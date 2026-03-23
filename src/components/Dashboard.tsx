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
  TrendingUp,
  Loader2
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

  // --- ESTADOS PARA DEBUG DE GEOLOCALIZAÇÃO ---
  const [geoDebugLog, setGeoDebugLog] = useState<string>("Aguardando ação...\nClique no botão acima para iniciar o teste de GPS.");
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const totalRanchers = mapData.reduce((a, s) => a + s.ranchersCount, 0);
  const totalHeads = mapData.reduce((a, s) => a + s.ranchersList.reduce((sum, r) => sum + r.headCount, 0), 0);

  // --- FUNÇÃO DE DEBUG DO GPS ---
  const handleGetLocation = () => {
    setIsLocating(true);
    setGeoDebugLog("Iniciando requisição de GPS...\nVerificando suporte do navegador...");

    if (!navigator.geolocation) {
      setGeoDebugLog(prev => prev + "\n[ERRO FATAL] O seu navegador NÃO suporta a API de Geolocalização (navigator.geolocation é undefined).");
      setIsLocating(false);
      return;
    }

    setGeoDebugLog(prev => prev + "\n[OK] Navegador suporta GPS.\nSolicitando permissão ao usuário e buscando satélites/antenas...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, altitude, speed } = position.coords;
        const successMsg = `
[SUCESSO] Localização capturada!
-----------------------------------
Latitude:  ${latitude}
Longitude: ${longitude}
Precisão:  ${accuracy} metros (Quanto menor, melhor)
Altitude:  ${altitude ? altitude + ' m' : 'Não disponível'}
Velocidade:${speed ? speed + ' m/s' : 'Não disponível'}
Timestamp: ${new Date(position.timestamp).toLocaleString()}
-----------------------------------
Copie essas coordenadas e jogue no Google Maps para conferir se está certo.
`;
        setGeoDebugLog(prev => prev + successMsg);
        setIsLocating(false);
      },
      (error) => {
        let errorReason = "";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorReason = "Usuário NEGOU a permissão de localização. Verifique o cadeadinho na barra de endereço ou as permissões do celular.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorReason = "Informação de localização INDISPONÍVEL. O celular/PC não conseguiu contato com o GPS ou torres de celular.";
            break;
          case error.TIMEOUT:
            errorReason = "TIMEOUT. A requisição demorou demais para responder (mais de 15 segundos).";
            break;
          default:
            errorReason = "Erro desconhecido.";
            break;
        }
        
        const errorMsg = `
[ERRO] Falha ao capturar localização!
-----------------------------------
Código:  ${error.code}
Motivo:  ${errorReason}
Msg API: ${error.message}
-----------------------------------
`;
        setGeoDebugLog(prev => prev + errorMsg);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true, // Força o uso do GPS real do celular (mais demorado, mais preciso)
        timeout: 15000,           // 15 segundos de limite para achar o sinal
        maximumAge: 0             // Não aceita localização velha em cache
      }
    );
  };

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

      {/* --- BLOCO DE TESTE DE GEOLOCALIZAÇÃO --- */}
      <Card className="bg-slate-50 border-dashed border-2 border-slate-300">
        <CardHeader className="pb-2 border-b border-slate-200/60 mb-4">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-700 uppercase">
            <MapPin className="w-4 h-4 text-blue-600" /> Ferramenta de Debug de Geolocalização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleGetLocation} 
            disabled={isLocating}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {isLocating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Navigation className="w-4 h-4 mr-2" />}
            PEGAR GEOLOCALIZAÇÃO REAL
          </Button>
          
          <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm whitespace-pre-wrap overflow-x-auto min-h-[150px] shadow-inner">
            {geoDebugLog}
          </div>
        </CardContent>
      </Card>
      {/* -------------------------------------- */}

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