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

export const isStaff = (role: string) => role === "ADMIN" || role === "EDITOR";

/** Turns a thrown HttpError into a JSON response; anything else is a 500. */
export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
