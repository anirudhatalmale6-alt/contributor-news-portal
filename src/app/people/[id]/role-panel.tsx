"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  CONTRIBUTOR: "Contributor",
};

const RANK: Record<string, number> = { CONTRIBUTOR: 0, EDITOR: 1, ADMIN: 2, SUPERADMIN: 3 };

/** The same rule the server enforces, so the UI never offers a forbidden change. */
function allowedRoles(myRole: string, targetRole: string) {
  if (myRole === "SUPERADMIN") return ["CONTRIBUTOR", "EDITOR", "ADMIN", "SUPERADMIN"];
  const mine = RANK[myRole] ?? 0;
  if ((RANK[targetRole] ?? 0) >= mine) return [];
  return ["CONTRIBUTOR", "EDITOR", "ADMIN"].filter((r) => (RANK[r] ?? 0) <= mine);
}

/**
 * Role and contributor tier, with a Save button.
 *
 * The people list saves the instant the dropdown changes, which is quick but
 * gives no sign anything happened. Here the choice is staged and saved
 * deliberately, and the panel says what it did.
 */
export function RolePanel({
  userId,
  name,
  myRole,
  initialRole,
  initialTier,
}: {
  userId: string;
  name: string;
  myRole: string;
  initialRole: string;
  initialTier: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState({ role: initialRole, tier: initialTier });
  const [draft, setDraft] = useState({ role: initialRole, tier: initialTier });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const options = allowedRoles(myRole, saved.role);
  const dirty = draft.role !== saved.role || draft.tier !== saved.tier;

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(draft.role !== saved.role ? { role: draft.role } : {}),
        ...(draft.tier !== saved.tier ? { tier: draft.tier } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not save that change." });
      return;
    }
    setSaved({ role: data.user.role, tier: data.user.tier });
    setDraft({ role: data.user.role, tier: data.user.tier });
    setMessage({
      kind: "ok",
      text: `Saved. ${name} is now ${ROLE_LABEL[data.user.role] ?? data.user.role}${
        data.user.role === "CONTRIBUTOR"
          ? ` (${data.user.tier === "VERIFIED" ? "verified" : "general"})`
          : ""
      }. They have been notified.`,
    });
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-line p-5">
      <h2 className="font-serif text-lg font-bold">Role and access</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {options.length
          ? "Choose a role, then press Save. Nothing changes until you do."
          : "You are not senior enough to change this account."}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Role</span>
          <select
            name="role"
            value={draft.role}
            disabled={!options.length || busy}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy disabled:bg-paper-soft"
          >
            {[...new Set([saved.role, ...options])].map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r] ?? r}
              </option>
            ))}
          </select>
        </label>

        {draft.role === "CONTRIBUTOR" ? (
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Contributor tier</span>
            <select
              name="tier"
              value={draft.tier}
              disabled={!options.length || busy}
              onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy disabled:bg-paper-soft"
            >
              <option value="GENERAL">General</option>
              <option value="VERIFIED">Verified</option>
            </select>
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || busy || !options.length}
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
        >
          {/* The label never changes: a button that reads "Saved" before
              anything has been done is a small lie. */}
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>

      {message ? (
        <p className={`mt-3 text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
