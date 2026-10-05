"""
Proves the Google and Facebook wiring without owning a Google or Facebook app.

Boots a second copy of the build with placeholder OAuth keys, then checks that
the buttons appear and that pressing them hands off to the provider with the
right client_id and the right callback URL. The outbound request to the
provider is intercepted and aborted, so nothing leaves the machine.

    python3 verify_social_login.py
"""

import os
import re
import signal
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 3301
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = os.path.join(HERE, "shots")
os.makedirs(SHOTS, exist_ok=True)

GOOGLE_ID = "demo-google-client-id.apps.googleusercontent.com"
FACEBOOK_ID = "demo-facebook-app-id"

results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))
    if not ok:
        raise AssertionError(name + " " + detail)


def start_server():
    env = dict(os.environ)
    env.update(
        {
            "AUTH_GOOGLE_ID": GOOGLE_ID,
            "AUTH_GOOGLE_SECRET": "demo-google-secret",
            "AUTH_FACEBOOK_ID": FACEBOOK_ID,
            "AUTH_FACEBOOK_SECRET": "demo-facebook-secret",
            "AUTH_URL": BASE,
            "NEXTAUTH_URL": BASE,
        }
    )
    log = open("/tmp/social-server.log", "w")
    proc = subprocess.Popen(
        ["npx", "next", "start", "-p", str(PORT)],
        cwd=HERE,
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )
    for _ in range(40):
        time.sleep(0.5)
        try:
            import urllib.request

            if urllib.request.urlopen(BASE, timeout=2).status == 200:
                return proc
        except Exception:
            continue
    raise RuntimeError("second server never came up - see /tmp/social-server.log")


def main():
    proc = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1280, "height": 720})
            page = ctx.new_page()

            # Nothing may actually leave for google.com / facebook.com: capture
            # the hand-off URL and abort the request.
            handoff = {}

            def intercept(route):
                url = route.request.url
                if "google.com" in url or "facebook.com" in url:
                    handoff.setdefault("url", url)
                    route.abort()
                else:
                    route.continue_()

            page.route("**/*", intercept)

            page.goto(f"{BASE}/login", wait_until="networkidle")
            html = page.content()
            check("Google button rendered once keys are present", "Continue with Google" in html)
            check("Facebook button rendered once keys are present", "Continue with Facebook" in html)
            page.screenshot(path=os.path.join(SHOTS, "15-social-login-buttons.png"))

            page.click('button:has-text("Continue with Google")')
            for _ in range(30):
                if handoff.get("url"):
                    break
                page.wait_for_timeout(200)
            url = handoff.get("url", "")
            check("Google button hands off to Google's consent screen", "accounts.google.com" in url, url[:120])
            check("the client_id sent is the one from the environment", GOOGLE_ID in url)
            check(
                "the callback URL is /api/auth/callback/google",
                re.search(r"redirect_uri=[^&]*%2Fapi%2Fauth%2Fcallback%2Fgoogle", url) is not None,
                url[:200],
            )
            check("PKCE challenge is sent", "code_challenge=" in url)
            check("state parameter is sent (CSRF protection)", "state=" in url)
            check("nonce is sent (replay protection)", "nonce=" in url)

            handoff.clear()
            page.goto(f"{BASE}/login", wait_until="networkidle")
            page.click('button:has-text("Continue with Facebook")')
            for _ in range(30):
                if handoff.get("url"):
                    break
                page.wait_for_timeout(200)
            url = handoff.get("url", "")
            check("Facebook button hands off to Facebook's dialog", "facebook.com" in url, url[:120])
            check("the Facebook app id sent is the one from the environment", FACEBOOK_ID in url)
            check(
                "the callback URL is /api/auth/callback/facebook",
                re.search(r"redirect_uri=[^&]*%2Fapi%2Fauth%2Fcallback%2Ffacebook", url) is not None,
                url[:200],
            )

            browser.close()
        print("\n%d/%d checks passed" % (sum(results), len(results)))
    finally:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print("\nFAILED: %s" % e)
        sys.exit(1)
