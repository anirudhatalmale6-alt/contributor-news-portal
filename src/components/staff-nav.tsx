import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin, isOwner, isStaff, type SessionUser } from "@/lib/rbac";
import { unreadCount } from "@/lib/inbox";
import { unreadNotifications } from "@/lib/notify";
import { deskLocale } from "@/lib/settings";
import { text } from "@/lib/ui-text";

/**
 * One bar across every working screen, so nobody has to guess where the queue,
 * the people list or their own drafts live. What it shows follows the role:
 * contributors see only their desk, editors get the newsroom and people, and
 * the owner also gets settings.
 */
/** A small line icon for each item in the vertical menu. */
const ICON: Record<string, string> = {
  desk: "M4 20h16M6 16l9.5-9.5a2.1 2.1 0 0 1 3 3L9 19H6v-3z",
  inbox: "M4 6h16v12H4zM4 7l8 6 8-6",
  newsroom: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
  published: "M5 12l4 4 10-10",
  frontpage: "M4 5h16v14H4zM4 10h16M10 10v9",
  people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c.8-3 3.2-5 6-5s5.2 2 6 5M17 11a2.5 2.5 0 1 0 0-5M18 14c1.6.6 2.7 2.2 3 5",
  payouts: "M3 7h18v10H3zM3 11h18M7 15h3",
  sections: "M4 6h16M4 12h16M4 18h10",
  pages: "M7 3h7l5 5v13H7zM14 3v5h5",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.6 4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  wording: "M4 7V5h16v2M9 19h6M12 5v14",
};

export async function StaffNav({
  user,
  current,
  vertical = false,
  hideWho = false,
}: {
  /** Leaves out the "name · role" at the end of the bar. */
  hideWho?: boolean;
  /** The desk sidebar's column of links, rather than the bar across the top. */
  vertical?: boolean;
  user: SessionUser;
  current:
    | "desk"
    | "newsroom"
    | "published"
    | "frontpage"
    | "inbox"
    | "people"
    | "settings"
    | "wording"
    | "pages"
    | "sections"
    | "payouts";
}) {
  const staff = isStaff(user.role);
  const locale = await deskLocale();
  const [waiting, unread, updates, payouts] = await Promise.all([
    staff ? prisma.article.count({ where: { status: "SUBMITTED" } }) : 0,
    unreadCount(user),
    unreadNotifications(user.id),
    // Money waiting on somebody is worth a number in the bar.
    isAdmin(user.role) ? prisma.payoutRequest.count({ where: { status: "PENDING" } }) : 0,
  ]);

  const items: { key: typeof current; href: string; label: string; badge?: number }[] = [
    { key: "desk", href: "/dashboard", label: text("nav.myWritingDesk", locale), badge: updates },
    { key: "inbox", href: "/inbox", label: text("nav.inbox", locale), badge: unread },
    ...(staff
      ? [
          { key: "newsroom" as const, href: "/editorial", label: text("nav.newsroomQueue", locale), badge: waiting },
          {
            key: "published" as const,
            href: "/editorial?status=APPROVED",
            label: text("nav.publishedList", locale),
          },
          { key: "frontpage" as const, href: "/editorial/front-page", label: text("nav.frontPage", locale) },
          { key: "people" as const, href: "/people", label: text("nav.people", locale) },
        ]
      : []),
    ...(isAdmin(user.role)
      ? [
          { key: "payouts" as const, href: "/payouts", label: text("nav.payouts", locale), badge: payouts },
          { key: "sections" as const, href: "/admin/sections", label: text("nav.sections", locale) },
          { key: "pages" as const, href: "/admin/pages", label: text("nav.pages", locale) },
        ]
      : []),
    ...(isOwner(user.role)
      ? [
          { key: "settings" as const, href: "/admin", label: text("nav.settings", locale) },
          { key: "wording" as const, href: "/admin/wording", label: text("nav.wording", locale) },
        ]
      : []),
  ];

  if (vertical) {
    return (
      <nav lang={locale === "BN" ? "bn" : undefined} aria-label="Desk" className="grid gap-0.5">
        {items.map((item) => {
          const on = item.key === current;
          return (
            <Link
              key={item.key}
              href={item.href}
              data-nav={item.key}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium ${
                on ? "bg-navy text-white" : "text-ink hover:bg-paper-soft"
              }`}
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0 fill-none stroke-current stroke-[1.8]">
                <path d={ICON[item.key] ?? ICON.desk} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    on ? "bg-white text-navy" : "bg-brand text-white"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      // Bangla labels need the Bangla face, including on the newsroom screens
      // that are otherwise set in the English stack.
      lang={locale === "BN" ? "bn" : undefined}
      className="-mx-1 mb-4 flex flex-wrap items-center gap-1 border-b border-line pb-3 pt-1"
    >
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

      <span className={`ml-auto text-xs text-ink-soft ${hideWho ? "hidden" : ""}`}>
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
