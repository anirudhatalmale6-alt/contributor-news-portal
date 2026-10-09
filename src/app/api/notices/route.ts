import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAdmin } from "@/lib/rbac";
import { refreshPublicPages } from "@/lib/revalidate";

const schema = z.object({
  body: z.string().trim().min(3, "Write the notice").max(2000),
  /** Left out means everybody. */
  userId: z.string().trim().min(1).optional(),
});

/** POST /api/notices - put a message on a contributor's dashboard, or everyone's. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(422, parsed.error.issues[0]?.message ?? "Check the notice");
    }

    if (parsed.data.userId) {
      const exists = await prisma.user.findUnique({
        where: { id: parsed.data.userId },
        select: { id: true },
      });
      if (!exists) throw new HttpError(404, "That person no longer has an account");
    }

    const notice = await prisma.notice.create({
      data: {
        body: parsed.data.body,
        userId: parsed.data.userId ?? null,
        writtenById: admin.id,
      },
    });
    refreshPublicPages();
    return Response.json({ notice }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
