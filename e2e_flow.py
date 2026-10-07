"""
End-to-end walk of the whole contributor workflow against the running build.
Signup -> draft -> media -> submit -> editorial edit -> approve + payout ->
earnings visible -> admin flags Verified -> piece live on the public feed.

Every step asserts, and screenshots land in shots/ at 1280x720 (phone shots at
390x780) so nothing exceeds the chat image limits.
"""

import re
import os
import sys
import time
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3300")
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(SHOTS, exist_ok=True)

DESKTOP = {"width": 1280, "height": 720}
PHONE = {"width": 390, "height": 780}

STAMP = str(int(time.time()))
NEW_EMAIL = f"rosa.{STAMP}@thedocument.test"
NEW_PASS = "demo1234"
NEW_PASS2 = "demo-changed-5678"
INBOX_EMAIL = f"probe.inbox.{STAMP}@thedocument.test"
REJECT_TITLE = "The minutes nobody has seen"
NEW_NAME = "Rosa Delgado"
HEADLINE = "The allotment that became a flood defence"
BN_HEADLINE = "যে বরাদ্দ জমি বন্যা প্রতিরোধের বাঁধ হয়ে উঠল"
BN_DEK = "এগারো বছর ধরে কাউন্সিল জমিটি কিনতে রাজি হয়নি। তারপর পানি এল।"
BN_BODY = (
    "জমিটি সড়কের চেয়ে দুই মিটার নিচে, আর পুরো গল্পটা সেখানেই।\n\n"
    "## এগারো বছরের প্রত্যাখ্যান\n"
    "২০১৪ সালে নামমাত্র দামে জমিটি কাউন্সিলকে দেওয়ার প্রস্তাব করা হয়েছিল। চারটি আলাদা কমিটির কার্যবিবরণীতে একই আপত্তি লেখা আছে: "
    "জমি কেনার জন্য বাজেট নেই, আইনি বাধ্যবাধকতাও নেই।\n\n"
    "> \"আমাদের বলা হয়েছিল এটি শখের বাগান। এখন এটিই সারি সারি বাড়ি আর খালের মাঝের একমাত্র ঢাল।\"\n\n"
    "২০২৩ সালের বন্যায় প্লটগুলো নয়শো ঘনমিটার পানি দুই দিনের বেশি ধরে রেখেছিল। পরে জমা দেওয়া প্রকৌশল নোটে জায়গাটিকে বলা হয়েছে "
    "অনানুষ্ঠানিক জলাধার, যার সহজ অর্থ: কাউন্সিল যে কাজের জন্য কখনো টাকা দেয়নি, জমিটি সেটিই করেছে।"
)
BOTH_EN_TITLE = "The ferry contract nobody costed"
BOTH_BN_TITLE = "যে ফেরি চুক্তির খরচ কেউ হিসাব করেনি"
# filled in once the test account exists, so the admin check can hit its API
NEW_USER_ID = [""]

# While the site sits behind the preview password, every context needs it.
GATE = (
    {"username": os.environ.get("GATE_USER", "preview"), "password": os.environ["GATE_PASSWORD"]}
    if os.environ.get("GATE_PASSWORD")
    else None
)

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))
    if not ok:
        raise AssertionError(name + " " + detail)


# Clicking before React has hydrated does nothing at all, and over the internet
# hydration takes noticeably longer than it does against localhost.
SETTLE_MS = 250 if ("127.0.0.1" in BASE or "localhost" in BASE) else 1500


def go(page, url, timeout=45000):
    """
    Navigate and settle.

    `networkidle` is unreliable against a real server over TLS - one slow or
    kept-alive connection and it never fires. Waiting for the document, then
    for the page scripts, is both faster and steadier.
    """
    page.goto(url, wait_until="domcontentloaded", timeout=timeout)
    page.wait_for_selector("body", timeout=timeout)
    try:
        page.wait_for_load_state("load", timeout=timeout)
    except Exception:
        pass
    page.wait_for_timeout(SETTLE_MS)


def wait_article(page, timeout=30000):
    """The loading skeleton now shows first, so wait for the real article."""
    page.wait_for_selector(".prose-article", timeout=timeout)
    page.wait_for_timeout(200)


def norm(text):
    """Intl puts a non-breaking space between the currency code and the amount."""
    return text.replace("\u00a0", " ")


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
    go(page, f"{BASE}/login")
    # /login sends a signed-in visitor to their dashboard, so a leftover session
    # from an earlier step would leave no form to fill.
    if page.locator('input[type="email"]').count() == 0:
        sign_out(page)
        go(page, f"{BASE}/login")
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_url(lambda u: "/login" not in u, timeout=20000)


