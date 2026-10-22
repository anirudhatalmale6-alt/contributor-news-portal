import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAdmin } from "@/lib/rbac";
import { pageSchema, uniquePageSlug } from "@/lib/pages";
import { refreshPublicPages } from "@/lib/revalidate";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/pages/:id - save changes. The web address can be changed too. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "That page no longer exists");
    const parsed = pageSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Check the page");
    const d = parsed.data;
    if (!d.titleBn && !d.titleEn) throw new HttpError(422, "Give the page a title, in Bangla or English");
    const slug = d.slug && d.slug !== existing.slug ? await uniquePageSlug(d.slug, id) : existing.slug;
    const page = await prisma.page.update({ where: { id }, data: { ...d, slug } });
    await refreshPublicPages();
    return Response.json({ page });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/admin/pages/:id - removes the page and its footer link. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    await prisma.page.delete({ where: { id } }).catch(() => {
      throw new HttpError(404, "That page no longer exists");
    });
    await refreshPublicPages();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
