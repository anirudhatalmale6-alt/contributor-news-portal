# API

JSON in, JSON out. Auth is a session cookie issued by Auth.js; every protected route answers
`401` with no session and `403` when the role is wrong. Validation failures return `422` with a
per-field `issues` object. Money is always integer **cents**.

Base URL in development: `http://localhost:3300`

---

## Auth

### `POST /api/register`
Public. Email + password signup. New accounts are `CONTRIBUTOR` / `GENERAL`.

```json
{ "name": "Rosa Delgado", "email": "rosa@example.com", "password": "at-least-8-chars" }
```

`201` → `{ "user": { "id", "name", "email", "role", "tier" } }`
`409` → that email already has an account.

### `POST /api/auth/callback/credentials`
Handled by Auth.js. The UI calls `signIn("credentials", { email, password })`.

### `GET /api/auth/signin/:provider`
Google / Facebook. A first social login creates the local contributor record and links the
provider account (`OAuthAccount`).

### `POST /api/auth/signout`
Ends the session.

---

## Drafts (contributor, own work only)

### `GET /api/drafts`
Every article belonging to the signed-in user, newest edit first, with media and the latest
review note.

### `POST /api/drafts`
Create a draft. All fields optional.

```json
{ "title": "Untitled draft", "dek": "", "body": "", "category": "General", "coverImage": null, "language": "EN" }
```

`language` is `EN` or `BN` - what the contributor is writing in. The editor supplies the other one.

`201` → `{ "article": { ... } }`

### `GET /api/drafts/:id`
The draft plus its media and full review history. `403` if it is not yours.

### `PATCH /api/drafts/:id`
Save (the composer autosaves two seconds after typing stops). Any subset of
`title`, `dek`, `body`, `category`, `coverImage`, `language`.

- A `SUBMITTED` article returns `409` - it is locked while the editors have it.
- An `APPROVED` article returns `409` - published copy is edited by an editor.
- A `REJECTED` article flips back to `DRAFT` on the first save.
- Changing the title re-slugs the article, keeping slugs unique.

### `DELETE /api/drafts/:id`
Deletes an unpublished piece. `409` once it is published.

### `POST /api/drafts/:id/submit`
Sends it to the editorial queue. Requires a title and at least 50 characters of body (`422`).
Records `SUBMITTED` or, for a piece that had been sent back, `RESUBMITTED`.

---

## Media

### `POST /api/uploads` (multipart/form-data)
Fields: `file`, `articleId`, optional `caption`.
Images ≤ 8 MB (`image/jpeg|png|webp|gif|avif`), video ≤ 128 MB (`video/mp4|webm|quicktime`).
`415` on an unsupported type, `413` when oversized.
The first image attached is promoted to the article's cover.

`201` → `{ "media": { "id", "kind", "url", "caption" } }`

### `DELETE /api/uploads/:mediaId`
Author or staff. If the removed file was the cover, the next image takes its place.

### `GET /media/:name`
Public, serves the stored bytes with an ETag and `cache-control: immutable`.

---

## Editorial (EDITOR, ADMIN)

### `GET /api/editorial/queue?status=SUBMITTED`
`status` accepts `SUBMITTED` (default), `APPROVED`, `REJECTED`, `DRAFT` or `ALL`.
Oldest submission first - the queue is worked front to back.

### `GET /api/editorial/:id`
Full article, author, media and the complete audit trail.

### `PATCH /api/editorial/:id`
Editor's copy fixes: `title`, `dek`, `body`, `category`, `coverImage`. Works in any state and
stamps the editor as reviewer.

### `POST /api/editorial/:id/decision`

```json
{ "decision": "APPROVE", "payoutCents": 13250, "note": "Tightened the intro." }
```

- `APPROVE` requires `payoutCents` (`422` without it), publishes the article and stamps
  `publishedAt`.
