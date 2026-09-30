import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarX2,
  Loader2,
  MapPin,
  Navigation,
  Route,
  X,
} from "lucide-react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  api,
  type ApiVisitaLocalizacaoPublica,
} from "@/services/api";
import {
  buildRouteWithFinalAccess,
  calculateStraightLineDistanceKm,
} from "@/lib/geo-distance";

const EMPRESA_COORDS: [number, number] = [-16.3419669, -49.4708347];

const formatVisitDate = (value: string | null) => {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

function MapBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), {
      padding: [32, 32],
      maxZoom: 14,
    });
  }, [map, points]);

  return null;
}

export default function VisitaLocalizacaoPublica() {
  const { token: pathToken = "" } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || pathToken;
  const [visit, setVisit] = useState<ApiVisitaLocalizacaoPublica | null>(null);
  const [pageError, setPageError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [roadPath, setRoadPath] = useState<[number, number][]>([]);
  const [accessPath, setAccessPath] = useState<[number, number][]>([]);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number | null>(null);
  const [accessDistanceKm, setAccessDistanceKm] = useState<number | null>(null);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeFallback, setRouteFallback] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setPageError("");

    if (!token) {
      setPageError("Link de localização inválido.");
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    api.fetchLocalizacaoPublicaVisita(token)
      .then((data) => {
        if (active) setVisit(data);
      })
      .catch((error) => {
        if (active) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Não foi possível abrir esta localização.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!visit) return;

    const latitude = Number(visit.GPS_LATITUDE);
    const longitude = Number(visit.GPS_LONGITUDE);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setPageError("A visita não possui coordenadas válidas.");
      return;
    }

    const destination: [number, number] = [latitude, longitude];
    const fallbackPath: [number, number][] = [EMPRESA_COORDS, destination];
    const controller = new AbortController();
    let active = true;

    const applyFallback = () => {
      const distance = calculateStraightLineDistanceKm(
        EMPRESA_COORDS,
        destination,
      );
      setRoadPath([]);
      setAccessPath(fallbackPath);
      setRoadDistanceKm(null);
      setAccessDistanceKm(distance);
      setTotalDistanceKm(distance);
      setRouteFallback(true);
    };

    setIsLoadingRoute(true);
    setRouteFallback(false);
    setRoadPath([]);
    setAccessPath(fallbackPath);
    const timeout = window.setTimeout(() => {
      if (!active) return;
      applyFallback();
      setIsLoadingRoute(false);
      controller.abort();
    }, 15000);

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${EMPRESA_COORDS[1]},${EMPRESA_COORDS[0]};${longitude},${latitude}?overview=full&geometries=geojson`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Rota não encontrada");
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const route = data?.routes?.[0];
        if (!route?.geometry?.coordinates?.length) {
          throw new Error("Rota não encontrada");
        }

        const result = buildRouteWithFinalAccess(
          route.geometry.coordinates,
          Number(route.distance),
          destination,
        );
        setRoadPath(result.roadPath);
        setAccessPath(result.accessPath);
        setRoadDistanceKm(result.roadDistanceKm);
        setAccessDistanceKm(result.accessDistanceKm);
        setTotalDistanceKm(result.totalDistanceKm);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        applyFallback();
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setIsLoadingRoute(false);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [visit]);

  const mapPoints = useMemo(
    () => [...roadPath, ...accessPath],
    [roadPath, accessPath],
  );

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6fb] px-5">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#12447d]" />
          <p className="text-sm font-bold text-slate-600">Carregando localização...</p>
        </div>
      </main>
    );
  }

  if (pageError || !visit) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6fb] px-5">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <img src="/logo.png" alt="Beauvallet" className="mx-auto h-20 w-auto object-contain" />
          <AlertTriangle className="mx-auto mt-6 h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-black text-slate-800">Localização indisponível</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{pageError}</p>
          <p className="mt-5 text-xs font-semibold text-slate-400">
            Solicite um novo link ao responsável pela visita.
          </p>
        </section>
      </main>
    );
  }

  const latitude = Number(visit.GPS_LATITUDE);
  const longitude = Number(visit.GPS_LONGITUDE);
  const destination: [number, number] = [latitude, longitude];
  const locationSource = visit.ORIGEM_LOCALIZACAO || "VISITA";
  const lastVisitDate = visit.DATA_ULTIMA_VISITA || null;
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0,_#f8fafc_42%,_#eef2f7_100%)] px-3 py-4 sm:px-6 sm:py-7">
      <section className="mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,50,90,0.18)]">
        <header className="relative overflow-hidden bg-[#123f73] px-5 py-5 text-white sm:px-8 sm:py-6">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[34px] border-white/5" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-lg sm:h-24 sm:w-36">
                <img src="/logo.png" alt="Beauvallet" className="max-h-full max-w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
                  Rota compartilhada
                </p>
                <h1 className="mt-1 text-xl font-black leading-tight sm:text-3xl">
                  Localização da propriedade
                </h1>
                <p className="mt-1 text-sm font-semibold text-blue-100">
                  Saída da sede Beauvallet até a propriedade
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Origem da localização</p>
              <p className="mt-1 text-sm font-bold">
                {locationSource === "ERP" ? "Cadastro do ERP" : "GPS coletado em visita"}
              </p>
              {locationSource === "VISITA" && (
                <p className="mt-0.5 text-[10px] font-semibold text-blue-100">
                  {formatVisitDate(visit.DATA_VISITA_REFERENCIA || visit.DATA_REGISTRO_VISITA)}
                </p>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-7">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Destino</p>
                  <p className="mt-1 truncate text-base font-black uppercase text-slate-800">
                    {visit.NOME_FAZENDA || "Propriedade"}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold uppercase text-slate-500">
                    {visit.NOME_PRODUTOR || "Produtor"}
                    {visit.MUNICIPIO ? ` • ${visit.MUNICIPIO}` : ""}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                      locationSource === "ERP"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {locationSource === "ERP"
                      ? "Localização do ERP"
                      : "Localização da visita"}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 ${
                lastVisitDate
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div
                className={`flex items-center gap-2 ${
                  lastVisitDate ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {lastVisitDate ? (
                  <CalendarCheck2 className="h-4 w-4" />
                ) : (
                  <CalendarX2 className="h-4 w-4" />
                )}
                <p className="text-[10px] font-black uppercase tracking-wider">Situação da visita</p>
              </div>
              <p
                className={`mt-2 text-sm font-black ${
                  lastVisitDate ? "text-emerald-900" : "text-amber-900"
                }`}
              >
                {lastVisitDate ? "Visita realizada" : "Nenhuma visita registrada"}
              </p>
              {lastVisitDate && (
                <p className="mt-1 text-[10px] font-bold text-emerald-700">
                  Última visita: {formatVisitDate(lastVisitDate)}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Latitude</p>
              <p className="mt-2 font-mono text-sm font-black text-slate-800">
                {latitude.toFixed(6)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Longitude</p>
              <p className="mt-2 font-mono text-sm font-black text-slate-800">
                {longitude.toFixed(6)}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Route className="h-4 w-4" />
                <p className="text-[10px] font-black uppercase tracking-wider">Distância calculada</p>
              </div>
              <p className="mt-2 text-2xl font-black text-blue-900">
                {isLoadingRoute || totalDistanceKm === null
                  ? "Calculando..."
                  : `${totalDistanceKm.toFixed(1)} km`}
              </p>
              {!isLoadingRoute && roadDistanceKm !== null && (
                <p className="mt-1 text-[10px] font-bold text-blue-600">
                  {roadDistanceKm.toFixed(1)} km por estrada
                  {accessDistanceKm && accessDistanceKm > 0.01
                    ? ` + ${accessDistanceKm.toFixed(1)} km de acesso`
                    : ""}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <Navigation className="h-4 w-4" />
                <p className="text-[10px] font-black uppercase tracking-wider">
                  {locationSource === "ERP" ? "KM cadastrado" : "KM registrado"}
                </p>
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-900">
                {visit.DISTANCIA_PERCORRIDA_REAL === null
                  ? "Não informado"
                  : `${Number(visit.DISTANCIA_PERCORRIDA_REAL).toFixed(1)} km`}
              </p>
            </div>
          </div>

          {routeFallback && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              A rota por estrada não ficou disponível. O mapa está mostrando uma estimativa em linha reta até o GPS.
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123f73] px-6 text-sm font-black text-white shadow-lg transition hover:bg-[#0d315a] sm:w-auto"
              onClick={() => setNavigationOpen(true)}
            >
              <Navigation className="h-5 w-5" />
              Ir agora
            </button>
          </div>

          <div className="relative mt-4 h-[54vh] min-h-[390px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
            <MapContainer
              center={EMPRESA_COORDS}
              zoom={7}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBounds points={mapPoints.length > 1 ? mapPoints : [EMPRESA_COORDS, destination]} />
              {roadPath.length > 1 && (
                <Polyline positions={roadPath} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }} />
              )}
              {accessPath.length > 1 && (
                <Polyline
                  positions={accessPath}
                  pathOptions={{ color: "#f97316", weight: 4, opacity: 0.9, dashArray: "10 9" }}
                />
              )}
              <CircleMarker
                center={EMPRESA_COORDS}
                radius={8}
                pathOptions={{ color: "#7f1d1d", fillColor: "#dc2626", fillOpacity: 1, weight: 2 }}
              >
                <Tooltip permanent direction="top" offset={[0, -8]}>Sede Beauvallet</Tooltip>
              </CircleMarker>
              <CircleMarker
                center={destination}
                radius={9}
                pathOptions={{ color: "#1e3a8a", fillColor: "#2563eb", fillOpacity: 1, weight: 3 }}
              >
                <Tooltip permanent direction="top" offset={[0, -9]}>Local da visita</Tooltip>
              </CircleMarker>
            </MapContainer>

            {isLoadingRoute && (
              <div className="absolute inset-x-0 top-3 z-[500] mx-auto flex w-fit items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-blue-800 shadow-lg backdrop-blur">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando rota por estrada...
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[11px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-2"><i className="h-1 w-8 rounded-full bg-blue-600" /> Rota por estrada</span>
            <span className="inline-flex items-center gap-2"><i className="w-8 border-t-2 border-dashed border-orange-500" /> Acesso final ao GPS</span>
            <span className="ml-auto">Use os botões +/− ou a roda do mouse para aproximar o mapa.</span>
          </div>
        </div>
      </section>

      {navigationOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Escolher aplicativo de navegação"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNavigationOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-600">Ir agora</p>
                <h2 className="mt-1 text-xl font-black text-slate-800">Escolha o aplicativo</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  A rota será aberta até o GPS da propriedade.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                onClick={() => setNavigationOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                className="flex h-14 items-center justify-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-800 transition hover:bg-blue-100"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                  setNavigationOpen(false);
                }}
              >
                <MapPin className="h-5 w-5" />
                Google Maps
              </button>
              <button
                type="button"
                className="flex h-14 items-center justify-start gap-3 rounded-xl bg-[#1b67aa] px-4 text-sm font-black text-white transition hover:bg-[#14558e]"
                onClick={() => {
                  window.open(
                    `https://www.waze.com/ul?ll=${latitude},${longitude}&navigate=yes`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                  setNavigationOpen(false);
                }}
              >
                <Navigation className="h-5 w-5" />
                Waze
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
