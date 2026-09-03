import { describe, expect, it } from "vitest";
import { isPasswordComplex } from "./is-password-complex.validator";

describe("isPasswordComplex", () => {
  it("rejects a non-string value", () => {
    expect(isPasswordComplex(undefined)).toBe(false);
    expect(isPasswordComplex(12345678)).toBe(false);
  });

  it("rejects a long password with only 1 character class (all lowercase)", () => {
    expect(isPasswordComplex("onlylowercaseletters")).toBe(false);
  });

  it("rejects a long password with only 2 character classes (lowercase + digit)", () => {
    expect(isPasswordComplex("lowercase12345")).toBe(false);
  });

  it("accepts a password with exactly 3 character classes (lowercase + uppercase + digit)", () => {
    expect(isPasswordComplex("Lowercase12345")).toBe(true);
  });

  it("accepts a password with exactly 3 character classes (lowercase + digit + symbol)", () => {
    expect(isPasswordComplex("lowercase-12345")).toBe(true);
  });

  it("accepts a password with all 4 character classes", () => {
    expect(isPasswordComplex("Lowercase-12345")).toBe(true);
  });

  it("does not itself enforce a minimum length — that remains @MinLength(8)'s own job", () => {
    // Short but 4 classes present: still "complex" by this predicate alone.
    expect(isPasswordComplex("Ab1!")).toBe(true);
  });
});
