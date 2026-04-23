import { describe, expect, it } from "vitest";

import {
  formatSqlConnectionDisplay,
  formatSqlConnectionDisplayFull,
} from "../sqlConnectionDisplay";

describe("sqlConnectionDisplay", () => {
  it("preserves short connection strings", () => {
    expect(
      formatSqlConnectionDisplay({
        username: "reader",
        host: "db.example.com",
        port: 5432,
        database: "postgres",
      }),
    ).toBe("reader@db.example.com:5432/postgres");
  });

  it("shortens long segments with ellipses", () => {
    expect(
      formatSqlConnectionDisplay({
        username: "postgres.biwvjdxzskwuygeewmvx",
        host: "aws-1-us-east-2.pooler.supabase.com",
        port: 5432,
        database: "warehouse_reporting_primary",
      }),
    ).toContain("…");
  });

  it("returns the full string for tooltips and titles", () => {
    expect(
      formatSqlConnectionDisplayFull({
        username: "reader",
        host: "db.example.com",
        port: 5432,
        database: "postgres",
      }),
    ).toBe("reader@db.example.com:5432/postgres");
  });
});
