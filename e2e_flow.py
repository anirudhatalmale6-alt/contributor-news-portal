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
WITNESS_TITLE = "The roadworks nobody signed off"
BYLINE_TITLE = "The ferry terminal that opened twice"
BYLINE_NAME = "Our Khulna correspondent"

# Writing a test advertisement onto a page is fine locally and wrong on a site
# that sells the space, so the write checks are opt-in away from localhost.
AD_WRITES = os.environ.get("AD_WRITES", "") == "1" or "127.0.0.1" in BASE or "localhost" in BASE

# Whatever advertising the site already carries, so the run can put it back.
ADS_BEFORE: dict[str, str] = {}
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


STAFF_PASS = os.environ.get("STAFF_PASSWORD", "demo1234")


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
        lead_headline = page.locator("main article h2").first.inner_text().strip()
        check("home serves a published lead story", len(lead_headline) > 5, lead_headline[:60])

        # Nothing unpublished may appear. Asked of the database rather than of a
        # fixture, so it holds whatever articles this site happens to carry.
        public_titles = page.inner_text("main")
        check(
            "an unpublished draft never leaks onto the public feed",
            "Untitled draft" not in public_titles and "Market rents" not in public_titles,
        )
        shot(page, "01-home-desktop.png")

        # the old /bn addresses still resolve rather than 404
        go(page, f"{BASE}/bn")
        check("the old /bn address redirects to the new Bangla root", page.url.rstrip("/") == BASE)
        shot(page, "21-home-bangla-default.png")
        go(page, f"{BASE}/en")

        # --- 2. article page ------------------------------------------------
        # Whatever is leading today, not a fixture by name.
        page.locator("main article h2").first.click()
        page.wait_for_url("**/en/article/**", timeout=20000)
        wait_article(page)
        check("the headline link reaches the article", "/article/" in page.url, page.url)
        # Real prose, not an empty shell: a few hundred characters of body copy.
        copy_len = len(page.inner_text(".prose-article").strip())
        check("article page renders the body copy", copy_len > 120, f"{copy_len} characters")
        check(
            "the byline carries the writer and the date",
            page.locator("main time, main p:has-text('min read'), main span:has-text('min read')").count() > 0
            or "min read" in page.inner_text("main"),
        )
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
            "a new piece opens with an empty headline, not placeholder words",
            page.input_value('input[name="title"]') == "",
            page.input_value('input[name="title"]'),
        )
        check(
            "a new piece opens in Bangla, not English",
            page.locator('select[name="language"]').input_value() == "BN",
            page.locator('select[name="language"]').input_value(),
        )
        page.select_option('select[name="language"]', "EN")
        page.fill('input[name="title"]', HEADLINE)
        page.fill(
            'input[name="dek"]',
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
            page.click('button[name="attach-media"]')
        fc.value.set_files(photo)
        page.wait_for_selector("li img", timeout=20000)
        check("image upload attaches to the draft", page.locator("section li img").count() >= 1)
        page.click('button[name="save-draft"]')
        page.wait_for_selector("text=Draft saved", timeout=20000)
        # Visible text: the wording for both languages is handed to this screen
        # as a prop, so the confirmation's words are in the page source already.
        check(
            "saving a draft confirms it in words",
            "come back to it any time" in page.inner_text("body"),
        )
        shot(page, "04-composer.png", scroll="top")

        # reload proves the copy really persisted, not just sat in React state
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(SETTLE_MS)
        check(
            "draft survives a reload (saved server-side, not in the browser)",
            # Form fields, so read their values: inner_text does not see them
            # and page.content() would also match the wording shipped as props.
            page.input_value('input[name="title"]') == HEADLINE
            and "attenuation basin" in page.input_value("textarea >> nth=0"),
        )

        # --- 5. submit ------------------------------------------------------
        # The desk cannot chase a story it has no number for, so a submission
        # without one has to be refused rather than quietly accepted.
        page.click('button[name="submit-article"]')
        page.wait_for_timeout(SETTLE_MS * 3)
        check(
            "a submission with no contact number is refused",
            "contact number" in page.inner_text("body").lower()
            # Visible text only: the composer is handed the wording for both
            # languages, so the confirmation's words are in the page source
            # whether or not anything was submitted.
            and "Submitted for review" not in page.inner_text("body"),
        )
        page.fill('input[placeholder="01XXXXXXXXX"] >> nth=0', "01712345678")
        page.fill('input[placeholder="01XXXXXXXXX"] >> nth=1', "01812345678")
        shot(page, "28-submission-contact.png", scroll="section:has-text('reach you about this piece')")
        page.click('button[name="submit-article"]')
        page.wait_for_selector("text=Submitted for review", timeout=20000)
        check(
            "submitting shows a confirmation with a way back",
            "Back to my desk" in page.inner_text("body"),
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
        sign_in(page, "editor@thedocument.test", STAFF_PASS)
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
            scroll="section#translation",
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
        # The owner removed the seeded demo pieces from his live site, so the
        # checks that read them only mean something where the seed is present.
        # Probe for the demo article itself - BN_HEADLINE is produced by this
        # very run, so it would say "seeded" on any site at all.
        seeded = page.request.get(f"{BASE}/article/notun-sorok-puratan-khaler-opore").status == 200
        check(
            "the Bangla front page is in Bangla",
            "সর্বশেষ" in bn_home and ("আজকের আরও খবর" in bn_home or "নির্বাচিত" in bn_home),
        )
        if not seeded:
            print("SKIP  the seeded demo pieces are not on this site, so the checks that",
                  "read them are stood down. They run in full against a seeded database.")
        if seeded:
            check("the editor's Bangla headline is live", BN_HEADLINE in bn_home)
            # Checked on the piece's own page rather than on the front page:
            # once a site has more than a screenful of news, whether a given
            # older story is still above the fold says nothing about the code.
            bn_piece = page.request.get(f"{BASE}/article/notun-sorok-puratan-khaler-opore").text()
            check(
                "a piece written in Bangla by a contributor reads in Bangla",
                "পুরোনো খালের ওপর নতুন সড়ক" in bn_piece,
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
        page.select_option('select[name="language"]', "EN")
        page.fill('input[name="title"]', BOTH_EN_TITLE)
        page.fill(
            'input[name="dek"]',
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
        page.click('button[name="submit-article"]')
        page.wait_for_selector("text=Submitted for review", timeout=20000)

        sign_out(page)
        sign_in(page, "editor@thedocument.test", STAFF_PASS)
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

        # A piece pinned to the lead on the Front page screen outranks the
        # featured flag, by design. Clear any pin first, or this check is really
        # testing whatever an earlier run left behind.
        go(page, f"{BASE}/editorial/front-page")
        while page.locator('button:has-text("Remove")').count():
            page.locator('button:has-text("Remove")').first.click()
            page.wait_for_timeout(SETTLE_MS)

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

        # sections - whichever one this site actually has stories in
        feed = page.request.get(f"{BASE}/api/articles?perPage=50").json()
        by_cat: dict[str, list[str]] = {}
        for a in feed.get("articles", []):
            by_cat.setdefault(a["category"], []).append(a["title"])
        busiest = max(by_cat, key=lambda c: len(by_cat[c])) if by_cat else "Politics"
        other_cat = next((c for c in by_cat if c != busiest), None)

        # A section page only carries pieces that exist in that language, and a
        # Bangla original has no English version until an editor writes one. So
        # check the side the stories are actually on, and that the other side
        # still answers rather than erroring.
        cards = 0
        shown_side = ""
        for side in (f"{BASE}/section/{busiest.lower()}", f"{BASE}/en/section/{busiest.lower()}"):
            go(page, side)
            n = page.locator("main article").count()
            if n > cards:
                cards, shown_side = n, side
        go(page, shown_side or f"{BASE}/section/{busiest.lower()}")
        check(
            f"the {busiest} section page lists its own stories",
            cards >= 1,
            f"{cards} cards on {shown_side}",
        )
        if other_cat:
            body = page.inner_text("main")
            check(
                "and nothing from another section",
                not any(t[:24] in body for t in by_cat[other_cat]),
            )
        shot(page, "25-section-page.png")
        r = page.request.get(f"{BASE}/en/section/{busiest.lower()}")
        check("the same section answers on the other language too", r.status == 200, f"got {r.status}")

        r = page.request.get(f"{BASE}/en/section/not-a-section")
        check("an invented section is a 404, not a blank page", r.status == 404, f"got {r.status}")

        # related articles, on whatever is leading today
        go(page, f"{BASE}/en")
        page.locator("main article h2").first.click()
        page.wait_for_url("**/article/**", timeout=20000)
        wait_article(page)
        check("an article offers more to read", "More on this" in page.content())
        related = page.locator("section:has-text('More on this') a").count()
        check("related links are real links", related >= 1, str(related))

        # --- 9. admin: roles, verified flag, payment settings ---------------
        sign_out(page)
        sign_in(page, "admin@thedocument.test", STAFF_PASS)
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
        AD_FIELDS = [
            "adHomeHtml",
            "adBannerHtml",
            "adSquareHtml",
            "adArticleHtml",
            "adHomeHtmlEn",
            "adBannerHtmlEn",
            "adSquareHtmlEn",
            "adArticleHtmlEn",
        ]
        page.click('summary:has-text("Or paste code from an ad network")')
        page.wait_for_timeout(300)
        ADS_BEFORE.update(
            {f: page.input_value(f'#site-settings textarea[name="{f}"]') for f in AD_FIELDS}
        )
        ADS_BEFORE["siteNameEn"] = page.input_value('#site-settings input[name="siteNameEn"]')

        page.fill('#site-settings input[name="siteNameEn"]', "The Document Daily")
        page.check('#site-settings input[name="adsEnabled"]')
        page.fill(
            '#site-settings textarea[name="adHomeHtmlEn"]',
            '<div id="ad-home-test">HOUSE AD</div>',
        )
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

        # --- 9a1. where an advertisement sends its clicks ---------------------
        # Changing the link must not mean uploading the picture again, and the
        # field must show the link the box actually has.
        go(page, f"{BASE}/admin")
        page.wait_for_timeout(800)
        PICTURE_SLOTS = [
            ("square", "Square", "adSquareHtml"),
            ("home", "Home page extra", "adHomeHtml"),
            ("article", "Article page", "adArticleHtml"),
            ("squareEn", "Square", "adSquareHtmlEn"),
            ("homeEn", "Home page extra", "adHomeHtmlEn"),
        ]

        def ad_box(label, english=False):
            """The English column repeats the same four labels, in order."""
            boxes = page.locator(f'div:has(> div > span:text-is("{label}"))')
            return boxes.nth(1) if english else boxes.first

        # Only a box that really carries a click-through can prove the field is
        # pre-filled; an image with no link would pass that check vacuously.
        sold = [
            s_
            for s_ in PICTURE_SLOTS + [("banner", "Banner", "adBannerHtml")]
            if "<img" in ADS_BEFORE.get(s_[2], "") and 'href="' in ADS_BEFORE.get(s_[2], "")
        ]
        if sold:
            _, label, column = sold[0]
            stored = ADS_BEFORE[column]
            # The href lives in an HTML attribute, so & arrives as &amp;; the
            # input box holds the plain address.
            href = (
                stored.split('href="', 1)[1].split('"', 1)[0].replace("&amp;", "&")
                if 'href="' in stored
                else ""
            )
            sold_box = ad_box(label, english=column.endswith("En"))
            field_ = sold_box.locator('input[placeholder="https://advertiser.example.com"]')
            check(
                "an advertisement that is already sold shows the link it has",
                field_.input_value() == href,
                f"{field_.input_value()} vs {href}",
            )
            check(
                "and offers nothing to save until the address is changed",
                sold_box.locator('button:has-text("Saved")').is_disabled(),
            )
        else:
            print("NOTE no picture advertisement with a link is in place, so the "
                  "pre-filled link check was not run")

        # The write side runs against an EMPTY slot, and only where writing an
        # advertisement onto the page is harmless: a live site sells this space.
        # It runs on the English side because this run has already proved
        # the English front page carries advertising, and the Bangla front page
        # may legitimately have no lead yet, which hides the rail slots. The
        # current value of the box decides whether it is free, not the snapshot.
        free = next(
            (
                x
                for x in PICTURE_SLOTS[3:]
                if not page.input_value(f'textarea[name="{x[2]}"]').strip()
            ),
            None,
        )
        if AD_WRITES and free:
            slot, label, column = free
            box = ad_box(label, english=True)
            box.locator('input[placeholder="https://advertiser.example.com"]').fill(
                "https://first-advertiser.example.com"
            )
            with page.expect_response(lambda r: "/api/admin/site/ad-image" in r.url) as got:
                box.locator('input[type="file"]').set_input_files("sample-upload.jpg")
            check("a picture advertisement uploads", got.value.status == 201, str(got.value.status))
            page.wait_for_timeout(2000)
            check(
                "the markup it writes carries the link given with it",
                'href="https://first-advertiser.example.com"'
                in page.input_value(f'textarea[name="{column}"]'),
            )

            go(page, f"{BASE}/admin")
            page.wait_for_timeout(800)
            box = ad_box(label, english=True)
            field_ = box.locator('input[placeholder="https://advertiser.example.com"]')
            check(
                "re-opening Settings shows that link rather than an empty box",
                field_.input_value() == "https://first-advertiser.example.com",
                field_.input_value(),
            )

            field_.fill("https://second-advertiser.example.com/offer?id=7&ref=a")
            with page.expect_response(lambda r: "/api/admin/site/ad-image" in r.url) as got:
                box.locator('button:has-text("Save link")').click()
            check("the link saves on its own", got.value.status == 200, str(got.value.status))
            page.wait_for_timeout(1500)
            check(
                "it confirms in words where the clicks now go",
                "second-advertiser.example.com" in box.inner_text(),
                box.inner_text()[-120:].replace("\n", " "),
            )
            check(
                "the picture is left exactly as it was",
                page.input_value(f'textarea[name="{column}"]').count("<img") == 1,
            )
            go(page, f"{BASE}/en")
            check(
                "a reader clicking it lands on the new address",
                'href="https://second-advertiser.example.com/offer?id=7&amp;ref=a"'
                in page.content(),
            )
            check(
                "and the Bangla site is not carrying the English advertisement",
                "second-advertiser.example.com" not in page.request.get(f"{BASE}/").text(),
            )

            go(page, f"{BASE}/admin")
            page.wait_for_timeout(800)
            box = ad_box(label, english=True)
            box.locator('input[placeholder="https://advertiser.example.com"]').fill(
                "advertiser.example.com"
            )
            box.locator('button:has-text("Save link")').click()
            page.wait_for_timeout(1200)
            check(
                "an address without http:// is refused with a reason",
                "must start with http" in box.inner_text(),
                box.inner_text()[-110:].replace("\n", " "),
            )

            box.locator('button:has-text("Remove and hide")').click()
            page.wait_for_timeout(1500)
            check(
                "and the test advertisement is taken back off the page",
                page.input_value(f'textarea[name="{column}"]').strip() == "",
            )
        elif AD_WRITES:
            print("NOTE every English picture slot is already sold, so the upload "
                  "checks were not run")

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
        sign_in(ep2, "editor@thedocument.test", STAFF_PASS)

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
        sign_in(ep, "editor@thedocument.test", STAFF_PASS)
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
            feed["total"] >= 1 and all(a.get("status", "APPROVED") == "APPROVED" for a in feed["articles"]),
        )
        anon.close()

        # --- 10b. the wait after clicking a headline --------------------------
        go(page, f"{BASE}/en")
        loading_seen = page.evaluate(
            """() => new Promise((resolve) => {
                 // A headline inside an article card, never an advertisement:
                 // the owner runs ads that link to his own pieces in a new tab.
                 const link = [...document.querySelectorAll('main article a[href*="/article/"]')][0];
                 if (!link) return resolve('no link');
                 const observer = new MutationObserver(() => {
                   if (document.querySelector('[role="progressbar"][aria-busy="true"]')) {
                     observer.disconnect();
                     resolve('seen');
                   }
                 });
                 const started = performance.now();
                 observer.observe(document.body, { childList: true, subtree: true });
                 link.click();
                 // If the article arrives almost at once there is nothing for a
                 // progress bar to do, and a bar that flashes for 80ms would be
                 // worse than none. Report how long it took so the check can
                 // tell "too fast to need one" from "broken".
                 const done = () => {
                   observer.disconnect();
                   resolve('not seen after ' + Math.round(performance.now() - started) + 'ms');
                 };
                 const poll = setInterval(() => {
                   if (location.pathname.includes('/article/')) { clearInterval(poll); done(); }
                 }, 50);
                 setTimeout(() => { clearInterval(poll); done(); }, 5000);
               })"""
        )
        quick = "not seen after" in loading_seen and int(loading_seen.split()[-1].rstrip("ms")) < 600
        check(
            "clicking a headline shows a loading bar while the article arrives",
            loading_seen == "seen" or quick,
            loading_seen + (" (nothing to wait for)" if quick else ""),
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
        sign_in(epage, "editor@thedocument.test", STAFF_PASS)
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
        sign_in(apg, "admin@thedocument.test", STAFF_PASS)
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
        sign_in(ap2, "admin@thedocument.test", STAFF_PASS)

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
        sign_in(ep3, "editor@thedocument.test", STAFF_PASS)
        r = ep3.request.post(
            f"{BASE}/api/admin/users/{NEW_USER_ID[0]}/earnings",
            data={"amountCents": 10000, "reason": "Editors should not be able to do this"},
        )
        check("an editor cannot change what anybody earned", r.status == 403, f"got {r.status}")
        ed2.close()

        # --- 10e5. asking to be paid ----------------------------------------
        # The money path, end to end. Worth the length: a bug here either pays
        # somebody twice or refuses to pay them at all.
        pc = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        pp = pc.new_page()
        sign_in(pp, NEW_EMAIL, NEW_PASS2)
        go(pp, f"{BASE}/dashboard")
        desk = pp.inner_text("main")
        check(
            "the threshold is stated on the contributor's own desk",
            "at least" in desk and "500" in desk,
            desk[:160].replace("\n", " "),
        )
        check(
            "under the threshold the button is there but cannot be pressed",
            pp.locator('button[name="request-payout"]').is_disabled(),
        )
        under = pp.request.post(f"{BASE}/api/payouts")
        check(
            "and the server refuses it too, saying what is needed",
            under.status == 422,
            f"{under.status} {under.text()[:90]}",
        )

        # Put them over the line, then walk the whole path.
        go(ap2, f"{BASE}/people/{NEW_USER_ID[0]}")
        ap2.click('button:has-text("Bonus +")')
        ap2.fill('input[inputmode="decimal"]', "600")
        ap2.fill('input[placeholder^="Bonus for"]', "Bonus to cross the payout threshold")
        ap2.click('button:has-text("Add bonus")')
        ap2.wait_for_selector("text=Bonus added to their total", timeout=20000)
        ap2.wait_for_timeout(SETTLE_MS)

        go(pp, f"{BASE}/dashboard")
        check(
            "over the threshold the button comes alive",
            not pp.locator('button[name="request-payout"]').is_disabled(),
        )
        pp.click('button[name="request-payout"]')
        pp.wait_for_timeout(SETTLE_MS)
        with pp.expect_response(lambda r: r.url.endswith("/api/payouts")) as got:
            pp.click('button[name="confirm-payout"]')
        check("the request is accepted", got.value.status == 201, str(got.value.status))
        pp.wait_for_timeout(SETTLE_MS)
        check(
            "the desk tells them it is waiting",
            "You have asked for" in pp.inner_text("main"),
        )
        twice = pp.request.post(f"{BASE}/api/payouts")
        check(
            "a second request while one is waiting is refused",
            twice.status == 409,
            f"{twice.status} {twice.text()[:80]}",
        )

        go(ap2, f"{BASE}/payouts")
        queue = ap2.inner_text("main")
        check(
            "an admin sees the request with the account to send it to",
            NEW_NAME in queue and "01819445203" in queue,
            queue[:200].replace("\n", " "),
        )
        shot(ap2, "47-payout-queue.png")
        ap2.on("dialog", lambda d: d.accept())
        with ap2.expect_response(lambda r: "/api/payouts/" in r.url) as got:
            ap2.click('button[name="mark-paid"]')
        check("marking it paid is accepted", got.value.status == 200, str(got.value.status))
        ap2.wait_for_timeout(SETTLE_MS)

        go(pp, f"{BASE}/dashboard")
        paid_desk = norm(pp.inner_text("main"))
        check(
            "what was paid comes off what they can ask for",
            "Available to withdraw: BDT 0.00" in paid_desk,
            paid_desk[:200].replace("\n", " "),
        )
        check(
            "and they cannot ask for it a second time",
            pp.locator('button[name="request-payout"]').is_disabled(),
        )
        pc.close()

        # An editor must never see where anybody's money goes.
        ed3 = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ep4 = ed3.new_page()
        sign_in(ep4, "editor@thedocument.test", STAFF_PASS)
        go(ep4, f"{BASE}/payouts")
        check("an editor is kept out of the payouts screen", "/payouts" not in ep4.url, ep4.url)
        ed3.close()

        # This section walked the admin page over to the payouts screen; the
        # ledger checks that follow expect it back on the person it was on.
        go(ap2, f"{BASE}/people/{NEW_USER_ID[0]}")
        ap2.wait_for_timeout(SETTLE_MS)

        ap2.click('button:has-text("Remove") >> nth=0')
        ap2.wait_for_selector("text=Entry removed", timeout=20000)
        ap2.wait_for_timeout(SETTLE_MS)
        check("an entry can be taken back off", "Entry removed" in ap2.inner_text("main"))
        adm2.close()

        # --- 10f. saving a role, messaging a person, and being told ----------
        adm3 = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ap3 = adm3.new_page()
        sign_in(ap3, "admin@thedocument.test", STAFF_PASS)
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
        # The form speaks the language of the piece, and this one is English.
        tp.select_option('select[name="language"]', "EN")
        tp.fill('input[name="title"]', REJECT_TITLE)
        tp.fill(
            "textarea",
            "A short filing that an editor is going to send back, so the writer can be "
            "told about it. It needs enough words to pass the length check on submission.",
        )
        tp.click('button[name="save-draft"]')
        tp.wait_for_selector("text=Draft saved", timeout=20000)
        tp.click('button[name="submit-article"]')
        tp.wait_for_selector("text=Submitted for review", timeout=20000)

        ed3 = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ep4 = ed3.new_page()
        sign_in(ep4, "editor@thedocument.test", STAFF_PASS)
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
        sign_in(php, "admin@thedocument.test", STAFF_PASS)
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
        sign_in(np, "admin@thedocument.test", STAFF_PASS)

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
        # A Bangla piece must be editable in a Bengali face, not in boxes.
        faces = np.evaluate(
            """() => {
                 const ta = document.querySelector('section textarea');
                 if (!ta) return { lang: '', font: '' };
                 return { lang: ta.getAttribute('lang') || '', font: getComputedStyle(ta).fontFamily };
               }"""
        )
        check(
            "the editor's copy box is marked with the piece's language",
            faces["lang"] in ("bn", "en"),
            str(faces),
        )
        if faces["lang"] == "bn":
            check(
                "and a Bangla piece is edited in a Bengali face",
                any(n in faces["font"] for n in ("Hind Siliguri", "Anek Bangla", "Tiro Bangla", "Bengali")),
                faces["font"],
            )
        live = np.locator('a:has-text("View live")').first.get_attribute("href")
        r = np.request.get(f"{BASE}{live}")
        check("the View live link goes to a real page", r.status == 200, f"{live} -> {r.status}")
        shot(np, "39-editorial-controls.png")

        # Editing a live piece: a long Bangla headline has to be accepted, the
        # address must not move under the readers, and a refusal has to say
        # which field it is about.
        headline = np.locator("section input").first
        was = headline.input_value()
        long_headline = was + " " + "যুক্ত বাক্যাংশ সহ দীর্ঘ শিরোনাম" * 6
        headline.fill(long_headline)
        with np.expect_response(
            lambda r_: "/api/editorial/" in r_.url and r_.request.method == "PATCH"
        ) as got:
            np.click('button:has-text("Save and update the live article")')
        check(
            "a headline longer than 180 characters saves",
            got.value.status == 200,
            f"{len(long_headline)} chars -> {got.value.status}",
        )
        np.wait_for_timeout(SETTLE_MS)
        check(
            "and says the live article was updated",
            "Updated" in np.locator('p[role="status"]').first.inner_text(),
            np.locator('p[role="status"]').first.inner_text(),
        )
        check(
            "a published piece keeps the address it was published at",
            np.locator('a:has-text("View live")').first.get_attribute("href") == live,
            str(np.locator('a:has-text("View live")').first.get_attribute("href")),
        )

        np.locator("section input").first.fill("")
        np.click('button:has-text("Save and update the live article")')
        np.wait_for_timeout(SETTLE_MS)
        refusal = np.locator('p[role="status"]').first.inner_text()
        check("a refused save names the field it is about", "Headline" in refusal, refusal)

        np.locator("section input").first.fill(was)
        np.click('button:has-text("Save and update the live article")')
        np.wait_for_selector("text=Updated", timeout=20000)
        np.reload(wait_until="domcontentloaded")
        np.wait_for_timeout(SETTLE_MS)
        check(
            "the run hands the headline back as it found it",
            np.locator("section input").first.input_value() == was,
        )

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
        while np.locator('button:text-is("Remove")').count():
            np.locator('button:text-is("Remove")').first.click()
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
        # A piece pinned to the lead leads the front page of the language it
        # was written in. A Bangla original has no English version until an
        # editor writes one, so check both sides and require one of them.
        leads = []
        for side in (BASE, f"{BASE}/en"):
            go(np, side)
            leads.append(np.locator("main article h2").first.inner_text())
        check(
            "the pinned piece really leads the front page",
            any(pinned_title[:24] in lead for lead in leads),
            f"pinned {pinned_title[:40]!r} vs leads {[l[:40] for l in leads]}",
        )

        # And it can be taken off again.
        go(np, f"{BASE}/editorial/front-page")
        np.locator('button:text-is("Remove")').first.click()
        np.wait_for_selector("text=Taken off the front page", timeout=20000)
        check("and taken off again", True)

        # --- 10e9. the machine first draft ----------------------------------
        # Deliberately never calls the provider: a test must not spend the
        # owner's money. It checks the two states instead - switched on means
        # the button is offered, switched off means it is absent and the
        # endpoint says so rather than erroring.
        go(np, f"{BASE}/editorial?status=APPROVED")
        np.wait_for_timeout(SETTLE_MS)
        np.locator('main a:has-text("Open")').first.click()
        np.wait_for_url("**/editorial/**", timeout=20000)
        np.wait_for_timeout(SETTLE_MS)
        offered = np.locator('button[name="draft-translation"]').count() == 1
        check(
            "the translation desk is there either way",
            np.locator("#translation").count() == 1,
        )
        if offered:
            check(
                "an AI first draft is offered, and says the editor still saves it",
                "You still read it and press Save" in np.inner_text("#translation"),
            )
            print("NOTE a translation key is configured, so the draft button is live. The "
                  "provider was not called - that would spend the owner's money.")
        else:
            art_id = np.url.rstrip("/").rsplit("/", 1)[-1]
            r = np.request.post(f"{BASE}/api/editorial/{art_id}/translation/draft")
            check(
                "with no key the feature is absent and says so rather than erroring",
                r.status == 503 and "not switched on" in r.text(),
                f"{r.status} {r.text()[:80]}",
            )

        # --- 10f1. the positions nobody pinned ------------------------------
        # With an empty board the page has to be today's paper: the newest
        # piece leads, the next two sit under it, and the rails come after. It
        # used to fill the rails first, which put the eighth and ninth stories
        # in the middle of the page under the main headline.
        while np.locator('button:text-is("Remove")').count():
            np.locator('button:text-is("Remove")').first.click()
            np.wait_for_timeout(SETTLE_MS)

        def middle_column(pg):
            go(pg, f"{BASE}/")
            return pg.evaluate(
                """() => {
                     const cols = [...(document.querySelector('main div.grid')?.children ?? [])];
                     return cols[1]
                       ? [...cols[1].querySelectorAll('a[href*="/article/"]')]
                           .map((a) => a.getAttribute('href'))
                       : [];
                   }"""
            )

        empty_board = middle_column(np)
        check(
            "with nothing pinned the page still leads with something",
            len(empty_board) >= 1,
            str(empty_board[:1]),
        )

        go(np, f"{BASE}/editorial/front-page")
        np.wait_for_timeout(SETTLE_MS)
        preview = np.evaluate(
            """() => {
                 const out = {};
                 for (const s of document.querySelectorAll('main section')) {
                   const h = s.querySelector('h2');
                   if (!h) continue;
                   out[h.innerText.trim()] = [...s.querySelectorAll('li')]
                     .filter((li) => li.innerText.includes('Filled automatically')).length;
                 }
                 return out;
               }"""
        )
        check(
            "the board shows what will fill the main headline",
            preview.get("Main headline") == 1,
            str(preview),
        )
        check(
            "and what will fill both places under it",
            preview.get("Under the headline") == 2,
            str(preview),
        )

        # A change on the board has to show on the next load, not a minute
        # later: the public pages are cached, so every write clears them.
        go(np, f"{BASE}/editorial/front-page")
        np.locator('section:has(h2:text-is("Main headline")) button:has-text("Add an article")').first.click()
        np.wait_for_timeout(SETTLE_MS)
        np.locator('section:has(input[placeholder^="Search published"]) ul button').last.click()
        np.wait_for_selector("text=Placed.", timeout=20000)
        np.wait_for_timeout(SETTLE_MS)
        check(
            "pinning a lead shows on the very next load, with no wait for the cache",
            middle_column(np)[:1] != empty_board[:1],
            f"{middle_column(np)[:1]} was {empty_board[:1]}",
        )

        go(np, f"{BASE}/editorial/front-page")
        np.locator('section:has(h2:text-is("Main headline")) button:text-is("Remove")').first.click()
        np.wait_for_selector("text=Taken off the front page", timeout=20000)
        np.wait_for_timeout(SETTLE_MS)
        check(
            "and taking it off hands the page straight back to the newest work",
            middle_column(np) == empty_board,
            f"{middle_column(np)[:3]} vs {empty_board[:3]}",
        )
        shot(np, "45-front-page-automatic.png")

        # --- 10f15. the English half is set in the face he asked for --------
        go(np, f"{BASE}/en")
        faces = np.evaluate(
            """() => {
                 const h = document.querySelector('main .balance');
                 return h
                   ? { family: getComputedStyle(h).fontFamily, weight: getComputedStyle(h).fontWeight }
                   : null;
               }"""
        )
        check("English headlines are set in Inter", "Inter" in str(faces and faces["family"]), str(faces))
        check("at the heavy weight the reference paper uses", faces and faces["weight"] == "900", str(faces))
        go(np, f"{BASE}/")
        bn_face = np.evaluate(
            """() => {
                 const h = document.querySelector('main .balance');
                 return h ? getComputedStyle(h).fontFamily : '';
               }"""
        )
        check("and the Bangla half keeps its own face", "Inter" not in str(bn_face), str(bn_face)[:90])

        # --- 10f2. the wording the owner controls ----------------------------
        # Labels are his to change, in both languages, without a developer.
        go(np, f"{BASE}/admin/wording")
        if "/admin/wording" not in np.url:
            print("NOTE this account is not the owner, so the wording screen was not opened")
        else:
            boxes = np.locator("textarea").count()
            check("the wording screen lists every line of the site", boxes > 100, str(boxes))
            before_bn = np.input_value('textarea[name="BN:feed.alsoToday"]')
            np.fill('textarea[name="BN:feed.alsoToday"]', "আজকের নির্বাচিত খবর")
            np.click('button:has-text("Save wording")')
            np.wait_for_selector("text=Saved", timeout=20000)
            np.wait_for_timeout(SETTLE_MS)

            go(np, f"{BASE}/")
            check(
                "a changed Bangla label shows on the site at once",
                "আজকের নির্বাচিত খবর" in np.content(),
            )
            go(np, f"{BASE}/en")
            check(
                "and the English site keeps its own wording",
                "Also today" in np.content() and "আজকের নির্বাচিত খবর" not in np.content(),
            )

            # Emptying the box is how a change is undone.
            go(np, f"{BASE}/admin/wording")
            np.fill('textarea[name="BN:feed.alsoToday"]', before_bn)
            np.click('button:has-text("Save wording")')
            np.wait_for_selector("text=Saved", timeout=20000)
            np.wait_for_timeout(SETTLE_MS)
            go(np, f"{BASE}/")
            check(
                "the run hands the wording back as it found it",
                "আজকের আরও খবর" in np.content() and "আজকের নির্বাচিত খবর" not in np.content(),
            )
            shot(np, "46-wording.png")

        # The summary sells the piece in a list; it is not repeated on the
        # article, where the reader has already read it.
        go(np, f"{BASE}/")
        np.locator('main div.grid > div a[href*="/article/"]').first.click()
        np.wait_for_url("**/article/**", timeout=20000)
        np.wait_for_timeout(SETTLE_MS)
        after_headline = np.evaluate(
            """() => {
                 const h1 = document.querySelector('main h1');
                 const next = h1 && h1.nextElementSibling;
                 return next ? next.tagName : 'NONE';
               }"""
        )
        check(
            "the one-line summary is not repeated under the headline",
            after_headline != "P",
            after_headline,
        )

        # Formatting toolbar, and what it writes.
        go(np, f"{BASE}/dashboard")
        np.click('button:has-text("Start a new piece")')
        np.wait_for_url("**/dashboard/write/**", timeout=20000)
        np.wait_for_timeout(SETTLE_MS)
        np.select_option('select[name="language"]', "EN")
        np.wait_for_timeout(300)
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

        # --- 10k. favicon, sections, and framing the cover -------------------
        ic = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ip2 = ic.new_page()

        # The owner's own favicon, served as the icon the browser asks for.
        go(ip2, BASE)
        icon = ip2.evaluate(
            """() => {
                 const l = document.querySelector('link[rel~="icon"]');
                 return l ? l.getAttribute('href') : '';
               }"""
        )
        check("the page declares an icon", bool(icon), str(icon))
        r = ip2.request.get(icon if icon.startswith("http") else f"{BASE}{icon}")
        check(
            "the icon is a PNG that really loads",
            r.status == 200 and "png" in (r.headers.get("content-type") or ""),
            f"{r.status} {r.headers.get('content-type')}",
        )

        # The section he asked for, and a readable address for it.
        menu = ip2.inner_text("header + nav")
        check("the menu carries আইনশৃঙ্খলা", "আইনশৃঙ্খলা" in menu, menu[:120])
        r = ip2.request.get(f"{BASE}/section/law-and-order")
        check("its address reads properly and resolves", r.status == 200, f"got {r.status}")

        # Framing a cover, and proving the front page obeys it.
        sign_in(ip2, "admin@thedocument.test", STAFF_PASS)
        go(ip2, f"{BASE}/editorial?status=APPROVED")
        opened = False
        for i in range(6):
            rows = ip2.locator('main ul > li a:has-text("Open")')
            if i >= rows.count():
                break
            rows.nth(i).click()
            ip2.wait_for_url("**/editorial/**", timeout=20000)
            ip2.wait_for_timeout(SETTLE_MS)
            if ip2.locator('button:has-text("Save this framing")').count():
                opened = True
                break
            go(ip2, f"{BASE}/editorial?status=APPROVED")

        if not opened:
            print("SKIP  no published piece on this site has a cover photo to frame")
        if opened:
            check(
                "a cover offers two framings, one per place it appears",
                ip2.locator('button:has-text("Save this framing")').count() == 2,
            )
            article_url = ip2.url
            # Zoom the front-page framing right in, then save it.
            ip2.locator('input[type="range"]').first.fill("40")
            ip2.wait_for_timeout(300)
            ip2.locator('button:has-text("Save this framing")').first.click()
            ip2.wait_for_selector("text=Saved.", timeout=20000)
            ip2.wait_for_timeout(SETTLE_MS)
            shot(ip2, "41-cover-framing.png")

            stored = ip2.request.get(f"{BASE}/api/editorial/{article_url.rstrip('/').split('/')[-1]}").json()
            crop = stored["article"]["coverCropHome"]
            check("the framing is stored against the article", bool(crop), str(crop))

            # And the reader's page must show that slice, not the whole photo.
            # The article's own page is the deterministic place to look: the
            # front page might not be carrying this piece today.
            ip2.locator('input[type="range"]').nth(1).fill("45")
            ip2.wait_for_timeout(300)
            ip2.locator('button:has-text("Save this framing")').nth(1).click()
            ip2.wait_for_timeout(SETTLE_MS * 2)

            live_href = ip2.locator('a:has-text("View live")').first.get_attribute("href")
            go(ip2, f"{BASE}{live_href}")
            wait_article(ip2)
            shown = ip2.evaluate(
                """() => {
                     const img = document.querySelector('main figure img');
                     if (!img) return null;
                     const frame = img.parentElement.getBoundingClientRect();
                     const box = img.getBoundingClientRect();
                     return { zoom: Math.round((box.width / frame.width) * 100) / 100 };
                   }"""
            )
            check(
                "a zoomed framing really is zoomed on the reader's page",
                bool(shown) and shown["zoom"] > 1.2,
                str(shown),
            )

            go(ip2, article_url)
            ip2.wait_for_timeout(SETTLE_MS)
            ip2.locator('button:has-text("Use the whole picture")').nth(1).click()
            ip2.wait_for_timeout(SETTLE_MS)

            # Put it back, so the run leaves nothing behind.
            go(ip2, article_url)
            ip2.wait_for_timeout(SETTLE_MS)
            ip2.locator('button:has-text("Use the whole picture")').first.click()
            ip2.wait_for_timeout(SETTLE_MS)
        ic.close()

        # --- 10l. photographs sized for a phone ------------------------------
        # Contributors upload what their phone took - six or seven megabytes.
        # Readers must never be sent that.
        pc = ctx.browser.new_context(viewport=PHONE, device_scale_factor=2, http_credentials=GATE)
        pp = pc.new_page()
        go(pp, BASE)
        pics = pp.evaluate(
            """() => [...document.querySelectorAll('main img, header img')]
                 .map((i) => ({ src: i.getAttribute('src') || '', set: i.getAttribute('srcset') || '' }))
                 .filter((i) => i.src.includes('/media/'))"""
        )
        unsized = [p for p in pics if "?w=" not in p["src"] and "?w=" not in p["set"]]
        check(
            "every photograph on the front page asks for a size",
            not unsized,
            f"{len(pics)} pictures, unsized: {[u['src'] for u in unsized][:3]}",
        )

        if pics:
            raw = pics[0]["src"].split("?")[0]
            full = pp.request.get(f"{BASE}{raw}")
            small = pp.request.get(f"{BASE}{raw}?w=480")
            full_kb = len(full.body()) // 1024
            small_kb = len(small.body()) // 1024
            check(
                "a phone-sized copy is served as WebP",
                "webp" in (small.headers.get("content-type") or ""),
                str(small.headers.get("content-type")),
            )
            check(
                "and is a fraction of the original",
                small_kb * 3 <= full_kb or full_kb < 60,
                f"original {full_kb}kB, phone copy {small_kb}kB",
            )
            check(
                "the resized copy is cached hard, so it is fetched once",
                "immutable" in (small.headers.get("cache-control") or ""),
                str(small.headers.get("cache-control")),
            )

        # An editor still gets the untouched original to work from.
        if pics:
            orig = pp.request.get(f"{BASE}{raw}?download=1")
            check(
                "an editor still downloads the full original",
                orig.status == 200 and "webp" not in (orig.headers.get("content-type") or ""),
                f"{orig.status} {orig.headers.get('content-type')}",
            )
        pc.close()

        # --- 10m. the strip, staff writing, witnesses, both toolbars ---------
        sb = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        sp = sb.new_page()
        sign_in(sp, "admin@thedocument.test", STAFF_PASS)

        # No scrollbar painted across the signed-in strip, at either width.
        for width, label in ((DESKTOP["width"], "desktop"), (PHONE["width"], "a phone")):
            sp.set_viewport_size({"width": width, "height": 800})
            go(sp, BASE)
            bars = sp.evaluate(
                """() => {
                     const strip = document.querySelector('header').previousElementSibling;
                     const row = strip ? strip.querySelector('nav') : null;
                     if (!row) return null;
                     return {
                       overflowing: row.scrollWidth - row.clientWidth,
                       hidden: getComputedStyle(row).scrollbarWidth === 'none',
                     };
                   }"""
            )
            check(
                f"no scrollbar is drawn across the signed-in strip on {label}",
                bars is None or bars["hidden"],
                str(bars),
            )
        sp.set_viewport_size(DESKTOP)

        # An editor writing their own piece is not asked for a contact number.
        go(sp, f"{BASE}/dashboard")
        sp.click('button:has-text("Start a new piece")')
        sp.wait_for_url("**/dashboard/write/**", timeout=20000)
        sp.wait_for_timeout(SETTLE_MS)
        sp.select_option('select[name="language"]', "EN")
        sp.wait_for_timeout(300)
        desk = sp.inner_text("main")
        check(
            "the desk is not asked how to reach itself",
            "How the desk can reach you" not in desk,
            desk[:200],
        )
        sp.fill('input[name="title"]', "A piece filed by the desk itself")
        sp.fill(
            "textarea >> nth=0",
            "Written in the newsroom rather than sent in, so there is nobody to telephone "
            "about it and no witness to name. It still has to publish like anything else.",
        )
        sp.click('button[name="save-draft"]')
        sp.wait_for_selector("text=Draft saved", timeout=20000)
        sp.click('button[name="submit-article"]')
        sp.wait_for_selector("text=Submitted for review", timeout=20000)
        check("and can still submit without one", True)
        sb.close()

        # A contributor gets the witness box, and the desk sees what they wrote.
        # Not NEW_EMAIL: that account was promoted to editor earlier in the run,
        # and an editor is deliberately not asked any of this.
        wc = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        wp = wc.new_page()
        sign_in(wp, INBOX_EMAIL, NEW_PASS)
        go(wp, f"{BASE}/dashboard")
        wp.click('button:has-text("Start a new piece")')
        wp.wait_for_url("**/dashboard/write/**", timeout=20000)
        wp.wait_for_timeout(SETTLE_MS)
        check(
            "a contributor is asked who saw it happen, in Bangla",
            "প্রত্যক্ষদর্শী" in wp.inner_text("main"),
        )
        wp.fill('input[name="title"]', WITNESS_TITLE)
        wp.fill(
            "textarea >> nth=0",
            "A filing that names somebody who was standing there, so the desk can ring them "
            "before it runs. Long enough to pass the length check on submission.",
        )
        witness_text = "মোঃ রফিকুল ইসলাম, বাগেরহাট সদর, ০১৭১১২২৩৩৪৪"
        wp.fill("textarea >> nth=1", witness_text)
        wp.fill('input[placeholder="01XXXXXXXXX"] >> nth=0', "01711000111")
        # This piece stays in Bangla, so the whole form - including the two
        # confirmations - has to come back in Bangla.
        wp.click('button[name="save-draft"]')
        wp.wait_for_selector("text=খসড়া সংরক্ষিত", timeout=20000)
        check("a Bangla piece is told its draft was saved, in Bangla", True)
        wp.click('button[name="submit-article"]')
        wp.wait_for_selector("text=যাচাইয়ের জন্য জমা দেওয়া হয়েছে", timeout=20000)
        check(
            "and the submission is confirmed in Bangla",
            "আমার ডেস্কে ফিরুন" in wp.inner_text("main"),
            wp.inner_text("main")[:120].replace("\n", " "),
        )
        wc.close()

        ec = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        ep5 = ec.new_page()
        sign_in(ep5, "editor@thedocument.test", STAFF_PASS)
        go(ep5, f"{BASE}/editorial?status=SUBMITTED&q={WITNESS_TITLE.split(' ')[1]}")
        ep5.locator(f'li:has-text("{WITNESS_TITLE}") a:has-text("Review")').first.click()
        ep5.wait_for_url("**/editorial/**", timeout=20000)
        ep5.wait_for_timeout(SETTLE_MS)
        review = ep5.inner_text("main")
        check("the desk sees the witnesses the contributor named", witness_text[:14] in review, review[:200])

        # The missing other-language version is a link to the box that writes it.
        check(
            "a missing language version points at the box that fixes it",
            ep5.locator('a[href="#translation"]').count() == 1,
        )
        check(
            "and that box offers the same formatting as the original",
            ep5.locator('section#translation button[title^="Bold"]').count() == 1,
        )

        # Write the English version there and prove it saves.
        ep5.fill('section#translation input >> nth=0', "A witness named, and the desk rang them")
        ep5.fill('section#translation textarea', "The English version, written by the desk.")
        ep5.click('section#translation button:has-text("translation")')
        ep5.wait_for_selector("text=version saved", timeout=20000)
        check("an editor can write the missing version themselves", True)
        shot(ep5, "42-translation-desk.png")
        ec.close()

        # --- 10n. a desk byline, and ads that stay on their own side --------
        bl = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        bp = bl.new_page()
        sign_in(bp, "admin@thedocument.test", STAFF_PASS)

        # The desk files a piece under a correspondent's name.
        go(bp, f"{BASE}/dashboard")
        bp.click('button:has-text("Start a new piece")')
        bp.wait_for_url("**/dashboard/write/**", timeout=20000)
        bp.wait_for_timeout(SETTLE_MS)
        bp.select_option('select[name="language"]', "EN")
        bp.wait_for_timeout(300)
        check(
            "the desk is offered a contributor name for the piece",
            "Set a contributor name for this article" in bp.inner_text("main"),
        )
        bp.fill('input[name="title"]', BYLINE_TITLE)
        bp.fill(
            "textarea >> nth=0",
            "Filed from the newsroom under a correspondent's name, the way a desk runs copy "
            "from a stringer who has no account on the site.",
        )
        bp.fill('input[placeholder^="Leave empty to publish under"]', BYLINE_NAME)
        bp.click('button[name="save-draft"]')
        bp.wait_for_selector("text=Draft saved", timeout=20000)
        bp.click('button[name="submit-article"]')
        bp.wait_for_selector("text=Submitted for review", timeout=20000)

        # Publish it, then look at what a reader sees.
        go(bp, f"{BASE}/editorial?status=SUBMITTED&q={BYLINE_TITLE.split(' ')[1]}")
        bp.locator(f'li:has-text("{BYLINE_TITLE}") a:has-text("Review")').first.click()
        bp.wait_for_url("**/editorial/**", timeout=20000)
        bp.wait_for_timeout(SETTLE_MS)
        check(
            "and the review screen offers the same field",
            bp.locator('input[name="bylineName"]').count() == 1,
        )
        tr_title = f"{BYLINE_TITLE} (Bangla)"
        bp.fill("section#translation input >> nth=0", tr_title)
        bp.fill("section#translation textarea", "বাংলা সংস্করণ, ডেস্কের লেখা।")
        bp.click('section#translation button:has-text("translation")')
        bp.wait_for_selector("text=version saved", timeout=20000)
        bp.wait_for_timeout(SETTLE_MS)
        bp.click('button:has-text("Approve and publish")')
        bp.wait_for_selector("text=Published", timeout=20000)
        bp.wait_for_timeout(SETTLE_MS)

        live = bp.locator('a:has-text("View live")').first.get_attribute("href")
        go(bp, f"{BASE}{live}")
        wait_article(bp)
        reader = bp.inner_text("main")
        check(
            "the reader sees the name the desk set, not the editor's account",
            BYLINE_NAME in reader and "Nadia Okoro" not in reader,
            reader[:220],
        )
        # The name may well appear inside a card link elsewhere on the page;
        # what matters is that it is not offered as a profile to visit.
        check(
            "a made-up byline is not linked to a profile that does not exist",
            bp.locator(f'main a[href*="/author/"]:has-text("{BYLINE_NAME}")').count() == 0,
        )
        shot(bp, "43-desk-byline.png")

        # Advertising: each half of the paper keeps its own.
        go(bp, f"{BASE}/admin")
        bp.check('#site-settings input[name="adsEnabled"]')
        bp.click('summary:has-text("Or paste code from an ad network")')
        bp.wait_for_timeout(300)
        bp.fill('#site-settings textarea[name="adBannerHtml"]', '<div id="ad-bn">BANGLA BANNER</div>')
        bp.fill('#site-settings textarea[name="adBannerHtmlEn"]', '<div id="ad-en">ENGLISH BANNER</div>')
        bp.click('button:has-text("Save site settings")')
        bp.wait_for_selector("text=Refresh the public site", timeout=20000)

        go(bp, BASE)
        bn_home = bp.inner_text("main")
        go(bp, f"{BASE}/en")
        en_home = bp.inner_text("main")
        check(
            "the Bangla banner runs on the Bangla site only",
            "BANGLA BANNER" in bn_home and "BANGLA BANNER" not in en_home,
            f"bn={'yes' if 'BANGLA BANNER' in bn_home else 'no'} en={'yes' if 'BANGLA BANNER' in en_home else 'no'}",
        )
        check(
            "and the English banner on the English site only",
            "ENGLISH BANNER" in en_home and "ENGLISH BANNER" not in bn_home,
            f"en={'yes' if 'ENGLISH BANNER' in en_home else 'no'} bn={'yes' if 'ENGLISH BANNER' in bn_home else 'no'}",
        )
        shot(bp, "44-ads-by-language.png")
        bl.close()

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
        mp.locator("main article h2").first.click()
        mp.wait_for_url("**/article/**", timeout=20000)
        mp.wait_for_timeout(SETTLE_MS)
        mp.screenshot(path=os.path.join(SHOTS, "13-article-mobile.png"))
        go(mp, f"{BASE}/login")
        mp.fill('input[type="email"]', "maya@thedocument.test")
        mp.fill('input[type="password"]', STAFF_PASS)
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
            # publish-before-translating, a malformed website, an advertising
            # link with no http:// (422s) and the wrong current password (403).
            # The refused empty headline is not counted: it happens in the
            # newsroom context, whose console is not collected here.
            len(rejected) == 6,
            str(rejected),
        )
        check("no uncaught JS errors anywhere in the run", not real_errors, str(real_errors[:3]))

        # Hand the site back exactly as it was found: the owner's own
        # advertising, not the markup this run pasted over it.
        if ADS_BEFORE:
            restore = ctx.browser.new_context(viewport=DESKTOP, http_credentials=GATE)
            rp = restore.new_page()
            sign_in(rp, "admin@thedocument.test", STAFF_PASS)
            go(rp, f"{BASE}/admin")
            rp.click('summary:has-text("Or paste code from an ad network")')
            rp.wait_for_timeout(300)
            for field, value in ADS_BEFORE.items():
                sel = (
                    f'#site-settings input[name="{field}"]'
                    if field == "siteNameEn"
                    else f'#site-settings textarea[name="{field}"]'
                )
                rp.fill(sel, value)
            rp.click('button:has-text("Save site settings")')
            rp.wait_for_selector("text=Refresh the public site", timeout=20000)
            rp.wait_for_timeout(SETTLE_MS)
            back = {
                f: rp.input_value(
                    f'#site-settings input[name="{f}"]'
                    if f == "siteNameEn"
                    else f'#site-settings textarea[name="{f}"]'
                )
                for f in ADS_BEFORE
            }
            check(
                "the run hands the advertising settings back as it found them",
                back == ADS_BEFORE,
                str({k: v[:30] for k, v in back.items() if v != ADS_BEFORE[k]}),
            )
            restore.close()

        browser.close()

    print("\n%d/%d checks passed" % (sum(1 for _, ok, _ in results if ok), len(results)))


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print("\nFAILED: %s" % e)
        print("%d/%d checks passed before the failure" % (sum(1 for _, ok, _ in results if ok), len(results)))
        sys.exit(1)
