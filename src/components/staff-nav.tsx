import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isOwner, isStaff, type SessionUser } from "@/lib/rbac";

/**
 * One bar across every working screen, so nobody has to guess where the queue,
 * the people list or their own drafts live. What it shows follows the role:
 * contributors see only their desk, editors get the newsroom and people, and
 * the owner also gets settings.
 */
export async function StaffNav({
  user,
  current,
}: {
  user: SessionUser;
  current: "desk" | "newsroom" | "people" | "settings";
}) {
  const staff = isStaff(user.role);
  const waiting = staff ? await prisma.article.count({ where: { status: "SUBMITTED" } }) : 0;

  const items: { key: typeof current; href: string; label: string; badge?: number }[] = [
    { key: "desk", href: "/dashboard", label: "My writing desk" },
    ...(staff
      ? [
          { key: "newsroom" as const, href: "/editorial", label: "Newsroom", badge: waiting },
          { key: "people" as const, href: "/people", label: "People" },
        ]
      : []),
    ...(isOwner(user.role) ? [{ key: "settings" as const, href: "/admin", label: "Settings" }] : []),
  ];

  return (
    <nav className="-mx-1 mb-4 flex flex-wrap items-center gap-1 border-b border-line pb-3 pt-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            item.key === current
              ? "bg-navy text-white"
              : "text-ink-soft hover:bg-paper-soft hover:text-ink"
          }`}
        >
          {item.label}
          {item.badge ? (
            <span
              className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                item.key === current ? "bg-white text-navy" : "bg-brand text-white"
              }`}
            >
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}

      <span className="ml-auto text-xs text-ink-soft">
        {user.name} ·{" "}
        {user.role === "SUPERADMIN"
          ? "Owner"
          : user.role === "ADMIN"
            ? "Admin"
            : user.role === "EDITOR"
              ? "Editor"
              : "Contributor"}
      </span>
    </nav>
  );
}
