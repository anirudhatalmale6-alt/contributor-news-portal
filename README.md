# The Dispatch - contributor news portal (working prototype)

A fast, mobile-first news site with a full writing and moderation workflow behind it.

- Public pages are server-rendered and cached, with no webfonts and no third-party requests.
- Contributors draft, attach images or video, save, come back, and submit.
- Every submission - verified or not - sits in an editorial queue until an editor approves it.
- On approval the editor sets an estimated payout; the writer sees it, and their running total, immediately.

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

Demo logins (password `demo1234` for all of them):

| Email | Role |
| --- | --- |
| admin@dispatch.test | Admin |
| editor@dispatch.test | Editor |
| maya@dispatch.test | Contributor (Verified) |
| sam@dispatch.test | Contributor (General) |
| leo@dispatch.test | Contributor (General) |

## Social login

Google and Facebook are wired through the same auth layer and register themselves only when
their keys are present, so a fresh clone boots without them:

```
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_FACEBOOK_ID=...
AUTH_FACEBOOK_SECRET=...
```

Callback URL to register with the provider: `https://your-domain/api/auth/callback/google`.
Adding a provider is three lines in `src/auth.ts` - Apple, X, LinkedIn and GitHub all follow the
same shape.

## Roles

| | Admin | Editor | Contributor |
| --- | --- | --- | --- |
| Write / edit own drafts | yes | yes | yes |
| Editorial queue, edit anyone's copy | yes | yes | no |
| Approve / reject, set payout | yes | yes | no |
| Change roles, flag Verified | yes | no | no |
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

Uploads are written to `UPLOAD_DIR` (default `./storage/uploads`) and served by `/media/:name`,
never from `public/`. Two reasons: files written into `public/` after a build are invisible to
`next start`, and they vanish entirely on a serverless host. Swapping to S3 / R2 / Cloudinary
means rewriting `src/lib/storage.ts` alone - nothing else in the app knows where bytes live.

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
asserts 34 things: signup, draft, upload, save-survives-reload, submit, queue, editor edit,
approve with payout, earnings total, role guards, API 401s, mobile layout, and a zero-JS-error
check. Screenshots land in `shots/`.

```bash
npm run build && npm run start      # terminal 1
python3 e2e_flow.py                 # terminal 2
```

## API

See [API.md](API.md) - every endpoint with its method, auth requirement, body and responses.

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
