import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Building2, MapPin, Clock } from "lucide-react";
import { api, type DashboardStats, type Visit } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getRecentVisits()]).then(([s, v]) => {
      setStats(s);
      setVisits(v);
      setLoading(false);
    });
  }, []);

  const totalRanchers = stats.reduce((a, s) => a + s.ranchers, 0);
  const totalCities = stats.reduce((a, s) => a + s.cities, 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-border pb-6 gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-primary">
            Originação de Gado
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consolidado Regional — Estado de Goiás
          </p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
            Live Data
          </span>
          <p className="text-xs text-muted-foreground tabular-nums">
            Atualizado: {new Date().toLocaleTimeString("pt-BR")}
          </p>
        </div>
      </header>

      {/* Summary bar */}
      <div className="flex gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground tabular-nums">{totalRanchers}</span> pecuaristas
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" />
          <span className="font-semibold text-foreground tabular-nums">{totalCities}</span> cidades
        </div>
      </div>

      {/* Region Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card
              key={s.region}
              className="border-l-4 border-l-primary hover:shadow-md transition-shadow duration-150"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {s.region}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {s.ranchers}
                    </span>
                    <p className="text-[10px] text-muted-foreground uppercase mt-0.5">
                      Pecuaristas
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold tabular-nums text-accent">
                      {s.cities}
                    </span>
                    <p className="text-[10px] text-muted-foreground uppercase mt-0.5">
                      Cidades
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Visits Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Últimas Visitas de Campo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-surface hover:bg-surface">
                  <TableHead className="text-xs font-semibold">Data</TableHead>
                  <TableHead className="text-xs font-semibold">Propriedade</TableHead>
                  <TableHead className="text-xs font-semibold hidden sm:table-cell">
                    Proprietário
                  </TableHead>
                  <TableHead className="text-xs font-semibold hidden md:table-cell">
                    Município
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium tabular-nums text-sm">
                      {new Date(v.date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{v.ranchName}</TableCell>
                    <TableCell className="text-sm hidden sm:table-cell">{v.owner}</TableCell>
                    <TableCell className="text-sm hidden md:table-cell">{v.city}</TableCell>
                    <TableCell className="text-right">
                      {v.status === "completed" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          Sincronizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          Pendente
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
