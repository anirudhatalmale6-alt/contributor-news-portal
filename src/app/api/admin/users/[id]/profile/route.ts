import { prisma } from "@/lib/prisma";
import { canChangeRole, errorResponse, HttpError, requireStaff } from "@/lib/rbac";
import { profileData, profileSchema } from "@/lib/profile";
import { saveUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Staff may edit someone junior to them, and nobody may edit themselves here. */
async function editable(actorRole: string, actorId: string, id: string) {
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) throw new HttpError(404, "No such account");
  if (target.id === actorId) {
    throw new HttpError(409, "Edit your own profile from your account page");
  }
  if (!canChangeRole(actorRole, target.role, target.role)) {
    throw new HttpError(403, "You cannot edit that account");
  }
  return target;
}

/** GET /api/admin/users/:id/profile */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        publicEmail: true,
        phone: true,
        website: true,
        location: true,
        role: true,
        tier: true,
        suspendedAt: true,
        suspendedReason: true,
      },
    });
    if (!user) throw new HttpError(404, "No such account");
    return Response.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH /api/admin/users/:id/profile - an editor tidying a contributor's page. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireStaff();
    const { id } = await params;
    await editable(actor.role, actor.id, id);

    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the form", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: profileData(parsed.data),
      select: {
        id: true,
        name: true,
        image: true,
        bio: true,
        publicEmail: true,
        phone: true,
        website: true,
        location: true,
      },
    });
    return Response.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/admin/users/:id/profile (multipart: file) - replace their photo. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireStaff();
    const { id } = await params;
    await editable(actor.role, actor.id, id);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "No file received");
    if (!PHOTO_TYPES.includes(file.type)) throw new HttpError(415, "Use a JPEG, PNG or WebP photo");
    if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "Keep the photo under 5 MB");

    const { url } = await saveUpload(file);
    const user = await prisma.user.update({
      where: { id },
      data: { image: url },
      select: { id: true, image: true },
    });
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