def sign_out(page):
    # the root is the Bangla site now, where the button reads সাইন আউট
    go(page, f"{BASE}/en")
    button = page.locator('button:has-text("Sign out")')
    if button.count():
        button.first.click()
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
        ctx = browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "console",
            lambda m: errors.append(m.text) if m.type == "error" else None,
        )

        # --- 1. public feed -------------------------------------------------
        go(page, BASE)
        home = page.content()
        check(
            "the default home page is the Bangla feed",
            # the rail is headed "আজকের আরও খবর" normally and "নির্বাচিত" once
            # something is featured, so accept either rather than depending on
            # what the database happens to hold
            "সর্বশেষ" in home and ("আজকের আরও খবর" in home or "নির্বাচিত" in home),
        )
        check(
            "the English switch is a visible button, not a hidden link",
            page.locator("header a:has-text('English')").first.is_visible(),
        )
        page.click("header a:has-text('English')")
        page.wait_for_url("**/en", timeout=20000)
        page.wait_for_selector("main", timeout=20000)
        page.wait_for_timeout(SETTLE_MS)
        check("the switch lands on the English site at /en", page.url.rstrip("/").endswith("/en"))
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

        # the old /bn addresses still resolve rather than 404
        go(page, f"{BASE}/bn")
        check("the old /bn address redirects to the new Bangla root", page.url.rstrip("/") == BASE)
        shot(page, "21-home-bangla-default.png")
        go(page, f"{BASE}/en")

        # --- 2. article page ------------------------------------------------
        # .first: the headline is a link in both the lead card and the rail
        page.locator("a:has-text('The night bus that never came')").first.click()
        page.wait_for_url("**/en/article/**", timeout=20000)
        wait_article(page)
        check("the headline link reaches the article", "/article/" in page.url, page.url)
        check("article page renders the body copy", "00:41" in page.content())
        check("verified badge shows on the byline", page.locator("svg[aria-label], span:has-text('Verified contributor')").count() > 0)
        shot(page, "02-article-desktop.png")

        # --- 3. signup ------------------------------------------------------
        go(page, f"{BASE}/register")
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
        check(
            "a new piece opens in Bangla, not English",
            page.locator("select").nth(1).input_value() == "BN",
            page.locator("select").nth(1).input_value(),
        )
        page.select_option("select >> nth=1", "EN")
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
        page.wait_for_selector("text=Draft saved", timeout=20000)
        check("saving a draft confirms it in words", "come back to it any time" in page.content())
        shot(page, "04-composer.png", scroll="top")

        # reload proves the copy really persisted, not just sat in React state
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(SETTLE_MS)
        check(
            "draft survives a reload (saved server-side, not in the browser)",
            HEADLINE in page.content() and "attenuation basin" in page.content(),
        )

        # --- 5. submit ------------------------------------------------------
        # The desk cannot chase a story it has no number for, so a submission
        # without one has to be refused rather than quietly accepted.
        page.click('button:has-text("Submit for review")')
        page.wait_for_timeout(SETTLE_MS * 3)
        check(
            "a submission with no contact number is refused",
            "contact number" in page.inner_text("body").lower()
            and "Submitted for review" not in page.content(),
        )
        page.fill('input[placeholder="01XXXXXXXXX"] >> nth=0', "01712345678")
        page.fill('input[placeholder="01XXXXXXXXX"] >> nth=1', "01812345678")
        shot(page, "28-submission-contact.png", scroll="section:has-text('reach you about this piece')")
        page.click('button:has-text("Submit for review")')
        page.wait_for_selector("text=Submitted for review", timeout=20000)
        check(
            "submitting shows a confirmation with a way back",
            "Back to my desk" in page.content(),
        )
        page.click('a:has-text("Back to my desk")')
        page.wait_for_url("**/dashboard", timeout=20000)
        check("the piece is now in review", "In review" in page.content())
        go(page, f"{BASE}/dashboard")
        check("dashboard shows it as in review", "In review" in page.content())
        check(
            "a contributor with no payment details is prompted for them",
            "Add your payment details" in page.content(),
        )
        shot(page, "05-dashboard-contributor.png")

        # --- 5b. payment details on the contributor profile ------------------
        page.click('a:has-text("Add payment details")')
        page.wait_for_url("**/dashboard/payout", timeout=20000)
        page.select_option("select", "BKASH")
        page.fill('input[placeholder="Exactly as it appears on the account"]', NEW_NAME)
        page.fill('input[placeholder="01XXXXXXXXX"]', "12345")
        page.click('button:has-text("payment details")')
        page.wait_for_selector("text=Use an 11-digit number", timeout=20000)
        check("a malformed bKash number is refused", "Use an 11-digit number" in page.content())

        page.fill('input[placeholder="01XXXXXXXXX"]', "01819 445 203")
        shot(page, "16-payout-form.png")
        page.click('button:has-text("payment details")')
        page.wait_for_selector("text=Payment details saved", timeout=20000)
        check("payment details save", "Payment details saved" in page.content())

        go(page, f"{BASE}/dashboard")
        check(
            "the dashboard shows the method and only the last four digits",
            "bKash" in page.content() and "5203" in page.content() and "01819" not in page.content(),
        )

        # a contributor must not reach the newsroom
        go(page, f"{BASE}/editorial")
        check("a contributor is bounced out of the editorial queue", "/dashboard" in page.url)
        go(page, f"{BASE}/admin")
        check("a contributor is bounced out of admin", "/dashboard" in page.url)

        # --- 6. editor reviews ---------------------------------------------
        sign_out(page)
        sign_in(page, "editor@thedocument.test", "demo1234")
        go(page, f"{BASE}/editorial")
        check("editor sees the queue with the new submission", HEADLINE in page.content())
        shot(page, "06-editorial-queue.png")

        page.locator(f'li:has-text("{HEADLINE}")').last.locator('a:has-text("Review")').click()
        page.wait_for_url("**/editorial/**", timeout=20000)
        page.wait_for_timeout(SETTLE_MS)
        check("review screen loads the submitted copy", "attenuation basin" in page.content())

        check(
            "the queue flags that the Bangla version is missing",
            "Bangla version missing" in page.content(),
        )

        # editor fine-tunes the headline, then approves with a payout
        edited = HEADLINE + " - and the council that refused to buy it"
        page.fill('input.font-serif >> nth=0', edited)
        page.fill('input[inputmode="decimal"]', "132.50")
        page.fill("textarea >> nth=1", "Tightened the headline and cut one line from the close. Good find.")
        shot(page, "07-review-panel.png", scroll="section:has-text('DECISION'), section:has(h2:text('Decision'))")

        # publishing before the translation exists must fail
        page.click('button:has-text("Approve and publish")')
        page.wait_for_selector("text=before publishing", timeout=20000)
        check(
            "a piece cannot be published until the editor has translated it",
            "Add the Bangla version before publishing" in page.content(),
        )

        # --- 6b. the editor writes the Bangla version ------------------------
        page.fill('input[placeholder="শিরোনাম"]', BN_HEADLINE)
        page.fill('input[placeholder="সংক্ষিপ্ত বিবরণ"]', BN_DEK)
        page.fill('textarea[placeholder="অনুবাদ এখানে লিখুন"]', BN_BODY)
        shot(
            page,
            "17-translation-panel.png",
            scroll="section:has-text('Translation - বাংলা (Bangla)')",
        )
        page.click('button:has-text("Save translation")')
        page.wait_for_selector("text=version saved", timeout=20000)
        check("the Bangla version saves", "বাংলা (Bangla) version saved" in page.content())

        page.click('button:has-text("Approve and publish")')
        page.wait_for_selector("text=Published.", timeout=20000)
        check("approval confirms the payout the writer will see", "132.50" in page.content())
        shot(page, "08-approved.png")

        # --- 7. earnings ----------------------------------------------------
        sign_out(page)
        sign_in(page, NEW_EMAIL, NEW_PASS)
        go(page, f"{BASE}/dashboard")
        body = norm(page.content())
        check("payout appears on the contributor's article", "BDT 132.50" in body)
        check("cumulative earnings total updates", "Total earnings" in body and "BDT 132.50" in body)
        check("editor's note reaches the writer", "Tightened the headline" in body)
        check("the editor's headline edit is what the writer now sees", "refused to buy it" in body)
        shot(page, "09-dashboard-earnings.png")

        # --- 8. live on the public site -------------------------------------
        go(page, f"{BASE}/en?category=Culture")
        check("approved piece is live on the public feed", "refused to buy it" in page.content())
        shot(page, "10-public-feed-culture.png")

        # --- 8b. the same piece on the Bangla side of the site ---------------
        go(page, BASE)
        bn_home = page.content()
        # The owner removed the seeded demo pieces from his live site, so these
        # three checks only mean something where the seed is present.
        seeded = BN_HEADLINE in bn_home or "পুরোনো খালের ওপর নতুন সড়ক" in bn_home
        check(
            "the Bangla front page is in Bangla",
            "সর্বশেষ" in bn_home and ("আজকের আরও খবর" in bn_home or "নির্বাচিত" in bn_home),
        )
        if not seeded:
            print("SKIP  the seeded demo pieces are not on this site, so the checks that",
                  "read them are stood down. They run in full against a seeded database.")
        if seeded:
            check("the editor's Bangla headline is live", BN_HEADLINE in bn_home)
            check(
                "a piece written in Bangla by a contributor is also there",
                "পুরোনো খালের ওপর নতুন সড়ক" in bn_home,
            )
            shot(page, "18-bangla-feed.png")

            page.locator(f"a:has-text('{BN_HEADLINE}')").first.click()
            page.wait_for_url("**/article/**", timeout=20000)
            wait_article(page)
            check("the Bangla article renders the translated body", BN_BODY[:24] in page.content())
            headings = page.evaluate(
                """() => [...document.querySelectorAll('.prose-article h2')].map((h) => h.innerText.length)"""
            )
            check(
                "a heading written straight above its paragraph stays a heading",
                all(n < 90 for n in headings),
                str(headings),
            )
            check("the page is marked as Bangla for screen readers", 'lang="bn"' in page.content())
            font = page.evaluate(
                "getComputedStyle(document.querySelector('.prose-article')).fontFamily"
            )
            check(
                "Bangla copy is set in a Bengali reading face, not a fallback box",
                any(name in font for name in ("Hind Siliguri", "Anek Bangla", "Tiro Bangla", "Bengali")),
                font,
            )
            shot(page, "19-bangla-article.png")

            # A gallery appears only where there is a second picture to show. This
            # piece has one, the one we are on has nothing but its cover.
            check(
                "a piece with nothing but a cover shows no Evidence section",
                "প্রমাণ" not in page.content(),
            )
            bn_story = page.url
            go(page, f"{BASE}/article/notun-sorok-puratan-khaler-opore")
            wait_article(page)
            check("readers get an Evidence gallery where there is evidence", "প্রমাণ" in page.content())
            # The cover is already at the top of the page; showing it again as
            # evidence is the same photo twice.
            cover_twice = page.evaluate(
                """() => {
                     const cover = document.querySelector('article figure img');
                     if (!cover) return false;
                     const gallery = [...document.querySelectorAll('section img')]
                       .map((i) => i.getAttribute('src'));
                     return gallery.includes(cover.getAttribute('src'));
                   }"""
            )
            check("the cover photo is not repeated in the Evidence gallery", not cover_twice)
            shot(page, "28-evidence.png", scroll="section:has-text('প্রমাণ')")
            go(page, bn_story)
            wait_article(page)

            # the language switch returns to the English version of the same story
            page.click("text=Read in English")
            page.wait_for_url("**/en/article/**", timeout=20000)
            wait_article(page)
            check("the language switch lands on the English version", "refused to buy it" in page.content())

            # a Bangla original is readable in English too
            go(page, f"{BASE}/en/article/notun-sorok-puratan-khaler-opore-en")
            wait_article(page)
            check(
                "the desk's English version of a Bangla original is live",
                "A new road over an old canal" in page.content(),
            )

        # --- 8b1. the contributor's own profile ------------------------------
        go(page, f"{BASE}/dashboard/profile")
        page.fill('input[name="name"]', NEW_NAME)
        page.fill('textarea[name="bio"]', "Covers transport and public money in Rajshahi.")
        page.fill('input[name="publicEmail"]', "rosa.public@example.com")
        page.fill('input[name="phone"]', "01711 000 111")
        page.fill('input[name="website"]', "not-a-url")
        page.fill('input[name="location"]', "Rajshahi")
        page.click('button:has-text("Save profile")')
        page.wait_for_selector("text=Check the form", timeout=20000)
        check(
            "a malformed website is refused, and the field says so",
            "Check the form" in page.content(),
        )

        page.fill('input[name="website"]', "https://example.com/rosa")
        with page.expect_file_chooser() as fc:
            page.click('button:has-text("Upload a photo")')
        fc.value.set_files(photo)
        page.wait_for_selector("text=Photo updated", timeout=20000)
        check("a contributor can upload a profile photo", "Photo updated" in page.content())

        page.click('button:has-text("Save profile")')
        page.wait_for_selector("text=Profile saved", timeout=20000)
        check("the profile saves", "Profile saved" in page.content())
        shot(page, "30-my-profile.png")

        # and readers can see it
        go(page, f"{BASE}/en/author/{NEW_USER_ID[0] or ''}") if NEW_USER_ID[0] else None

        # --- 8b2. changing your own password ---------------------------------
        sign_out(page)
        sign_in(page, NEW_EMAIL, NEW_PASS)
        go(page, f"{BASE}/dashboard/account")
        page.fill('input[autocomplete="current-password"]', "wrong-password")
        page.fill('input[autocomplete="new-password"] >> nth=0', NEW_PASS2)
        page.fill('input[autocomplete="new-password"] >> nth=1', NEW_PASS2)
        page.click('button:has-text("Change password")')
        page.wait_for_selector("text=not your current password", timeout=20000)
        check("the wrong current password is refused", "not your current password" in page.content())

        page.fill('input[autocomplete="current-password"]', NEW_PASS)
        page.fill('input[autocomplete="new-password"] >> nth=0', NEW_PASS2)
        page.fill('input[autocomplete="new-password"] >> nth=1', NEW_PASS2)
        page.click('button:has-text("Change password")')
        page.wait_for_selector("text=Password changed", timeout=20000)
        check("the password changes", "Password changed" in page.content())
        shot(page, "23-account-password.png")

        sign_out(page)
        go(page, f"{BASE}/login")
        page.fill('input[type="email"]', NEW_EMAIL)
        page.fill('input[type="password"]', NEW_PASS)
        page.click('button[type="submit"]')
        page.wait_for_selector("text=did not match", timeout=20000)
        check("the old password no longer works", "did not match" in page.content())
        sign_in(page, NEW_EMAIL, NEW_PASS2)
        check("the new password works", "/login" not in page.url)

        # --- 8b3. the public contributor page --------------------------------
        roster_for_profile = page.request.get(f"{BASE}/api/drafts")  # keeps the session warm
        me = page.request.get(f"{BASE}/api/profile").json()["user"]
        NEW_USER_ID[0] = me["id"]
        go(page, f"{BASE}/en/author/{me['id']}")
        body = page.content()
        check("the contributor has a public page", NEW_NAME in body)
        check("with their introduction", "transport and public money" in body)
        check("and the contact details they chose", "rosa.public@example.com" in body)
        check("but never their sign-in email", NEW_EMAIL not in body)
        shot(page, "31-author-page.png")

        go(page, f"{BASE}/author/{me['id']}")
        check("the Bangla version of the page works too", NEW_NAME in page.content())

        # --- 8c. a contributor writing BOTH versions themselves --------------
        sign_out(page)
        sign_in(page, NEW_EMAIL, NEW_PASS2)
        go(page, f"{BASE}/dashboard")
        page.click('button:has-text("Start a new piece")')
        page.wait_for_url("**/dashboard/write/**", timeout=20000)
        # written in English here, so the second version the writer adds is Bangla
        page.select_option("select >> nth=1", "EN")
        page.fill('input[placeholder="Headline"]', BOTH_EN_TITLE)
        page.fill(
            'input[placeholder="One-line summary shown in the feed"]',
            "Two years of minutes, and not one of them mentions the cost.",
        )
        page.fill(
            "textarea >> nth=0",
            "The committee met eleven times before anyone asked what the ferry would cost to run.\n\n"
            "## What the minutes show\nEvery meeting records the same three items and none of them is the operating subsidy. "
            "The figure appears for the first time in a footnote eighteen months after the contract was signed.\n\n"
            "> \"Nobody asked, so nobody answered.\"\n\n"
            "The subsidy is now the second largest line in the transport budget.",
        )
        page.click('button:has-text("Add it")')
        page.fill('input[placeholder="শিরোনাম"]', BOTH_BN_TITLE)
        page.fill('input[placeholder="সংক্ষিপ্ত বিবরণ"]', "দুই বছরের কার্যবিবরণী, একবারও খরচের উল্লেখ নেই।")
        page.fill(
            'textarea[placeholder="এখানে বাংলা সংস্করণ লিখুন"]',
            "ফেরি চালাতে কত খরচ হবে, কমিটির এগারোটি সভার আগে কেউ সে প্রশ্ন করেনি।\n\n"
            "## কার্যবিবরণী যা বলছে\nপ্রতিটি সভায় একই তিনটি বিষয় লেখা আছে, তার একটিও পরিচালন ভর্তুকি নয়। "
            "চুক্তি সইয়ের আঠারো মাস পর একটি পাদটীকায় প্রথমবার সংখ্যাটি আসে।\n\n"
            "> \"কেউ প্রশ্ন করেনি, তাই কেউ উত্তরও দেয়নি।\"\n\n"
            "এই ভর্তুকি এখন পরিবহন বাজেটের দ্বিতীয় বৃহত্তম খাত।",
        )
        page.click('button:has-text("Save বাংলা (Bangla) version")')
        page.wait_for_selector("text=now goes to both sections", timeout=20000)
        check(
            "a contributor can write the second language themselves",
            "Both sections" in page.content(),
        )
        shot(page, "22-contributor-both-languages.png", scroll="section:has-text('Also submit in')")
        page.fill('input[placeholder="01XXXXXXXXX"] >> nth=0', "01712345678")
        page.click('button:has-text("Submit for review")')
        page.wait_for_selector("text=Submitted for review", timeout=20000)

        sign_out(page)
        sign_in(page, "editor@thedocument.test", "demo1234")
        go(page, f"{BASE}/editorial")
        queue_row = page.locator(f'li:has-text("{BOTH_EN_TITLE}")').last
        check(
            "the queue shows that both languages arrived together",
            "both languages" in queue_row.inner_text(),
        )
        queue_row.locator('a:has-text("Review")').click()
        page.wait_for_url("**/editorial/**", timeout=20000)
        page.wait_for_timeout(SETTLE_MS)
        check(
            "the editor sees the contributor's own second version, not an empty box",
            "Supplied by the contributor" in page.content() and BOTH_BN_TITLE in page.content(),
        )
        page.fill('input[inputmode="decimal"]', "90.00")
        page.click('button:has-text("Approve and publish")')
        page.wait_for_selector("text=Published.", timeout=20000)
        check("a piece that arrived in both languages publishes straight away", "90.00" in page.content())

        go(page, BASE)
        check("it is live on the Bangla site", BOTH_BN_TITLE in page.content())
        go(page, f"{BASE}/en")
        check("and on the English site", BOTH_EN_TITLE in page.content())

        # --- 8d. featuring, sections and related articles --------------------
        # (still signed in as the editor from the step above)
        go(page, f"{BASE}/editorial?status=APPROVED")
        # several runs leave rows with the same headline, so pin to one
        row = page.locator(f'li:has-text("{BOTH_EN_TITLE}")').first
        # the database may already carry a featured flag from an earlier run, so
        # drive it to the state we want rather than assuming it starts off
        if row.locator('button:has-text("Feature on front page")').count():
            row.locator('button:has-text("Feature on front page")').click()
        expect(row.locator('button:has-text("On the front page")')).to_be_visible(timeout=20000)
        check("an editor can put a published piece on the front page", True)

        go(page, f"{BASE}/en")
        # The rails have h2 headings of their own now, so pin to the first
        # article card - that is the lead whatever the surrounding furniture.
        lead = page.locator("main article h2").first.inner_text()
        check(
            "the featured piece leads the front page, not just the newest",
            BOTH_EN_TITLE in lead,
            lead,
        )
        shot(page, "24-front-page-featured.png")

        # sections
        go(page, f"{BASE}/en/section/politics")
        body = page.content()
        check("the Politics section page lists its own stories", "night bus" in body)
        check("and nothing from another section", "corner shop" not in body)
        shot(page, "25-section-page.png")
        go(page, f"{BASE}/section/politics")
        check("the Bangla section page works too", "যে রাতের বাস কখনো আসেনি" in page.content())

        r = page.request.get(f"{BASE}/en/section/not-a-section")
        check("an invented section is a 404, not a blank page", r.status == 404, f"got {r.status}")

        # related articles
        go(page, f"{BASE}/en/article/the-night-bus-that-never-came")
        wait_article(page)
        check("an article offers more to read", "More on this" in page.content())
        related = page.locator("section:has-text('More on this') a").count()
        check("related links are real links", related >= 1, str(related))

        # --- 9. admin: roles, verified flag, payment settings ---------------
        sign_out(page)
        sign_in(page, "admin@thedocument.test", "demo1234")
        go(page, f"{BASE}/people")
        check("the owner sees every account", NEW_EMAIL in page.content())
        roster = page.request.get(f"{BASE}/api/admin/users").json()["users"]
        NEW_USER_ID[0] = next(u["id"] for u in roster if u["email"] == NEW_EMAIL)

        # search: the whole point of the screen
        page.fill('input[placeholder="Search by name, email or phone"]', NEW_EMAIL.split("@")[0])
        page.wait_for_timeout(SETTLE_MS)
        check(
            "searching by email narrows the list to one person",
            page.locator("tbody tr").count() == 1,
            str(page.locator("tbody tr").count()),
        )
        page.fill('input[placeholder="Search by name, email or phone"]', "Maya")
        page.wait_for_timeout(SETTLE_MS)
        # read the table, not page.content(): the server payload in the HTML
        # carries every row regardless of what the client is filtering to.
        check("searching by name works too", "maya@thedocument.test" in page.inner_text("tbody"))
        page.fill('input[placeholder="Search by name, email or phone"]', "")
        page.click('button:has-text("Editor")')
        page.wait_for_timeout(SETTLE_MS)
        table = page.inner_text("tbody")
        check(
            "the role filter shows only editors",
            "editor@thedocument.test" in table and "sam@thedocument.test" not in table,
            table.replace("\n", " | ")[:160],
        )
        page.click('button:has-text("Everyone")')
        shot(page, "29-people-search.png")

        row = page.locator(f'tr:has-text("{NEW_EMAIL}")').first
        row.locator('button:has-text("flag as verified")').click()
        expect(row.locator('button:has-text("Verified")')).to_be_visible(timeout=20000)
        check("the owner can flag a contributor as Verified", True)

        # the owner can hand out any role
        page.locator(f'tr:has-text("{NEW_EMAIL}")').first.locator("select").select_option("EDITOR")
        page.wait_for_timeout(800)
        roster = page.request.get(f"{BASE}/api/admin/users").json()["users"]
        made_editor = next(u for u in roster if u["email"] == NEW_EMAIL)
        check("the owner can promote someone to editor", made_editor["role"] == "EDITOR")

        # settings live on their own screen now, and only the owner gets there
        go(page, f"{BASE}/admin")
        check("the owner reaches Settings", "/admin" in page.url)
        page.fill('input[inputmode="decimal"] >> nth=0', "45.00")
        page.click('button:has-text("Save settings")')
        page.wait_for_selector("text=Saved", timeout=20000)
        check("payment settings save", "Saved" in page.content())
        shot(page, "11-admin.png")

        # site settings: wording and advertising, no developer needed
        page.fill('#site-settings input[name="siteNameEn"]', "The Document Daily")
        page.check('#site-settings input[name="adsEnabled"]')
        # The code boxes now sit behind a fold, because most owners upload a
        # picture instead; open it the way a person would.
        page.click('summary:has-text("Or paste code from an ad network")')
        page.wait_for_timeout(300)
        page.fill('#site-settings textarea[name="adHomeHtml"]', '<div id="ad-home-test">HOUSE AD</div>')
        page.click('button:has-text("Save site settings")')
        page.wait_for_selector("text=Refresh the public site", timeout=20000)
        check("site settings save", "Refresh the public site" in page.content())

        go(page, f"{BASE}/en")
        check("the new site name reaches the public pages", "The Document Daily" in page.content())
        check("the advertising slot renders what was pasted", "HOUSE AD" in page.content())
        shot(page, "26-ads-and-name.png")

        # put the name back so the screenshots after this look like the real site
        go(page, f"{BASE}/admin")
        page.fill('#site-settings input[name="siteNameEn"]', "The Document")
        page.click('button:has-text("Save site settings")')
        page.wait_for_selector("text=Refresh the public site", timeout=20000)

        # payment details: the owner can see them, an editor never can
        go(page, f"{BASE}/people")
        row = page.locator(f'tr:has-text("{NEW_EMAIL}")').first
        check("the owner sees the payout method on the people list", "bKash" in row.inner_text())
        row.locator('button:has-text("bKash")').click()
        page.wait_for_timeout(800)
        check(
            "the owner can reveal the full wallet number to actually pay someone",
            "01819445203" in row.inner_text(),
            row.inner_text()[:160],
        )
        shot(page, "20-admin-payout.png", scroll=f'tr:has-text("{NEW_EMAIL}")')

        # self-demotion guard
        resp = page.request.patch(
            f"{BASE}/api/admin/users/{page.evaluate('1')}", data={"role": "EDITOR"}
        )
        check("a bogus user id is rejected, not silently applied", resp.status >= 400)

        # --- 9a2. staff editing a profile, and suspension ---------------------
        go(page, f"{BASE}/people/{NEW_USER_ID[0]}")
        check("staff can open one person's record", NEW_NAME in page.content())
        page.fill('textarea[name="bio"]', "Edited by the desk: covers transport in Rajshahi.")
        page.click('button:has-text("Save profile")')
        page.wait_for_selector("text=Profile saved", timeout=20000)
        check("an admin can edit a contributor's profile", "Profile saved" in page.content())

        go(page, f"{BASE}/en/author/{NEW_USER_ID[0]}")
        check("the desk's edit shows on the public page", "Edited by the desk" in page.content())

        go(page, f"{BASE}/people/{NEW_USER_ID[0]}")
        check(
            "the suspend button stays disabled until a reason is given",
            page.locator('button:has-text("Suspend")').last.is_disabled(),
        )
        page.fill(
            'input[placeholder="Why this account is being suspended"]',
            "Testing the suspension flow",
        )
        page.locator('button:has-text("Suspend")').last.click()
        page.wait_for_selector("text=is suspended", timeout=20000)
        check("an admin can suspend a contributor", "is suspended" in page.content())
        shot(page, "32-suspended.png")

        r = page.request.get(f"{BASE}/en/author/{NEW_USER_ID[0]}")
        check("a suspended contributor's public page is withdrawn", r.status == 404, f"got {r.status}")

        suspended_ctx = ctx.browser.new_context(http_credentials=GATE)
        sp = suspended_ctx.new_page()
        go(sp, f"{BASE}/login")
        sp.fill('input[type="email"]', NEW_EMAIL)
        sp.fill('input[type="password"]', NEW_PASS2)
        sp.click('button[type="submit"]')
        sp.wait_for_selector("text=did not match", timeout=20000)
        check("a suspended contributor cannot sign in", "did not match" in sp.content())
        suspended_ctx.close()

        page.click('button:has-text("Lift the suspension")')
        page.wait_for_selector("text=Suspend this account", timeout=20000)
        check("and the suspension can be lifted again", "Suspend this account" in page.content())

        r = page.request.get(f"{BASE}/en/author/{NEW_USER_ID[0]}")
        check("the public page comes back", r.status == 200, f"got {r.status}")

        # --- 9b. an editor's limits ------------------------------------------
        editor_only = ctx.browser.new_context(http_credentials=GATE)
        ep2 = editor_only.new_page()
        sign_in(ep2, "editor@thedocument.test", "demo1234")

        go(ep2, f"{BASE}/people")
        check("an editor can open the people list", "People" in ep2.content())
        check(
            "an editor sees no Settings link in the navigation",
            ep2.locator('nav a:has-text("Settings")').count() == 0,
        )

        r = ep2.request.patch(f"{BASE}/api/admin/site", data={"siteNameEn": "Hijacked"})
        check("an editor cannot change the site design", r.status == 403, f"got {r.status}")
        r = ep2.request.patch(f"{BASE}/api/admin/settings", data={"defaultPayout": 1})
        check("an editor cannot change payment settings", r.status == 403, f"got {r.status}")
        go(ep2, f"{BASE}/admin")
        check("an editor opening Settings is sent to People", ep2.url.endswith("/people"))

        # but they can make a contributor an editor, which is the point
        roster = ep2.request.get(f"{BASE}/api/admin/users").json()["users"]
        a_contributor = next(u for u in roster if u["role"] == "CONTRIBUTOR")
        r = ep2.request.patch(
            f"{BASE}/api/admin/users/{a_contributor['id']}", data={"role": "EDITOR"}
        )
        check("an editor can promote a contributor to editor", r.status == 200, f"got {r.status}")

        # promoting is not the same as being able to demote a colleague
        r = ep2.request.patch(
            f"{BASE}/api/admin/users/{a_contributor['id']}", data={"role": "CONTRIBUTOR"}
        )
        check(
            "an editor cannot demote a fellow editor - only the owner can",
            r.status == 403,
            f"got {r.status}",
        )

        owner_row = next(u for u in roster if u["role"] == "SUPERADMIN")
        r = ep2.request.patch(f"{BASE}/api/admin/users/{owner_row['id']}", data={"role": "EDITOR"})
        check("an editor cannot demote the owner", r.status == 403, f"got {r.status}")
        another_contributor = next(
            (u for u in roster if u["role"] == "CONTRIBUTOR" and u["id"] != a_contributor["id"]),
            None,
        )
        if another_contributor:
            r = ep2.request.patch(
                f"{BASE}/api/admin/users/{another_contributor['id']}", data={"role": "ADMIN"}
            )
            check("an editor cannot create an admin", r.status == 403, f"got {r.status}")
        editor_only.close()

        # put the promoted contributor back, as the owner
        r = page.request.patch(
            f"{BASE}/api/admin/users/{a_contributor['id']}", data={"role": "CONTRIBUTOR"}
        )
        check("the owner can undo that promotion", r.status == 200, f"got {r.status}")

        # --- 10. API spot checks -------------------------------------------
        anon = ctx.browser.new_context(http_credentials=GATE)
        anon_page = anon.new_page()
        r = anon_page.request.get(f"{BASE}/api/drafts")
        check("GET /api/drafts without a session is 401", r.status == 401, f"got {r.status}")
        r = anon_page.request.get(f"{BASE}/api/editorial/queue")
        check("GET /api/editorial/queue without a session is 401", r.status == 401, f"got {r.status}")
        editor_ctx = ctx.browser.new_context(http_credentials=GATE)
        ep = editor_ctx.new_page()
        sign_in(ep, "editor@thedocument.test", "demo1234")
        r = ep.request.get(f"{BASE}/api/admin/users/{NEW_USER_ID[0]}/payout")
        check("an editor cannot read anyone's payment details", r.status == 403, f"got {r.status}")
        r = ep.request.get(f"{BASE}/api/admin/users")
        check("but an editor can read the people list", r.status == 200, f"got {r.status}")
        editor_ctx.close()

        r = anon_page.request.get(f"{BASE}/api/articles")
        check("GET /api/articles is public", r.status == 200)
        feed = r.json()
        check(
            "public API only returns approved work",
            feed["total"] >= 5 and all("permit office" not in a["title"] for a in feed["articles"]),
        )
        anon.close()

        # --- 10b. the wait after clicking a headline --------------------------
        go(page, f"{BASE}/en")
        loading_seen = page.evaluate(
            """() => new Promise((resolve) => {
                 const link = [...document.querySelectorAll('main a[href*="/article/"]')][0];
                 if (!link) return resolve('no link');
                 const observer = new MutationObserver(() => {
                   if (document.querySelector('[role="progressbar"][aria-busy="true"]')) {
                     observer.disconnect();
                     resolve('seen');
                   }
                 });
                 observer.observe(document.body, { childList: true, subtree: true });
                 link.click();
                 setTimeout(() => { observer.disconnect(); resolve('not seen'); }, 5000);
               })"""
        )
        check(
            "clicking a headline shows a loading bar while the article arrives",
            loading_seen == "seen",
            loading_seen,
        )
        wait_article(page)

        # the loading bar must not turn a missing page into a 200
        for missing in ("/en/section/not-a-section", "/en/article/does-not-exist"):
            r = page.request.get(f"{BASE}{missing}")
            check(f"{missing} is still a real 404", r.status == 404, f"got {r.status}")

        # --- 10b. the internal inbox -----------------------------------------
        # A contributor writes to the desk, any editor can answer it, and the
        # reply comes back with an unread badge. Two separate browser contexts,
        # because the whole point is that these are two different people.
        cp = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        cpage = cp.new_page()
        # A brand-new contributor, because the account from earlier in the run
        # has since been promoted to editor.
        go(cpage, f"{BASE}/register")
        cpage.fill('input[autocomplete="name"]', "Nadia Rahman")
        cpage.fill('input[type="email"]', INBOX_EMAIL)
        cpage.fill('input[type="password"]', NEW_PASS)
        cpage.click('button[type="submit"]')
        cpage.wait_for_url("**/dashboard", timeout=20000)

        check(
            "the logged-in strip names the person and their role",
            "You are logged in as" in cpage.content() and "Nadia Rahman" in cpage.content(),
        )

        go(cpage, f"{BASE}/inbox")
        cpage.click('button:has-text("Message the newsroom")')
        cpage.fill('input[maxlength="120"]', "Can I file a follow-up on the allotment story?")
        cpage.fill("textarea", "I have two more interviews lined up for next week.")
        cpage.click('button:has-text("Send")')
        cpage.wait_for_url("**/inbox/**", timeout=20000)
        check(
            "a contributor can open a conversation with the newsroom",
            "two more interviews" in cpage.content(),
        )
        shot(cpage, "29-inbox-contributor.png", scroll="top")

        thread_id = cpage.url.rsplit("/", 1)[-1]

        ip = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        epage = ip.new_page()
        sign_in(epage, "editor@thedocument.test", "demo1234")
        go(epage, f"{BASE}/inbox")
        check(
            "an editor sees the newsroom thread without being named on it",
            "follow-up on the allotment story" in epage.content(),
        )
        check("the editor's inbox shows it as unread", "new" in epage.inner_text("ul"))
        shot(epage, "30-inbox-newsroom.png", scroll="top")

        go(epage, f"{BASE}/inbox/{thread_id}")
        epage.fill("textarea", "Yes please. Send the notes over by Thursday.")
        epage.click('button:has-text("Send reply")')
        # A `text=` selector can match the streamed RSC payload inside a script
        # tag, so settle and read what is actually rendered.
        epage.wait_for_selector("text=Send the notes over by Thursday", timeout=20000)
        epage.wait_for_timeout(SETTLE_MS)
        rendered = epage.inner_text("main")
        check("an editor can reply in the thread", "by Thursday" in rendered, rendered[:200])
        go(epage, f"{BASE}/inbox")
        check(
            "answering clears the unread badge for the editor",
            "new" not in epage.inner_text("ul"),
        )

        go(cpage, f"{BASE}/inbox")
        check(
            "the reply comes back to the contributor as unread",
            "new" in cpage.inner_text("ul"),
        )
        go(cpage, f"{BASE}/inbox/{thread_id}")
        go(cpage, f"{BASE}/inbox")
        check(
            "reading the thread clears the contributor's badge",
            "new" not in cpage.inner_text("ul"),
        )

        # --- 10c. contact numbers: newsroom only -----------------------------
        go(epage, f"{BASE}/people")
        table = epage.inner_text("tbody")
        check(
            "staff see contributor numbers in the people list",
            "01711000111" in table,
            table[:200],
        )
        check(
            "the people screen says who those numbers are for",
            "Contact numbers are for the newsroom" in epage.content(),
        )
        shot(epage, "31-people-contacts.png", scroll="top")

        anon = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        apage = anon.new_page()
        go(apage, f"{BASE}/en/author/{NEW_USER_ID[0]}")
        check(
            "a reader cannot see the contributor's number by default",
            "01711000111" not in apage.content(),
        )

        # ...until somebody deliberately publishes it. An editor cannot edit a
        # colleague of equal rank, so this is the admin's screen.
        adm = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        apg = adm.new_page()
        sign_in(apg, "admin@thedocument.test", "demo1234")
        go(apg, f"{BASE}/people/{NEW_USER_ID[0]}")
        apg.check('input[name="phonePublic"]')
        apg.click('button:has-text("Save profile")')
        apg.wait_for_selector("text=Profile saved", timeout=20000)
        go(apage, f"{BASE}/en/author/{NEW_USER_ID[0]}")
        check(
            "the number appears publicly only after the opt-in",
            "01711000111" in apage.content(),
        )
        go(apg, f"{BASE}/people/{NEW_USER_ID[0]}")
        apg.uncheck('input[name="phonePublic"]')
        apg.click('button:has-text("Save profile")')
        apg.wait_for_selector("text=Profile saved", timeout=20000)
        adm.close()
        go(apage, f"{BASE}/en/author/{NEW_USER_ID[0]}")
        check(
            "turning the opt-in back off hides it again",
            "01711000111" not in apage.content(),
        )
        anon.close()
        cp.close()
        ip.close()

        # --- 10d. the newspaper layout he asked for --------------------------
        # Measured, not eyeballed: the copy has to start on the same left edge
        # as the masthead, and the other news has to sit to its right.
        wide = ctx.browser.new_context(viewport={"width": 1440, "height": 900}, http_credentials=GATE)
        wp = wide.new_page()
        go(wp, f"{BASE}/en")
        cols = wp.evaluate(
            """() => {
                 const logo = document.querySelector('header img');
                 const lead = document.querySelector('main article h2');
                 const rails = [...document.querySelectorAll('main aside')]
                   .map((a) => a.getBoundingClientRect())
                   .filter((r) => r.width > 0);
                 return {
                   logoLeft: logo ? logo.getBoundingClientRect().left : null,
                   leadLeft: lead ? lead.getBoundingClientRect().left : null,
                   rails: rails.length,
                   leftRailBeforeLead: rails.length ? rails[0].left < (lead ? lead.getBoundingClientRect().left : 0) : false,
                 };
               }"""
        )
        check("the front page runs three columns on a desktop", cols["rails"] >= 2, str(cols))
        check("a rail of other stories sits left of the lead", cols["leftRailBeforeLead"], str(cols))
        shot(wp, "32-front-page-wide.png")

        # Reach an article the way a reader does, so the slug never goes stale.
        go(wp, f"{BASE}/en")
        wp.locator('main article h2').first.click()
        wp.wait_for_url("**/article/**", timeout=20000)
        wait_article(wp)
        edges = wp.evaluate(
            """() => {
                 const logo = document.querySelector('header img');
                 const h1 = document.querySelector('main h1');
                 const rail = document.querySelector('main > aside');
                 return {
                   logoLeft: logo && Math.round(logo.getBoundingClientRect().left),
                   copyLeft: h1 && Math.round(h1.getBoundingClientRect().left),
                   railLeft: rail && Math.round(rail.getBoundingClientRect().left),
                   copyRight: h1 && Math.round(h1.getBoundingClientRect().right),
                   railBlocks: document.querySelectorAll('main > aside li').length,
                 };
               }"""
        )
        check(
            "the article copy starts on the same left edge as the logo",
            abs((edges["copyLeft"] or 0) - (edges["logoLeft"] or -99)) <= 1,
            str(edges),
        )
        check(
            "the other news sits in a panel to the right of the copy",
            (edges["railLeft"] or 0) > (edges["copyRight"] or 0) and edges["railBlocks"] >= 2,
            str(edges),
        )
        shot(wp, "33-article-wide.png")
        wide.close()

        # --- 10e. published list, and corrections to what someone earned -----
        adm2 = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ap2 = adm2.new_page()
        sign_in(ap2, "admin@thedocument.test", "demo1234")

        go(ap2, f"{BASE}/editorial?status=APPROVED")
        check(
            "the newsroom has a published list of its own",
            "Published articles" in ap2.content() and "Newest first" in ap2.content(),
        )
        dates = ap2.evaluate(
            """() => [...document.querySelectorAll('main ul > li')]
                 .map((li) => li.innerText)
                 .filter((t) => t.includes('published'))
                 .length"""
        )
        check("published rows say when they went live", dates >= 1, str(dates))

        # Searching has to survive a reload, so it is a real query string.
        ap2.fill('input[name="q"]', "ferry")
        ap2.click('button:has-text("Search")')
        ap2.wait_for_url("**q=ferry**", timeout=20000)
        ap2.wait_for_timeout(SETTLE_MS)
        rows = ap2.inner_text("main")
        check(
            "the newsroom list can be searched by headline",
            "ferry" in rows.lower() and "q=ferry" in ap2.url,
        )
        shot(ap2, "34-published-list.png")

        # Earnings corrections. The figure on the contributor's own desk and the
        # figure in the people list have to move together.
        def listed_total():
            """What the people list says this contributor is owed, in minor units."""
            go(ap2, f"{BASE}/people")
            ap2.fill('input[placeholder="Search by name, email or phone"]', NEW_EMAIL)
            ap2.wait_for_timeout(SETTLE_MS)
            cell = ap2.inner_text("tbody").replace("\u00a0", " ")
            amounts = re.findall(r"BDT ([\d,]+\.\d{2})", cell)
            return round(float(amounts[-1].replace(",", "")) * 100) if amounts else 0

        owed_before = listed_total()

        go(ap2, f"{BASE}/people/{NEW_USER_ID[0]}")
        check("an admin sees an earnings panel on a contributor", "Total owed" in ap2.inner_text("main"))

        ap2.click('button:has-text("Bonus +")')
        ap2.fill('input[inputmode="decimal"]', "250")
        ap2.fill('input[placeholder^="Bonus for"]', "Bonus for the flood investigation")
        ap2.click('button:has-text("Add bonus")')
        ap2.wait_for_selector("text=Bonus added to their total", timeout=20000)
        ap2.wait_for_timeout(SETTLE_MS)
        panel = ap2.inner_text("main")
        check(
            "a bonus lands on the ledger with its reason",
            "flood investigation" in panel,
            panel[:300],
        )
        shot(ap2, "35-earnings-panel.png")

        owed_after = listed_total()
        check(
            "the bonus moves the total in the people list by exactly that much",
            owed_after - owed_before == 25000,
            f"{owed_before} -> {owed_after}",
        )

        # A deduction cannot invent a debt.
        go(ap2, f"{BASE}/people/{NEW_USER_ID[0]}")
        ap2.click('button:has-text("Deduct -")')
        ap2.fill('input[inputmode="decimal"]', "999999")
        ap2.fill('input[placeholder^="Payment void"]', "Too much on purpose")
        ap2.click('button:has-text("Take off earnings")')
        ap2.wait_for_selector("text=below zero", timeout=20000)
        check("a deduction cannot take a total below zero", "below zero" in ap2.inner_text("main"))

        # A real deduction, then take the bonus back out again.
        ap2.fill('input[inputmode="decimal"]', "50")
        ap2.fill('input[placeholder^="Payment void"]', "Payment void: unverified claim")
        ap2.click('button:has-text("Take off earnings")')
        ap2.wait_for_selector("text=Deduction taken off", timeout=20000)
        # The ledger redraws after the save returns, which over the internet is
        # a beat later than the confirmation message.
        ap2.wait_for_timeout(SETTLE_MS)
        ledger = ap2.inner_text("main")
        check("a deduction lands on the ledger", "unverified claim" in ledger, ledger[:300])

        # An editor must not be able to move money at all. (The editor context
        # from the inbox section is closed by now, so this is a fresh one.)
        ed2 = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ep3 = ed2.new_page()
        sign_in(ep3, "editor@thedocument.test", "demo1234")
        r = ep3.request.post(
            f"{BASE}/api/admin/users/{NEW_USER_ID[0]}/earnings",
            data={"amountCents": 10000, "reason": "Editors should not be able to do this"},
        )
        check("an editor cannot change what anybody earned", r.status == 403, f"got {r.status}")
        ed2.close()

        ap2.click('button:has-text("Remove") >> nth=0')
        ap2.wait_for_selector("text=Entry removed", timeout=20000)
        ap2.wait_for_timeout(SETTLE_MS)
        check("an entry can be taken back off", "Entry removed" in ap2.inner_text("main"))
        adm2.close()

        # --- 10f. saving a role, messaging a person, and being told ----------
        adm3 = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ap3 = adm3.new_page()
        sign_in(ap3, "admin@thedocument.test", "demo1234")
        go(ap3, f"{BASE}/people/{NEW_USER_ID[0]}")

        check(
            "a contributor's page has a Save button for their role",
            ap3.locator('button:has-text("Save changes")').count() == 1,
        )
        check(
            "it starts disabled, because nothing has been changed yet",
            ap3.locator('button:has-text("Save changes")').is_disabled(),
        )

        # Whatever they are now, move them to the other rank, so the run does
        # not depend on where an earlier section left them.
        was = ap3.locator('select[name="role"]').input_value()
        want = "CONTRIBUTOR" if was == "EDITOR" else "EDITOR"
        ap3.select_option('select[name="role"]', want)
        check(
            "choosing a different role enables Save",
            not ap3.locator('button:has-text("Save changes")').is_disabled(),
            f"{was} -> {want}",
        )
        ap3.click('button:has-text("Save changes")')
        ap3.wait_for_selector("text=Saved.", timeout=20000)
        ap3.wait_for_timeout(SETTLE_MS)
        said = ap3.inner_text("main")
        check(
            "saving a role says so in words",
            f"is now {want.capitalize()}" in said and "notified" in said,
            said[:220],
        )
        shot(ap3, "36-role-save.png")

        # Reload: the change really went to the server, not just React state.
        go(ap3, f"{BASE}/people/{NEW_USER_ID[0]}")
        check(
            "the new role survives a reload",
            ap3.locator('select[name="role"]').input_value() == want,
            ap3.locator('select[name="role"]').input_value(),
        )

        check(
            "a contributor's page has a button to message them",
            ap3.locator('button:has-text("Send a message")').count() == 1,
        )
        ap3.click('button:has-text("Send a message")')
        ap3.wait_for_url("**/inbox/**", timeout=20000)
        ap3.wait_for_timeout(SETTLE_MS)
        check(
            "that button opens a thread with that person",
            "A message for" in ap3.inner_text("main"),
        )

        # And back again, which is the second role notification.
        go(ap3, f"{BASE}/people/{NEW_USER_ID[0]}")
        ap3.select_option('select[name="role"]', was)
        ap3.click('button:has-text("Save changes")')
        ap3.wait_for_selector(f"text=is now {was.capitalize()}", timeout=20000)
        adm3.close()

        # --- 10g. the contributor is told what happened ----------------------
        # Nothing in the run has been sent back yet, so file a piece and have an
        # editor reject it - the notice is only worth asserting if the thing it
        # reports actually happened.
        told = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        tp = told.new_page()
        sign_in(tp, NEW_EMAIL, NEW_PASS2)
        go(tp, f"{BASE}/dashboard")
        tp.click('button:has-text("Start a new piece")')
        tp.wait_for_url("**/dashboard/write/**", timeout=20000)
        tp.fill('input[placeholder="Headline"]', REJECT_TITLE)
        tp.fill(
            "textarea",
            "A short filing that an editor is going to send back, so the writer can be "
            "told about it. It needs enough words to pass the length check on submission.",
        )
        tp.click('button:has-text("Save draft")')
        tp.wait_for_selector("text=Draft saved", timeout=20000)
        tp.click('button:has-text("Submit for review")')
        tp.wait_for_selector("text=Submitted for review", timeout=20000)

        ed3 = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ep4 = ed3.new_page()
        sign_in(ep4, "editor@thedocument.test", "demo1234")
        go(ep4, f"{BASE}/editorial?status=SUBMITTED&q={REJECT_TITLE.split(' ')[0]}")
        ep4.locator(f'li:has-text("{REJECT_TITLE}") a:has-text("Review")').first.click()
        ep4.wait_for_url("**/editorial/**", timeout=20000)
        ep4.wait_for_timeout(SETTLE_MS)
        # The editorial screen has several textareas; the note is the one the
        # review panel owns.
        ep4.fill('textarea[placeholder^="Required when sending"]', "Please name the committee and attach the minutes.")
        ep4.click('button:has-text("Send back for changes")')
        ep4.wait_for_timeout(SETTLE_MS * 2)
        check(
            "an editor can send a piece back with a note",
            "Changes requested" in ep4.inner_text("main") or "Sent back" in ep4.inner_text("main"),
            ep4.inner_text("main")[:200],
        )
        ed3.close()

        go(tp, f"{BASE}/dashboard")
        updates = tp.inner_text("main")
        check(
            "the contributor is told their article was published",
            "Your article is published" in updates,
            updates[:300],
        )
        check(
            "the contributor is told an editor sent a piece back",
            "sent your article back" in updates,
        )
        check(
            "the contributor is told their role changed",
            "role is now" in updates or "You are now" in updates,
            updates[:300],
        )
        check(
            "the published notice carries the payout the desk set",
            "Payout set to" in updates,
        )
        shot(tp, "37-contributor-updates.png")

        unread_before = tp.locator("text=new").count()
        tp.click('button:has-text("Mark all as read")')
        tp.wait_for_timeout(SETTLE_MS * 2)
        check(
            "marking them read clears the badge",
            "Mark all as read" not in tp.inner_text("main"),
            str(unread_before),
        )
        told.close()

        # --- 10h. the sign-in page only offers what works --------------------
        out = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        op = out.new_page()
        go(op, f"{BASE}/login")
        buttons = op.inner_text("main")
        check(
            "Facebook is not offered while it is switched off",
            "Continue with Facebook" not in buttons,
            buttons[:200],
        )
        # A developer clone has no keys at all, so only assert Google where some
        # social provider is actually configured.
        if "Continue with" in buttons:
            check("Google sign-in is still offered", "Continue with Google" in buttons)
        # The demo accounts include an owner; their password must never be
        # printed on a site the public can reach.
        r = op.request.get(f"{BASE}/login")
        check(
            "the live sign-in page does not print the demo passwords",
            ("demo1234" in r.text()) == (os.environ.get("SHOW_DEMO_LOGINS") == "true"),
            "demo1234 visible" if "demo1234" in r.text() else "hidden",
        )
        out.close()

        # --- 10i. the shape of the page on a phone ---------------------------
        # He reported the top of the page looking like loose parts on a phone:
        # the section bar is sticky, and the signed-in strip used to sit under
        # it, so scrolling slid one over the other.
        ph = ctx.browser.new_context(
            viewport=PHONE, device_scale_factor=2, http_credentials=GATE
        )
        php = ph.new_page()
        sign_in(php, "admin@thedocument.test", "demo1234")
        go(php, BASE)
        php.evaluate("window.scrollTo(0, 400)")
        php.wait_for_timeout(SETTLE_MS)
        overlap = php.evaluate(
            """() => {
                 const strip = document.querySelector('header')?.previousElementSibling;
                 const nav = document.querySelector('header + nav');
                 if (!strip || !nav) return 'missing';
                 const s = strip.getBoundingClientRect(), n = nav.getBoundingClientRect();
                 // They overlap if one starts before the other ends, both ways.
                 return s.bottom > n.top && n.bottom > s.top ? 'overlap' : 'clear';
               }"""
        )
        check("the signed-in strip and the menu never sit on top of each other", overlap == "clear", overlap)

        lines = php.evaluate(
            """() => {
                 const strip = document.querySelector('header')?.previousElementSibling;
                 if (!strip) return 0;
                 return Math.round(strip.getBoundingClientRect().height);
               }"""
        )
        check("the signed-in strip is one line on a phone", lines <= 44, f"{lines}px")

        go(php, BASE)
        sizes = php.evaluate(
            """() => {
                 const logo = document.querySelector('header img');
                 const lead = document.querySelector('main article h2');
                 const thumb = document.querySelector('main aside a img');
                 return {
                   logo: logo ? Math.round(logo.getBoundingClientRect().height) : 0,
                   lead: lead ? parseFloat(getComputedStyle(lead).fontSize) : 0,
                   thumb: thumb ? Math.round(thumb.getBoundingClientRect().width) : 0,
                 };
               }"""
        )
        check("the masthead is a readable size on a phone", sizes["logo"] >= 40, str(sizes))
        check("the lead headline is big enough to read", sizes["lead"] >= 28, str(sizes))
        check("list thumbnails are big enough to see", sizes["thumb"] == 0 or sizes["thumb"] >= 88, str(sizes))
        shot(php, "38-phone-front.png")
        ph.close()

        # --- 10j. the desk's new controls -------------------------------------
        nd = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        np = nd.new_page()
        sign_in(np, "admin@thedocument.test", "demo1234")

        # The menu now carries the owner's own list of sections.
        go(np, BASE)
        menu = np.inner_text("header + nav")
        for want in ("রাজনীতি", "অর্থনীতি", "বিশ্ব", "মতামত", "সাহিত্য", "বিজ্ঞান", "ক্যারিয়ার"):
            check(f"the Bangla menu carries {want}", want in menu, menu[:160])
        go(np, f"{BASE}/en")
        menu_en = np.inner_text("header + nav")
        for want in ("Economy", "World", "Opinion", "Literature", "Science", "Career"):
            check(f"the English menu carries {want}", want in menu_en, menu_en[:160])
        check(
            "a new section page actually resolves",
            np.request.get(f"{BASE}/en/section/world").status == 200,
        )

        # The newsroom tabs change the query string only, which used to leave
        # the loading bar running for ever.
        go(np, f"{BASE}/editorial?status=SUBMITTED")
        np.click('a:has-text("Published")')
        np.wait_for_url("**status=APPROVED**", timeout=20000)
        np.wait_for_timeout(SETTLE_MS * 2)
        check(
            "the loading bar stops when only the query string changed",
            np.locator('[role="progressbar"]').count() == 0,
        )

        # Open a published piece: cover controls, a working live link, a delete.
        np.locator('main ul > li a:has-text("Open")').first.click()
        np.wait_for_url("**/editorial/**", timeout=20000)
        np.wait_for_timeout(SETTLE_MS)
        # The heading is uppercased by CSS, so compare without case.
        check(
            "an admin can change the cover photo",
            "cover photo" in np.inner_text("main").lower()
            and np.locator('button:has-text("cover")').count() > 0,
        )
        check("an admin gets a delete control", "Delete this article" in np.inner_text("main"))
        check(
            "the save button says it updates the live article",
            "Save and update the live article" in np.inner_text("main"),
        )
        live = np.locator('a:has-text("View live")').first.get_attribute("href")
        r = np.request.get(f"{BASE}{live}")
        check("the View live link goes to a real page", r.status == 200, f"{live} -> {r.status}")
        shot(np, "39-editorial-controls.png")

        # Deleting asks first, and then really deletes.
        np.click('button:has-text("Delete this article")')
        check("deleting asks for confirmation first", "Yes, delete it" in np.inner_text("main"))
        np.click('button:has-text("Keep it")')
        check("and can be called off", "Yes, delete it" not in np.inner_text("main"))

        # Front page board.
        go(np, f"{BASE}/editorial/front-page")
        board = np.inner_text("main")
        for slot in ("Main headline", "Beside the masthead", "Left column", "Under the headline", "Right column"):
            check(f"the front page board has a {slot} position", slot in board)
        # Start from an empty board, so an earlier run cannot change what the
        # first "Add" button does.
        while np.locator('button:has-text("Remove")').count():
            np.locator('button:has-text("Remove")').first.click()
            np.wait_for_timeout(SETTLE_MS)

        np.locator('button:has-text("Add an article")').first.click()
        np.wait_for_timeout(SETTLE_MS)
        # The candidate list is inside the open position, not anywhere in main.
        np.locator('section:has(input[placeholder^="Search published"]) ul button').first.click()
        np.wait_for_selector("text=Placed.", timeout=20000)
        np.wait_for_timeout(SETTLE_MS)
        check("an article can be pinned to a position", "Remove" in np.inner_text("main"))
        shot(np, "40-front-page-board.png")

        pinned_title = np.evaluate(
            """() => {
                 const first = document.querySelector('main section li span span');
                 return first ? first.innerText : '';
               }"""
        )
        # The board shows English titles, so check the English front page - and
        # check it is the LEAD, not merely somewhere on the page.
        go(np, f"{BASE}/en")
        lead_now = np.locator("main article h2").first.inner_text()
        check(
            "the pinned piece really leads the front page",
            pinned_title[:24] in lead_now,
            f"pinned {pinned_title[:40]!r} vs lead {lead_now[:40]!r}",
        )

        # And it can be taken off again.
        go(np, f"{BASE}/editorial/front-page")
        np.locator('button:has-text("Remove")').first.click()
        np.wait_for_selector("text=Taken off the front page", timeout=20000)
        check("and taken off again", True)

        # Formatting toolbar, and what it writes.
        go(np, f"{BASE}/dashboard")
        np.click('button:has-text("Start a new piece")')
        np.wait_for_url("**/dashboard/write/**", timeout=20000)
        np.wait_for_timeout(SETTLE_MS)
        check("the writing desk has a formatting toolbar", np.locator('button[title^="Bold"]').count() == 1)
        np.fill("textarea >> nth=0", "The committee met twice")
        np.evaluate(
            """() => {
                 const ta = document.querySelector('textarea');
                 ta.focus();
                 ta.setSelectionRange(4, 13);
               }"""
        )
        np.click('button[title^="Bold"]')
        np.wait_for_timeout(400)
        check(
            "pressing Bold wraps the chosen words",
            "**committee**" in np.input_value("textarea >> nth=0"),
            np.input_value("textarea >> nth=0"),
        )
        np.click('button:has-text("Big subtitle")')
        np.wait_for_timeout(400)
        check(
            "and Big subtitle marks the line as a heading",
            np.input_value("textarea >> nth=0").startswith("## "),
            np.input_value("textarea >> nth=0")[:40],
        )
        nd.close()

        # --- 11. mobile ------------------------------------------------------
        mob = ctx.browser.new_context(viewport=PHONE, device_scale_factor=2, http_credentials=GATE)
        mp = mob.new_page()
        go(mp, BASE)
        overflow = mp.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        check("no sideways scroll on a 390px phone", not overflow)
        # The client saw the section links twice on a phone: the header row and
        # the feed's own chips. There must now be exactly one of each link.
        dupes = mp.evaluate(
            """() => {
                 // Only what the reader can actually see: the header keeps a
                 // desktop row and a phone row in the DOM, and CSS hides one.
                 const hrefs = [...document.querySelectorAll('a[href*="/section/"]')]
                   .filter((a) => a.getClientRects().length > 0)
                   .map((a) => a.getAttribute('href'));
                 const seen = {};
                 hrefs.forEach((h) => (seen[h] = (seen[h] || 0) + 1));
                 return Object.entries(seen).filter(([, n]) => n > 1).map(([h]) => h);
               }"""
        )
        check("the section menu appears only once on a phone", not dupes, str(dupes))
        mp.screenshot(path=os.path.join(SHOTS, "12-home-mobile.png"))
        go(mp, f"{BASE}/article/the-night-bus-that-never-came-bn")
        mp.screenshot(path=os.path.join(SHOTS, "13-article-mobile.png"))
        go(mp, f"{BASE}/login")
        mp.fill('input[type="email"]', "maya@thedocument.test")
        mp.fill('input[type="password"]', "demo1234")
        mp.click('button[type="submit"]')
        mp.wait_for_url("**/dashboard", timeout=20000)
        mp.screenshot(path=os.path.join(SHOTS, "14-dashboard-mobile.png"))
        check("dashboard works on a phone", "Total earnings" in mp.content())
        mob.close()

        # The run deliberately triggers rejections the server must refuse: a
        # malformed bKash number, publishing before translating, a password
        # change with the wrong current password, and an editor reaching for
        # settings and senior accounts. Those are API calls made with
        # request.*, which the browser does not log, so only the in-page ones
        # show up here.
        rejected = [e for e in errors if "422" in e or "403" in e]
        real_errors = [
            e for e in errors if "favicon" not in e.lower() and "Failed to load resource" not in e
        ]
        check(
            "every deliberate bad request really was rejected by the server",
            # a submission with no contact number, a bad wallet number,
            # publish-before-translating, a malformed website (422s) and the
            # wrong current password (403)
            len(rejected) == 5,
            str(rejected),
        )
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
