import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";
import { aiConfig } from "@/lib/ai-config";
import { polishArticle } from "@/lib/ai-tasks";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  language: z.enum(["BN", "EN"]),
  title: z.string().trim().max(400).default(""),
  body: z.string().trim().min(1, "There is nothing written to polish yet").max(200000),
});

/**
 * POST /api/editorial/:id/polish - a tidied version of the article text for an
 * editor to read. Nothing is saved: it replaces what is in the box, and the
 * editor decides whether to keep it.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;
    if (!(await aiConfig())) throw new HttpError(503, "The AI is not switched on for this site");

    const article = await prisma.article.findUnique({ where: { id }, select: { id: true } });
    if (!article) throw new HttpError(404, "Article not found");

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Check the article");

    const body = await polishArticle(parsed.data);
    return Response.json({ body });
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.warn(`polish failed - ${detail}`);
    return Response.json({ error: `Could not polish the article. ${detail}` }, { status: 502 });
  }
}
