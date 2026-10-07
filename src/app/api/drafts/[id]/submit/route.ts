import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/rbac";
import { bdMobile, normalisePhone } from "@/lib/profile";

const schema = z.object({
  contactPhone: z.string().trim().max(24).optional(),
  contactWhatsapp: z.string().trim().max(24).optional(),
  witnesses: z.string().trim().max(2000).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/drafts/:id/submit
 * Pushes a draft into the editorial queue. Verified or General makes no
 * difference here - every piece is reviewed before it can go live.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Check the contact number" }, { status: 422 });
    }

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) throw new HttpError(404, "Article not found");
    if (article.authorId !== user.id) throw new HttpError(403, "Not your article");
    if (article.status === "SUBMITTED") throw new HttpError(409, "Already submitted");
    if (article.status === "APPROVED") throw new HttpError(409, "Already published");
    if (!article.title.trim() || article.body.trim().length < 50) {
      throw new HttpError(422, "Add a title and at least 50 characters of copy before submitting");
    }

    // The desk needs a way to reach the writer about this specific piece. Fall
    // back to the number on their profile so they only type it once.
    const author = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true, whatsapp: true },
    });
    const phone = normalisePhone(parsed.data.contactPhone || article.contactPhone || author?.phone || "");
    const whatsapp = normalisePhone(
      parsed.data.contactWhatsapp || article.contactWhatsapp || author?.whatsapp || "",
    );

    // The desk asks a contributor for a number because it may need to chase
    // the story. It does not need to ask itself.
    const isStaff = user.role !== "CONTRIBUTOR";
    if (!phone && !isStaff) {
      throw new HttpError(
        422,
        "Add a contact number for this piece - the desk may need to call you about it",
      );
    }
    if (phone && !bdMobile.test(phone)) {
      throw new HttpError(422, "That contact number does not look right. Use 01XXXXXXXXX");
    }
    if (whatsapp && !bdMobile.test(whatsapp)) {
      throw new HttpError(422, "That WhatsApp number does not look right. Use 01XXXXXXXXX");
    }

    const resubmission = article.status === "REJECTED";
    const [updated] = await prisma.$transaction([
      prisma.article.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          contactPhone: phone || null,
          contactWhatsapp: whatsapp || null,
          ...(parsed.data.witnesses !== undefined
            ? { witnesses: parsed.data.witnesses.trim() || null }
            : {}),
        },
      }),
      // A contributor with no number on file gets this one saved, so the
      // newsroom always has a way to reach them.
      prisma.user.update({
        where: { id: user.id },
        data: {
          ...(author?.phone || !phone ? {} : { phone }),
          ...(author?.whatsapp || !whatsapp ? {} : { whatsapp }),
        },
      }),
      prisma.review.create({
        data: {
          articleId: id,
          editorId: null,
          action: resubmission ? "RESUBMITTED" : "SUBMITTED",
          fromStatus: article.status,
          toStatus: "SUBMITTED",
        },
      }),
    ]);
    return Response.json({ article: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
