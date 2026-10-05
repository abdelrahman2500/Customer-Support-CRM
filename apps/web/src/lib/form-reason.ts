/**
 * Story 225 (PR-4.4) — "Still needed: Subject and Customer", in the UI's
 * language and list style (Intl.ListFormat), for a create form's disabled or
 * incomplete submit. `t` is the `common` translator.
 */
export function missingReason(
  t: (key: string, values?: Record<string, string>) => string,
  locale: string,
  missing: string[],
): string {
  const fields = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    missing,
  );
  return t("form.missing", { fields });
}
