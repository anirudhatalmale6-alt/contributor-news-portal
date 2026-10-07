"""Proves the live site hands off to Google and Facebook with the real apps.

Clicks each button on https://thedocument.net and intercepts the outbound
request. Nothing is ever sent to either provider: the request is aborted the
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
EXPECT_GOOGLE = os.environ.get("EXPECT_GOOGLE_ID", "")
EXPECT_FACEBOOK = os.environ.get("EXPECT_FACEBOOK_ID", "")

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
            seen["google"] = url
            route.abort()
            return
        if "facebook.com/" in url and "oauth" in url:
            seen["facebook"] = url
            route.abort()
            return
        route.continue_()

    ctx.route("**/*", intercept)

    for provider, label, expect in (
        ("google", "Google", EXPECT_GOOGLE),
        ("facebook", "Facebook", EXPECT_FACEBOOK),
    ):
        page.goto(f"{BASE}/login", wait_until="domcontentloaded")
        page.wait_for_timeout(1800)
        check(
            f"the {label} button is on the sign-in page",
            page.locator(f"text=Continue with {label}").count() > 0,
        )
        page.click(f"text=Continue with {label}")
        page.wait_for_timeout(5000)

        check(f"pressing it hands off to {label}", provider in seen, str(seen.keys()))
        if provider in seen:
            q = parse_qs(urlparse(seen[provider]).query)
            cid = (q.get("client_id") or [""])[0]
            redirect = (q.get("redirect_uri") or [""])[0]
            check(
                f"it carries the real {label} app id",
                cid.startswith(expect[:20]) if expect else bool(cid),
                cid,
            )
            check(
                f"the callback {label} is asked for is this site's",
                redirect == f"{BASE}/api/auth/callback/{provider}",
                redirect,
            )
            check(f"the {label} hand-off is over https", seen[provider].startswith("https://"))

    browser.close()

print("OK" if ok else "FAILED")
sys.exit(0 if ok else 1)
