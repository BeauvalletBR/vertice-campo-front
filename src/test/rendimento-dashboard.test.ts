import { describe, expect, it } from "vitest";

import { aggregateYieldGoalRows } from "@/modules/rendimento/utils/dashboardReport";

describe("rendimento dashboard weekly goal aggregation", () => {
  it("groups the same product by week and weights its yield by processed weight", () => {
    const rows = aggregateYieldGoalRows([
      {
        id: "test-1-product-1",
        testId: "test-1",
        productId: "product-1",
        hierarchyOrder: 1,
        week: "2026.43",
        standard: "CONTRA FILE MI",
        pieces: 20,
        referenceWeight: 200,
        productWeight: 16,
        yieldPercent: 8,
        goal: 8,
      },
      {
        id: "test-2-product-1",
        testId: "test-2",
        productId: "product-1",
        hierarchyOrder: 1,
        week: "2026.43",
        standard: "CONTRA FILE MI",
        pieces: 14,
        referenceWeight: 140,
        productWeight: 10.5,
        yieldPercent: 7.5,
        goal: 8,
      },
      {
        id: "test-3-product-1",
        testId: "test-3",
        productId: "product-1",
        hierarchyOrder: 1,
        week: "2026.44",
        standard: "CONTRA FILE MI",
        pieces: 10,
        referenceWeight: 100,
        productWeight: 8.1,
        yieldPercent: 8.1,
        goal: 8,
      },
    ]);

    expect(rows).toHaveLength(2);
    const week43 = rows.find((row) => row.week === "2026.43");
    expect(week43?.pieces).toBe(34);
    expect(week43?.yieldPercent).toBeCloseTo((26.5 / 340) * 100, 6);
    expect(week43?.difference).toBeCloseTo(8 - (26.5 / 340) * 100, 6);
  });
});
