import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";
import { refreshPublicPages } from "@/lib/revalidate";
import { uniqueSlug } from "@/lib/settings";
import { formComplaint } from "@/lib/zod-message";

type Ctx = { params: Promise<{ id: string }> };

/**
 * An empty field arrives from the browser as "" and from older code as null.
 * Both mean the same thing to an editor, so neither should be able to fail the
 * form: they are folded into "" before any length rule looks at them.
 */
const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v.length <= max, { message: `Keep this under ${max} characters` })
    .optional();

const patchSchema = z.object({
  // Bangla headlines run long, and the desk occasionally files a two-clause
  // one. 180 characters was tighter than the newsroom actually needs.
  title: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v.length > 0, { message: "The headline cannot be empty" })
    .refine((v) => v.length <= 400, { message: "Keep the headline under 400 characters" })
    .optional(),
  dek: optionalText(800),
  body: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => v ?? "")
    .refine((v) => v.length <= 400_000, { message: "This article is too long to store" })
    .optional(),
  category: optionalText(60),
  coverImage: z.string().trim().max(500).nullable().optional(),
  bylineName: optionalText(120),
});

/** The field names an editor sees on the screen, for a readable complaint. */
const LABEL: Record<string, string> = {
  title: "Headline",
  dek: "Standfirst",
  body: "Article text",
  category: "Section",
  coverImage: "Cover image",
  bylineName: "Contributor name",
};

/** GET /api/editorial/:id - full article + audit trail, for the review screen. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, tier: true } },
        media: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { editor: { select: { name: true, role: true } } },
        },
      },
    });
    if (!article) throw new HttpError(404, "Article not found");
    return Response.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH /api/editorial/:id - an editor fine-tuning wording or media, any status. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Article not found");

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      // Name the field and say what is wrong with it. A bare "check the form"
      // leaves an editor pressing the same button and getting the same nothing.
      const issues = parsed.error.flatten().fieldErrors;
      const said = formComplaint(issues, LABEL);
      console.warn(`editorial PATCH ${id} rejected - ${said}`);
      return Response.json({ error: said || "Check the form", issues }, { status: 422 });
    }
    const data = parsed.data;

    const article = await prisma.article.update({
      where: { id },
      data: {
        ...data,
        reviewerId: staff.id,
        // A published piece keeps the address it was published at. Rewording a
        // live headline must not break the link a reader already shared.
        slug:
          data.title && data.title !== existing.title && existing.status !== "APPROVED"
            ? await uniqueSlug(data.title, id)
            : existing.slug,
      },
      include: { media: true },
    });
    refreshPublicPages();
    return Response.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}
