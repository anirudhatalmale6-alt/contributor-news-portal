import { prisma } from "@/lib/prisma";
import { setTextOverrides } from "@/lib/ui-text";

/**
 * Keeps the running wording in step with the database.
 *
 * `t()` is called from deep inside components that are not async, so the words
 * cannot be fetched at the point of use. Instead the root layout primes this
 * before it renders anything, which is early enough for every page below it.
 * The wording is the same for every visitor, so one process-wide copy is right.
 *
 * Server side only - it imports the database client. Anything the browser needs
 * lives in ui-text.ts, which deliberately imports nothing.
 */

let loadedAt = 0;
let inFlight: Promise<void> | null = null;

/** Long enough that a busy page does not query on every render, short enough
    that another process editing the wording catches up on its own. */
const MAX_AGE_MS = 30_000;

async function load() {
  const rows = await prisma.uiText.findMany({ select: { key: true, locale: true, value: true } });
  setTextOverrides(
    Object.fromEntries(rows.map((r) => [`${r.locale}:${r.key}`, r.value])),
  );
  loadedAt = Date.now();
}

export async function primeUiText(force = false) {
  if (!force && Date.now() - loadedAt < MAX_AGE_MS) return;
  // Concurrent renders share one query rather than each firing their own.
  inFlight ??= load().finally(() => {
    inFlight = null;
  });
  try {
    await inFlight;
  } catch {
    // A database hiccup must not take the site down: the shipped wording is a
    // perfectly good fallback, and the next render tries again.
    loadedAt = 0;
  }
}

/** Saves one line, or clears it back to the shipped wording when empty. */
export async function saveUiText(entries: { key: string; locale: string; value: string }[]) {
  const writes = entries.map((e) =>
    e.value.trim()
      ? prisma.uiText.upsert({
          where: { key_locale: { key: e.key, locale: e.locale } },
          create: { key: e.key, locale: e.locale, value: e.value.trim() },
          update: { value: e.value.trim() },
        })
      : prisma.uiText.deleteMany({ where: { key: e.key, locale: e.locale } }),
  );
  await prisma.$transaction(writes);
  await primeUiText(true);
}
