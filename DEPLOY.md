# Getting The Document online

Two ways. Pick one.

- **Option A - Vercel + Neon.** Free, no server to manage, about ten minutes, and you do it
  yourself with clicks. Best for seeing the site live today.
- **Option B - your own server.** Give me SSH access and I run one script; you get a normal
  Linux server with Postgres, nginx and HTTPS. Best for the long run.

A note on hosting first, because it saves a wasted purchase: **ordinary shared cPanel hosting
will not run this**. It serves PHP files; this is a Node application that needs a process running
all the time. If you want your own server, you need either a VPS (DigitalOcean, Hetzner, Vultr,
Contabo - roughly $5-7 a month, 2 GB RAM is plenty) or a cPanel plan that explicitly advertises
"Node.js app" support.

---

## Option A - Vercel + Neon (free, about ten minutes)

### 1. A database (Neon)

1. Go to https://neon.tech and sign up (GitHub login is quickest).
2. Create a project. Any name, any region - pick Singapore or Frankfurt for Bangladesh.
3. On the dashboard, copy the **connection string**. It looks like
   `postgresql://user:password@ep-something.aws.neon.tech/neondb?sslmode=require`.
   Keep that tab open.

### 2. The site (Vercel)

1. Go to https://vercel.com and sign up with GitHub.
2. **Add New → Project → Import** the repository
   `anirudhatalmale6-alt/contributor-news-portal`.
   (If it is not listed, press "Adjust GitHub App Permissions" and allow access to it.)
3. Before pressing Deploy, open **Environment Variables** and add:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the Neon connection string from step 1 |
| `AUTH_SECRET` | any long random string - Vercel's "Generate" button is fine |
| `STORAGE_DRIVER` | `db` |
| `AUTH_URL` | leave blank for now, you will fill it in step 4 |

4. Press **Deploy**. When it finishes Vercel shows you a URL like
   `contributor-news-portal.vercel.app`. Go back to **Settings → Environment Variables**, set
   `AUTH_URL` and `SITE_URL` to `https://that-url`, and press **Redeploy**.

### 3. Create the tables and the demo content

In Vercel, open your project → **Storage / Deployments** is not where this lives, so use the
simplest route instead: on your own machine, with the Neon connection string:

```bash
git clone https://github.com/anirudhatalmale6-alt/contributor-news-portal.git
cd contributor-news-portal
npm install
echo 'DATABASE_URL="<your neon string>"' > .env
npx prisma migrate deploy     # creates the tables
npx tsx prisma/seed.ts        # demo articles and logins, optional
```

If you would rather not run anything locally, send me the Neon connection string and I will run
those two commands for you - it takes a minute and touches nothing else.

### 4. Why `STORAGE_DRIVER=db`

Vercel gives the app no disk that survives a request, so photo and video uploads are stored in
Postgres instead. On a normal server leave it as `disk`. Nothing else changes - the same
`/media/<name>` URLs work either way.

---

## Option B - your own server (I do it)

Send me:

1. the server IP address,
2. an SSH user with sudo (root is fine) and either its password or my public key installed,
3. the domain you want it on, with an A record already pointing at that IP.

**No domain yet?** That is fine - a free wildcard DNS name works for the certificate, so you still
get HTTPS on day one. For a server at `203.0.113.7` the hostname is `203-0-113-7.sslip.io`
(verified: that name resolves straight back to the IP). Run the script with it, and switch to your
real domain later by re-running the script with the new name.

Then I run:

```bash
sudo bash deploy/setup-vps.sh thedocument.example.com you@example.com
```

That one script installs Node 22, PostgreSQL, nginx and a Let's Encrypt certificate, creates the
database with a generated password, builds the app, and runs it as a systemd service behind nginx
on HTTPS. It is safe to re-run for every future update.

Afterwards:

```bash
systemctl restart the-document      # restart
journalctl -u the-document -f       # logs
cd /srv/the-document && git pull && npm ci && npx prisma migrate deploy && npm run build && systemctl restart the-document   # update
```

---

## How to test it once it is live

Demo accounts (password `demo1234` for all of them) exist if you ran the seed:

| Email | Role |
| --- | --- |
| admin@thedocument.test | Admin |
| editor@thedocument.test | Editor |
| maya@thedocument.test | Verified contributor |
| sam@thedocument.test | General contributor |

A five-minute walk through everything:

1. **As a reader.** Open the site - the front page is Bangla. Press the **English** button top
   right, then open any article and press **বাংলায় পড়ুন** to come back.
2. **As a contributor.** Sign out, press **আমাদের জন্য লিখুন** (Write for us) and create an
   account, or sign in as `sam@thedocument.test`. Press **Start a new piece**, write something,
   attach a photo, press **Save draft**, reload the page to prove it was saved. Open
   **Also submit in বাংলা** and write the second version if you want to test that path. Press
   **Submit for review**.
3. **Payment details.** On the dashboard press **Add payment details**, choose bKash, type a
   wrong number like `12345` (it is refused), then a real one like `01819445203` and save. The
   dashboard then shows only the last four digits.
4. **As an editor.** Sign out, sign in as `editor@thedocument.test`, open **Newsroom**. The piece
   is in the queue. Fix the headline, write the Bangla version if the contributor did not, type a
   payout like `150`, press **Approve and publish**. Try approving before writing the translation
   to see it refuse.
5. **Back as the contributor.** Sign in as the writer again - the payout and the running total are
   on the dashboard, with the editor's note. The article is now on both the Bangla and English
   front pages.
6. **As an admin.** Sign in as `admin@thedocument.test` → **Admin**: change someone's role, flag a
   contributor as Verified, reveal a contributor's full payment details, change the currency or
   the default payout, or turn off "require a translation before publishing".

## Handing it over

Once it is up, two commands turn the demo into your site:

```bash
# your own Admin account (also works as a password reset)
npm run admin:create -- "you@example.com" "Your Name" "a-good-password"

# see what the demo data is, then remove it
npm run demo:clear
npm run demo:clear -- --yes
```

`demo:clear` only touches the seeded `@thedocument.test` accounts and what they wrote. Real
accounts, real articles and your settings are left alone, and it prints what it is about to do
before you confirm.

## Going live for real

Before you open it to the public:

- Create your Admin account and clear the demo content with the two commands above.
- Set `AUTH_SECRET` to a fresh random value, and `AUTH_URL` / `SITE_URL` to your real domain.
- Add your Google and Facebook keys - see [SETUP-OAUTH.md](SETUP-OAUTH.md).
- Point your own domain at it and add the TLS certificate (Option B does this for you).
