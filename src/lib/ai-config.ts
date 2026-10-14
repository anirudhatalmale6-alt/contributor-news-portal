import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { open, seal } from "@/lib/secret-box";

/**
 * Which AI service the site uses, and with whose key.
 *
 * Always the owner's key. He chooses the service and pastes the key in
 * Settings; it is stored sealed and never sent back to a browser. A key set in
 * the server's environment still works as a fallback, for the case where he
 * would rather it never touched the database at all.
 */

export type AiProvider = "OPENAI" | "ANTHROPIC";

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  OPENAI: "ChatGPT (OpenAI)",
  ANTHROPIC: "Claude (Anthropic)",
};

/** Which model each service is asked for. Overridable on the server without a release. */
export const MODEL: Record<AiProvider, string> = {
  OPENAI: process.env.AI_MODEL_OPENAI || "gpt-6.1-sol",
  ANTHROPIC: process.env.AI_TRANSLATION_MODEL || "claude-opus-5",
};

export type AiConfig = { provider: AiProvider; key: string; model: string; source: "settings" | "server" };

export async function aiConfig(): Promise<AiConfig | null> {
  const row = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { aiProvider: true, aiKeyCipher: true },
  });
  if (row && (row.aiProvider === "OPENAI" || row.aiProvider === "ANTHROPIC") && row.aiKeyCipher) {
    const key = open(row.aiKeyCipher);
    if (key) return { provider: row.aiProvider, key, model: MODEL[row.aiProvider], source: "settings" };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: "OPENAI", key: process.env.OPENAI_API_KEY, model: MODEL.OPENAI, source: "server" };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "ANTHROPIC", key: process.env.ANTHROPIC_API_KEY, model: MODEL.ANTHROPIC, source: "server" };
  }
  return null;
}

/** What Settings may show about the key: the service, and the last four characters. */
export async function aiKeySummary() {
  const row = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { aiProvider: true, aiKeyCipher: true, aiKeyHint: true },
  });
  const inSettings =
    row && row.aiKeyCipher && (row.aiProvider === "OPENAI" || row.aiProvider === "ANTHROPIC")
      ? { provider: row.aiProvider as AiProvider, hint: row.aiKeyHint, readable: open(row.aiKeyCipher) !== null }
      : null;
  const onServer = process.env.OPENAI_API_KEY
    ? ("OPENAI" as const)
    : process.env.ANTHROPIC_API_KEY
      ? ("ANTHROPIC" as const)
      : null;
  return { inSettings, onServer };
}

/** The shape each service's keys have. Catches a key pasted into the wrong box. */
export function keyLooksRight(provider: AiProvider, key: string) {
  if (provider === "ANTHROPIC") return key.startsWith("sk-ant-");
  return key.startsWith("sk-") && !key.startsWith("sk-ant-");
}

/**
 * Asks the service whether it accepts the key, using the free "list models"
 * call - checking a key must never cost the owner anything.
 */
export async function keyWorks(provider: AiProvider, key: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (provider === "OPENAI") {
      await new OpenAI({ apiKey: key }).models.list();
    } else {
      await new Anthropic({ apiKey: key }).models.list({ limit: 1 });
    }
    return { ok: true };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401) return { ok: false, reason: "The service says this key is not valid." };
    if (status === 403) return { ok: false, reason: "The service accepted the key but says it is not allowed to be used." };
    const detail = err instanceof Error ? err.message : "unknown error";
    return { ok: false, reason: `Could not reach the service to check the key (${detail}).` };
  }
}

export async function saveAiKey(provider: AiProvider, key: string) {
  await prisma.siteSettings.update({
    where: { id: 1 },
    data: { aiProvider: provider, aiKeyCipher: seal(key), aiKeyHint: key.slice(-4) },
  });
}

export async function clearAiKey() {
  await prisma.siteSettings.update({
    where: { id: 1 },
    data: { aiProvider: "", aiKeyCipher: "", aiKeyHint: "" },
  });
}
