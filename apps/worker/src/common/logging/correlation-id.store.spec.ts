import { describe, expect, it } from "vitest";
import { CorrelationIdStore } from "./correlation-id.store";

describe("CorrelationIdStore", () => {
  it("returns undefined when called outside any run()", () => {
    expect(CorrelationIdStore.get()).toBeUndefined();
  });

  it("returns the bound id for code executed inside run()", () => {
    const result = CorrelationIdStore.run("job-1", () => CorrelationIdStore.get());
    expect(result).toBe("job-1");
  });

  it("returns the bound id for async code awaited inside run()", async () => {
    const result = await CorrelationIdStore.run("job-2", async () => {
      await Promise.resolve();
      return CorrelationIdStore.get();
    });
    expect(result).toBe("job-2");
  });

  it("keeps concurrent runs isolated from each other", async () => {
    const [a, b] = await Promise.all([
      CorrelationIdStore.run("job-a", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return CorrelationIdStore.get();
      }),
      CorrelationIdStore.run("job-b", async () => {
        return CorrelationIdStore.get();
      }),
    ]);
    expect(a).toBe("job-a");
    expect(b).toBe("job-b");
  });

  it("returns undefined again once run() has completed", () => {
    CorrelationIdStore.run("job-3", () => undefined);
    expect(CorrelationIdStore.get()).toBeUndefined();
  });
});
