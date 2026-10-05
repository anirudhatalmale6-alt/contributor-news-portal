import { z } from "zod";
import type { PayoutProfile } from "@prisma/client";

/** Mobile wallets first - that is how most contributors here get paid. */
export const PAYOUT_METHODS = [
  { value: "BKASH", label: "bKash", kind: "wallet" },
  { value: "NAGAD", label: "Nagad", kind: "wallet" },
  { value: "ROCKET", label: "Rocket", kind: "wallet" },
  { value: "BANK", label: "Bank transfer", kind: "bank" },
  { value: "PAYPAL", label: "PayPal", kind: "email" },
  { value: "WISE", label: "Wise", kind: "email" },
] as const;

export const methodLabel = (method: string) =>
  PAYOUT_METHODS.find((m) => m.value === method)?.label ?? method;

export const methodKind = (method: string) =>
  PAYOUT_METHODS.find((m) => m.value === method)?.kind ?? "wallet";

/** Bangladeshi mobile numbers: 11 digits starting 01, with or without +880. */
const bdMobile = /^(?:\+?880|0)1[3-9]\d{8}$/;

export const payoutSchema = z
  .object({
    method: z.enum(["BKASH", "NAGAD", "ROCKET", "BANK", "PAYPAL", "WISE"]),
    accountName: z.string().trim().min(2).max(120),
    walletNumber: z.string().trim().max(24).optional().or(z.literal("")),
    bankName: z.string().trim().max(120).optional().or(z.literal("")),
    branch: z.string().trim().max(120).optional().or(z.literal("")),
    accountNumber: z.string().trim().max(40).optional().or(z.literal("")),
    routingNumber: z.string().trim().max(20).optional().or(z.literal("")),
    email: z.string().trim().max(160).optional().or(z.literal("")),
    country: z.string().trim().max(60).default("Bangladesh"),
    note: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const kind = methodKind(data.method);
    if (kind === "wallet") {
      if (!data.walletNumber?.trim()) {
        ctx.addIssue({ code: "custom", path: ["walletNumber"], message: "Wallet number is required" });
      } else if (!bdMobile.test(data.walletNumber.replace(/[\s-]/g, ""))) {
        ctx.addIssue({
          code: "custom",
          path: ["walletNumber"],
          message: "Use an 11-digit number starting with 01",
        });
      }
    }
    if (kind === "bank") {
      if (!data.bankName?.trim()) {
        ctx.addIssue({ code: "custom", path: ["bankName"], message: "Bank name is required" });
      }
      if (!data.accountNumber?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["accountNumber"],
          message: "Account number is required",
        });
      }
    }
    if (kind === "email") {
      if (!data.email?.trim()) {
        ctx.addIssue({ code: "custom", path: ["email"], message: "Email is required" });
      } else if (!z.string().email().safeParse(data.email).success) {
        ctx.addIssue({ code: "custom", path: ["email"], message: "That is not a valid email" });
      }
    }
  });

/** Last four digits only - what a list or an editor-adjacent screen may show. */
export function maskedDestination(profile: Pick<PayoutProfile, "method" | "walletNumber" | "accountNumber" | "email">) {
  const kind = methodKind(profile.method);
  if (kind === "wallet" && profile.walletNumber) {
    return `•••• ${profile.walletNumber.slice(-4)}`;
  }
  if (kind === "bank" && profile.accountNumber) {
    return `•••• ${profile.accountNumber.slice(-4)}`;
  }
  if (kind === "email" && profile.email) {
    const [name, domain] = profile.email.split("@");
    return `${name.slice(0, 2)}•••@${domain ?? ""}`;
  }
  return "";
}
