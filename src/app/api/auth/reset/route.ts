import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError } from "@/lib/rbac";
import { burnToken, userForToken } from "@/lib/password-reset";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Use at least 8 characters"),
});

/** POST /api/auth/reset - set the new password, and spend the link. */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? "Check the form";
      throw new HttpError(422, issue);
    }

    const found = await userForToken(parsed.data.token);
    if (!found) {
      throw new HttpError(
        410,
        "That link has been used already or has expired. Ask for a new one.",
      );
    }

    // Both in one transaction: a new password that leaves the link alive would
    // let anyone holding the old email set another one.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: found.user.id },
        data: { passwordHash: await bcrypt.hash(parsed.data.password, 11) },
      }),
      burnToken(found.reset.id),
    ]);

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
