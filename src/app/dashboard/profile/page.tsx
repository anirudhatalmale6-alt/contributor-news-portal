import { DeskShell } from "@/components/desk-shell";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/rbac";
import { ProfileForm } from "@/components/profile-form";

export const metadata = { title: "My profile" };

/** A contributor's own introduction, picture and contact details. */
export default async function MyProfilePage() {
  const me = await currentUser();
  if (!me) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      name: true,
      publicName: true,
      image: true,
      bio: true,
      publicEmail: true,
      phone: true,
      whatsapp: true,
      phonePublic: true,
      website: true,
      location: true,
    },
  });

  return (
    <>
      <DeskShell user={me} width="max-w-2xl">
        <Link href="/dashboard" className="inline-block py-4 text-sm text-ink-soft hover:text-ink">
          &larr; Back to my desk
        </Link>

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">My profile</h1>
        <p className="mt-1 text-sm text-ink-soft">
          This is what readers see on your public page and under every article you write.{" "}
          <Link href={`/author/${me.id}`} className="font-medium text-brand hover:underline">
            See it as a reader
          </Link>
        </p>

        <div className="mt-6">
          <ProfileForm
            heading="Your introduction"
            endpoint="/api/profile"
            method="PUT"
            photoEndpoint="/api/profile/photo"
            initial={{
              name: user?.name ?? "",
              publicName: user?.publicName ?? user?.name ?? "",
              bio: user?.bio ?? "",
              publicEmail: user?.publicEmail ?? "",
              phone: user?.phone ?? "",
              whatsapp: user?.whatsapp ?? "",
              phonePublic: user?.phonePublic ?? false,
              website: user?.website ?? "",
              location: user?.location ?? "",
              image: user?.image ?? null,
            }}
          />
        </div>
      </DeskShell>
    </>
  );
}
