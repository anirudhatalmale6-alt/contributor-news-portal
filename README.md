# The Document - contributor news portal (working prototype)

A fast, mobile-first news site with a full writing and moderation workflow behind it.

- Two languages. **Bangla is the default site at `/`**, English at `/en`, with an obvious switch button in the header.
- Public pages are server-rendered and cached, with no third-party requests at all.
- Contributors draft, attach images or video, save, come back, and submit.
- Every submission - verified or not - sits in an editorial queue until an editor approves it.
- On approval the editor sets an estimated payout; the writer sees it, and their running total, immediately.
- Contributors keep their own payment details (bKash, Nagad, Rocket, bank, PayPal, Wise); only they and an Admin can read them.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma · PostgreSQL · Auth.js (credentials + Google/Facebook).

---

## Run it

```bash
npm install
cp .env.example .env          # point DATABASE_URL at your Postgres
npx prisma migrate deploy     # create the schema
npm run db:seed               # demo users + articles in every workflow state
npm run dev                   # http://localhost:3300
```

Running it for real rather than as a demo:

```bash
npm run admin:create -- "you@example.com" "Your Name" "a-good-password"
npm run demo:clear -- --yes   # removes the seeded @thedocument.test accounts and their articles
```

Demo logins (password `demo1234` for all of them):

| Email | Role |
| --- | --- |
| admin@thedocument.test | Admin |
| editor@thedocument.test | Editor |
| maya@thedocument.test | Contributor (Verified) |
| sam@thedocument.test | Contributor (General) |
| leo@thedocument.test | Contributor (General) |

## Social login

Google and Facebook are wired through the same auth layer and register themselves only when
their keys are present, so a fresh clone boots without them. Step-by-step console walkthrough:
[SETUP-OAUTH.md](SETUP-OAUTH.md).

```
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_FACEBOOK_ID=...
AUTH_FACEBOOK_SECRET=...
```

Callback URL to register with the provider: `https://your-domain/api/auth/callback/google`
(and `.../facebook`). `AUTH_URL` must be set to the public origin in production - it is what the
callback URL is built from. Both providers run with PKCE, `state` and (for Google) `nonce`.
Someone who signed up by email and later uses Google keeps the same account. Adding Apple, X,
LinkedIn or GitHub later is a three-line block in `src/auth.ts`.

## Two languages

| | Bangla (default) | English |
| --- | --- | --- |
| Front page | `/` | `/en` |
| Article | `/article/<slug>` | `/en/article/<slug>` |

The old `/bn` addresses 301 to the new roots, so anything already shared keeps working.
The language switch is a bordered button with a globe, not a small text link - most readers land
on the Bangla site and should not have to hunt for English.

A contributor chooses the language they are writing in, and may write the second version
themselves - the composer has an "Also submit in ..." panel, and filling it in sends the piece to
both sections at once. If they leave it, the editor writes it on the review screen, side by side
with the original. Either way the piece cannot be published until both versions exist (Admin can
switch the requirement off under payment settings), and the editor can rewrite either version. Both versions share one article
record, so they share media, payout, author and audit trail - and the language switch on an
article links straight to its counterpart, with `hreflang` set for search engines.

Bangla pages are typeset in Noto Sans / Noto Serif Bengali, both self-hosted in `public/fonts`
as single variable files. A Bengali face has to ship with the site: most desktops do not have one
and the text would otherwise render as empty boxes. Dates and numbers are localised too
(৫ অক্টোবর ২০২৬, ৩ মিনিটের পড়া).

## Payment details

Each contributor fills in their own payout destination at `/dashboard/payout`:

- bKash / Nagad / Rocket - 11-digit wallet number, validated
- Bank transfer - bank, branch, account number, routing number
- PayPal / Wise - email

Who can see what: the contributor sees their own in full, an **Admin** can reveal any of them (they
are the one sending money, and the reveal is an explicit click, not a wall of account numbers on
screen), and an **Editor** has no route to them at all - `/api/admin/users/:id/payout` answers 403.
Lists show the method plus the last four digits only.

## Roles

