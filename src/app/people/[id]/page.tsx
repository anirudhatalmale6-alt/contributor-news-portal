import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canChangeRole, currentUser, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { ProfileForm } from "@/components/profile-form";
import { SuspendPanel } from "./suspend-panel";
import { StatusPill, TierBadge } from "@/components/ui";
import { longDate } from "@/lib/format";

export const metadata = { title: "Contributor" };

/** One person, as the newsroom sees them: their profile, and whether they are suspended. */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (!isStaff(me.role)) redirect("/dashboard");

  const { id } = await params;
  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      bio: true,
      publicEmail: true,
      phone: true,
      whatsapp: true,
      phonePublic: true,
      website: true,
      location: true,
      role: true,
      tier: true,
      createdAt: true,
      suspendedAt: true,
      suspendedReason: true,
      suspendedBy: { select: { name: true } },
      articles: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, title: true, status: true, updatedAt: true },
      },
    },
  });
  if (!person) notFound();

  const mayEdit = person.id !== me.id && canChangeRole(me.role, person.role, person.role);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={me} current="people" />
        </div>

        <Link href="/people" className="inline-block py-2 text-sm text-ink-soft hover:text-ink">
          &larr; Back to People
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">{person.name}</h1>
          <TierBadge tier={person.tier} role={person.role} />
          {person.suspendedAt ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-800">
              Suspended
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {person.email} · joined {longDate(person.createdAt)} ·{" "}
          <Link href={`/author/${person.id}`} className="font-medium text-brand hover:underline">
            public page
          </Link>
        </p>

        {!mayEdit ? (
          <p className="mt-6 rounded-xl border border-line bg-paper-soft p-4 text-sm text-ink-soft">
            {person.id === me.id
              ? "This is your own account. Edit it from your account page."
              : "Only the site owner can edit this account."}
          </p>
        ) : (
          <div className="mt-6 grid gap-6">
            <SuspendPanel
              userId={person.id}
              name={person.name}
              suspendedAt={person.suspendedAt?.toISOString() ?? null}
              reason={person.suspendedReason}
              by={person.suspendedBy?.name ?? null}
            />

            <ProfileForm
              heading={`Profile for ${person.name}`}
              note="Edits here appear on their public page straight away."
              endpoint={`/api/admin/users/${person.id}/profile`}
              method="PATCH"
              photoEndpoint={`/api/admin/users/${person.id}/profile`}
              initial={{
                name: person.name,
                bio: person.bio ?? "",
                publicEmail: person.publicEmail ?? "",
                phone: person.phone ?? "",
                whatsapp: person.whatsapp ?? "",
                phonePublic: person.phonePublic,
                website: person.website ?? "",
                location: person.location ?? "",
                image: person.image,
              }}
            />
          </div>
        )}

        <section className="mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
            Recent work
          </h2>
          {person.articles.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing written yet.</p>
          ) : (
            <ul className="grid gap-2">
              {person.articles.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill status={a.status} />
                    <span className="font-serif font-bold">{a.title || "Untitled draft"}</span>
                  </span>
                  <Link
                    href={`/editorial/${a.id}`}
                    className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-paper-soft"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
