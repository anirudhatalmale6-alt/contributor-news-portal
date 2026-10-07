import Link from "next/link";
import { SHELL } from "@/components/ui";
import { currentUser } from "@/lib/rbac";
import { SignOutButton } from "@/components/auth-buttons";
import { unreadCount } from "@/lib/inbox";
import { unreadNotifications } from "@/lib/notify";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  CONTRIBUTOR: "Contributor",
};

/**
 * A dark strip across the very top telling whoever is signed in that they are,
 * and as whom. Sessions last 30 days, so without this a contributor on a shared
 * machine has no way of noticing they are still logged in as someone else.
 *
 * One line on every width. On a phone the wording shortens and the links scroll
 * sideways rather than wrapping into a second and third row, which is what made
 * it look like a box of loose parts.
 */
export async function SignedInBar() {
  const user = await currentUser();
  if (!user) return null;
  const [unread, updates] = await Promise.all([unreadCount(user), unreadNotifications(user.id)]);

  const badge = (n: number) =>
    n ? (
      <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
        {n}
      </span>
    ) : null;

  const link = "shrink-0 whitespace-nowrap font-medium text-white/90 hover:text-white";

  return (
    <div className="bg-navy text-white">
      <div className={`${SHELL} flex h-9 items-center gap-3 text-xs sm:h-10 sm:gap-4 sm:text-[13px]`}>
        <span className="min-w-0 truncate">
          <span className="hidden sm:inline">You are logged in as </span>
          <span className="sm:hidden">Signed in: </span>
          <span className="font-semibold">{user.name}</span>
          <span className="text-white/70"> ({ROLE_LABEL[user.role] ?? user.role})</span>
        </span>

        <nav className="no-scrollbar ml-auto flex items-center gap-3 overflow-x-auto sm:gap-4">
          <Link href="/dashboard" className={link}>
            Updates
            {badge(updates)}
          </Link>
          <Link href="/inbox" className={link}>
            Inbox
            {badge(unread)}
          </Link>
          <Link href="/dashboard/account" className={`${link} hidden sm:inline`}>
            Account
          </Link>
          <span className="shrink-0 [&_button]:text-white/90 [&_button:hover]:text-white">
            <SignOutButton label="Sign out" compact />
          </span>
        </nav>
      </div>
    </div>
  );
}
