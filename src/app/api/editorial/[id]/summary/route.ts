import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";
import { aiConfig } from "@/lib/ai-config";
import { writeSummary } from "@/lib/ai-tasks";

type Ctx = { params: Promise<{ id: string }> };

/** Takes what is in the editor's boxes now, saved or not. */
const schema = z.object({
  language: z.enum(["BN", "EN"]),
  title: z.string().trim().max(400).default(""),
  body: z.string().trim().min(1, "There is nothing written to summarise yet").max(200000),
});

/**
 * POST /api/editorial/:id/summary - the one-line summary for the feed, written
 * by the AI for an editor to check. It fills the box; the editor saves it.
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

    const dek = await writeSummary(parsed.data);
    return Response.json({ dek });
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.warn(`summary failed - ${detail}`);
    return Response.json({ error: `Could not write the summary. ${detail}` }, { status: 502 });
  }
}
