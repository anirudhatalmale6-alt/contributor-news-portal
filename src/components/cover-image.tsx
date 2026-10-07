/**
 * A cover photo shown at a fixed shape, cropped the way an editor chose.
 *
 * The crop is four percentages of the original picture, so it survives the
 * photo being re-served at any size and needs no second copy of the file on
 * disk. Without a crop the middle of the picture is used, which is what most
 * photographs want anyway.
 */

/** The shapes a cover appears in, and what each one is for. */
export const COVER_SHAPES = {
  home: { ratio: 16 / 9, label: "Front page", px: "1200 x 675" },
  article: { ratio: 3 / 2, label: "Article page", px: "1200 x 800" },
} as const;

export type CoverShape = keyof typeof COVER_SHAPES;

export type Crop = { x: number; y: number; w: number; h: number };

/** "10,0,80,60" -> {x:10,y:0,w:80,h:60}; anything malformed is simply ignored. */
export function parseCrop(value: string | null | undefined): Crop | null {
  if (!value) return null;
  const parts = value.split(",").map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = parts;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

export const serialiseCrop = (c: Crop) =>
  [c.x, c.y, c.w, c.h].map((n) => Math.round(n * 100) / 100).join(",");

/**
 * The inline styles that place a cropped picture inside its frame.
 *
 * The image is scaled so the chosen rectangle exactly fills the frame, then
 * shifted so that rectangle is the part you can see.
 */
export function cropStyle(crop: Crop | null): React.CSSProperties {
  if (!crop) return { width: "100%", height: "100%", objectFit: "cover" };
  return {
    position: "absolute",
    width: `${(100 / crop.w) * 100}%`,
    height: `${(100 / crop.h) * 100}%`,
    left: `${-(crop.x / crop.w) * 100}%`,
    top: `${-(crop.y / crop.h) * 100}%`,
    maxWidth: "none",
    objectFit: "cover",
  };
}

export function CoverImage({
  src,
  crop,
  shape,
  className = "",
  eager,
}: {
  src: string;
  crop?: string | null;
  shape: CoverShape;
  className?: string;
  eager?: boolean;
}) {
  const parsed = parseCrop(crop);
  return (
    <div
      className={`relative overflow-hidden bg-paper-soft ${className}`}
      style={{ aspectRatio: String(COVER_SHAPES[shape].ratio) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        style={cropStyle(parsed)}
      />
    </div>
  );
}
