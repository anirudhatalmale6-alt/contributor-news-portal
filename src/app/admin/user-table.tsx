"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { methodLabel } from "@/lib/payout";

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  providers: string[];
  articles: number;
  earnedCents: number;
  payout: { method: string; masked: string } | null;
};

const ROLES = ["CONTRIBUTOR", "EDITOR", "ADMIN"];

export function UserTable({
  users,
  currency,
  meId,
}: {
  users: Row[];
  currency: string;
  meId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Record<string, string | null>>>({});

  // Full account numbers are fetched only when the admin asks for them, so a
  // shared screen does not leak everyone's bank details at once.
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

  async function patch(id: string, body: { role?: string; tier?: string }) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update that user.");
      return;
    }
    const { user } = await res.json();
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, role: user.role, tier: user.tier } : r)));
    router.refresh();
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          User management
        </h2>
        {error ? <span className="text-xs text-rose-700">{error}</span> : null}
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Contributor tier</th>
              <th className="px-4 py-2.5 font-medium">Payment details</th>
              <th className="px-4 py-2.5 text-right font-medium">Articles</th>
              <th className="px-4 py-2.5 text-right font-medium">Earned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {u.name}
                    {u.id === meId ? " (you)" : ""}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {u.email}
                    {u.providers.length ? ` · via ${u.providers.join(", ")}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={busy === u.id}
                    onChange={(e) => void patch(u.id, { role: e.target.value })}
                    className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-navy"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
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
                <td className="px-4 py-3">
                  {u.payout ? (
                    <div className="grid gap-1">
                      <button
                        type="button"
                        onClick={() => void reveal(u.id)}
                        className="justify-self-start rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-paper-soft"
                      >
                        {methodLabel(u.payout.method)} {u.payout.masked}
                      </button>
                      {details[u.id] ? (
                        <dl className="rounded-lg border border-line bg-paper-soft p-2 text-xs">
                          {Object.entries(details[u.id])
                            .filter(
                              ([k, v]) =>
                                v &&
                                !["id", "userId", "createdAt", "updatedAt"].includes(k),
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
                <td className="px-4 py-3 text-right tabular-nums">{u.articles}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {money(u.earnedCents, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
