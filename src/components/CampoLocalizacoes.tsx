import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  MapPin,
  MapPinOff,
  Navigation,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  api,
  fetchPecuaristasAgendamento,
  type ApiCampoLocalizacao,
} from "@/services/api";
import {
  buildRouteWithFinalAccess,
  calculateStraightLineDistanceKm,
} from "@/lib/geo-distance";

const PAGE_SIZE = 15;
const EMPRESA_COORDS: [number, number] = [-16.3419669, -49.4708347];

type LocationFilter = "TODOS" | "COM_LOCALIZACAO" | "SEM_LOCALIZACAO";
type SearchField = "TODOS" | "COD_PRODUTOR" | "NOME_PRODUTOR" | "NOME_FAZENDA";
type SortColumn =
  | "PRODUTOR"
  | "MUNICIPIO"
  | "DISTANCIA_REAL"
  | "DISTANCIA_CADASTRADA"
  | "LOCALIZACAO";
type SortDirection = "asc" | "desc";
type DistanceState = {
  status: "loading" | "ready" | "error";
  value?: number;
  fallback?: boolean;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const locationKey = (row: ApiCampoLocalizacao) =>
  `${row.COD_PRODUTOR}-${row.INSCRICAO || row.NOME_FAZENDA}`;

const hasCoordinates = (row: ApiCampoLocalizacao) =>
  row.LATITUDE != null &&
  row.LONGITUDE != null &&
  Number.isFinite(Number(row.LATITUDE)) &&
  Number.isFinite(Number(row.LONGITUDE));

const formatKm = (value: number | null | undefined) =>
  value == null || !Number.isFinite(Number(value))
    ? "—"
    : `${Number(value).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} km`;

const toCoordinate = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateRouteDistance = async (latitude: number, longitude: number) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${EMPRESA_COORDS[1]},${EMPRESA_COORDS[0]};${longitude},${latitude}?overview=full&geometries=geojson`,
      { signal: controller.signal },
    );
    if (!response.ok) throw new Error("Rota não encontrada");
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error("Rota não encontrada");
    return {
      value: buildRouteWithFinalAccess(
        route.geometry.coordinates,
        Number(route.distance),
        [latitude, longitude],
      ).totalDistanceKm,
      fallback: false,
    };
  } catch {
    return {
      value: calculateStraightLineDistanceKm(
        EMPRESA_COORDS,
        [latitude, longitude],
      ),
      fallback: true,
    };
  } finally {
    window.clearTimeout(timeout);
  }
};

export function CampoLocalizacoes() {
  const [rows, setRows] = useState<ApiCampoLocalizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("TODOS");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("TODOS");
  const [page, setPage] = useState(1);
  const [navigationRow, setNavigationRow] = useState<ApiCampoLocalizacao | null>(null);
  const [creatingLink, setCreatingLink] = useState("");
  const [distances, setDistances] = useState<Record<string, DistanceState>>({});
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const load = async (forceRefresh = false) => {
    setLoading(true);
    setError("");
    setDistances({});
    try {
      const ranchers = await fetchPecuaristasAgendamento(forceRefresh);
      setRows(
        ranchers.map((rancher) => {
          const latitude = toCoordinate(rancher.LATITUDE);
          const longitude = toCoordinate(rancher.LONGITUDE);
          const validCoordinates =
            latitude != null &&
            longitude != null &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180 &&
            !(latitude === 0 && longitude === 0);

          return {
            COD_PRODUTOR: rancher.COD_PRODUTOR,
            NOME_PRODUTOR: rancher.NOME_PRODUTOR,
            NOME_FAZENDA: rancher.NOME_FAZENDA,
            INSCRICAO: rancher.INSCRICAO || null,
            MUNICIPIO: rancher.MUNICIPIO || null,
            UF_FAZENDA: rancher.UF_FAZENDA || null,
            DISTANCIA_CADASTRADA: rancher.DISTANCIA_CADASTRADA ?? null,
            DATA_ULTIMA_VISITA: rancher.DATA_ULTIMA_VISITA || null,
            LATITUDE_ERP: validCoordinates ? latitude : null,
            LONGITUDE_ERP: validCoordinates ? longitude : null,
            ID_VISITA_REFERENCIA: null,
            DATA_VISITA_REFERENCIA: null,
            LATITUDE_VISITA: null,
            LONGITUDE_VISITA: null,
            ORIGEM_LOCALIZACAO: validCoordinates ? "ERP" : "SEM_LOCALIZACAO",
            LATITUDE: validCoordinates ? latitude : null,
            LONGITUDE: validCoordinates ? longitude : null,
          } as ApiCampoLocalizacao;
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar os pecuaristas.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    const located = rows.filter(hasCoordinates).length;
    return { all: rows.length, located, missing: rows.length - located };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = normalize(search);

    return rows.filter((row) => {
      const located = hasCoordinates(row);
      if (locationFilter === "COM_LOCALIZACAO" && !located) return false;
      if (locationFilter === "SEM_LOCALIZACAO" && located) return false;
      if (!term) return true;

      const code = normalize(row.COD_PRODUTOR);
      const producer = normalize(row.NOME_PRODUTOR);
      const farm = normalize(row.NOME_FAZENDA);
      if (searchField === "COD_PRODUTOR") return code.includes(term);
      if (searchField === "NOME_PRODUTOR") return producer.includes(term);
      if (searchField === "NOME_FAZENDA") return farm.includes(term);
      return code.includes(term) || producer.includes(term) || farm.includes(term);
    });
  }, [locationFilter, rows, search, searchField]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;

    const getValue = (row: ApiCampoLocalizacao): string | number | null => {
      if (sortColumn === "PRODUTOR") {
        return normalize(`${row.NOME_PRODUTOR} ${row.NOME_FAZENDA}`);
      }
      if (sortColumn === "MUNICIPIO") return normalize(row.MUNICIPIO);
      if (sortColumn === "DISTANCIA_REAL") {
        return distances[locationKey(row)]?.value ?? null;
      }
      if (sortColumn === "DISTANCIA_CADASTRADA") {
        const value = Number(row.DISTANCIA_CADASTRADA);
        return Number.isFinite(value) ? value : null;
      }
      return hasCoordinates(row) ? 1 : 0;
    };

    return [...filteredRows].sort((rowA, rowB) => {
      const valueA = getValue(rowA);
      const valueB = getValue(rowB);
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;

      const comparison =
        typeof valueA === "number" && typeof valueB === "number"
          ? valueA - valueB
          : String(valueA).localeCompare(String(valueB), "pt-BR");
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [distances, filteredRows, sortColumn, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [locationFilter, search, searchField]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, sortedRows],
  );

  const handleSort = (column: SortColumn) => {
    setPage(1);
    if (sortColumn === column) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  };

  const sortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 opacity-45" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
    );
  };

  const calculateDistance = async (row: ApiCampoLocalizacao) => {
    if (!hasCoordinates(row)) return;
    const key = locationKey(row);
    setDistances((current) => ({
      ...current,
      [key]: { status: "loading" },
    }));
    try {
      const result = await calculateRouteDistance(
        Number(row.LATITUDE),
        Number(row.LONGITUDE),
      );
      setDistances((current) => ({
        ...current,
        [key]: {
          status: "ready",
          value: result.value,
          fallback: result.fallback,
        },
      }));
    } catch {
      setDistances((current) => ({
        ...current,
        [key]: { status: "error" },
      }));
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSearchField("TODOS");
    setLocationFilter("TODOS");
  };

  const openPublicReport = async (row: ApiCampoLocalizacao) => {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    const key = locationKey(row);
    setCreatingLink(key);
    try {
      const result = await api.criarLinkLocalizacaoCampo(row);
      const publicAppUrl = String(
        import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin,
      ).replace(/\/+$/, "");
      const url = `${publicAppUrl}/localizacao/visita/${result.token}`;
      if (popup) popup.location.replace(url);
      else window.location.assign(url);
    } catch (linkError) {
      popup?.close();
      toast.error(
        linkError instanceof Error
          ? linkError.message
          : "Não foi possível gerar o link público.",
      );
    } finally {
      setCreatingLink("");
    }
  };

  const openNavigation = (provider: "google" | "waze") => {
    if (!navigationRow || !hasCoordinates(navigationRow)) return;
    const coordinates = `${navigationRow.LATITUDE},${navigationRow.LONGITUDE}`;
    const url =
      provider === "google"
        ? `https://www.google.com/maps/dir/?api=1&destination=${coordinates}&travelmode=driving`
        : `https://www.waze.com/ul?ll=${coordinates}&navigate=yes`;
    window.open(url, "_blank", "noopener,noreferrer");
    setNavigationRow(null);
  };

  return (
    <div className="min-h-screen bg-[#f3f7fb] px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Campo</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Localização dos pecuaristas
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Dados de VERTICE.VCGV_PECUARISTA. A distância real considera a rota entre a sede
              Beauvallet e a latitude/longitude cadastrada no ERP.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["TODOS", "Todos os cadastros", totals.all, "border-blue-200 bg-blue-50 text-blue-900"],
            ["COM_LOCALIZACAO", "Com latitude e longitude", totals.located, "border-emerald-200 bg-emerald-50 text-emerald-900"],
            ["SEM_LOCALIZACAO", "Sem localização", totals.missing, "border-amber-200 bg-amber-50 text-amber-900"],
          ].map(([value, label, total, colors]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setLocationFilter(value as LocationFilter)}
              className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${colors} ${
                locationFilter === value ? "ring-2 ring-blue-500 ring-offset-2" : ""
              }`}
            >
              <span className="block text-[11px] font-black uppercase tracking-wider opacity-70">{label}</span>
              <strong className="mt-1 block text-2xl font-black tabular-nums">{total}</strong>
            </button>
          ))}
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[210px_minmax(280px,1fr)_auto]">
            <select
              value={searchField}
              onChange={(event) => setSearchField(event.target.value as SearchField)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-slate-700"
              aria-label="Pesquisar por"
            >
              <option value="TODOS">Código, produtor ou fazenda</option>
              <option value="COD_PRODUTOR">Código do produtor</option>
              <option value="NOME_PRODUTOR">Nome do produtor</option>
              <option value="NOME_FAZENDA">Nome da fazenda</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite para pesquisar..."
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center gap-3 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              Buscando dados...
            </div>
          ) : error ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 p-6 text-center">
              <MapPinOff className="h-10 w-10 text-rose-500" />
              <p className="font-semibold text-slate-800">{error}</p>
              <Button onClick={() => void load()}>Tentar novamente</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[1250px]">
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead>
                        <button type="button" className="flex w-full items-center gap-1.5 text-left font-bold hover:text-blue-700" onClick={() => handleSort("PRODUTOR")}>
                          Pecuarista / fazenda {sortIcon("PRODUTOR")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="flex w-full items-center gap-1.5 text-left font-bold hover:text-blue-700" onClick={() => handleSort("MUNICIPIO")}>
                          Município {sortIcon("MUNICIPIO")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="flex w-full items-center gap-1.5 text-left font-bold hover:text-blue-700" onClick={() => handleSort("DISTANCIA_REAL")}>
                          Distância real calculada {sortIcon("DISTANCIA_REAL")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="flex w-full items-center gap-1.5 text-left font-bold hover:text-blue-700" onClick={() => handleSort("DISTANCIA_CADASTRADA")}>
                          Distância cadastrada {sortIcon("DISTANCIA_CADASTRADA")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="flex w-full items-center gap-1.5 text-left font-bold hover:text-blue-700" onClick={() => handleSort("LOCALIZACAO")}>
                          Latitude / longitude {sortIcon("LOCALIZACAO")}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row) => {
                      const located = hasCoordinates(row);
                      const key = locationKey(row);
                      const distance = distances[key];
                      return (
                        <TableRow key={key} className="hover:bg-blue-50/40">
                          <TableCell className="max-w-[340px]">
                            <p className="font-extrabold text-slate-900">{row.NOME_PRODUTOR}</p>
                            <p className="truncate text-sm text-slate-600">{row.NOME_FAZENDA}</p>
                            <p className="mt-0.5 text-xs text-slate-400">Código {row.COD_PRODUTOR}{row.INSCRICAO ? ` • IE ${row.INSCRICAO}` : ""}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-slate-700">{row.MUNICIPIO || "Não informado"}</p>
                            <p className="text-xs text-slate-400">{row.UF_FAZENDA || ""}</p>
                          </TableCell>
                          <TableCell>
                            {!located ? (
                              <span className="text-slate-400">—</span>
                            ) : distance?.status === "loading" ? (
                              <span className="inline-flex items-center text-xs font-bold text-blue-600"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Calculando rota...</span>
                            ) : distance?.status === "ready" ? (
                              <div>
                                <strong className="text-sm text-blue-800">{formatKm(distance.value)}</strong>
                                {distance.fallback && <p className="text-[10px] font-semibold text-amber-600">Estimativa em linha reta</p>}
                              </div>
                            ) : distance?.status === "error" ? (
                              <Button size="sm" variant="outline" className="h-8 border-rose-200 text-xs text-rose-700" onClick={() => void calculateDistance(row)}>
                                Tentar novamente
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-8 text-xs font-bold text-blue-700" onClick={() => void calculateDistance(row)}>
                                Calcular rota
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-slate-700">{formatKm(row.DISTANCIA_CADASTRADA)}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-600">
                            {located ? (
                              `${Number(row.LATITUDE).toFixed(6)}, ${Number(row.LONGITUDE).toFixed(6)}`
                            ) : (
                              <span className="font-sans font-bold text-amber-700">Sem localização cadastrada</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" disabled={!located} onClick={() => setNavigationRow(row)}><Navigation className="mr-1.5 h-4 w-4" /> Maps / Waze</Button>
                              <Button size="sm" disabled={!located || creatingLink === key} onClick={() => void openPublicReport(row)}>
                                {creatingLink === key ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1.5 h-4 w-4" />}
                                Link público
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {visibleRows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-500">Nenhum cadastro encontrado com esses filtros.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 border-t bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>{filteredRows.length} cadastro(s) encontrado(s)</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <strong className="min-w-24 text-center text-slate-700">{currentPage} de {totalPages}</strong>
                  <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {navigationRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-600">Abrir rota</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{navigationRow.NOME_FAZENDA}</h2>
                <p className="mt-1 font-mono text-xs text-slate-500">{navigationRow.LATITUDE}, {navigationRow.LONGITUDE}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setNavigationRow(null)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button className="h-12 bg-blue-600 hover:bg-blue-700" onClick={() => openNavigation("google")}><MapPin className="mr-2 h-5 w-5" /> Google Maps</Button>
              <Button className="h-12 bg-cyan-600 hover:bg-cyan-700" onClick={() => openNavigation("waze")}><Navigation className="mr-2 h-5 w-5" /> Waze</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
