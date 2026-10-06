/**
 * Money is stored in minor units (poisha for BDT, cents for USD) and only ever
 * becomes a decimal here. BDT renders as "BDT 1,500.00" rather than the ৳ glyph,
 * which several Windows fonts still draw as a box.
 */
export function money(minorUnits: number, currency = "BDT") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base || "article";
}


export function readingTime(body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  const steps: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
  ];
  let value = secs;
  let unit = "second";
  for (const [size, name] of steps) {
    if (Math.abs(value) < size) {
      unit = name;
      break;
    }
    value = Math.round(value / size);
    unit = name;
  }
  if (unit === "second" && Math.abs(value) < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return rtf.format(-value, unit as Intl.RelativeTimeFormatUnit);
}

export function longDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
