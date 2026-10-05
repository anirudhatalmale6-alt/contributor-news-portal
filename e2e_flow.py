"""
End-to-end walk of the whole contributor workflow against the running build.
Signup -> draft -> media -> submit -> editorial edit -> approve + payout ->
earnings visible -> admin flags Verified -> piece live on the public feed.

Every step asserts, and screenshots land in shots/ at 1280x720 (phone shots at
390x780) so nothing exceeds the chat image limits.
"""

import os
import sys
import time
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3300"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(SHOTS, exist_ok=True)

DESKTOP = {"width": 1280, "height": 720}
PHONE = {"width": 390, "height": 780}

STAMP = str(int(time.time()))
NEW_EMAIL = f"rosa.{STAMP}@thedocument.test"
NEW_PASS = "demo1234"
NEW_NAME = "Rosa Delgado"
HEADLINE = "The allotment that became a flood defence"

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))
    if not ok:
        raise AssertionError(name + " " + detail)


def shot(page, name, scroll="top"):
    """Screenshots are viewport-sized; park the page where the shot reads best."""
    if scroll == "top":
        page.evaluate("window.scrollTo(0, 0)")
    elif scroll != "none":
        page.locator(scroll).first.scroll_into_view_if_needed()
        page.evaluate("window.scrollBy(0, -90)")
    page.wait_for_timeout(350)
    page.screenshot(path=os.path.join(SHOTS, name))


def sign_in(page, email, password):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_url(lambda u: "/login" not in u, timeout=20000)


def sign_out(page):
    page.goto(f"{BASE}/", wait_until="networkidle")
    page.click('button:has-text("Sign out")')
    page.wait_for_timeout(1500)


def make_photo(path):
    from PIL import Image, ImageDraw, ImageFilter

    img = Image.new("RGB", (1200, 675), (26, 44, 50))
    d = ImageDraw.Draw(img, "RGBA")
    for i, col in enumerate([(52, 112, 96), (168, 186, 110), (226, 226, 206)]):
        d.ellipse([-200 + i * 420, 120 + i * 60, 520 + i * 420, 760 + i * 60], fill=col + (120,))
    img = img.filter(ImageFilter.GaussianBlur(40))
    d = ImageDraw.Draw(img, "RGBA")
    for x in range(80, 1120, 120):
        d.rectangle([x, 420, x + 26, 600], fill=(240, 238, 224, 90))
    img.save(path, quality=88)


