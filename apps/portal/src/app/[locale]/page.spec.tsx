import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import PortalRootPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("PortalRootPage (Story 96 orphan-route fix)", () => {
  it("redirects to the real landing page under the current locale", async () => {
    await PortalRootPage({ params: Promise.resolve({ locale: "en" }) });

    expect(redirect).toHaveBeenCalledWith("/en/home");
  });

  it("preserves the visited locale in the redirect target", async () => {
    await PortalRootPage({ params: Promise.resolve({ locale: "ar" }) });

    expect(redirect).toHaveBeenCalledWith("/ar/home");
  });
});
