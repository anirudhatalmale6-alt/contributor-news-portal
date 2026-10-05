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

export function SocialButtons({
  providers,
}: {
  providers: { id: string; name: string }[];
}) {
  const [busy, setBusy] = useState<string | null>(null);

  if (providers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-paper-soft p-3 text-xs text-ink-soft">
        Google / Facebook sign-in is wired through the same auth layer - it switches on as soon as
        your OAuth client ID and secret are in the environment file. Until then use email +
        password below.
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
          className="flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-paper-soft disabled:opacity-60"
        >
          {busy === p.id ? "Opening..." : (LABELS[p.id] ?? `Continue with ${p.name}`)}
        </button>
      ))}
    </div>
  );
}
