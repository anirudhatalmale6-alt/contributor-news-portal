"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COVER_SHAPES,
  type CoverShape,
  type Crop,
  cropStyle,
  parseCrop,
  serialiseCrop,
} from "@/components/cover-image";

/**
 * The crop that fills the frame with as much of the picture as possible,
 * centred. Coordinates are percentages of the picture, so the picture's own
 * shape matters: a crop w% wide and h% tall shows (w x pictureWidth) by
 * (h x pictureHeight), and that has to come out at the frame's shape.
 */
function covering(frame: number, picture: number): Crop {
  if (picture >= frame) {
    const w = (100 * frame) / picture;
    return { x: (100 - w) / 2, y: 0, w, h: 100 };
  }
  const h = (100 * picture) / frame;
  return { x: 0, y: (100 - h) / 2, w: 100, h };
}

/** How tall a crop of this width is, for this frame and picture. */
const heightFor = (w: number, frame: number, picture: number) => (w * picture) / frame;

/**
 * Keeps one side of the crop inside the picture when it is smaller than the
 * picture, and keeps the picture inside the frame when it has been zoomed out
 * past it - so you can slide a small photo around a large frame, but never
 * lose it off the edge.
 */
const clampEdge = (pos: number, size: number) =>
  Math.min(Math.max(pos, Math.min(0, 100 - size)), Math.max(0, 100 - size));

/**
 * Framing a cover photo for one place on the site.
 *
 * Drag the picture to choose what is inside the frame, and use the slider to
 * zoom. Nothing is written to the file: the four numbers are stored and the
 * page does the framing, so the original photograph is never destroyed and the
 * crop can be changed again at any time.
 */
function ShapeCropper({
  articleId,
  src,
  shape,
  initial,
  aspect,
}: {
  articleId: string;
  src: string;
  shape: CoverShape;
  initial: string | null;
  aspect: number;
}) {
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  // The picture's own shape is only known once it has loaded. Until then the
  // saved framing is shown as it is and the zoom waits.
  const [picture, setPicture] = useState<number | null>(null);
  const [crop, setCrop] = useState<Crop>(parseCrop(initial) ?? { x: 0, y: 0, w: 100, h: 100 });

  const imgRef = useRef<HTMLImageElement>(null);
  const measure = useCallback(
    (img: HTMLImageElement) => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const shapeOfPicture = img.naturalWidth / img.naturalHeight;
      setPicture(shapeOfPicture);
      // Nothing saved yet: start from the picture filling the frame.
      if (!parseCrop(initial)) setCrop(covering(aspect, shapeOfPicture));
    },
    [aspect, initial],
  );
  // A photo already in the browser's cache can finish loading before this
  // screen's script is running, and then its load event is never seen. Read
  // it directly in that case, or the zoom would stay switched off.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) measure(img);
  }, [measure]);

  // Zooming in stops at a fifth of the filled frame; zooming out stops when the
  // whole picture fits inside the frame, with the rest of the frame left plain.
  const fill = picture ? covering(aspect, picture) : null;
  const minW = fill ? fill.w * 0.2 : 20;
  const maxW = picture ? Math.max(100, (100 * aspect) / picture) : 100;
  const [drag, setDrag] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zoom is expressed as the width of the crop: a narrower crop is a closer
  // view, and a crop wider than the picture is the picture zoomed out. Height
  // always follows from the two shapes, so the photo is never stretched.
  function setZoom(width: number) {
    if (!picture) return;
    const w = Math.min(maxW, Math.max(minW, width));
    const h = heightFor(w, aspect, picture);
    setCrop((c) => ({
      w,
      h,
      x: clampEdge(c.x + (c.w - w) / 2, w),
      y: clampEdge(c.y + (c.h - h) / 2, h),
    }));
    setSaved(false);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !frameRef.current) return;
    const box = frameRef.current.getBoundingClientRect();
    // A pixel of mouse movement is worth more when zoomed in, because the
    // frame is showing a smaller slice of the picture.
    const dx = ((e.clientX - drag.x) / box.width) * crop.w;
    const dy = ((e.clientY - drag.y) / box.height) * crop.h;
    setCrop((c) => ({
      ...c,
      x: clampEdge(drag.cx - dx, c.w),
      y: clampEdge(drag.cy - dy, c.h),
    }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    const field = shape === "home" ? "coverCropHome" : "coverCropArticle";
    const res = await fetch(`/api/editorial/${articleId}/cover-crop`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: serialiseCrop(crop) }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save this framing.");
      return;
    }
    setError(null);
    setSaved(true);
    router.refresh();
  }

  async function reset() {
    setBusy(true);
    const field = shape === "home" ? "coverCropHome" : "coverCropArticle";
    const res = await fetch(`/api/editorial/${articleId}/cover-crop`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: null }),
    });
    setBusy(false);
    if (!res.ok) return;
    if (picture) setCrop(covering(aspect, picture));
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{COVER_SHAPES[shape].label}</span>
        <span className="text-xs text-ink-soft">{COVER_SHAPES[shape].px}</span>
      </div>

      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        className="relative cursor-move touch-none select-none overflow-hidden rounded-lg border border-line bg-paper-soft"
        style={{ aspectRatio: String(aspect) }}
        role="group"
        aria-label={`Framing for ${COVER_SHAPES[shape].label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          style={cropStyle(crop)}
          ref={imgRef}
          onLoad={(e) => measure(e.currentTarget)}
        />
      </div>

      <label className="grid gap-1 text-xs text-ink-soft">
        <span className="flex justify-between">
          <span>Zoom in</span>
          <span>Zoom out</span>
        </span>
        <input
          type="range"
          name={`zoom-${shape}`}
          min={minW}
          max={maxW}
          step="any"
          disabled={!picture}
          value={Math.min(maxW, Math.max(minW, crop.w))}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-navy"
          aria-label={`Zoom for ${COVER_SHAPES[shape].label}`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="rounded-full bg-navy px-3.5 py-1.5 text-xs font-medium text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save this framing"}
        </button>
        <button
          type="button"
          onClick={() => void reset()}
          disabled={busy}
          className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium hover:bg-paper-soft disabled:opacity-60"
        >
          Reset
        </button>
        {saved ? <span className="text-xs text-emerald-700">Saved.</span> : null}
        {error ? <span className="text-xs text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}

/** Both framings, side by side: one for the front page, one for the article. */
export function CropEditor({
  articleId,
  src,
  home,
  article,
}: {
  articleId: string;
  src: string;
  home: string | null;
  article: string | null;
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-line p-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          How the cover is framed
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Drag the picture to choose what shows, and use the slider to zoom in or out. Zoomed
          right out, the whole photograph fits inside the frame. The two places need different
          shapes, so they are framed separately. The photograph itself is never altered.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <ShapeCropper
          articleId={articleId}
          src={src}
          shape="home"
          initial={home}
          aspect={COVER_SHAPES.home.ratio}
        />
        <ShapeCropper
          articleId={articleId}
          src={src}
          shape="article"
          initial={article}
          aspect={COVER_SHAPES.article.ratio}
        />
      </div>
    </section>
  );
}
