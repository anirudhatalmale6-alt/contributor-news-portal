"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COVER_SHAPES,
  type CoverShape,
  type Crop,
  cropStyle,
  parseCrop,
  serialiseCrop,
} from "@/components/cover-image";

/** The widest crop of this shape that fits inside the picture, centred. */
function fitted(ratio: number): Crop {
  // Working in percentages of a square-ish box: start full width, and take the
  // height the shape asks for. Anything over 100 means the picture is taller
  // than the frame, so take full height instead.
  const h = 100 / ratio;
  if (h <= 100) return { x: 0, y: (100 - h) / 2, w: 100, h };
  const w = 100 * ratio;
  return { x: (100 - w) / 2, y: 0, w, h: 100 };
}

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
  const [crop, setCrop] = useState<Crop>(parseCrop(initial) ?? fitted(aspect));
  const [drag, setDrag] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Zoom is expressed as the width of the crop: a narrower crop is a closer
  // view. Height always follows from the shape, so the frame cannot be skewed.
  function setZoom(width: number) {
    const w = Math.min(100, Math.max(20, width));
    const h = Math.min(100, w / aspect);
    setCrop((c) => ({
      w,
      h,
      x: Math.min(Math.max(0, c.x + (c.w - w) / 2), 100 - w),
      y: Math.min(Math.max(0, c.y + (c.h - h) / 2), 100 - h),
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
      x: Math.min(Math.max(0, drag.cx - dx), 100 - c.w),
      y: Math.min(Math.max(0, drag.cy - dy), 100 - c.h),
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
    if (!res.ok) return;
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
    setCrop(fitted(aspect));
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
        <img src={src} alt="" draggable={false} style={cropStyle(crop)} />
      </div>

      <label className="grid gap-1 text-xs text-ink-soft">
        <span>Zoom</span>
        <input
          type="range"
          min={20}
          max={100}
          step={1}
          value={Math.round(crop.w)}
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
          Use the whole picture
        </button>
        {saved ? <span className="text-xs text-emerald-700">Saved.</span> : null}
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
          Drag the picture and zoom to choose what shows. The two places need
          different shapes, so they are framed separately. The photograph itself is never
          altered.
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
