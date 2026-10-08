import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, requireUser } from "@/lib/rbac";
import { uniqueSlug } from "@/lib/settings";

const createSchema = z.object({
  title: z.string().trim().min(1).max(400).default("Untitled draft"),
  dek: z.string().trim().max(800).optional(),
  body: z.string().max(200_000).default(""),
  category: z.string().trim().max(60).default("General"),
  coverImage: z.string().trim().max(500).optional(),
  language: z.enum(["EN", "BN"]).default("BN"),
});

/** GET /api/drafts - every article belonging to the signed-in contributor. */
export async function GET() {
  try {
    const user = await requireUser();
    const articles = await prisma.article.findMany({
      where: { authorId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        media: true,
        reviews: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return Response.json({ articles });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/drafts - start a new draft. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json(
        { error: "Check the form", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const data = parsed.data;
    const article = await prisma.article.create({
      data: {
        title: data.title,
        dek: data.dek ?? null,
        body: data.body,
        category: data.category,
        coverImage: data.coverImage ?? null,
        language: data.language,
        slug: await uniqueSlug(data.title),
        authorId: user.id,
        status: "DRAFT",
      },
    });
    return Response.json({ article }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
