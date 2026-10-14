import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Sealing a secret before it goes into the database.
 *
 * Used for the owner's AI key. A copy of the database on its own - a backup
 * left somewhere, a dump sent for debugging - should not hand somebody a key
 * that spends his money. The seal is AES-256-GCM, keyed from the site's own
 * AUTH_SECRET, which lives in the server's environment and not in the
 * database, so the two have to be stolen together to be any use.
 *
 * If AUTH_SECRET is ever changed, what was sealed under the old one simply
 * fails to open, and the caller treats the key as not set. That is the right
 * failure: the owner pastes it in again, rather than the site using garbage.
 */

const secretKey = () => {
  const base = process.env.AUTH_SECRET;
  if (!base) throw new Error("AUTH_SECRET is not set on the server");
  // A separate key for this purpose, so it is not the one that signs sessions.
  return createHash("sha256").update(`${base}:ai-key:v1`).digest();
};

/** "iv.tag.ciphertext", all base64url. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, body].map((b) => b.toString("base64url")).join(".");
}

/** The original text, or null if it was sealed under a different secret or tampered with. */
export function open(sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    if (!iv?.length || !tag?.length || !body) return null;
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
