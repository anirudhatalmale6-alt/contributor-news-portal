# Turning on Google and Facebook sign-in

The code is already there. Both providers register themselves the moment their keys exist in
`.env`, so this is a copy-paste job, not a development task. Nothing else changes - a reader who
signs in with Google lands in the same contributor account system as everyone else, starting as a
General Contributor.

Replace `https://your-domain.com` below with the real site address. On your own machine that is
`http://localhost:3300`.

---

## Google (about 5 minutes)

1. Go to https://console.cloud.google.com/ and create a project (any name).
2. Left menu: **APIs & Services → OAuth consent screen**.
   - User type: **External**, then Create.
   - App name: The Document. Support email: yours. Developer contact: yours. Save.
   - While the app is in *Testing* only the emails you list as test users can sign in. Press
     **Publish app** when you want it open to everyone.
3. Left menu: **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Authorised JavaScript origins: `https://your-domain.com`
   - Authorised redirect URIs: `https://your-domain.com/api/auth/callback/google`
   - Create. Copy the **Client ID** and **Client secret**.
4. Put them in `.env`:

```
AUTH_GOOGLE_ID="...apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="..."
```

5. Restart the app. The "Continue with Google" button appears on the sign-in and signup pages.

## Facebook (about 10 minutes)

1. Go to https://developers.facebook.com/apps/ and **Create app**.
   - Use case: **Authenticate and request data from users with Facebook Login**.
   - App type: Consumer / Business, whichever it offers you. Give it a name and a contact email.
2. In the app, add the product **Facebook Login → Settings**:
   - Valid OAuth Redirect URIs: `https://your-domain.com/api/auth/callback/facebook`
   - Client OAuth login: on. Web OAuth login: on. Save changes.
3. **Settings → Basic**: copy the **App ID** and **App secret**. Add a Privacy Policy URL here -
   Facebook will not let you leave Development mode without one.
4. Put them in `.env`:

```
AUTH_FACEBOOK_ID="..."
AUTH_FACEBOOK_SECRET="..."
```

5. Restart the app. While the Facebook app is in **Development** mode only accounts listed under
   Roles (admins, developers, testers) can sign in. Switch the toggle at the top to **Live** when
   you are ready, which requires the privacy policy URL and a completed business verification for
   some account types.

---

## Notes

- `AUTH_URL` in `.env` must match the public address of the site, otherwise the provider refuses
  the callback. Set `AUTH_URL="https://your-domain.com"` in production.
- `AUTH_SECRET` must be a long random string in production: `openssl rand -base64 32`.
- The callback path is always `/api/auth/callback/<provider>` - that is the URL the provider asks
  for, and the only one it will redirect to.
- If someone signs up with email + password and later uses Google with the same address, the two
  are linked to one account rather than creating a duplicate.
- Adding another provider later (Apple, X, LinkedIn, GitHub) is a three-line block in
  `src/auth.ts` plus its two keys.
