import { describe, expect, it } from "vitest";
import { parseCorsOrigins } from "./cors-origins";

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
});
