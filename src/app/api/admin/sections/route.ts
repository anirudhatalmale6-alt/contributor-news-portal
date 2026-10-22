import { z } from "zod";
import { errorResponse, HttpError, requireAdmin } from "@/lib/rbac";
import { addSection, updateSections } from "@/lib/section-store";
import { refreshPublicPages } from "@/lib/revalidate";

const row = z.object({
  key: z.string().min(1).max(60),
  slug: z.string().trim().toLowerCase().max(60),
  position: z.coerce.number().int().min(0).max(999),
  inMenu: z.boolean(),
  en: z.string().trim().max(60),
  bn: z.string().trim().max(60),
});

/** PUT /api/admin/sections - names, addresses, order and menu, all at once. */
export async function PUT(req: Request) {
  try {
    await requireAdmin();
    const parsed = z.object({ sections: z.array(row).min(1).max(100) }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Check the sections");
    await updateSections(parsed.data.sections);
    await refreshPublicPages();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/admin/sections - a new section, added to the menu just before General. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const parsed = z
      .object({ en: z.string().trim().max(60), bn: z.string().trim().max(60), slug: z.string().trim().toLowerCase().max(60).optional() })
      .safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Give the section a name in both languages");
    const key = await addSection(parsed.data);
    await refreshPublicPages();
    return Response.json({ key }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
