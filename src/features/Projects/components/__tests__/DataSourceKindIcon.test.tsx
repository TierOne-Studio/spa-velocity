import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  DataSourceKindIcon,
  dataSourceKindLabel,
} from "../DataSourceKindIcon";

describe("dataSourceKindLabel", () => {
  it.each([
    ["database", "Database"],
    ["vector_db", "Vector database"],
    ["external", "External source"],
    ["airweave_collection", "Airweave collection"],
  ] as const)("labels %s as %s", (kind, expected) => {
    expect(dataSourceKindLabel(kind)).toBe(expected);
  });
});

describe("DataSourceKindIcon", () => {
  function iconClass(kind: Parameters<typeof DataSourceKindIcon>[0]["kind"]) {
    const { container } = render(<DataSourceKindIcon kind={kind} />);
    return container.querySelector("svg")?.getAttribute("class") ?? "";
  }

  it("renders a distinct icon for vector_db (not the airweave fallback)", () => {
    // Regression guard: vector_db previously fell through to the airweave
    // branch (IconBooks). It must now render its own icon.
    const vectorDb = iconClass("vector_db");
    expect(vectorDb).toContain("tabler-icon-database-search");
    expect(vectorDb).not.toBe(iconClass("airweave_collection"));
    expect(vectorDb).not.toBe(iconClass("database"));
  });
});
