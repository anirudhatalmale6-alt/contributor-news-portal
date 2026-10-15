import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireOwner } from "@/lib/rbac";
import { DEFAULT_INSTRUCTIONS } from "@/lib/ai-tasks";

const text = z.string().trim().max(4000);
const schema = z.object({
  toEnglish: text,
  toBangla: text,
  summary: text,
  polish: text,
});

/**
 * PUT /api/admin/ai-instructions - the owner's own wording for each AI job.
 *
 * Wording identical to the shipped text is stored as empty, meaning "use the
 * shipped text", so a later improvement to it still reaches him. The rules that
 * keep the facts straight are not part of this and cannot be removed here.
 */
export async function PUT(req: Request) {
  try {
    await requireOwner();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Each instruction can be up to 4,000 characters");
    const own = (value: string, shipped: string) => (value === shipped ? "" : value);
    const d = parsed.data;
    await prisma.siteSettings.update({
      where: { id: 1 },
      data: {
        aiPromptToEnglish: own(d.toEnglish, DEFAULT_INSTRUCTIONS.toEnglish),
        aiPromptToBangla: own(d.toBangla, DEFAULT_INSTRUCTIONS.toBangla),
        aiPromptSummary: own(d.summary, DEFAULT_INSTRUCTIONS.summary),
        aiPromptPolish: own(d.polish, DEFAULT_INSTRUCTIONS.polish),
      },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
