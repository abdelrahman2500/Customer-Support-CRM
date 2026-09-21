/**
 * Story 149 regression guard, mirroring the portal's own
 * `ticket-filter-messages.spec.ts` (and, before it,
 * `fetch-state-messages.spec.ts`) in scope and reasoning.
 *
 * `ArticleListView`'s translation column reads three keys that no type
 * checker can verify. A missing one would not fail the build — next-intl
 * renders the key path instead, so the Knowledge Base list would show a
 * column literally headed `list.columns.translation`, in Arabic as well as
 * English.
 *
 * Deliberately scoped to the keys this story introduced, not a sweep of
 * the whole catalog.
 */
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

const CATALOGS = { en, ar } as const;

describe("knowledge base translation-status messages", () => {
  for (const [locale, messages] of Object.entries(CATALOGS)) {
    describe(locale, () => {
      it("has a translation column header", () => {
        const header = messages.knowledgeBase.list.columns.translation;
        expect(header).toBeTypeOf("string");
        expect(header.trim()).not.toBe("");
      });

      it("has both badge labels", () => {
        const { translated, untranslated } = messages.knowledgeBase.list.translation;
        for (const label of [translated, untranslated]) {
          expect(label).toBeTypeOf("string");
          expect(label.trim()).not.toBe("");
        }
        // The two states must not read the same, or the badge says nothing.
        expect(translated).not.toBe(untranslated);
      });
    });
  }

  it("actually translates all three strings into Arabic", () => {
    const pairs: [string, string][] = [
      [en.knowledgeBase.list.columns.translation, ar.knowledgeBase.list.columns.translation],
      [en.knowledgeBase.list.translation.translated, ar.knowledgeBase.list.translation.translated],
      [
        en.knowledgeBase.list.translation.untranslated,
        ar.knowledgeBase.list.translation.untranslated,
      ],
    ];
    for (const [english, arabic] of pairs) {
      expect(arabic).not.toBe(english);
      // Arabic script, not a latin placeholder left behind.
      expect(arabic).toMatch(/[؀-ۿ]/);
    }
  });
});
