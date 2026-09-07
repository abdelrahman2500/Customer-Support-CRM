/**
 * RM-06 — @Mentions. A simple, bounded parser (the plan's own words: "not
 * a rich-text editor") — no markup, no stored mention entities on
 * `TicketNote` itself. A mention is recognized purely by matching against
 * the real, already-known list of this branch's own agents
 * (`IdentityService.listUsers()`, the same list `TicketDetailView`'s
 * assignee picker already renders) — there is no separate `username`/
 * handle field anywhere on `User` (recon confirmed this), so the match key
 * is `fullName` itself, exactly as the frontend composer inserts it
 * (`@{fullName} `) when an agent picks someone from its own dropdown.
 *
 * Unresolvable text after an `@` (a typo, an agent outside this branch, or
 * an unrelated `@` in ordinary text, e.g. inside an email address) is
 * silently not a mention — never an error, per this story's own acceptance
 * criteria ("never blocks saving the note").
 */
export interface MentionCandidate {
  id: string;
  fullName: string;
}

const WORD_BOUNDARY = /[\s.,!?;:()[\]{}'"]/;

function isWordBoundary(char: string | undefined): boolean {
  return char === undefined || WORD_BOUNDARY.test(char);
}

/**
 * Longest-match-first: if both "Jan" and "Jane Doe" were ever valid
 * agent names, `@Jane Doe` resolves to "Jane Doe", not the shorter "Jan"
 * prefix of it. Every match is also boundary-checked on both sides — the
 * character before `@` must be the start of the body or whitespace/
 * punctuation (so `user@example.com` is never mistaken for a mention),
 * and the character immediately after the matched name must likewise be a
 * boundary or end-of-string (so `@Janet` is never mistaken for a mention
 * of a shorter "Jan"). Returns deduplicated recipient ids, in no
 * particular order.
 */
export function parseMentions(body: string, candidates: MentionCandidate[]): string[] {
  const sorted = [...candidates].sort((a, b) => b.fullName.length - a.fullName.length);
  const mentionedIds = new Set<string>();

  for (let i = 0; i < body.length; i += 1) {
    if (body[i] !== "@") {
      continue;
    }
    if (!isWordBoundary(body[i - 1])) {
      continue; // `@` mid-word (e.g. an email address) — never a mention start.
    }

    const rest = body.slice(i + 1);
    const match = sorted.find(
      (candidate) =>
        candidate.fullName.length > 0 &&
        rest.toLowerCase().startsWith(candidate.fullName.toLowerCase()) &&
        isWordBoundary(rest[candidate.fullName.length]),
    );
    if (match) {
      mentionedIds.add(match.id);
    }
  }

  return [...mentionedIds];
}