def main():
    photo = os.path.join(SHOTS, "..", "sample-upload.jpg")
    make_photo(photo)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport=DESKTOP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "console",
            lambda m: errors.append(m.text) if m.type == "error" else None,
        )

        # --- 1. public feed -------------------------------------------------
        page.goto(BASE, wait_until="networkidle")
        check("home serves the published lead story", "night bus" in page.content())
        check(
            "an unpublished draft never leaks onto the public feed",
            "Market rents" not in page.content(),
        )
        check(
            "a submitted-but-unapproved piece is not public",
            "permit office backlog" not in page.content(),
        )
        shot(page, "01-home-desktop.png")

        # --- 2. article page ------------------------------------------------
        # .first: the headline is a link in both the lead card and the rail
        page.locator("a:has-text('The night bus that never came')").first.click()
        page.wait_for_url("**/article/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        check("the headline link reaches the article", "/article/" in page.url, page.url)
        check("article page renders the body copy", "00:41" in page.content())
        check("verified badge shows on the byline", page.locator("svg[aria-label], span:has-text('Verified contributor')").count() > 0)
        shot(page, "02-article-desktop.png")

        # --- 3. signup ------------------------------------------------------
        page.goto(f"{BASE}/register", wait_until="networkidle")
        shot(page, "03-register.png")
        page.fill('input[autocomplete="name"]', NEW_NAME)
        page.fill('input[type="email"]', NEW_EMAIL)
        page.fill('input[type="password"]', NEW_PASS)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard", timeout=20000)
        check("email + password signup lands on the dashboard", "/dashboard" in page.url)
        check("a brand new account is a General Contributor", "Contributor" in page.content())

        # --- 4. draft, media, save -----------------------------------------
        page.click('button:has-text("Start a new piece")')
        page.wait_for_url("**/dashboard/write/**", timeout=20000)
        article_url = page.url
        page.fill('input[placeholder="Headline"]', HEADLINE)
        page.fill(
            'input[placeholder="One-line summary shown in the feed"]',
            "The council spent eleven years refusing to buy it. Then the water came.",
        )
        page.select_option("select", "Culture")
        page.fill(
            "textarea",
            "The allotment sits two metres below the road, and that is the whole story.\n\n"
            "## Eleven years of refusals\nThe site was offered to the council in 2014 for a nominal sum. "
            "Minutes from four separate committee meetings record the same objection: no budget line for "
            "acquisition, no statutory duty to act.\n\n"
            "> \"We were told it was a hobby. It is now the only thing between the terrace and the brook.\"\n\n"
            "After the flood of 2023 the plots held nine hundred cubic metres of water for a little over two days. "
            "The engineer's note filed afterwards called the allotment an informal attenuation basin, which is a "
            "long way of saying it did the job the council never paid for.\n\n"
            "## What happens now\n- The lease runs out in March\n- The developer's option is still live\n"
            "- No flood model submitted with the application mentions the site at all",
        )
        with page.expect_file_chooser() as fc:
            page.click('button:has-text("Attach media")')
        fc.value.set_files(photo)
        page.wait_for_selector("li img", timeout=20000)
        check("image upload attaches to the draft", page.locator("section li img").count() >= 1)
        page.click('button:has-text("Save draft")')
        page.wait_for_selector("text=saved", timeout=20000)
        check("manual save reports success", "saved" in page.content())
        shot(page, "04-composer.png", scroll="top")

        # reload proves the copy really persisted, not just sat in React state
        page.reload(wait_until="networkidle")
        check(
            "draft survives a reload (saved server-side, not in the browser)",
            HEADLINE in page.content() and "attenuation basin" in page.content(),
        )

        # --- 5. submit ------------------------------------------------------
        page.click('button:has-text("Submit for review")')
        page.wait_for_selector("text=An editor will review it", timeout=20000)
        check("submit puts the piece in the editorial queue", "In review" in page.content())
        page.goto(f"{BASE}/dashboard", wait_until="networkidle")
        check("dashboard shows it as in review", "In review" in page.content())
        shot(page, "05-dashboard-contributor.png")

        # a contributor must not reach the newsroom
        page.goto(f"{BASE}/editorial", wait_until="networkidle")
        check("a contributor is bounced out of the editorial queue", "/dashboard" in page.url)
        page.goto(f"{BASE}/admin", wait_until="networkidle")
        check("a contributor is bounced out of admin", "/dashboard" in page.url)

        # --- 6. editor reviews ---------------------------------------------
        sign_out(page)
        sign_in(page, "editor@thedocument.test", "demo1234")
        page.goto(f"{BASE}/editorial", wait_until="networkidle")
        check("editor sees the queue with the new submission", HEADLINE in page.content())
        shot(page, "06-editorial-queue.png")

        page.click(f'li:has-text("{HEADLINE}") >> a:has-text("Review")')
        page.wait_for_url("**/editorial/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        check("review screen loads the submitted copy", "attenuation basin" in page.content())

        # editor fine-tunes the headline, then approves with a payout
        edited = HEADLINE + " - and the council that refused to buy it"
        page.fill('input.font-serif', edited)
        page.fill('input[inputmode="decimal"]', "132.50")
        page.fill("textarea >> nth=1", "Tightened the headline and cut one line from the close. Good find.")
        shot(page, "07-review-panel.png", scroll="section:has-text('DECISION'), section:has(h2:text('Decision'))")
        page.click('button:has-text("Approve and publish")')
        page.wait_for_selector("text=Published.", timeout=20000)
        check("approval confirms the payout the writer will see", "132.50" in page.content())
        shot(page, "08-approved.png")

        # --- 7. earnings ----------------------------------------------------
        sign_out(page)
        sign_in(page, NEW_EMAIL, NEW_PASS)
        page.goto(f"{BASE}/dashboard", wait_until="networkidle")
        body = page.content()
        check("payout appears on the contributor's article", "$132.50" in body)
        check("cumulative earnings total updates", "Total earnings" in body and "$132.50" in body)
        check("editor's note reaches the writer", "Tightened the headline" in body)
        check("the editor's headline edit is what the writer now sees", "refused to buy it" in body)
        shot(page, "09-dashboard-earnings.png")

        # --- 8. live on the public site -------------------------------------
        page.goto(f"{BASE}/?category=Culture", wait_until="networkidle")
        check("approved piece is live on the public feed", "refused to buy it" in page.content())
        shot(page, "10-public-feed-culture.png")

        # --- 9. admin: roles, verified flag, payment settings ---------------
        sign_out(page)
        sign_in(page, "admin@thedocument.test", "demo1234")
        page.goto(f"{BASE}/admin", wait_until="networkidle")
        check("admin sees every account", NEW_EMAIL in page.content())
        row = page.locator(f'tr:has-text("{NEW_EMAIL}")')
        row.locator('button:has-text("flag as verified")').click()
        expect(row.locator('button:has-text("Verified")')).to_be_visible(timeout=20000)
        check("admin can flag a contributor as Verified", True)

        page.fill('input[inputmode="decimal"] >> nth=0', "45.00")
        page.click('button:has-text("Save settings")')
        page.wait_for_selector("text=Saved", timeout=20000)
        check("payment settings save", "Saved" in page.content())
        shot(page, "11-admin.png")

        # self-demotion guard
        resp = page.request.patch(
            f"{BASE}/api/admin/users/{page.evaluate('1')}", data={"role": "EDITOR"}
        )
        check("a bogus user id is rejected, not silently applied", resp.status >= 400)

        # --- 10. API spot checks -------------------------------------------
        anon = ctx.browser.new_context()
        anon_page = anon.new_page()
        r = anon_page.request.get(f"{BASE}/api/drafts")
        check("GET /api/drafts without a session is 401", r.status == 401, f"got {r.status}")
        r = anon_page.request.get(f"{BASE}/api/editorial/queue")
        check("GET /api/editorial/queue without a session is 401", r.status == 401, f"got {r.status}")
        r = anon_page.request.get(f"{BASE}/api/articles")
        check("GET /api/articles is public", r.status == 200)
        feed = r.json()
        check(
            "public API only returns approved work",
            feed["total"] >= 5 and all("permit office" not in a["title"] for a in feed["articles"]),
        )
        anon.close()

        # --- 11. mobile ------------------------------------------------------
        mob = ctx.browser.new_context(viewport=PHONE, device_scale_factor=2)
        mp = mob.new_page()
        mp.goto(BASE, wait_until="networkidle")
        overflow = mp.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        check("no sideways scroll on a 390px phone", not overflow)
        mp.screenshot(path=os.path.join(SHOTS, "12-home-mobile.png"))
        mp.goto(f"{BASE}/article/the-night-bus-that-never-came", wait_until="networkidle")
        mp.screenshot(path=os.path.join(SHOTS, "13-article-mobile.png"))
        mp.goto(f"{BASE}/login", wait_until="networkidle")
        mp.fill('input[type="email"]', "maya@thedocument.test")
        mp.fill('input[type="password"]', "demo1234")
        mp.click('button[type="submit"]')
        mp.wait_for_url("**/dashboard", timeout=20000)
        mp.screenshot(path=os.path.join(SHOTS, "14-dashboard-mobile.png"))
        check("dashboard works on a phone", "Total earnings" in mp.content())
        mob.close()

        real_errors = [e for e in errors if "favicon" not in e.lower()]
        check("no uncaught JS errors anywhere in the run", not real_errors, str(real_errors[:3]))

        browser.close()

    print("\n%d/%d checks passed" % (sum(1 for _, ok, _ in results if ok), len(results)))


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print("\nFAILED: %s" % e)
        print("%d/%d checks passed before the failure" % (sum(1 for _, ok, _ in results if ok), len(results)))
        sys.exit(1)
