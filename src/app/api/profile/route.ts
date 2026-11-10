import { prisma } from "@/lib/prisma";
import { errorResponse, requireUser } from "@/lib/rbac";
import { profileData, profileSchema } from "@/lib/profile";

/** GET /api/profile - the signed-in person's own profile. */
export async function GET() {
  try {
    const me = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: me.id },
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
      },
    });
    return Response.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT /api/profile - a contributor editing their own introduction. */
export async function PUT(req: Request) {
  try {
    const me = await requireUser();
    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the form", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    // The byline is the desk's. An account that somehow has none stored yet
    // keeps the name it has now as its byline, before that name changes -
    // otherwise renaming the account would quietly rename every article.
    const current = await prisma.user.findUnique({
      where: { id: me.id },
      select: { name: true, publicName: true },
    });
    const freeze = current && !current.publicName?.trim() ? { publicName: current.name } : {};

    const user = await prisma.user.update({
      where: { id: me.id },
      data: { ...profileData(parsed.data), ...freeze },
      select: {
        id: true,
        name: true,
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
    return Response.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}
