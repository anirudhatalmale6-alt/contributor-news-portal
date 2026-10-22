import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAdmin } from "@/lib/rbac";
import { pageSchema, uniquePageSlug } from "@/lib/pages";
import { refreshPublicPages } from "@/lib/revalidate";


/** GET /api/admin/pages - every page, published or not. Admins only. */
export async function GET() {
  try {
    await requireAdmin();
    const pages = await prisma.page.findMany({ orderBy: [{ footerOrder: "asc" }, { createdAt: "asc" }] });
    return Response.json({ pages });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/admin/pages - a new page. Needs a title in at least one language. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const parsed = pageSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Check the page");
    const d = parsed.data;
    if (!d.titleBn && !d.titleEn) throw new HttpError(422, "Give the page a title, in Bangla or English");
    const slug = await uniquePageSlug(d.slug || d.titleEn || d.titleBn);
    const page = await prisma.page.create({ data: { ...d, slug } });
    await refreshPublicPages();
    return Response.json({ page }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
