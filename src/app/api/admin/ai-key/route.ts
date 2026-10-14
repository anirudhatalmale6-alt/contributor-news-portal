import { z } from "zod";
import { errorResponse, HttpError, requireOwner } from "@/lib/rbac";
import {
  aiKeySummary,
  clearAiKey,
  keyLooksRight,
  keyWorks,
  PROVIDER_LABEL,
  saveAiKey,
} from "@/lib/ai-config";

const schema = z.object({
  provider: z.enum(["OPENAI", "ANTHROPIC"]),
  key: z.string().trim().min(20, "That is too short to be a key").max(400),
});

/**
 * PUT /api/admin/ai-key - the owner pastes in his AI key.
 *
 * Checked with the service before it is kept, using a call that costs
 * nothing, so a mistyped key is caught here and not when an editor presses
 * the translate button at deadline. Owner only. The key is never returned:
 * the answer carries the last four characters and nothing else.
 */
export async function PUT(req: Request) {
  try {
    await requireOwner();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(422, parsed.error.issues[0]?.message ?? "Choose a service and paste the key");
    }
    const { provider, key } = parsed.data;

    if (!keyLooksRight(provider, key)) {
      throw new HttpError(
        422,
        provider === "OPENAI"
          ? "That does not look like an OpenAI key. They start with sk- and come from platform.openai.com."
          : "That does not look like an Anthropic key. They start with sk-ant- and come from console.anthropic.com.",
      );
    }

    const check = await keyWorks(provider, key);
    if (!check.ok) throw new HttpError(422, check.reason ?? "The key did not work");

    await saveAiKey(provider, key);
    return Response.json({
      ok: true,
      message: `Saved. ${PROVIDER_LABEL[provider]} accepted the key ending in ${key.slice(-4)}.`,
      summary: await aiKeySummary(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/admin/ai-key - takes the key out. The AI buttons disappear with it. */
export async function DELETE() {
  try {
    await requireOwner();
    await clearAiKey();
    return Response.json({ ok: true, summary: await aiKeySummary() });
  } catch (err) {
    return errorResponse(err);
  }
}
