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
