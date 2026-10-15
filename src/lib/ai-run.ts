import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiConfig } from "@/lib/ai-config";

/**
 * One request to whichever AI service the owner chose, with the answer held
 * to a JSON schema so the site never has to guess at free text.
 *
 * Every AI job on the site (translation, the feed summary, polishing) goes
 * through here, so a refusal, a cut-off or an empty answer is handled the same
 * way everywhere and always comes back as a sentence an editor can read.
 */

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: "string"; description?: string }>;
  required: string[];
  additionalProperties: false;
};

export async function runStructured<T extends Record<string, string>>(
  config: AiConfig,
  { name, system, prompt, schema }: { name: string; system: string; prompt: string; schema: JsonSchema },
): Promise<T> {
  const raw =
    config.provider === "OPENAI"
      ? await viaOpenAI(config, { name, system, prompt, schema })
      : await viaAnthropic(config, { system, prompt, schema });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("The AI answered in a form this site could not read. Try again.");
  }
  const out: Record<string, string> = {};
  for (const key of schema.required) out[key] = String(parsed[key] ?? "").trim();
  return out as T;
}

/** Claude: the Messages API. */
async function viaAnthropic(
  config: AiConfig,
  { system, prompt, schema }: { system: string; prompt: string; schema: JsonSchema },
): Promise<string> {
  const client = new Anthropic({ apiKey: config.key });
  const message = await client.messages.create({
    model: config.model,
    // Room for a long piece plus the model's own thinking, which shares this
    // budget. Well under the point where the request would need streaming.
    max_tokens: 16000,
    system,
    output_config: {
      // Newsroom jobs are well specified rather than puzzles, and the owner
      // pays for every token of thinking as well as the answer.
      effort: "low",
      format: { type: "json_schema", schema },
    },
    messages: [{ role: "user", content: prompt }],
  });

  // A safety classifier can decline; that is a 200 with no usable content, so
  // it has to be checked before the content is read.
  if (message.stop_reason === "refusal") {
    throw new Error("The AI declined this piece. Do this one by hand.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("This piece is too long for the AI in one go. Do it in sections.");
  }
  const text = message.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI came back empty");
  return text.text;
}

/** ChatGPT: the Responses API. */
async function viaOpenAI(
  config: AiConfig,
  { name, system, prompt, schema }: { name: string; system: string; prompt: string; schema: JsonSchema },
): Promise<string> {
  const client = new OpenAI({ apiKey: config.key });
  const response = await client.responses.create({
    model: config.model,
    instructions: system,
    input: prompt,
    reasoning: { effort: "low" },
    max_output_tokens: 16000,
    text: { format: { type: "json_schema", name, schema, strict: true } },
  });

  if (response.status === "incomplete") {
    if (response.incomplete_details?.reason === "max_output_tokens") {
      throw new Error("This piece is too long for the AI in one go. Do it in sections.");
    }
    throw new Error("The AI stopped part way. Try again, or do this one by hand.");
  }
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type === "refusal") throw new Error("The AI declined this piece. Do this one by hand.");
    }
  }
  if (!response.output_text) throw new Error("The AI came back empty");
  return response.output_text;
}
