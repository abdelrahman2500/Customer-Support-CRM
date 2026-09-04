import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import * as icons from "./icons";
import * as ui from "../index";

/**
 * Story S-5 — the icon module is a set of decisions, not behaviour, so what
 * is worth testing is that the decisions are all actually there and all
 * actually reachable. A role silently missing from the barrel is the way
 * this convention would erode: a caller who cannot import `DeleteIcon`
 * reaches straight back into `lucide-react` and picks their own glyph.
 */
const ROLES = [
  "SearchIcon",
  "FilterIcon",
  "SortIcon",
  "SortAscIcon",
  "SortDescIcon",
  "EditIcon",
  "DeleteIcon",
  "AddIcon",
  "RetryIcon",
  "ChevronDownIcon",
  "ChevronUpIcon",
  "ChevronLeftIcon",
  "ChevronRightIcon",
  "ExternalLinkIcon",
  "MenuIcon",
  "CloseIcon",
  "SuccessIcon",
  "WarningIcon",
  "ErrorIcon",
  "InfoIcon",
] as const;

describe("icon vocabulary", () => {
  it("covers every semantic role the applications need, and each one renders", () => {
    for (const role of ROLES) {
      // Lucide ships `forwardRef` components, so these are objects rather
      // than plain functions - what matters is that each is a usable
      // component that draws an SVG.
      const { container, unmount } = render(createElement(icons[role]));
      expect(container.querySelector("svg"), role).toBeInTheDocument();
      unmount();
    }
  });

  it("re-exports every role from the package barrel", () => {
    for (const role of ROLES) {
      expect(ui[role], role).toBe(icons[role]);
    }
  });

  it("maps distinct roles to distinct glyphs", () => {
    const unique = new Set(ROLES.map((role) => icons[role]));

    // Two roles sharing one glyph would mean a naming decision was never
    // actually made — e.g. "error" and "warning" both falling back to the
    // same triangle.
    expect(unique.size).toBe(ROLES.length);
  });
});
