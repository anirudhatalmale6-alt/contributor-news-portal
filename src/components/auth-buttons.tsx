"use client";

import { signIn, signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectTo: "/" })}
      className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
    >
      Sign out
    </button>
  );
}

const LABELS: Record<string, string> = {
  google: "Continue with Google",
  facebook: "Continue with Facebook",
};

/* Inline marks - no request leaves the page for an icon. */
function ProviderIcon({ id }: { id: string }) {
  if (id === "google") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden className="size-5">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.2z" />
        <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z" />
        <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.7 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="size-5">
        <path
          fill="#1877F2"
          d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.956.93-1.956 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
        />
      </svg>
    );
  }
  return null;
}

export function SocialButtons({
  providers,
}: {
  providers: { id: string; name: string }[];
}) {
  const [busy, setBusy] = useState<string | null>(null);

  if (providers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-paper-soft p-3 text-xs text-ink-soft">
        Google and Facebook sign-in are built and wired through the same auth layer. They appear
        here the moment your OAuth client ID and secret are in the environment file - see
        SETUP-OAUTH.md for the five-minute walkthrough. Until then, use email + password below.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setBusy(p.id);
            signIn(p.id, { redirectTo: "/dashboard" });
          }}
          className="flex items-center justify-center gap-2.5 rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-paper-soft disabled:opacity-60"
        >
          <ProviderIcon id={p.id} />
          {busy === p.id ? "Opening..." : (LABELS[p.id] ?? `Continue with ${p.name}`)}
        </button>
      ))}
    </div>
  );
}
