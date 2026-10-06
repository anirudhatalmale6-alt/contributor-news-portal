import { z } from "zod";

/** The fields a contributor (or a senior colleague) may edit on a profile. */
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  publicEmail: z
    .union([z.string().trim().email().max(160), z.literal("")])
    .nullable()
    .optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z
    .union([z.string().trim().url().max(200), z.literal("")])
    .nullable()
    .optional(),
  location: z.string().trim().max(120).nullable().optional(),
});

/** Empty strings mean "cleared", not "unchanged". */
export function profileData(input: z.infer<typeof profileSchema>) {
  const blankToNull = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim();

  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    bio: blankToNull(input.bio),
    publicEmail: blankToNull(input.publicEmail),
    phone: blankToNull(input.phone),
    website: blankToNull(input.website),
    location: blankToNull(input.location),
  };
}
