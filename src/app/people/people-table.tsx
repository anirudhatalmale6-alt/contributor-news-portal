"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  providers: string[];
  hasPayout: boolean;
  payoutMethod: string | null;
  payoutMasked: string;
  articles: number;
  earnedCents: number;
};

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

export function PeopleTable({
  users,
  currency,
  meId,
  myRole,
}: {
  users: Row[];
  currency: string;
  meId: string;
  myRole: string;
}) {
  const router = useRouter();
  const isOwner = myRole === "SUPERADMIN";
  const [rows, setRows] = useState(users);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Record<string, string | null>>>({});

  // Full account numbers only when the owner asks for them, one person at a
  // time, so a shared screen never shows everyone's bank details at once.
  async function reveal(id: string) {
    if (details[id]) {
      setDetails(({ [id]: _drop, ...rest }) => rest);
      return;
    }
    const res = await fetch(`/api/admin/users/${id}/payout`);
    if (!res.ok) {
      setError("Could not load those payment details.");
      return;
    }
    const { payout } = await res.json();
    setDetails((d) => ({ ...d, [id]: payout ?? {} }));
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesText =
        !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
      return matchesRole && matchesText;
    });
  }, [rows, query, roleFilter]);

  async function patch(id: string, body: { role?: string; tier?: string }) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Could not update that person.");
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, role: data.user.role, tier: data.user.tier } : r)));
    router.refresh();
  }

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Search people</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-full border border-line py-2.5 pl-10 pr-3 text-sm outline-none focus:border-navy"
          />
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-2.5 size-4 fill-none stroke-ink-soft stroke-2"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
        </label>

        <div className="flex flex-wrap gap-1">
          {["ALL", "CONTRIBUTOR", "EDITOR", "ADMIN", "SUPERADMIN"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                roleFilter === r
                  ? "border-navy bg-navy text-white"
                  : "border-line text-ink-soft hover:text-ink"
              }`}
            >
              {r === "ALL" ? "Everyone" : ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        {visible.length} of {rows.length} shown
        {error ? <span className="ml-2 text-rose-700">{error}</span> : null}
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Contributor tier</th>
              {isOwner ? <th className="px-4 py-2.5 font-medium">Payment details</th> : null}
              <th className="px-4 py-2.5 text-right font-medium">Articles</th>
              <th className="px-4 py-2.5 text-right font-medium">Earned</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 6 : 5} className="px-4 py-8 text-center text-sm text-ink-soft">
                  Nobody matches that search.
                </td>
              </tr>
            ) : null}

            {visible.map((u) => {
              const options = allowedRoles(myRole, u.role);
              const canEdit = u.id !== meId && options.length > 0;
              return (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {u.name}
                      {u.id === meId ? " (you)" : ""}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {u.email}
                      {u.providers.length ? ` · via ${u.providers.join(", ")}` : ""}
                      {!isOwner && u.hasPayout ? " · payment details on file" : ""}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    {canEdit ? (
                      <select
                        value={u.role}
                        disabled={busy === u.id}
                        onChange={(e) => void patch(u.id, { role: e.target.value })}
                        className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-navy"
                      >
                        {[...new Set([u.role, ...options])].map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r] ?? r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full border border-line bg-paper-soft px-2.5 py-1 text-xs font-medium text-ink-soft">
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {u.role === "CONTRIBUTOR" ? (
                      <button
                        type="button"
                        disabled={busy === u.id}
                        onClick={() =>
                          void patch(u.id, { tier: u.tier === "VERIFIED" ? "GENERAL" : "VERIFIED" })
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          u.tier === "VERIFIED"
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-line text-ink-soft hover:text-ink"
                        }`}
                      >
                        {u.tier === "VERIFIED" ? "Verified · click to unflag" : "General · flag as verified"}
                      </button>
                    ) : (
                      <span className="text-xs text-ink-soft">n/a</span>
                    )}
                  </td>

                  {isOwner ? (
                    <td className="px-4 py-3">
                      {u.payoutMethod ? (
                        <div className="grid gap-1">
                          <button
                            type="button"
                            onClick={() => void reveal(u.id)}
                            className="justify-self-start rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-paper-soft"
                          >
                            {u.payoutMethod} {u.payoutMasked}
                          </button>
                          {details[u.id] ? (
                            <dl className="rounded-lg border border-line bg-paper-soft p-2 text-xs">
                              {Object.entries(details[u.id])
                                .filter(
                                  ([k, v]) =>
                                    v && !["id", "userId", "createdAt", "updatedAt"].includes(k),
                                )
                                .map(([k, v]) => (
                                  <div key={k} className="flex gap-2">
                                    <dt className="text-ink-soft">{k}</dt>
                                    <dd className="font-medium">{String(v)}</dd>
                                  </div>
                                ))}
                            </dl>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-soft">not provided</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-right tabular-nums">{u.articles}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(u.earnedCents, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
