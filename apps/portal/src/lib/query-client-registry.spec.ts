import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { clearQueryCache, registerQueryClient } from "./query-client-registry";

describe("query-client-registry (portal)", () => {
  it("does not throw when clearing before any client has registered", () => {
    expect(() => clearQueryCache()).not.toThrow();
  });

  it("clears the registered client's cache", () => {
    const client = new QueryClient();
    const clearSpy = vi.spyOn(client, "clear");
    registerQueryClient(client);

    clearQueryCache();

    expect(clearSpy).toHaveBeenCalledOnce();
  });
});
