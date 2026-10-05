import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, requireRole } from "@/lib/rbac";
import { paymentSettings } from "@/lib/settings";

const schema = z.object({
  currency: z.string().trim().length(3).toUpperCase().optional(),
  defaultPayout: z.coerce.number().int().min(0).max(100_000_00).optional(),
  verifiedBonusPct: z.coerce.number().int().min(0).max(500).optional(),
  payoutNote: z.string().trim().max(400).optional(),
  requireTranslation: z.boolean().optional(),
});

/** GET /api/admin/settings - payment settings (Editors read, Admin writes). */
export async function GET() {
  try {
    await requireRole("ADMIN", "EDITOR");
    return Response.json({ settings: await paymentSettings() });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH /api/admin/settings */
export async function PATCH(req: Request) {
  try {
    await requireRole("ADMIN");
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the form", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const settings = await prisma.paymentSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...parsed.data },
      update: parsed.data,
    });
    return Response.json({ settings });
  } catch (err) {
    return errorResponse(err);
  }
}
