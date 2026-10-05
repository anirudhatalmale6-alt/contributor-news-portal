import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-soft">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-serif font-bold text-ink">The Dispatch</span> - a prototype
          contributor newsroom.
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/" className="hover:text-ink">
            Latest
          </Link>
          <Link href="/register" className="hover:text-ink">
            Write for us
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
