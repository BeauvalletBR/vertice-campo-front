import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Building2, 
  Maximize2, 
  Navigation, 
  TrendingUp,
  Loader2,
  X,
  Clock,
  MapPin,
  User
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { api, type ApiVisita, type ApiUsuario } from "@/services/api";

type Rancher = { id: string; name: string; farm: string; headCount: number };
type CityData = { city: string; lat: number; lng: number; ranchersCount: number; ranchersList: Rancher[] };

function MapController({ selectedCity }: { selectedCity: CityData | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedCity) map.flyTo([selectedCity.lat, selectedCity.lng], 11, { duration: 1.5 });
    else map.flyTo([-15.933, -50.14], 6, { duration: 1.5 });
  }, [selectedCity, map]);
  return null;
}

function MetricCard({ title, value, icon, sub }: { title: string, value: string | number, icon: React.ReactNode, sub: string }) {
  return (
    <Card className="border-none shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
        </div>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
          <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  
  const [visitas, setVisitas] = useState<ApiVisita[]>([]);
  const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const carregarDados = async () => {
      setIsLoading(true);
      try {
        const [dadosVisitas, dadosUsuarios] = await Promise.all([
          api.getVisitasConsulta(),
          api.getUsuarios()
        ]);
        setVisitas(dadosVisitas);
        setUsuariosData(dadosUsuarios);
      } catch (error) {
        console.error("Erro ao carregar visitas para o Dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    carregarDados();
  }, []);

  const getNomeComprador = (id?: number) => {
    if (!id) return "NÃO DEFINIDO";
    const usuario = usuariosData.find(u => Number(u.SEQUSUARIO) === Number(id));
    return usuario ? usuario.CODUSUARIO : `ID: ${id}`;
  };

  const { mapData, kpis } = useMemo(() => {
    let totalHeads = 0;
    let novosPecuaristas = 0;
    const cidadesSet = new Set<string>();
    const citiesMap = new Map<string, CityData>();

    visitas.forEach(v => {
    
      const cabecas = Number(v.EFETIVO_TOTAL_ANIMAIS) || 0;
      totalHeads += cabecas;
      
      if (!v.COD_PRODUTOR) {
        novosPecuaristas += 1;
      }

      if (v.MUNICIPIO) {
        cidadesSet.add(v.MUNICIPIO.toUpperCase());
      }

      if (v.GPS_LATITUDE && v.GPS_LONGITUDE) {
        const city = (v.MUNICIPIO || "Não Informado").toUpperCase();
        
        if (!citiesMap.has(city)) {
          citiesMap.set(city, { 
            city, 
            lat: v.GPS_LATITUDE, 
            lng: v.GPS_LONGITUDE, 
            ranchersCount: 0, 
            ranchersList: [] 
          });
        }
        
        const cityData = citiesMap.get(city)!;
        cityData.ranchersCount += 1;
        cityData.ranchersList.push({
          id: String(v.ID_VISITA),
          name: v.NOME_PRODUTOR || "Sem Nome",
          farm: v.NOME_FAZENDA || "Sem Fazenda",
          headCount: cabecas
        });
      }
    });

    return {
      mapData: Array.from(citiesMap.values()),
      kpis: {
        totalHeads,
        totalVisitas: visitas.length,
        novosPecuaristas,
        cidadesCobertas: cidadesSet.size
      }
    };
  }, [visitas]);

  const ultimasVisitas = useMemo(() => {
    return [...visitas]
      .sort((a, b) => b.ID_VISITA - a.ID_VISITA) // Maior ID = Mais recente
      .slice(0, 5);
  }, [visitas]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Estratégico</h1>
          <p className="text-muted-foreground text-sm">Visão geral de originação baseada em dados em tempo real</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedCity(null)}>Resetar Mapa</Button>
          <Button size="sm" className="bg-primary shadow-md" onClick={() => setIsMapExpanded(!isMapExpanded)}>
            <Maximize2 className="w-4 h-4 mr-2" /> {isMapExpanded ? "Reduzir" : "Tela Cheia"}
          </Button>
        </div>
      </header>

      {/* MÉTRICAS DE BI (Com loading) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
             <Card key={i} className="h-[140px] flex items-center justify-center border-none shadow-sm"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></Card>
          ))
        ) : (
          <>
            <MetricCard title="Gado Prospectado" value={kpis.totalHeads.toLocaleString('pt-BR')} icon={<TrendingUp className="text-blue-600" />} sub="Efetivo total registrado em visitas" />
            <MetricCard title="Visitas Realizadas" value={kpis.totalVisitas} icon={<Navigation className="text-indigo-600" />} sub="Total de registros no banco" />
            <MetricCard title="Novos Pecuaristas" value={kpis.novosPecuaristas} icon={<Users className="text-emerald-600" />} sub="Visitas sem cadastro prévio no ERP" />
            <MetricCard title="Cidades Cobertas" value={kpis.cidadesCobertas} icon={<Building2 className="text-amber-600" />} sub="Abrangência geográfica real" />
          </>
        )}
      </div>

      {/* MAPA PRINCIPAL COM DADOS REAIS */}
      <Card className={`overflow-hidden border-none shadow-md transition-all duration-300 ${isMapExpanded ? 'fixed inset-4 z-[200] flex flex-col' : ''}`}>
        <CardHeader className="bg-white border-b pb-4 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">Mapa de Densidade de Compra</CardTitle>
              <CardDescription>Distribuição geográfica e potencial baseados no GPS das visitas</CardDescription>
            </div>
            {isMapExpanded && (
              <Button variant="ghost" size="icon" onClick={() => setIsMapExpanded(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 relative flex-1">
          {isLoading ? (
             <div className="h-[500px] flex flex-col items-center justify-center bg-slate-50">
               <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
               <p className="text-slate-500 font-medium">Buscando geolocalizações reais no servidor...</p>
             </div>
          ) : (
            <div className={`w-full z-0 ${isMapExpanded ? 'h-full min-h-[600px]' : 'h-[500px]'}`}>
              <MapContainer center={[-15.933, -50.14]} zoom={6} className="h-full w-full">
                <MapController selectedCity={selectedCity} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {mapData.map((city, idx) => (
                  <CircleMarker 
                    key={idx} 
                    center={[city.lat, city.lng]} 
                    radius={Math.min(25, 8 + (city.ranchersCount * 2))} 
                    fillColor="#1d4ed8" 
                    color="#1e3a8a" 
                    fillOpacity={0.6} 
                    eventHandlers={{ click: () => setSelectedCity(city) }}
                  >
                    <Tooltip>{city.city}: {city.ranchersCount} pecuarista(s)</Tooltip>
                    <Popup>
                      <div className="p-2 min-w-[200px] max-h-[250px] overflow-y-auto">
                        <h4 className="font-bold border-b mb-2 sticky top-0 bg-white text-slate-800">{city.city}</h4>
                        {city.ranchersList.map(r => (
                          <div key={r.id} className="text-xs mb-2 border-b border-slate-100 pb-2 last:border-0">
                            <p className="font-bold text-slate-800 uppercase">{r.name}</p>
                            <p className="text-slate-500">{r.farm}</p>
                            <p className="text-blue-600 font-bold mt-0.5">{r.headCount} cabeças de efetivo</p>
                          </div>
                        ))}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 👇 NOVA TABELA: AS ÚLTIMAS 5 VISITAS 👇 */}
      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="bg-white border-b pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
            <Clock className="w-5 h-5 text-primary" />
            Últimas 5 Visitas Realizadas
          </CardTitle>
          <CardDescription>Monitoramento em tempo real da equipe de campo</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-xs whitespace-nowrap text-slate-500 uppercase">Data</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap text-slate-500 uppercase">Pecuarista / Fazenda</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap text-slate-500 uppercase">Local</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap text-slate-500 uppercase">Comprador</TableHead>
                  <TableHead className="font-semibold text-xs text-right whitespace-nowrap text-slate-500 uppercase">Distância (GPS vs ERP)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : ultimasVisitas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500 font-medium">Nenhuma visita registrada ainda.</TableCell>
                  </TableRow>
                ) : (
                  ultimasVisitas.map((v) => {
                    const distReal = v.DISTANCIA_PERCORRIDA_REAL ? Number(v.DISTANCIA_PERCORRIDA_REAL).toFixed(1) + ' km' : '--';
                    // Tratando a distância cadastrada (usamos "any" caso a tipagem do TypeScript reclame da nova coluna da View)
                    const distCad = (v as any).DISTANCIA_CADASTRADA ? Number((v as any).DISTANCIA_CADASTRADA).toFixed(1) + ' km' : '--';
                    
                    return (
                      <TableRow key={v.ID_VISITA} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-medium text-xs text-slate-600 whitespace-nowrap">
                          {v.DATA_REGISTRO_VISITA ? new Date(v.DATA_REGISTRO_VISITA.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') : '--'}
                        </TableCell>
                        <TableCell>
                          <p className="font-bold text-sm text-slate-800 uppercase">{v.NOME_PRODUTOR || 'NÃO CADASTRADO'}</p>
                          <p className="text-xs text-slate-500 uppercase">{v.NOME_FAZENDA || 'Fazenda não informada'}</p>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-xs text-slate-600 font-bold uppercase">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {v.MUNICIPIO || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {getNomeComprador(v.ID_COMPRADOR)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded shadow-sm" title="Distância coletada pelo GPS do celular">
                              GPS: {distReal}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase" title="Distância cadastrada na Datavale">
                              ERP: {distCad}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}