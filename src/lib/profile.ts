import { z } from "zod";

/** 11 digits starting 01, with or without the +880 country code. */
export const bdMobile = /^(?:\+?880|0)1[3-9]\d{8}$/;
export const normalisePhone = (v: string) => v.replace(/[\s-]/g, "");
export const phoneField = z
  .string()
  .trim()
  .max(24)
  .refine((v) => v === "" || bdMobile.test(normalisePhone(v)), {
    message: "Use an 11-digit number starting with 01",
  });

/** The fields a contributor (or a senior colleague) may edit on a profile. */
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  publicEmail: z
    .union([z.string().trim().email().max(160), z.literal("")])
    .nullable()
    .optional(),
  phone: phoneField.nullable().optional(),
  whatsapp: phoneField.nullable().optional(),
  phonePublic: z.boolean().optional(),
  website: z
    .union([z.string().trim().url().max(200), z.literal("")])
    .nullable()
    .optional(),
  location: z.string().trim().max(120).nullable().optional(),
});

const normaliseOrNull = (v: string | null | undefined) =>
  v === undefined || v === null ? v : normalisePhone(v);

/** Empty strings mean "cleared", not "unchanged". */
export function profileData(input: z.infer<typeof profileSchema>) {
  const blankToNull = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim();

  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    bio: blankToNull(input.bio),
    publicEmail: blankToNull(input.publicEmail),
    phone: input.phone === undefined ? undefined : blankToNull(normaliseOrNull(input.phone)),
    whatsapp: input.whatsapp === undefined ? undefined : blankToNull(normaliseOrNull(input.whatsapp)),
    ...(input.phonePublic !== undefined ? { phonePublic: input.phonePublic } : {}),
    website: blankToNull(input.website),
    location: blankToNull(input.location),
  };
}
