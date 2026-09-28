import { describe, expect, it } from "vitest";

import {
  buildRouteWithFinalAccess,
  calculateStraightLineDistanceKm,
} from "@/lib/geo-distance";

describe("distância geográfica da visita", () => {
  it("retorna zero para o mesmo ponto", () => {
    expect(
      calculateStraightLineDistanceKm(
        [-16.3419669, -49.4708347],
        [-16.3419669, -49.4708347],
      ),
    ).toBe(0);
  });

  it("soma a estrada ao acesso final até o GPS", () => {
    const result = buildRouteWithFinalAccess(
      [
        [-49.4708347, -16.3419669],
        [-49.0, -17.0],
      ],
      100_000,
      [-17.1, -49.1],
    );

    expect(result.roadDistanceKm).toBe(100);
    expect(result.accessDistanceKm).toBeGreaterThan(0);
    expect(result.totalDistanceKm).toBeCloseTo(
      result.roadDistanceKm + result.accessDistanceKm,
      8,
    );
    expect(result.accessPath.at(-1)).toEqual([-17.1, -49.1]);
  });
});
