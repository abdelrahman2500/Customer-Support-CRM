import { describe, expect, it } from "vitest";
import { parseMentions } from "./ticket-mentions";

const users = [
  { id: "user-1", fullName: "Jane Doe" },
  { id: "user-2", fullName: "John Smith" },
  { id: "user-3", fullName: "Jan" },
];

describe("parseMentions", () => {
  it("returns [] for a body with no @ at all", () => {
    expect(parseMentions("Called the customer back.", users)).toEqual([]);
  });

  it("resolves a single mention at the start of the body", () => {
    expect(parseMentions("@Jane Doe can you take a look?", users)).toEqual(["user-1"]);
  });

  it("resolves a mention in the middle of the body", () => {
    expect(parseMentions("Looping in @John Smith on this one.", users)).toEqual(["user-2"]);
  });

  it("resolves multiple distinct mentions", () => {
    const result = parseMentions("@Jane Doe @John Smith please review", users);
    expect(result).toContain("user-1");
    expect(result).toContain("user-2");
    expect(result).toHaveLength(2);
  });

  it("dedupes the same person mentioned twice in one note", () => {
    expect(parseMentions("@Jane Doe, @Jane Doe are you there?", users)).toEqual(["user-1"]);
  });

  it("prefers the longest match when a shorter name is a prefix of a longer one", () => {
    // "Jan" is itself a valid user, but "@Jane Doe" must resolve to the
    // full "Jane Doe" match, not the shorter "Jan" prefix of it.
    expect(parseMentions("@Jane Doe", users)).toEqual(["user-1"]);
  });

  it("does not match a shorter name when it's actually a prefix of unrelated text", () => {
    // "Jan" should not spuriously match inside "@Janet", since "Janet"
    // isn't a real agent name and the boundary check after "Jan" fails.
    expect(parseMentions("@Janet, are you around?", users)).toEqual([]);
  });

  it("silently ignores an unresolvable mention (typo/unknown agent), never throwing", () => {
    expect(() => parseMentions("@Someone Unknown, please help", users)).not.toThrow();
    expect(parseMentions("@Someone Unknown, please help", users)).toEqual([]);
  });

  it("never mistakes an email address's @ for a mention", () => {
    expect(parseMentions("Reach me at jane@example.com if needed.", users)).toEqual([]);
  });

  it("matches case-insensitively", () => {
    expect(parseMentions("@jane doe can you check?", users)).toEqual(["user-1"]);
  });

  it("resolves a mention at the very end of the body with no trailing punctuation", () => {
    expect(parseMentions("Please review, @John Smith", users)).toEqual(["user-2"]);
  });

  it("returns [] when the candidate list is empty", () => {
    expect(parseMentions("@Jane Doe", [])).toEqual([]);
  });
});
