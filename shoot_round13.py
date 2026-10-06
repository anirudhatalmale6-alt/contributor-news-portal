"""Framed screenshots of this round's work, for the client.

Not a test - the suite proves the behaviour. This only parks each screen where
the new thing is actually in view.
"""

import os
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3312")
GATE = (
    {"username": os.environ.get("GATE_USER", "preview"), "password": os.environ["GATE_PASSWORD"]}
    if os.environ.get("GATE_PASSWORD")
    else None
)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots13")
os.makedirs(OUT, exist_ok=True)
DESKTOP = {"width": 1280, "height": 760}
PHONE = {"width": 390, "height": 780}


def go(page, url):
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(900)


def sign_in(page, email, password="demo1234"):
    go(page, f"{BASE}/login")
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_url(lambda u: "/login" not in u, timeout=30000)
    page.wait_for_timeout(600)


def shot(page, name, anchor=None, offset=-110):
    if anchor:
        page.locator(anchor).first.scroll_into_view_if_needed()
        page.evaluate(f"window.scrollBy(0, {offset})")
    page.wait_for_timeout(450)
    page.screenshot(path=os.path.join(OUT, name))


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        page = ctx.new_page()

        # --- contributor: contact fields on the piece they are filing --------
        sign_in(page, "maya@thedocument.test")
        go(page, f"{BASE}/dashboard")
        page.click('button:has-text("Start a new piece")')
        page.wait_for_url("**/dashboard/write/**", timeout=30000)
        page.fill('input[placeholder="Headline"]', "The ferry timetable nobody publishes")
        page.wait_for_timeout(400)
        shot(page, "a-submission-contact.png", "section:has-text('reach you about this piece')")

        # --- contributor: writing to the newsroom ----------------------------
        go(page, f"{BASE}/inbox")
        page.click('button:has-text("Message the newsroom")')
        page.fill('input[maxlength="120"]', "Photographs for the ferry piece")
        page.fill(
            "textarea",
            "I have twelve photographs from the jetty this morning. Shall I attach all of "
            "them, or would you rather pick from a contact sheet?",
        )
        page.click('button:has-text("Send")')
        page.wait_for_url("**/inbox/**", timeout=30000)
        page.wait_for_timeout(700)
        shot(page, "b-inbox-contributor.png")

        # --- editor: the same thread, answered -------------------------------
        ectx = browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ep = ectx.new_page()
        sign_in(ep, "editor@thedocument.test")
        go(ep, f"{BASE}/inbox")
        ep.click('a:has-text("Photographs for the ferry piece")')
        ep.wait_for_timeout(900)
        ep.fill("textarea", "A contact sheet first please, then we will ask for the full size.")
        ep.click('button:has-text("Send reply")')
        ep.wait_for_timeout(1500)
        shot(ep, "c-inbox-editor-reply.png")

        go(ep, f"{BASE}/inbox")
        shot(ep, "d-inbox-list.png")

        # --- newsroom: numbers on the people list ----------------------------
        actx = browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ap = actx.new_page()
        sign_in(ap, "admin@thedocument.test")
        go(ap, f"{BASE}/people")
        shot(ap, "e-people-contacts.png")

        # --- newsroom: the writer's number beside the copy -------------------
        go(ap, f"{BASE}/editorial")
        ap.locator('a[href^="/editorial/"]').first.click()
        ap.wait_for_url("**/editorial/**", timeout=30000)
        ap.wait_for_timeout(900)
        shot(ap, "f-editorial-contact.png")

        # --- reader: one menu, on a phone ------------------------------------
        mctx = browser.new_context(viewport=PHONE, device_scale_factor=2, http_credentials=GATE)
        mp = mctx.new_page()
        go(mp, BASE)
        mp.screenshot(path=os.path.join(OUT, "g-home-phone.png"))

        browser.close()
    print("shots in", OUT)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print("FAILED:", e)
        sys.exit(1)
