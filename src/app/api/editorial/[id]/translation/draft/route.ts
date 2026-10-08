import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";
import { aiTranslationReady, draftTranslation } from "@/lib/translate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/editorial/:id/translation/draft
 *
 * Writes a first draft of the other-language version and hands it back to the
 * screen. It saves nothing and publishes nothing: an editor reads the draft,
 * changes what they want, and presses Save themselves. That separation is the
 * whole point - a translation nobody read is not something a newspaper prints.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;

    if (!aiTranslationReady()) {
      throw new HttpError(503, "Automatic translation is not switched on for this site");
    }

    const article = await prisma.article.findUnique({
      where: { id },
      select: { title: true, dek: true, body: true, language: true },
    });
    if (!article) throw new HttpError(404, "Article not found");
    if (!article.body.trim()) throw new HttpError(422, "There is nothing written to translate yet");

    const from = article.language === "BN" ? "BN" : "EN";
    const draft = await draftTranslation({
      from,
      to: from === "BN" ? "EN" : "BN",
      title: article.title,
      dek: article.dek ?? "",
      body: article.body,
    });

    return Response.json({ draft });
  } catch (err) {
    // A failure here is somebody waiting at a screen, so say what happened
    // rather than letting a provider error become a bare 500.
    if (err instanceof HttpError) return errorResponse(err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.warn(`translation draft failed - ${detail}`);
    return Response.json({ error: `Could not draft the translation. ${detail}` }, { status: 502 });
  }
}
