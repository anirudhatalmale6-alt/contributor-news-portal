import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { NewDraftButton } from "@/app/dashboard/new-draft-button";
import { deskLocale, siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { text } from "@/lib/ui-text";

type Current = Parameters<typeof StaffNav>[0]["current"];

const ROLE = { SUPERADMIN: "Owner", ADMIN: "Admin", EDITOR: "Editor", CONTRIBUTOR: "Contributor" } as const;

/**
 * Every working screen - the writer's desk, the newsroom, the inbox, the
 * owner's settings - sits inside this.
 *
 * He asked for the dashboard not to carry the newspaper's menu, and to work
 * like a Facebook profile: who you are at the top, one obvious button to
 * write, and the places you go down the side. So: the same masthead, no
 * section menu, a "Back to the newspaper" button instead, and a side column
 * with the person's card, the write button and the desk menu. On a phone the
 * side column folds into a row above the page.
 */
export async function DeskShell({
  user,
  current,
  width = "max-w-5xl",
  children,
}: {
  user: SessionUser;
  /** Which item in the side menu is lit. Left out on screens that are not in it. */
  current?: Current;
  /** How wide the page's own content may run. */
  width?: string;
  children: React.ReactNode;
}) {
  const locale = await deskLocale();
  const [site, me] = await Promise.all([
    siteSettings(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, publicName: true, image: true, tier: true, role: true },
    }),
  ]);
  const name = me?.publicName?.trim() || me?.name || user.name;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <SiteHeader desk locale={locale} />
      <div
        lang={locale === "BN" ? "bn" : undefined}
        style={
          locale === "BN"
            ? ({ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties)
            : undefined
        }
        className="mx-auto max-w-7xl px-4 pb-20 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8"
      >
        <aside data-desk-sidebar className="pt-4 lg:sticky lg:top-0 lg:max-h-screen lg:self-start lg:overflow-y-auto lg:pt-6">
          {/* Who is signed in, the way a profile page opens. */}
          {/* On a phone the strip at the very top already names them. */}
          <Link
            href="/dashboard/profile"
            className="hidden items-center gap-3 rounded-xl p-2 hover:bg-paper-soft lg:flex"
          >
            {me?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${me.image}?w=160`} alt="" className="size-11 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-navy font-serif text-lg font-bold text-white">
                {initial}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold">{name}</span>
              <span className="block truncate text-xs text-ink-soft">
                {ROLE[(me?.role ?? user.role) as keyof typeof ROLE]}
                {me?.tier === "VERIFIED" ? " · Verified" : ""}
              </span>
            </span>
          </Link>

          <div className="mt-1 lg:mt-3 [&>button]:w-full [&>button]:py-2.5">
            <NewDraftButton label={`+ ${text("nav.writeNew", locale)}`} busyLabel={text("desk.opening", locale)} />
          </div>

          {/* A phone gets the menu as a row it can scroll sideways; a desktop
              gets the column. */}
          <div className="mt-4 hidden lg:block">
            <StaffNav user={user} current={current ?? ("none" as Current)} vertical />
          </div>
          <div className="mt-3 lg:hidden">
            <StaffNav user={user} current={current ?? ("none" as Current)} hideWho />
          </div>

          {user.role === "CONTRIBUTOR" ? (
            <Link
              href={`/author/${user.id}`}
              className="mt-4 hidden px-3 text-sm font-medium text-navy hover:underline lg:block"
            >
              {text("nav.publicPage", locale)}
            </Link>
          ) : null}
        </aside>

        <main className={`w-full min-w-0 ${width} pt-2 lg:pt-6`}>{children}</main>
      </div>
    </>
  );
}
