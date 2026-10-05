import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/rbac";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

/** POST /api/register - email + password signup. New accounts are General Contributors. */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the form", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const { name, email, password } = parsed.data;

    if (await prisma.user.findUnique({ where: { email } })) {
      return Response.json({ error: "That email already has an account" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 11) },
      select: { id: true, name: true, email: true, role: true, tier: true },
    });
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
