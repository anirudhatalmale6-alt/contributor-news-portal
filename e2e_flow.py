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

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3300")
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(SHOTS, exist_ok=True)

DESKTOP = {"width": 1280, "height": 720}
PHONE = {"width": 390, "height": 780}

STAMP = str(int(time.time()))
NEW_EMAIL = f"rosa.{STAMP}@thedocument.test"
NEW_PASS = "demo1234"
NEW_PASS2 = "demo-changed-5678"
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
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_url(lambda u: "/login" not in u, timeout=20000)


def sign_out(page):
    # the root is the Bangla site now, where the button reads সাইন আউট
    page.goto(f"{BASE}/en", wait_until="networkidle")
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
        ctx = browser.new_context(viewport=DESKTOP, http_credentials=GATE)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "console",
            lambda m: errors.append(m.text) if m.type == "error" else None,
        )

        # --- 1. public feed -------------------------------------------------
        page.goto(BASE, wait_until="networkidle")
        check(
            "the default home page is the Bangla feed",
            "সর্বশেষ" in page.content() and "আজকের আরও খবর" in page.content(),
        )
        check(
            "the English switch is a visible button, not a hidden link",
            page.locator("header a:has-text('English')").first.is_visible(),
        )
        page.click("header a:has-text('English')")
        page.wait_for_url("**/en", timeout=20000)
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
        page.goto(f"{BASE}/bn", wait_until="networkidle")
        check("the old /bn address redirects to the new Bangla root", page.url.rstrip("/") == BASE)
        shot(page, "21-home-bangla-default.png")
        page.goto(f"{BASE}/en", wait_until="networkidle")

        # --- 2. article page ------------------------------------------------
        # .first: the headline is a link in both the lead card and the rail
        page.locator("a:has-text('The night bus that never came')").first.click()
        page.wait_for_url("**/en/article/**", timeout=20000)
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
        page.reload(wait_until="networkidle")
        check(
            "draft survives a reload (saved server-side, not in the browser)",
            HEADLINE in page.content() and "attenuation basin" in page.content(),
        )

        # --- 5. submit ------------------------------------------------------
        page.click('button:has-text("Submit for review")')
        page.wait_for_selector("text=Submitted for review", timeout=20000)
        check(
            "submitting shows a confirmation with a way back",
            "Back to my desk" in page.content(),
        )
        page.click('a:has-text("Back to my desk")')
        page.wait_for_url("**/dashboard", timeout=20000)
        check("the piece is now in review", "In review" in page.content())
        page.goto(f"{BASE}/dashboard", wait_until="networkidle")
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

        page.goto(f"{BASE}/dashboard", wait_until="networkidle")
        check(
            "the dashboard shows the method and only the last four digits",
            "bKash" in page.content() and "5203" in page.content() and "01819" not in page.content(),
        )

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
        page.goto(f"{BASE}/dashboard", wait_until="networkidle")
        body = norm(page.content())
        check("payout appears on the contributor's article", "BDT 132.50" in body)
        check("cumulative earnings total updates", "Total earnings" in body and "BDT 132.50" in body)
        check("editor's note reaches the writer", "Tightened the headline" in body)
        check("the editor's headline edit is what the writer now sees", "refused to buy it" in body)
        shot(page, "09-dashboard-earnings.png")

        # --- 8. live on the public site -------------------------------------
        page.goto(f"{BASE}/en?category=Culture", wait_until="networkidle")
        check("approved piece is live on the public feed", "refused to buy it" in page.content())
        shot(page, "10-public-feed-culture.png")

        # --- 8b. the same piece on the Bangla side of the site ---------------
        page.goto(BASE, wait_until="networkidle")
        bn_home = page.content()
        check("the Bangla front page is in Bangla", "সর্বশেষ" in bn_home and "আজকের আরও খবর" in bn_home)
        check("the editor's Bangla headline is live", BN_HEADLINE in bn_home)
        check(
            "a piece written in Bangla by a contributor is also there",
            "পুরোনো খালের ওপর নতুন সড়ক" in bn_home,
        )
        shot(page, "18-bangla-feed.png")

        page.locator(f"a:has-text('{BN_HEADLINE}')").first.click()
        page.wait_for_url("**/article/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        check("the Bangla article renders the translated body", BN_BODY[:24] in page.content())
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

        check("readers get an Evidence gallery", "প্রমাণ" in page.content())
        shot(page, "28-evidence.png", scroll="section:has-text('প্রমাণ')")

        # the language switch returns to the English version of the same story
        page.click("text=Read in English")
        page.wait_for_url("**/en/article/**", timeout=20000)
        check("the language switch lands on the English version", "refused to buy it" in page.content())

        # a Bangla original is readable in English too
        page.goto(f"{BASE}/en/article/notun-sorok-puratan-khaler-opore-en", wait_until="networkidle")
        check(
            "the desk's English version of a Bangla original is live",
            "A new road over an old canal" in page.content(),
        )

        # --- 8b2. changing your own password ---------------------------------
        sign_out(page)
        sign_in(page, NEW_EMAIL, NEW_PASS)
        page.goto(f"{BASE}/dashboard/account", wait_until="networkidle")
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
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill('input[type="email"]', NEW_EMAIL)
        page.fill('input[type="password"]', NEW_PASS)
        page.click('button[type="submit"]')
        page.wait_for_selector("text=did not match", timeout=20000)
        check("the old password no longer works", "did not match" in page.content())
        sign_in(page, NEW_EMAIL, NEW_PASS2)
        check("the new password works", "/login" not in page.url)

        # --- 8c. a contributor writing BOTH versions themselves --------------
        sign_out(page)
        sign_in(page, NEW_EMAIL, NEW_PASS2)
        page.goto(f"{BASE}/dashboard", wait_until="networkidle")
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
        page.click('button:has-text("Submit for review")')
        page.wait_for_selector("text=Submitted for review", timeout=20000)

        sign_out(page)
        sign_in(page, "editor@thedocument.test", "demo1234")
        page.goto(f"{BASE}/editorial", wait_until="networkidle")
        queue_row = page.locator(f'li:has-text("{BOTH_EN_TITLE}")')
        check(
            "the queue shows that both languages arrived together",
            "both languages" in queue_row.inner_text(),
        )
        queue_row.locator('a:has-text("Review")').click()
        page.wait_for_url("**/editorial/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        check(
            "the editor sees the contributor's own second version, not an empty box",
            "Supplied by the contributor" in page.content() and BOTH_BN_TITLE in page.content(),
        )
        page.fill('input[inputmode="decimal"]', "90.00")
        page.click('button:has-text("Approve and publish")')
        page.wait_for_selector("text=Published.", timeout=20000)
        check("a piece that arrived in both languages publishes straight away", "90.00" in page.content())

        page.goto(BASE, wait_until="networkidle")
        check("it is live on the Bangla site", BOTH_BN_TITLE in page.content())
        page.goto(f"{BASE}/en", wait_until="networkidle")
        check("and on the English site", BOTH_EN_TITLE in page.content())

        # --- 8d. featuring, sections and related articles --------------------
        # (still signed in as the editor from the step above)
        page.goto(f"{BASE}/editorial?status=APPROVED", wait_until="networkidle")
        row = page.locator(f'li:has-text("{BOTH_EN_TITLE}")')
        row.locator('button:has-text("Feature on front page")').click()
        expect(row.locator('button:has-text("On the front page")')).to_be_visible(timeout=20000)
        check("an editor can put a published piece on the front page", True)

        page.goto(f"{BASE}/en", wait_until="networkidle")
        lead = page.locator("main h2").first.inner_text()
        check(
            "the featured piece leads the front page, not just the newest",
            BOTH_EN_TITLE in lead,
            lead,
        )
        shot(page, "24-front-page-featured.png")

        # sections
        page.goto(f"{BASE}/en/section/politics", wait_until="networkidle")
        body = page.content()
        check("the Politics section page lists its own stories", "night bus" in body)
        check("and nothing from another section", "corner shop" not in body)
        shot(page, "25-section-page.png")
        page.goto(f"{BASE}/section/politics", wait_until="networkidle")
        check("the Bangla section page works too", "যে রাতের বাস কখনো আসেনি" in page.content())

        r = page.request.get(f"{BASE}/en/section/not-a-section")
        check("an invented section is a 404, not a blank page", r.status == 404, f"got {r.status}")

        # related articles
        page.goto(f"{BASE}/en/article/the-night-bus-that-never-came", wait_until="networkidle")
        check("an article offers more to read", "More on this" in page.content())
        related = page.locator("section:has-text('More on this') a").count()
        check("related links are real links", related >= 1, str(related))

        # --- 9. admin: roles, verified flag, payment settings ---------------
        sign_out(page)
        sign_in(page, "admin@thedocument.test", "demo1234")
        page.goto(f"{BASE}/people", wait_until="networkidle")
        check("the owner sees every account", NEW_EMAIL in page.content())
        roster = page.request.get(f"{BASE}/api/admin/users").json()["users"]
        NEW_USER_ID[0] = next(u["id"] for u in roster if u["email"] == NEW_EMAIL)

        # search: the whole point of the screen
        page.fill('input[placeholder="Search by name or email"]', NEW_EMAIL.split("@")[0])
        page.wait_for_timeout(300)
        check(
            "searching by email narrows the list to one person",
            page.locator("tbody tr").count() == 1,
            str(page.locator("tbody tr").count()),
        )
        page.fill('input[placeholder="Search by name or email"]', "Maya")
        page.wait_for_timeout(400)
        # read the table, not page.content(): the server payload in the HTML
        # carries every row regardless of what the client is filtering to.
        check("searching by name works too", "maya@thedocument.test" in page.inner_text("tbody"))
        page.fill('input[placeholder="Search by name or email"]', "")
        page.click('button:has-text("Editor")')
        page.wait_for_timeout(400)
        table = page.inner_text("tbody")
        check(
            "the role filter shows only editors",
            "editor@thedocument.test" in table and "sam@thedocument.test" not in table,
            table.replace("\n", " | ")[:160],
        )
        page.click('button:has-text("Everyone")')
        shot(page, "29-people-search.png")

        row = page.locator(f'tr:has-text("{NEW_EMAIL}")')
        row.locator('button:has-text("flag as verified")').click()
        expect(row.locator('button:has-text("Verified")')).to_be_visible(timeout=20000)
        check("the owner can flag a contributor as Verified", True)

        # the owner can hand out any role
        page.select_option(f'tr:has-text("{NEW_EMAIL}") select', "EDITOR")
        page.wait_for_timeout(800)
        roster = page.request.get(f"{BASE}/api/admin/users").json()["users"]
        made_editor = next(u for u in roster if u["email"] == NEW_EMAIL)
        check("the owner can promote someone to editor", made_editor["role"] == "EDITOR")

        # settings live on their own screen now, and only the owner gets there
        page.goto(f"{BASE}/admin", wait_until="networkidle")
        check("the owner reaches Settings", "/admin" in page.url)
        page.fill('input[inputmode="decimal"] >> nth=0', "45.00")
        page.click('button:has-text("Save settings")')
        page.wait_for_selector("text=Saved", timeout=20000)
        check("payment settings save", "Saved" in page.content())
        shot(page, "11-admin.png")

        # site settings: wording and advertising, no developer needed
        page.fill('#site-settings input[name="siteNameEn"]', "The Document Daily")
        page.check('#site-settings input[name="adsEnabled"]')
        page.fill('#site-settings textarea[name="adHomeHtml"]', '<div id="ad-home-test">HOUSE AD</div>')
        page.click('button:has-text("Save site settings")')
        page.wait_for_selector("text=Refresh the public site", timeout=20000)
        check("site settings save", "Refresh the public site" in page.content())

        page.goto(f"{BASE}/en", wait_until="networkidle")
        check("the new site name reaches the public pages", "The Document Daily" in page.content())
        check("the advertising slot renders what was pasted", "HOUSE AD" in page.content())
        shot(page, "26-ads-and-name.png")

        # put the name back so the screenshots after this look like the real site
        page.goto(f"{BASE}/admin", wait_until="networkidle")
        page.fill('#site-settings input[name="siteNameEn"]', "The Document")
        page.click('button:has-text("Save site settings")')
        page.wait_for_selector("text=Refresh the public site", timeout=20000)

        # payment details: the owner can see them, an editor never can
        page.goto(f"{BASE}/people", wait_until="networkidle")
        row = page.locator(f'tr:has-text("{NEW_EMAIL}")')
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

        # --- 9b. an editor's limits ------------------------------------------
        editor_only = ctx.browser.new_context(http_credentials=GATE)
        ep2 = editor_only.new_page()
        sign_in(ep2, "editor@thedocument.test", "demo1234")

        ep2.goto(f"{BASE}/people", wait_until="networkidle")
        check("an editor can open the people list", "People" in ep2.content())
        check(
            "an editor sees no Settings link in the navigation",
            ep2.locator('nav a:has-text("Settings")').count() == 0,
        )

        r = ep2.request.patch(f"{BASE}/api/admin/site", data={"siteNameEn": "Hijacked"})
        check("an editor cannot change the site design", r.status == 403, f"got {r.status}")
        r = ep2.request.patch(f"{BASE}/api/admin/settings", data={"defaultPayout": 1})
        check("an editor cannot change payment settings", r.status == 403, f"got {r.status}")
        ep2.goto(f"{BASE}/admin", wait_until="networkidle")
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

        # --- 11. mobile ------------------------------------------------------
        mob = ctx.browser.new_context(viewport=PHONE, device_scale_factor=2, http_credentials=GATE)
        mp = mob.new_page()
        mp.goto(BASE, wait_until="networkidle")
        overflow = mp.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        check("no sideways scroll on a 390px phone", not overflow)
        mp.screenshot(path=os.path.join(SHOTS, "12-home-mobile.png"))
        mp.goto(f"{BASE}/article/the-night-bus-that-never-came-bn", wait_until="networkidle")
        mp.screenshot(path=os.path.join(SHOTS, "13-article-mobile.png"))
        mp.goto(f"{BASE}/login", wait_until="networkidle")
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
            len(rejected) == 3,
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
