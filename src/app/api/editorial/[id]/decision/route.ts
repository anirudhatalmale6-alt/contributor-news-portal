import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireRole } from "@/lib/rbac";
import { paymentSettings } from "@/lib/settings";
import { other } from "@/lib/i18n";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(2000).optional(),
  // Estimated payout in cents. Required on approval so no piece goes live
  // without a figure the writer can see on their dashboard.
  payoutCents: z.coerce.number().int().min(0).max(100_000_00).optional(),
});

/**
 * POST /api/editorial/:id/decision
 * Approve (publish + set the estimated payout) or reject with a note.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const staff = await requireRole("EDITOR", "ADMIN");
    const { id } = await params;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the form", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const { decision, note, payoutCents } = parsed.data;

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Article not found");
    if (existing.status === "DRAFT") {
      throw new HttpError(409, "This piece has not been submitted yet");
    }
    if (decision === "REJECT" && !note?.trim()) {
      throw new HttpError(422, "A rejection needs a note so the writer knows what to fix");
    }
    if (decision === "APPROVE" && payoutCents === undefined) {
      throw new HttpError(422, "Set the estimated payout before approving");
    }

    // The site runs in two languages, so a piece is only publishable once the
    // editor's translation exists. An Admin can relax this in settings.
    if (decision === "APPROVE") {
      const settings = await paymentSettings();
      if (settings.requireTranslation) {
        const needed = other(existing.language);
        const translation = await prisma.articleTranslation.findUnique({
          where: { articleId_locale: { articleId: id, locale: needed } },
        });
        if (!translation) {
          throw new HttpError(
            422,
            `Add the ${needed === "BN" ? "Bangla" : "English"} version before publishing - readers on the other half of the site would see nothing`,
          );
        }
      }
    }

    const toStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const [article] = await prisma.$transaction([
      prisma.article.update({
        where: { id },
        data: {
          status: toStatus,
          reviewerId: staff.id,
          payoutCents: decision === "APPROVE" ? payoutCents! : existing.payoutCents,
          publishedAt:
            decision === "APPROVE" ? (existing.publishedAt ?? new Date()) : null,
        },
      }),
      prisma.review.create({
        data: {
          articleId: id,
          editorId: staff.id,
          action: toStatus,
          note: note ?? null,
          fromStatus: existing.status,
          toStatus,
        },
      }),
    ]);
    return Response.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}
