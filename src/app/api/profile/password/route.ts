import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/rbac";

const schema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8).max(200),
});

/**
 * POST /api/profile/password
 *
 * Anyone can change their own password, including the Admin - otherwise the
 * owner is stuck with whatever password was set for them at deploy time.
 * An account created through Google or Facebook has no password yet, so it can
 * set one without proving an old one; everyone else must type the current one.
 */
export async function POST(req: Request) {
  try {
    const session = await requireUser();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Use at least 8 characters", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new HttpError(404, "Account not found");

    if (user.passwordHash) {
      if (!currentPassword) throw new HttpError(422, "Enter your current password");
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        throw new HttpError(403, "That is not your current password");
      }
      if (await bcrypt.compare(newPassword, user.passwordHash)) {
        throw new HttpError(422, "The new password is the same as the old one");
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 11) },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
