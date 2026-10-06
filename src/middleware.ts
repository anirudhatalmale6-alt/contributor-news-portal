import { NextResponse, type NextRequest } from "next/server";

/**
 * Preview lock.
 *
 * While the site is being finished, one shared password keeps the whole thing
 * private. Set SITE_GATE_PASSWORD in .env to switch it on; remove it (and
 * restart) to open the site to the public - there is no other switch to forget.
 *
 * It is HTTP Basic auth on purpose: every browser and phone already knows how
 * to show the prompt, and it covers pages, images and the API in one go.
 */
const USER = process.env.SITE_GATE_USER || "preview";
const PASS = process.env.SITE_GATE_PASSWORD;

export function middleware(req: NextRequest) {
  if (!PASS) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [user, ...rest] = atob(header.slice(6)).split(":");
      if (user === USER && rest.join(":") === PASS) return NextResponse.next();
    } catch {
      // malformed header, fall through to the prompt
    }
  }

  return new NextResponse("This site is not open yet.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="The Document - preview", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own static output and the OAuth callback - a
     * provider redirecting a reader back here cannot send a Basic auth header.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|api/auth/callback).*)",
  ],
};
