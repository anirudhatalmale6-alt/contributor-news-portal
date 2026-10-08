import { z } from "zod";
import { errorResponse, requireOwner } from "@/lib/rbac";
import { refreshPublicPages } from "@/lib/revalidate";
import { saveUiText } from "@/lib/ui-text-store";
import { TEXT_DEFAULTS } from "@/lib/text-defaults";
import { formComplaint } from "@/lib/zod-message";

const schema = z.object({
  entries: z
    .array(
      z.object({
        key: z.string().min(1),
        locale: z.enum(["EN", "BN"]),
        // Empty means "put it back to what the site shipped with".
        value: z.string().max(4000),
      }),
    )
    .max(500),
});

/**
 * PATCH /api/admin/wording
 *
 * The owner's own words for any label on the site. Only keys the site actually
 * uses are accepted, so a stale screen cannot fill the table with lines nothing
 * will ever read.
 */
export async function PATCH(req: Request) {
  try {
    await requireOwner();

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      return Response.json(
        { error: formComplaint(issues, { entries: "Wording" }) || "Check the form", issues },
        { status: 422 },
      );
    }

    const known = parsed.data.entries.filter((e) => e.key in TEXT_DEFAULTS);
    const unknown = parsed.data.entries.length - known.length;
    await saveUiText(known);
    refreshPublicPages();

    return Response.json({ saved: known.length, ignored: unknown });
  } catch (err) {
    return errorResponse(err);
  }
}
