/**
 * Turns a rejected form into a sentence an editor can act on.
 *
 * "Check the form" is true and useless: the editor presses the button again and
 * gets the same nothing back. This names the field as it is labelled on the
 * screen and says what was wrong with it.
 */
export function formComplaint(
  fieldErrors: Record<string, string[] | undefined>,
  labels: Record<string, string>,
) {
  return Object.entries(fieldErrors)
    .map(([key, messages]) => `${labels[key] ?? key}: ${messages?.[0] ?? "not accepted"}`)
    .join(". ");
}
