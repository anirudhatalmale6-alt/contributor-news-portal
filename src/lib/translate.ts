import Anthropic from "@anthropic-ai/sdk";

/**
 * A first draft of the other-language version, written by Claude.
 *
 * Deliberately a DRAFT and nothing else: it fills the translation boxes on the
 * review screen and an editor still has to read it and press Save. Nothing here
 * publishes, and nothing here touches the original. A newsroom putting a
 * machine translation straight in front of readers is how a paper prints
 * something it never said.
 *
 * The key is the owner's, read from the environment on his own server. If it is
 * not set the feature is simply off - the button does not appear - rather than
 * failing at the moment an editor presses it.
 */

export const AI_MODEL = process.env.AI_TRANSLATION_MODEL || "claude-opus-5";

export const aiTranslationReady = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type Draft = { title: string; dek: string; body: string };

/** What the desk's own formatting buttons write, so the draft keeps the shape. */
const FORMATTING = `The text uses a small set of marks that must be preserved exactly:
- "## " at the start of a line is a section heading
- "### " is a smaller heading
- "> " is a pulled-out quotation
- "- " is a bullet
- **bold** and *italic* wrap words
Keep every one of these in the same place in the translation. Keep the paragraph
breaks (a blank line between paragraphs) exactly as they are in the original.`;

const SYSTEM = `You are a bilingual sub-editor at a Bangladeshi news organisation,
translating between Bangla and English for publication.

Translate as a newspaper translates: accurate first, then readable. Specifically:
- Never add a fact, a name, a number, a date or an attribution that is not in the
  original, and never drop one. If the original is vague, the translation is vague.
- Keep the register of the original. A news report stays a news report; an opinion
  piece keeps its voice.
- Bangladeshi place names, institutions and personal names keep their established
  English spelling where one exists (Dhaka, Chattogram, Jamuna, Awami League,
  Bangladesh Nationalist Party). Transliterate the rest the way Bangladeshi English
  papers do.
- Numbers written in Bangla digits become ordinary digits in English. Lakh and
  crore are kept as lakh and crore, not converted.
- A headline is a headline: short, active, no full stop.
- Translate quotations faithfully. Do not improve what somebody said.

${FORMATTING}

Return the translation only. No preamble, no notes, no explanation of choices.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string", description: "The headline, translated." },
    dek: {
      type: "string",
      description: "The one-line summary, translated. Empty string if the original has none.",
    },
    body: { type: "string", description: "The article text, translated, with its formatting kept." },
  },
  required: ["title", "dek", "body"],
  additionalProperties: false,
};

/**
 * Asks for a translation and returns it. Throws with a message an editor can
 * read: this is called from a route that puts the text on their screen.
 */
export async function draftTranslation({
  from,
  to,
  title,
  dek,
  body,
}: {
  from: "BN" | "EN";
  to: "BN" | "EN";
  title: string;
  dek: string;
  body: string;
}): Promise<Draft> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("No translation key is configured on the server");

  const client = new Anthropic({ apiKey: key });
  const source = from === "BN" ? "Bangla" : "English";
  const target = to === "BN" ? "Bangla" : "English";

  const message = await client.messages.create({
    model: AI_MODEL,
    // Room for a long piece plus the model's own thinking, which shares this
    // budget. Well under the point where the request would need streaming.
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      // Translation is a well-specified job rather than a reasoning problem,
      // so it does not need to be pondered at length - and the owner pays for
      // every token either way.
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Translate this ${source} news article into ${target}.

<headline>
${title}
</headline>

<summary>
${dek}
</summary>

<article>
${body}
</article>`,
      },
    ],
  });

  // A safety classifier can decline; that is a 200 with no usable content, so
  // it has to be checked before the content is read.
  if (message.stop_reason === "refusal") {
    throw new Error(
      "The translation service declined this piece. Write the other version by hand.",
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("This piece is too long to translate in one go. Translate it in sections.");
  }

  const text = message.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("The translation came back empty");

  let parsed: Partial<Draft>;
  try {
    parsed = JSON.parse(text.text) as Partial<Draft>;
  } catch {
    throw new Error("The translation came back in a form this site could not read");
  }

  return {
    title: String(parsed.title ?? "").trim(),
    dek: String(parsed.dek ?? "").trim(),
    body: String(parsed.body ?? "").trim(),
  };
}
