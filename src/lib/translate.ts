import { aiConfig } from "@/lib/ai-config";

/**
 * A first draft of the other-language version, for an editor to read, change
 * and save. The work itself is in ai-tasks.ts with the other AI jobs; this
 * module keeps the names the translation screens already use.
 *
 * If no key is set the feature is simply off - the button does not appear -
 * rather than failing at the moment an editor presses it.
 */
export const aiTranslationReady = async () => Boolean(await aiConfig());

export { draftTranslation, type Draft } from "@/lib/ai-tasks";
