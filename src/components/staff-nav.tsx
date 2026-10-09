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
export async function StaffNav({
  user,
  current,
}: {
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
      ? [{ key: "payouts" as const, href: "/payouts", label: text("nav.payouts", locale), badge: payouts }]
      : []),
    ...(isOwner(user.role)
      ? [
          { key: "settings" as const, href: "/admin", label: text("nav.settings", locale) },
          { key: "wording" as const, href: "/admin/wording", label: text("nav.wording", locale) },
        ]
      : []),
  ];

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
