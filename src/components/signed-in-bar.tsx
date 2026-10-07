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
 * A quiet strip under the masthead telling whoever is signed in that they are,
 * and as whom. Sessions last 30 days, so without this a contributor on a shared
 * machine has no way of noticing they are still logged in as someone else.
 */
export async function SignedInBar() {
  const user = await currentUser();
  if (!user) return null;
  const [unread, updates] = await Promise.all([unreadCount(user), unreadNotifications(user.id)]);

  return (
    <div className="border-b border-line bg-paper-soft">
      <div className={`${SHELL} flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs text-ink-soft`}>
        <span>
          You are logged in as <span className="font-semibold text-ink">{user.name}</span> (
          {ROLE_LABEL[user.role] ?? user.role})
        </span>
        <Link href="/dashboard" className="font-medium text-navy hover:underline">
          Updates
          {updates ? (
            <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
              {updates}
            </span>
          ) : null}
        </Link>
        <Link href="/inbox" className="font-medium text-navy hover:underline">
          Inbox
          {unread ? (
            <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unread}
            </span>
          ) : null}
        </Link>
        <Link href="/dashboard/account" className="font-medium text-navy hover:underline">
          Account
        </Link>
        <span className="ml-auto">
          <SignOutButton label="Sign out" compact />
        </span>
      </div>
    </div>
  );
}