- `REJECT` requires `note` (`422` without it) so the writer knows what to fix.
- `409` if the piece was never submitted.

Both write a `Review` row with from/to status, the editor and the note.

### `PATCH /api/editorial/:id/payout`
Revise the figure after publication: `{ "payoutCents": 15000 }`. Logged as `PAYOUT_UPDATED`;
the contributor's dashboard reflects it on their next page load.

---

## Translations (EDITOR, ADMIN)

### `GET /api/editorial/:id/translation`
The original plus every translation of the piece, with who wrote each one.

### `PUT /api/editorial/:id/translation`

```json
{ "locale": "BN", "title": "...", "dek": "...", "body": "..." }
```

Upserts - saving twice updates the same row (`@@unique([articleId, locale])`). `409` if the locale
is the language the piece was written in. Slug: the ASCII slug of the translated title, or the
original slug with a `-bn` / `-en` suffix when the title has no ASCII to work with. Logged as
`TRANSLATION_SAVED` in the audit trail.

### `DELETE /api/editorial/:id/translation?locale=BN`

### Effect on publishing
While `requireTranslation` is on (Admin setting, default on), `POST /api/editorial/:id/decision`
with `APPROVE` returns `422` until the other language exists.

---

## Payment details

### `GET /api/profile/payout` · `PUT /api/profile/payout` · `DELETE /api/profile/payout`
The signed-in contributor's own payout destination.

```json
{
  "method": "BKASH",
  "accountName": "Rosa Delgado",
  "walletNumber": "01819445203",
  "country": "Bangladesh"
}
```

Required fields depend on the method: `walletNumber` for BKASH / NAGAD / ROCKET (11 digits,
`01XXXXXXXXX`), `bankName` + `accountNumber` for BANK, `email` for PAYPAL / WISE. `422` lists the
offending fields in `issues`.

### `GET /api/admin/users/:id/payout`
**ADMIN only** - full details, for the person actually sending the money. An Editor gets `403`.
The admin user list carries the method and the last four digits only until the admin clicks to
reveal.

---

## Earnings (contributor)

### `GET /api/earnings`

```json
{
  "currency": "USD",
  "totalCents": 30000,
  "publishedCount": 3,
  "pendingReview": 1,
  "awaitingPayout": 1,
  "articles": [{ "id", "title", "slug", "payoutCents", "publishedAt" }]
}
```

---

## Admin (ADMIN)

### `GET /api/admin/users`
All accounts with role, tier, linked social providers, article count and lifetime payout.

### `PATCH /api/admin/users/:id`

```json
{ "role": "EDITOR", "tier": "VERIFIED" }
```

Either field alone is fine. An admin cannot remove their own Admin role (`409`).

### `GET /api/admin/settings` (ADMIN, EDITOR)
### `PATCH /api/admin/settings` (ADMIN)

```json
{ "currency": "USD", "defaultPayout": 2500, "verifiedBonusPct": 20, "payoutNote": "...", "requireTranslation": true }
```

`defaultPayout` pre-fills the editor's payout box; `verifiedBonusPct` is added to that
suggestion for Verified contributors. Neither changes a payout already assigned.
`requireTranslation` is the publish gate described above.

---

## Public

### `GET /api/articles?category=&q=&page=&perPage=`
Approved articles only, newest first, `perPage` capped at 50.
Returns `{ page, perPage, total, articles: [{ id, slug, title, dek, category, coverImage,
publishedAt, readingMinutes, author: { name, tier, image } }] }`
with `cache-control: public, s-maxage=60, stale-while-revalidate=300`.

---

## Status codes

| Code | Meaning |
| --- | --- |
| 200 / 201 | OK |
| 401 | not signed in |
| 403 | signed in, wrong role or not your article |
| 404 | no such record |
| 409 | state conflict (locked, already published, self-demotion) |
| 413 / 415 | file too large / unsupported type |
| 422 | validation failed - see `issues` |
