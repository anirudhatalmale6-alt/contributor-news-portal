/**
 * The small set of formatting the site's writing toolbars produce, turned into
 * page elements: paragraphs, two sizes of subtitle, pull quotes, bullets, bold
 * and italic. Shared by articles and the owner's own pages, so the same
 * buttons mean the same thing everywhere.
 */

/**
 * Paragraphs, H2/H3, pull quotes and bullets - the same subset in both
 * languages.
 *
 * Read line by line rather than block by block. A contributor who writes a
 * heading and starts the next line underneath it, without a blank line between,
 * means a heading followed by a paragraph - not one very long heading.
 */
/**
 * Inline emphasis: **bold** and *italic*.
 *
 * Built into React elements rather than injected as HTML, so a contributor
 * cannot smuggle markup into a published page by typing it.
 */
function inline(text: string, keyBase: string) {
  const out: (string | React.ReactElement)[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    } else {
      out.push(<em key={`${keyBase}-i${i++}`}>{m[2]}</em>);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}


/**
 * A YouTube or Facebook video address on a line of its own becomes a player.
 *
 * Only these two, recognised by their exact address shapes, and only ever as
 * a player pointing back at that service - nothing a writer types is turned
 * into markup. YouTube is loaded from its no-cookie address, so readers are
 * not tracked just for scrolling past.
 */
export function videoEmbed(line: string): { src: string; title: string } | null {
  let url: URL;
  try {
    url = new URL(line.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const id = (v: string | null | undefined) => (v && /^[A-Za-z0-9_-]{6,20}$/.test(v) ? v : null);

  let yt: string | null = null;
  if (host === "youtu.be") yt = id(url.pathname.slice(1));
  else if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") yt = id(url.searchParams.get("v"));
    else {
      const m = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
      yt = id(m?.[1]);
    }
  }
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt}`, title: "YouTube video" };

  const isFacebookVideo =
    (host === "facebook.com" && (/\/videos\//.test(url.pathname) || url.pathname.startsWith("/watch") || url.pathname.startsWith("/reel/"))) ||
    host === "fb.watch";
  if (isFacebookVideo) {
    return {
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.toString())}&show_text=false`,
      title: "Facebook video",
    };
  }
  return null;
}

export function renderBody(body: string) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactElement[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  let quote: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      const k = key++;
      out.push(<p key={k}>{inline(para.join(" "), `p${k}`)}</p>);
    }
    para = [];
  };
  const flushBullets = () => {
    if (bullets.length) {
      out.push(
        <ul key={key++}>
          {bullets.map((li, i) => (
            <li key={i}>{inline(li, `li${i}`)}</li>
          ))}
        </ul>,
      );
    }
    bullets = [];
  };
  const flushQuote = () => {
    if (quote.length) {
      const k = key++;
      out.push(<blockquote key={k}>{inline(quote.join(" "), `q${k}`)}</blockquote>);
    }
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushBullets();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushAll();
      continue;
    }
    if (line.startsWith("### ")) {
      flushAll();
      out.push(<h3 key={key++}>{inline(line.slice(4), `h3${key}`)}</h3>);
      continue;
    }
    // "## " is what the toolbar writes, but people type "# " as well, and it
    // was printing the hash as if it were part of the sentence. Both are the
    // same heading here: the page already has its h1 in the masthead.
    if (line.startsWith("## ") || line.startsWith("# ")) {
      flushAll();
      const text = line.startsWith("## ") ? line.slice(3) : line.slice(2);
      out.push(<h2 key={key++}>{inline(text, `h2${key}`)}</h2>);
      continue;
    }
    const video = videoEmbed(line);
    if (video) {
      flushAll();
      out.push(
        <div key={key++} className="not-prose my-6 aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            src={video.src}
            title={video.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>,
      );
      continue;
    }
    if (/^[-*] /.test(line)) {
      flushPara();
      flushQuote();
      bullets.push(line.replace(/^[-*] /, ""));
      continue;
    }
    if (line.startsWith(">")) {
      flushPara();
      flushBullets();
      quote.push(line.replace(/^> ?/, ""));
      continue;
    }
    flushBullets();
    flushQuote();
    para.push(line);
  }
  flushAll();
  return out;
}
