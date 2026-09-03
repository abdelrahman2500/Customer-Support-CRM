import { describe, expect, it } from "vitest";
import { parseCorsOrigins, parseCorsOriginsDetailed } from "./cors-origins";

describe("parseCorsOrigins", () => {
  it("returns an empty array when unset (fails closed)", () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseCorsOrigins("")).toEqual([]);
  });

  it("returns a single-element array for a single origin", () => {
    expect(parseCorsOrigins("http://localhost:3000")).toEqual(["http://localhost:3000"]);
  });

  it("splits a comma-separated list and trims whitespace around each origin", () => {
    expect(parseCorsOrigins(" http://localhost:3000 , https://app.example.com ")).toEqual([
      "http://localhost:3000",
      "https://app.example.com",
    ]);
  });

  it("drops empty entries produced by trailing/duplicate commas", () => {
    expect(parseCorsOrigins("http://localhost:3000,,")).toEqual(["http://localhost:3000"]);
  });

  it("normalizes a trailing slash away — a browser's Origin header never has one", () => {
    expect(parseCorsOrigins("https://app.example.com/")).toEqual(["https://app.example.com"]);
  });

  it("drops a default port, matching the browser's own Origin serialization", () => {
    expect(parseCorsOrigins("https://app.example.com:443,http://app.example.com:80")).toEqual([
      "https://app.example.com",
      "http://app.example.com",
    ]);
  });

  it("lowercases the scheme and host", () => {
    expect(parseCorsOrigins("HTTPS://App.Example.COM")).toEqual(["https://app.example.com"]);
  });

  it("de-duplicates entries that normalize to the same origin", () => {
    expect(parseCorsOrigins("https://app.example.com,https://app.example.com/")).toEqual([
      "https://app.example.com",
    ]);
  });

  it("keeps a non-default port, which is part of the origin", () => {
    expect(parseCorsOrigins("http://localhost:3002")).toEqual(["http://localhost:3002"]);
  });
});

describe("parseCorsOriginsDetailed", () => {
  it("reports nothing invalid for a well-formed list", () => {
    expect(parseCorsOriginsDetailed("http://localhost:3000,http://localhost:3002")).toEqual({
      origins: ["http://localhost:3000", "http://localhost:3002"],
      invalid: [],
    });
  });

  it("rejects an entry carrying a path — the operator pasted a page URL", () => {
    const { origins, invalid } = parseCorsOriginsDetailed("https://app.example.com/login");
    expect(origins).toEqual([]);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toMatchObject({ value: "https://app.example.com/login" });
    expect(invalid[0]?.reason).toContain("path");
  });

  it("rejects a bare hostname with no scheme", () => {
    const { origins, invalid } = parseCorsOriginsDetailed("app.example.com");
    expect(origins).toEqual([]);
    expect(invalid[0]?.reason).toContain("scheme");
  });

  it('rejects "*", which the CORS spec forbids on credentialed responses', () => {
    const { origins, invalid } = parseCorsOriginsDetailed("*");
    expect(origins).toEqual([]);
    expect(invalid[0]?.reason).toContain("credentialed");
  });

  it("rejects a non-http(s) scheme", () => {
    expect(parseCorsOriginsDetailed("ftp://app.example.com").invalid[0]?.reason).toContain(
      "unsupported scheme",
    );
  });

  it("rejects an entry with a query string or fragment", () => {
    expect(parseCorsOriginsDetailed("https://app.example.com?x=1").invalid).toHaveLength(1);
    expect(parseCorsOriginsDetailed("https://app.example.com#x").invalid).toHaveLength(1);
  });

  it("rejects an entry embedding credentials", () => {
    expect(
      parseCorsOriginsDetailed("https://user:pw@app.example.com").invalid[0]?.reason,
    ).toContain("credentials");
  });

  it("keeps the valid entries alongside the invalid ones", () => {
    const { origins, invalid } = parseCorsOriginsDetailed("https://good.example.com,bad-entry");
    expect(origins).toEqual(["https://good.example.com"]);
    expect(invalid).toHaveLength(1);
  });
});
