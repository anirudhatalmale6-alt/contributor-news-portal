import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role, User } from "@prisma/client";

export type SessionUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "tier" | "image"
>;

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, tier: true, image: true },
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Throws 401 when nobody is signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in required");
  return user;
}

/** Throws 403 unless the signed-in user holds one of `roles`. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new HttpError(403, "Insufficient permissions");
  return user;
}

/**
 * Who can do what.
 *
 * SUPERADMIN  the owner: design, wording, advertising, money settings, payout
 *             details, and any role change.
 * ADMIN       runs the newsroom: everything editorial, plus turning a
 *             contributor into an editor. No design or money settings.
 * EDITOR      the queue, the copy, the media, the payouts on a piece, and can
 *             also turn a contributor into an editor.
 * CONTRIBUTOR writes.
 */
export const isStaff = (role: string) =>
  role === "SUPERADMIN" || role === "ADMIN" || role === "EDITOR";

/** The owner's seat: site design, payment settings and the real account numbers. */
export const isOwner = (role: string) => role === "SUPERADMIN";

/** Everything below the owner, in order, so one place decides seniority. */
const RANK: Record<string, number> = { CONTRIBUTOR: 0, EDITOR: 1, ADMIN: 2, SUPERADMIN: 3 };

/**
 * Can `actor` move `target` to `nextRole`?
 *
 * The owner can do anything. Everyone else may only act on someone junior to
 * them, and may grant a rank up to their own but never above it - so an editor
 * can make a contributor an editor, which is the point, but cannot demote a
 * fellow editor, create an admin, or touch the owner.
 */
export function canChangeRole(actorRole: string, targetRole: string, nextRole: string) {
  if (actorRole === "SUPERADMIN") return true;
  if (!isStaff(actorRole)) return false;
  const actor = RANK[actorRole] ?? 0;
  return (
    (RANK[targetRole] ?? 0) < actor &&
    (RANK[nextRole] ?? 0) <= actor &&
    nextRole !== "SUPERADMIN"
  );
}

/** Throws 403 unless the signed-in user is the owner. */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isOwner(user.role)) {
    throw new HttpError(403, "Only the site owner can change this");
  }
  return user;
}

/** Throws 403 unless the signed-in user is staff of any kind. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) throw new HttpError(403, "Insufficient permissions");
  return user;
}

/** Turns a thrown HttpError into a JSON response; anything else is a 500. */
export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
