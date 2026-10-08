import { prisma } from "@/lib/prisma";
import { HttpError, errorResponse, requireOwner } from "@/lib/rbac";
import { saveUpload } from "@/lib/storage";
import { adLink, escapeAttr as escape, isPictureAd, withAdLink } from "@/lib/ad-markup";

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Each half of the paper has its own boxes; "...En" is the English site. */
const FIELD = {
  banner: "adBannerHtml",
  square: "adSquareHtml",
  home: "adHomeHtml",
  article: "adArticleHtml",
  section: "adSectionHtml",
  bannerEn: "adBannerHtmlEn",
  squareEn: "adSquareHtmlEn",
  homeEn: "adHomeHtmlEn",
  articleEn: "adArticleHtmlEn",
  sectionEn: "adSectionHtmlEn",
} as const;

const field = (slot: string) => {
  if (!(slot in FIELD)) throw new HttpError(422, "Unknown advertising slot");
  return FIELD[slot as keyof typeof FIELD];
};

const checkLink = (link: string) => {
  if (link && !/^https?:\/\//i.test(link)) {
    throw new HttpError(422, "The click-through address must start with http:// or https://");
  }
};

/**
 * POST /api/admin/site/ad-image (multipart: file, slot, link?)
 *
 * Most owners do not have ad-network code; they have a picture from an
 * advertiser. This takes the picture, stores it, and writes the small piece of
 * markup for them - so the advertising boxes stop being a thing only a
 * developer can fill in.
 */
export async function POST(req: Request) {
  try {
    await requireOwner();

    const form = await req.formData();
    const file = form.get("file");
    const slot = String(form.get("slot") ?? "");
    const link = String(form.get("link") ?? "").trim();
    const alt = String(form.get("alt") ?? "Advertisement").slice(0, 120);

    const column = field(slot);
    if (!(file instanceof File)) throw new HttpError(422, "No image received");
    if (!TYPES.includes(file.type)) throw new HttpError(415, "Use a PNG, JPEG, WebP or GIF");
    if (file.size > 4 * 1024 * 1024) throw new HttpError(413, "Keep the image under 4 MB");
    checkLink(link);

    const { url } = await saveUpload(file);
    // Served at a sensible width like every other picture on the site, with a
    // smaller one offered to phones.
    const img =
      `<img src="${escape(url)}?w=1200" ` +
      `srcset="${escape(url)}?w=480 480w, ${escape(url)}?w=800 800w, ${escape(url)}?w=1200 1200w" ` +
      `sizes="(min-width: 1024px) 970px, 100vw" ` +
      `alt="${escape(alt)}" loading="lazy" decoding="async" ` +
      `style="display:block;width:100%;height:auto">`;
    const html = link
      ? `<a href="${escape(link)}" target="_blank" rel="noopener sponsored">${img}</a>`
      : img;

    const settings = await prisma.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, [column]: html },
      update: { [column]: html },
    });

    return Response.json({ settings, url, link, html }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/admin/site/ad-image  { slot, link }
 *
 * Changes only where a click goes, leaving the picture alone. Selling the same
 * space to a new advertiser's page, or correcting a mistyped address, should not
 * mean finding and uploading the image a second time.
 */
export async function PATCH(req: Request) {
  try {
    await requireOwner();

    const body = (await req.json().catch(() => ({}))) as { slot?: string; link?: string };
    const column = field(String(body.slot ?? ""));
    const link = String(body.link ?? "").trim();
    checkLink(link);

    const site = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    const current = (site?.[column] ?? "") as string;
    if (!current.trim()) {
      throw new HttpError(422, "This box is empty - upload an image first, then set the link");
    }
    if (!isPictureAd(current)) {
      throw new HttpError(
        422,
        "This box holds code from an ad network, so the link lives inside that code",
      );
    }
    if (adLink(current) === link) {
      throw new HttpError(422, link ? "That is already the link" : "This image has no link to remove");
    }

    const html = withAdLink(current, link);
    const settings = await prisma.siteSettings.update({
      where: { id: 1 },
      data: { [column]: html },
    });
    return Response.json({ settings, link, html });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/admin/site/ad-image?slot=banner - empty the box again. */
export async function DELETE(req: Request) {
  try {
    await requireOwner();
    const column = field(new URL(req.url).searchParams.get("slot") ?? "");
    const settings = await prisma.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, [column]: "" },
      update: { [column]: "" },
    });
    return Response.json({ settings, html: "" });
  } catch (err) {
    return errorResponse(err);
  }
}
