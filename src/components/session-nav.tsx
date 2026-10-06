"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type SessionUser = { role?: string; name?: string | null };

/**
 * The only part of the header that depends on who is signed in.
 *
 * It lives in the browser on purpose: if the server header read the session
 * cookie, every public page would have to be rendered per request and could not
 * be cached at all. This way the article and feed HTML is the same for every
 * reader - fast, cacheable - and the two personal links fill in a moment later.
 */
export function SessionNav({
  labels,
}: {
  labels: {
    signIn: string;
    writeForUs: string;
    myDesk: string;
    newsroom: string;
    account: string;
    signOut: string;
  };
}) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive) setUser(data?.user ?? null);
      })
      .catch(() => {
        if (alive) setUser(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Reserve the space so the header does not jump when the answer arrives.
  if (user === undefined) {
    return <span aria-hidden className="inline-block h-8 w-24" />;
  }

  if (!user) {
    return (
      <>
        <Link
          href="/login"
          className="hidden px-2 py-1.5 text-sm text-ink-soft hover:text-ink sm:inline"
        >
          {labels.signIn}
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          {labels.writeForUs}
        </Link>
      </>
    );
  }

  const staff = user.role === "ADMIN" || user.role === "EDITOR";

  return (
    <>
      <Link
        href={staff ? "/editorial" : "/dashboard"}
        className="rounded-full bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-dark"
      >
        {staff ? labels.newsroom : labels.myDesk}
      </Link>
      <Link
        href="/dashboard/account"
        className="hidden px-2 py-1.5 text-sm text-ink-soft hover:text-ink sm:inline"
      >
        {labels.account}
      </Link>
      <button
        type="button"
        onClick={() => signOut({ redirectTo: "/" })}
        className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
      >
        {labels.signOut}
      </button>
    </>
  );
}
