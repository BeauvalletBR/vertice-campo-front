import { describe, expect, it } from "vitest";

import { getCompleteMonthWeekRange } from "@/lib/escala-planning";

describe("monthly scale week range", () => {
  it("completes the last August 2026 week into September", () => {
    expect(getCompleteMonthWeekRange("2026-08")).toEqual({
      start: "2026-07-27",
      end: "2026-09-06",
    });
  });

  it("completes the first January week into the previous year", () => {
    expect(getCompleteMonthWeekRange("2026-01")).toEqual({
      start: "2025-12-29",
      end: "2026-02-01",
    });
  });
});
