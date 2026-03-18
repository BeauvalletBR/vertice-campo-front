import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Building2, 
  MapPin, 
  X, 
  Clock, 
  Maximize2, 
  Map as MapIcon, 
  Navigation, 
  TrendingUp 
} from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Tipagens
type Rancher = { id: string; name: string; farm: string; headCount: number };
type CityData = { city: string; lat: number; lng: number; ranchersCount: number; ranchersList: Rancher[] };

const mapData: CityData[] = [
  { city: "Goiânia", lat: -16.6868, lng: -49.2643, ranchersCount: 15, ranchersList: [{ id: "1", name: "João Batista", farm: "Fazenda Esperança", headCount: 450 }] },
  { city: "Rio Verde", lat: -17.7892, lng: -50.9258, ranchersCount: 120, ranchersList: [{ id: "3", name: "Carlos Mendes", farm: "Fazenda Boa Vista", headCount: 1500 }] },
  { city: "Jussara", lat: -15.8653, lng: -50.8669, ranchersCount: 85, ranchersList: [{ id: "7", name: "Paulo Lima", farm: "Confinamento Jussara", headCount: 2100 }] },
  { city: "Porangatu", lat: -13.4411, lng: -49.1489, ranchersCount: 85, ranchersList: [{ id: "5", name: "Pedro Henrique", farm: "Estância Norte", headCount: 800 }] },
  { city: "Cristalina", lat: -16.7686, lng: -47.6136, ranchersCount: 40, ranchersList: [{ id: "6", name: "Lucas Fernandes", farm: "Fazenda Cristal", headCount: 600 }] },
];

function MapController({ selectedCity }: { selectedCity: CityData | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedCity) map.flyTo([selectedCity.lat, selectedCity.lng], 11, { duration: 1.5 });
    else map.flyTo([-15.933, -50.14], 6, { duration: 1.5 });
  }, [selectedCity, map]);
  return null;
}

function MetricCard({ title, value, icon, sub }: { title: string, value: string, icon: React.ReactNode, sub: string }) {
  return (
    <Card className="border-none shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">+12%</span>
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

  const totalRanchers = mapData.reduce((a, s) => a + s.ranchersCount, 0);
  const totalHeads = mapData.reduce((a, s) => a + s.ranchersList.reduce((sum, r) => sum + r.headCount, 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Estratégico</h1>
          <p className="text-muted-foreground text-sm">Visão geral de originação e mercado em Goiás</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedCity(null)}>Resetar Mapa</Button>
          <Button size="sm" className="bg-primary shadow-md" onClick={() => setIsMapExpanded(true)}>
            <Maximize2 className="w-4 h-4 mr-2" /> Tela Cheia
          </Button>
        </div>
      </header>

      {/* MÉTRICAS DE BI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Gado Prospectado" value={totalHeads.toLocaleString()} icon={<TrendingUp className="text-blue-600" />} sub="Cabeças nos últimos 30 dias" />
        <MetricCard title="Visitas Realizadas" value="48" icon={<Navigation className="text-indigo-600" />} sub="Média de 1.6 visitas/dia" />
        <MetricCard title="Novos Pecuaristas" value="14" icon={<Users className="text-emerald-600" />} sub="Cadastros pendentes Datavale" />
        <MetricCard title="Cidades Cobertas" value={mapData.length.toString()} icon={<Building2 className="text-amber-600" />} sub="Presença em 12 microrregiões" />
      </div>

      {/* MAPA PRINCIPAL */}
      <Card className="overflow-hidden border-none shadow-md">
        <CardHeader className="bg-white border-b pb-4">
          <CardTitle className="text-lg">Mapa de Densidade de Compra</CardTitle>
          <CardDescription>Distribuição geográfica e potencial de abate por região</CardDescription>
        </CardHeader>
        <CardContent className="p-0 relative">
          <div className="h-[500px] w-full z-0">
            <MapContainer center={[-15.933, -50.14]} zoom={6} className="h-full w-full">
              <MapController selectedCity={selectedCity} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {mapData.map((city, idx) => (
                <CircleMarker key={idx} center={[city.lat, city.lng]} radius={12} fillColor="#1d4ed8" color="#1e3a8a" fillOpacity={0.6} eventHandlers={{ click: () => setSelectedCity(city) }}>
                  <Tooltip>{city.city}: {city.ranchersCount} pecuaristas</Tooltip>
                  <Popup>
                    <div className="p-2 min-w-[180px]">
                      <h4 className="font-bold border-b mb-2">{city.city}</h4>
                      {city.ranchersList.map(r => (
                        <div key={r.id} className="text-xs mb-1">
                          <p className="font-semibold">{r.name}</p>
                          <p className="text-slate-500">{r.farm} • {r.headCount} cab.</p>
                        </div>
                      ))}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}