import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, requireOwner, requireStaff } from "@/lib/rbac";
import { siteSettings } from "@/lib/settings";

const schema = z.object({
  siteNameEn: z.string().trim().min(1).max(80).optional(),
  siteNameBn: z.string().trim().min(1).max(80).optional(),
  taglineEn: z.string().trim().max(200).optional(),
  taglineBn: z.string().trim().max(200).optional(),
  footerEn: z.string().trim().max(300).optional(),
  footerBn: z.string().trim().max(300).optional(),
  logoUrl: z.string().trim().max(500).nullable().optional(),
  adsEnabled: z.boolean().optional(),
  adHomeHtml: z.string().max(4000).optional(),
  adBannerHtml: z.string().max(4000).optional(),
  adSquareHtml: z.string().max(4000).optional(),
  adArticleHtml: z.string().max(4000).optional(),
  adSectionHtml: z.string().max(4000).optional(),
  banglaFont: z.enum(["hind-siliguri", "anek-bangla", "tiro-bangla", "noto-serif-bengali"]).optional(),
});

/** GET /api/admin/site - the wording, masthead and ad slots (ADMIN, EDITOR). */
export async function GET() {
  try {
    await requireStaff();
    return Response.json({ settings: await siteSettings() });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH /api/admin/site - ADMIN only. */
export async function PATCH(req: Request) {
  try {
    await requireOwner();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the form", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const settings = await prisma.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...parsed.data },
      update: parsed.data,
    });
    return Response.json({ settings });
  } catch (err) {
    return errorResponse(err);
  }
}
