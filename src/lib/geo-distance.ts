export type GeoPoint = [number, number];

export const calculateStraightLineDistanceKm = (
  start: GeoPoint,
  end: GeoPoint,
) => {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(end[0] - start[0]);
  const longitudeDelta = toRadians(end[1] - start[1]);
  const startLatitude = toRadians(start[0]);
  const endLatitude = toRadians(end[0]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
};

export const buildRouteWithFinalAccess = (
  osrmCoordinates: [number, number][],
  roadDistanceMeters: number,
  destination: GeoPoint,
) => {
  const roadPath = osrmCoordinates.map(
    ([longitude, latitude]) => [latitude, longitude] as GeoPoint,
  );

  if (roadPath.length === 0) {
    throw new Error("Rota sem coordenadas.");
  }

  const roadDistanceKm = Number(roadDistanceMeters) / 1000;
  const roadEnd = roadPath[roadPath.length - 1];
  const accessDistanceKm = calculateStraightLineDistanceKm(
    roadEnd,
    destination,
  );

  return {
    roadPath,
    accessPath:
      accessDistanceKm > 0.01 ? ([roadEnd, destination] as GeoPoint[]) : [],
    roadDistanceKm,
    accessDistanceKm,
    totalDistanceKm: roadDistanceKm + accessDistanceKm,
  };
};
