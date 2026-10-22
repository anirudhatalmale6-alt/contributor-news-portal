import { errorResponse, requireAdmin } from "@/lib/rbac";
import { deleteSection } from "@/lib/section-store";
import { refreshPublicPages } from "@/lib/revalidate";

type Ctx = { params: Promise<{ key: string }> };

/** DELETE /api/admin/sections/:key?moveTo=Other - moves its articles, then removes it. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { key } = await params;
    const moveTo = new URL(req.url).searchParams.get("moveTo");
    const moved = await deleteSection(key, moveTo);
    await refreshPublicPages();
    return Response.json({ ok: true, moved });
  } catch (err) {
    return errorResponse(err);
  }
}
