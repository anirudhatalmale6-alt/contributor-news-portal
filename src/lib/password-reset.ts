import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * One-time password reset links.
 *
 * The token is random, handed out once, and only its SHA-256 lives in the
 * database. A stolen copy of the table is therefore worth nothing: you cannot
 * turn a hash back into a working link.
 */

const HOUR = 60 * 60 * 1000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Makes a link for this person and returns it. The caller decides how it travels. */
export async function createResetLink(userId: string, baseUrl: string) {
  // Anything outstanding is dead the moment a new one is made, so a forwarded
  // old email cannot be used after a fresh request.
  await prisma.passwordReset.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + HOUR),
    },
  });

  return `${baseUrl.replace(/\/$/, "")}/reset?token=${token}`;
}

/** The person a live token belongs to, or null if it is spent, stale or fake. */
export async function userForToken(token: string) {
  if (!token) return null;
  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, suspendedAt: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  // A suspended account cannot be reset back into use.
  if (row.user.suspendedAt) return null;
  return { reset: row, user: row.user };
}

/** Marks the token spent. Call this in the same transaction as the new password. */
export const burnToken = (id: string) =>
  prisma.passwordReset.update({ where: { id }, data: { usedAt: new Date() } });
