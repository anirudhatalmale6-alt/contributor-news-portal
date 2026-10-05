import Link from "next/link";
import { currentUser } from "@/lib/rbac";
import { SignOutButton } from "@/components/auth-buttons";

const NAV = [
  { href: "/", label: "Latest" },
  { href: "/?category=Politics", label: "Politics" },
  { href: "/?category=Technology", label: "Technology" },
  { href: "/?category=Culture", label: "Culture" },
  { href: "/?category=Business", label: "Business" },
];

export async function SiteHeader() {
  const user = await currentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" aria-label="The Document - home" className="shrink-0">
          {/* Width and height are fixed so the masthead never shifts the layout
              while it decodes. eslint-disable: a plain <img> keeps the public
              pages free of the image optimiser round-trip. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/the-document-masthead.png"
            alt="The Document"
            width={1000}
            height={259}
            fetchPriority="high"
            className="h-9 w-auto sm:h-12"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-5 text-sm text-ink-soft md:flex">
          {NAV.map((item) => (
            <Link key={item.label} href={item.href} className="hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-4">
          {user ? (
            <>
              <Link
                href={user.role === "CONTRIBUTOR" ? "/dashboard" : "/editorial"}
                className="rounded-full bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-dark"
              >
                {user.role === "CONTRIBUTOR" ? "My desk" : "Newsroom"}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="px-2 py-1.5 text-sm text-ink-soft hover:text-ink">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Write for us
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-2 text-sm text-ink-soft md:hidden">
        {NAV.map((item) => (
          <Link key={item.label} href={item.href} className="whitespace-nowrap hover:text-ink">
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