| | Admin | Editor | Contributor |
| --- | --- | --- | --- |
| Write / edit own drafts | yes | yes | yes |
| Editorial queue, edit anyone's copy | yes | yes | no |
| Approve / reject, set payout | yes | yes | no |
| Write the translation | yes | yes | no |
| Change roles, flag Verified | yes | no | no |
| See a contributor's payment details | yes | no | own only |
| Payment settings | yes | read-only | no |

Contributors carry a tier - `GENERAL` or `VERIFIED`. The tier changes the byline badge and the
payout the editor is offered by default; it never skips review.

## Article lifecycle

```
DRAFT ──submit──> SUBMITTED ──approve──> APPROVED (public, payout set)
  ^                   │
  └──edit─── REJECTED ─┘  (editor's note goes back to the writer)
```

A SUBMITTED piece is locked to the author while it is in the queue. A REJECTED one reopens as a
draft the moment the writer touches it, and resubmitting records a `RESUBMITTED` entry in the
audit trail. Every state change is written to the `Review` table with who did it and why.

## Media

Uploads are served by `/media/:name`, never from `public/` - files written into `public/` after a
build are invisible to `next start` and vanish entirely on a serverless host. Two storage drivers,
picked with `STORAGE_DRIVER`:

- `disk` (default) - a directory, `UPLOAD_DIR`, default `./storage/uploads`. Right for a VPS.
- `db` - bytes in Postgres (`MediaBlob`). Right for Vercel / Netlify, which have no writable disk.

The whole app addresses media as `/media/<name>` either way, and the full test suite passes
against both drivers. Moving to S3 / R2 / Cloudinary later means rewriting `src/lib/storage.ts`
alone.

Limits: images 8 MB (jpeg, png, webp, gif, avif), video 128 MB (mp4, webm, mov). The first image
attached becomes the cover shot.

## Performance notes

- No webfonts, no analytics, no third-party scripts - the public pages make zero external requests.
- Article pages and the feed are cached and revalidated every 60s (`export const revalidate = 60`).
- `/api/articles` sends `s-maxage=60, stale-while-revalidate=300` so a CDN can serve it.
- Media is served `immutable` because filenames are UUIDs.
- Money is stored in integer cents, never a float.

## Tests

`e2e_flow.py` (repo root, Playwright) walks the entire workflow against a running build and
asserts 63 things: signup, draft, upload, save-survives-reload, payment details with a rejected
bad wallet number, submit, queue, editor edit, the publish-blocked-without-translation rule, the
Bangla version going live, the language switch, Bengali font resolution, approve with payout,
earnings total, role guards, admin payout reveal, API 401/403s, mobile layout, and a
zero-JS-error check. Screenshots land in `shots/`.

```bash
npm run build && npm run start      # terminal 1
python3 e2e_flow.py                 # terminal 2
```

`verify_social_login.py` proves the Google and Facebook wiring without needing a real provider
app: it boots a second copy of the build with placeholder keys and asserts that each button hands
off to the right provider with the right `client_id`, the right `/api/auth/callback/...` URL and
PKCE + state + nonce. The outbound request is intercepted, so nothing leaves the machine. 11
checks.

## Deploying

See [DEPLOY.md](DEPLOY.md) - Vercel + Neon in about ten minutes with no server to manage, or
`deploy/setup-vps.sh` which turns a bare Ubuntu box into Node + Postgres + nginx + HTTPS in one
command. It also contains a click-by-click test walkthrough for a non-developer.

## API

See [API.md](API.md) - every endpoint with its method, auth requirement, body and responses.

## Branding

The masthead supplied by the client lives in `public/brand/` (full lockup and the D mark), and
`src/app/icon.png` is the browser tab icon cut from it. The palette in `src/app/globals.css` is
sampled off the artwork: navy `#062a52`, red `#b4050e`.

## Layout

```
prisma/schema.prisma      data model
prisma/seed.ts            demo data
src/auth.ts               Auth.js config (credentials + social)
src/lib/rbac.ts           requireUser / requireRole, HTTP error mapping
src/lib/storage.ts        where uploaded bytes go (swap this for S3)
src/app/api/...           REST API
src/app/(public)          feed + article pages
src/app/dashboard         contributor desk + composer
src/app/editorial         queue + review screen
src/app/admin             users, roles, payment settings
```
