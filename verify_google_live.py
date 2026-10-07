"""Proves the live site hands off to Google with the client's real app.

Clicks "Continue with Google" on https://thedocument.net and intercepts the
outbound request. Nothing is ever sent to Google: the request is aborted the
moment its URL has been read.

    BASE_URL=https://thedocument.net GATE_PASSWORD=... python3 verify_google_live.py
"""

import os
import sys
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "https://thedocument.net")
GATE = (
    {"username": os.environ.get("GATE_USER", "preview"), "password": os.environ["GATE_PASSWORD"]}
    if os.environ.get("GATE_PASSWORD")
    else None
)
EXPECT_ID = os.environ.get("EXPECT_CLIENT_ID", "")

seen = {}
ok = True


def check(name, passed, detail=""):
    global ok
    print(("PASS " if passed else "FAIL ") + name + ((" - " + detail) if detail else ""))
    ok = ok and passed


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, http_credentials=GATE)
    page = ctx.new_page()

    def intercept(route):
        url = route.request.url
        if "accounts.google.com" in url:
            seen["url"] = url
            route.abort()
            return
        route.continue_()

    ctx.route("**/*", intercept)

    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.wait_for_timeout(1800)
    check("the Google button is on the sign-in page", page.locator('text=Continue with Google').count() > 0)
    page.click('text=Continue with Google')
    page.wait_for_timeout(5000)

    check("pressing it hands off to Google", "url" in seen, str(seen))
    if "url" in seen:
        q = parse_qs(urlparse(seen["url"]).query)
        cid = (q.get("client_id") or [""])[0]
        redirect = (q.get("redirect_uri") or [""])[0]
        check("it carries the real client id", cid.startswith(EXPECT_ID[:20]) if EXPECT_ID else bool(cid), cid)
        check(
            "the callback it asks for is this site's",
            redirect == f"{BASE}/api/auth/callback/google",
            redirect,
        )
        check("the hand-off is over https", seen["url"].startswith("https://accounts.google.com/"))
    page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots13", "h-login-google.png"))
    browser.close()

print("OK" if ok else "FAILED")
sys.exit(0 if ok else 1)
