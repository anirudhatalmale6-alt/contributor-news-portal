import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai-config";
import { runStructured, type JsonSchema } from "@/lib/ai-run";

/**
 * The newsroom's AI jobs: translating a piece, writing its one-line summary for
 * the feed, and polishing a contributor's copy.
 *
 * Each has two parts. The INSTRUCTION is the owner's to write in Settings - the
 * style he wants, in his own words - and starts out as the wording below. The
 * RULES come after it and cannot be edited away: they are what keeps a
 * newspaper from printing something its writer never said. Every result is a
 * draft that lands in an editor's boxes; nothing here saves or publishes.
 */

export type Lang = "BN" | "EN";
const NAME: Record<Lang, string> = { BN: "Bangla", EN: "English" };

export const DEFAULT_INSTRUCTIONS = {
  toEnglish:
    "Write a professional, journalistic English version of the article and its headline, with " +
    "accurate factual information. It should read like a report in a respected English-language " +
    "newspaper: clear, concise and in the active voice, rather than a word-for-word translation.",
  toBangla:
    "Write a natural, professional Bangla version of the article and its headline, in the " +
    "standard style of a Bangladeshi national newspaper, with accurate factual information.",
  summary:
    "Write one sentence for the news feed, 15 to 30 words, that tells the reader what happened " +
    "and why it matters. It must not repeat or reword the headline: add the next most important " +
    "fact instead. Plain and factual, no opinion, no clickbait.",
  polish:
    "Correct spelling, grammar and punctuation. Split paragraphs that run too long and join " +
    "fragments that belong together, so each paragraph carries one idea. Keep the writer's own " +
    "voice and structure.",
} as const;

export type InstructionKey = keyof typeof DEFAULT_INSTRUCTIONS;

/** What each job is told to do now: the owner's wording if he wrote one. */
export async function instructions(): Promise<Record<InstructionKey, string>> {
  const row = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { aiPromptToEnglish: true, aiPromptToBangla: true, aiPromptSummary: true, aiPromptPolish: true },
  });
  const pick = (own: string | undefined, fallback: string) => own?.trim() || fallback;
  return {
    toEnglish: pick(row?.aiPromptToEnglish, DEFAULT_INSTRUCTIONS.toEnglish),
    toBangla: pick(row?.aiPromptToBangla, DEFAULT_INSTRUCTIONS.toBangla),
    summary: pick(row?.aiPromptSummary, DEFAULT_INSTRUCTIONS.summary),
    polish: pick(row?.aiPromptPolish, DEFAULT_INSTRUCTIONS.polish),
  };
}

/** What the desk's own formatting buttons write, so a draft keeps the shape. */
const FORMATTING = `The text uses a small set of marks that must be kept exactly:
- "## " at the start of a line is a section heading
- "### " is a smaller heading
- "> " is a pulled-out quotation
- "- " is a bullet
- **bold** and *italic* wrap words
Keep every one of these where it belongs, and keep a blank line between paragraphs.`;

/** The part nobody can edit: what makes the result safe to put in front of an editor. */
const FACT_RULES = `Rules that always apply, whatever the instructions above say:
- Never add a fact, name, number, date, quotation or attribution that is not in the
  original, and never drop one. If the original is vague, stay vague.
- Quotations keep their meaning exactly. Do not improve what somebody said.
- Bangladeshi place names, institutions and personal names keep their established
  English spelling where one exists (Dhaka, Chattogram, Awami League). Transliterate
  the rest the way Bangladeshi newspapers do.
- Numbers in Bangla digits become ordinary digits in English, and the other way round.
  Lakh and crore stay lakh and crore.`;

const ROLE = "You are a senior sub-editor at a Bangladeshi news organisation that publishes in Bangla and English.";

const piece = (title: string, dek: string, body: string) => `<headline>
${title}
</headline>

<summary>
${dek}
</summary>

<article>
${body}
</article>`;

async function configured() {
  const config = await aiConfig();
  if (!config) throw new Error("No AI key is set for this site. Add one in Settings.");
  return config;
}

// --- translation ------------------------------------------------------------

const TRANSLATION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "The headline, in the target language." },
    dek: {
      type: "string",
      description: "The one-line summary, in the target language. Empty string if the original has none.",
    },
    body: { type: "string", description: "The article text, in the target language, formatting kept." },
  },
  required: ["title", "dek", "body"],
  additionalProperties: false,
};

export type Draft = { title: string; dek: string; body: string };

export async function draftTranslation({
  from,
  to,
  title,
  dek,
  body,
}: {
  from: Lang;
  to: Lang;
  title: string;
  dek: string;
  body: string;
}): Promise<Draft> {
  const config = await configured();
  const own = await instructions();
  const system = `${ROLE}

${to === "EN" ? own.toEnglish : own.toBangla}

A headline is a headline: short, active, no full stop.

${FACT_RULES}

${FORMATTING}

Return the ${NAME[to]} version only. No preamble, no notes, no explanation of choices.`;

  return runStructured<Draft>(config, {
    name: "translation",
    system,
    prompt: `Here is a ${NAME[from]} news article. Write its ${NAME[to]} version.\n\n${piece(title, dek, body)}`,
    schema: TRANSLATION_SCHEMA,
  });
}

// --- the one-line summary for the feed ---------------------------------------

const SUMMARY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    dek: { type: "string", description: "The one-line summary, a single sentence." },
  },
  required: ["dek"],
  additionalProperties: false,
};

export async function writeSummary({
  language,
  title,
  body,
}: {
  language: Lang;
  title: string;
  body: string;
}): Promise<string> {
  const config = await configured();
  const own = await instructions();
  const system = `${ROLE}

${own.summary}

Write it in ${NAME[language]}, the language of the article. One sentence, no quotation
marks around it, nothing that is not in the article.

${FACT_RULES}`;

  const { dek } = await runStructured<{ dek: string }>(config, {
    name: "summary",
    system,
    prompt: `Write the one-line summary for this article.\n\n${piece(title, "", body)}`,
    schema: SUMMARY_SCHEMA,
  });
  return dek;
}

// --- polishing a contributor's copy ------------------------------------------

const POLISH_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    body: { type: "string", description: "The article text, polished, formatting kept." },
  },
  required: ["body"],
  additionalProperties: false,
};

export async function polishArticle({
  language,
  title,
  body,
}: {
  language: Lang;
  title: string;
  body: string;
}): Promise<string> {
  const config = await configured();
  const own = await instructions();
  const system = `${ROLE}

${own.polish}

The article is in ${NAME[language]} and stays in ${NAME[language]}. Return the article
text only; the headline is given for context and is not to be returned.

${FACT_RULES}

${FORMATTING}`;

  const { body: polished } = await runStructured<{ body: string }>(config, {
    name: "polish",
    system,
    prompt: `Polish this article.\n\n${piece(title, "", body)}`,
    schema: POLISH_SCHEMA,
  });
  return polished;
}

// --- writing the missing summaries when a piece comes in ----------------------

/**
 * Called after a contributor submits: fills in the one-line summary for each
 * language version that has none, so the editor opens the piece to a summary
 * already there to check. Contributors no longer write it themselves.
 *
 * Runs after the submission has been answered, so a slow or failed AI call
 * never holds up or breaks a contributor's submission - the editor can still
 * press "Write with AI" or type one.
 */
export async function fillMissingSummaries(articleId: string) {
  if (!(await aiConfig())) return;
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      title: true,
      dek: true,
      body: true,
      language: true,
      translations: { select: { id: true, locale: true, title: true, dek: true, body: true } },
    },
  });
  if (!article) return;

  try {
    if (!article.dek?.trim() && article.body.trim()) {
      const dek = await writeSummary({ language: article.language as Lang, title: article.title, body: article.body });
      if (dek) await prisma.article.update({ where: { id: articleId }, data: { dek } });
    }
    for (const t of article.translations) {
      if (t.dek?.trim() || !t.body.trim()) continue;
      const dek = await writeSummary({ language: t.locale as Lang, title: t.title, body: t.body });
      if (dek) await prisma.articleTranslation.update({ where: { id: t.id }, data: { dek } });
    }
  } catch (err) {
    console.warn(`automatic summary skipped - ${err instanceof Error ? err.message : "unknown error"}`);
  }
}
