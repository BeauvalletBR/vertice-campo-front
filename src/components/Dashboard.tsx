import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Building2,
  Maximize2,
  Navigation,
  TrendingUp,
  Loader2,
  X,
  AlertTriangle,
  CalendarDays,
  Route,
  FileText,
  Download,
  ArrowUpDown,
  Filter
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
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

import { api, fetchPecuaristasAgendamento, type ApiVisita, type ApiUsuario, type ApiRancher, type ApiLote } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

type Rancher = { id: string; name: string; farm: string; headCount: number };
type CityData = { city: string; lat: number; lng: number; ranchersCount: number; ranchersList: Rancher[] };

// Estendendo o CheckinReport para suportar a lista de lotes da API
interface CheckinReport {
  id: string;
  nome: string;
  ie: string;
  propriedade: string;
  car: string;
  municipio: string;
  telefone: string;
  melhorDiaContato: string;
  proprietario: string;
  tipoVisita: string;
  nomeRecebedor: string;
  cargoRecebedor: string;
  frigorificoCostume: string;
  cabecasAbatidasAno: string;
  tipoVenda: string;
  atividade: string;
  habilitacao: string;
  terminacao: string;

  lotesDaApi: ApiLote[]; // <-- Novo Campo Adicionado

  numAnimais: string;
  data: string;
  visitante: string;
  produtorAssinatura: string;
  distancia: string;
  statusDatavale: "pendente" | "cadastrado";
}

function MapController({ selectedCity }: { selectedCity: CityData | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedCity) map.flyTo([selectedCity.lat, selectedCity.lng], 11, { duration: 1.5 });
    else map.flyTo([-15.933, -50.14], 6, { duration: 1.5 });
  }, [selectedCity, map]);
  return null;
}

function MetricCard({ title, value, icon, sub, colorClass }: { title: string, value: string | number, icon: React.ReactNode, sub: string, colorClass: string }) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${colorClass}`}>
            {icon}
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-bold text-slate-500 tracking-wide uppercase">{title}</p>
            <h3 className="text-4xl font-black text-slate-800 tracking-tight mt-1">{value}</h3>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-400">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const getDiffEmDias = (dataVisita: string, periodoOriginal: string | number) => {
  if (!dataVisita) return 0;
  const visitDate = new Date(dataVisita.split('T')[0] + 'T12:00:00');
  const diasSomar = Number(periodoOriginal);
  const dataAlvo = new Date(visitDate);
  dataAlvo.setDate(dataAlvo.getDate() + diasSomar);
  
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  
  const diffEmTempo = dataAlvo.getTime() - hoje.getTime();
  return Math.ceil(diffEmTempo / (1000 * 60 * 60 * 24));
};

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const temPermissaoAdmin = user?.modulos?.includes('ADMIN') || false;

  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateEnd, setDateEnd] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  
  // Agora armazenamos as visitas já com os Lotes preenchidos
  const [visitasBrutas, setVisitasBrutas] = useState<(ApiVisita & { lotesDaApi: ApiLote[] })[]>([]);
  
  const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]);
  const [pecuaristas, setPecuaristas] = useState<ApiRancher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [forecastModal, setForecastModal] = useState<{
    isOpen: boolean;
    periodo: 30 | 60 | 90;
    titulo: string;
  } | null>(null);
  
  const [forecastSortBy, setForecastSortBy] = useState<'qtd' | 'vencimento'>('vencimento');
  const [forecastSortOrder, setForecastSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedReport, setSelectedReport] = useState<CheckinReport | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const carregarDados = async () => {
      setIsLoading(true);
      try {
        const [dadosVisitas, dadosUsuarios, dadosPecuaristas] = await Promise.all([
          api.getVisitasConsulta(),
          api.getUsuarios(),
          temPermissaoAdmin ? fetchPecuaristasAgendamento() : Promise.resolve([])
        ]);
        
        // 👇 BUSCANDO OS LOTES DE CADA VISITA PARA O FORECAST FUNCIONAR 👇
        const visitasComLotes = await Promise.all(
          dadosVisitas.map(async (v) => {
            const lotes = await api.fetchLotesVisita(v.ID_VISITA);
            return { ...v, lotesDaApi: lotes };
          })
        );
        
        setVisitasBrutas(visitasComLotes);
        setUsuariosData(dadosUsuarios);
        setPecuaristas(dadosPecuaristas);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setIsLoading(false);
      }
    };
    carregarDados();
  }, [temPermissaoAdmin]);

  const visitas = useMemo(() => {
    if (!dateStart || !dateEnd) return visitasBrutas;
    return visitasBrutas.filter(v => {
      if (!v.DATA_REGISTRO_VISITA) return false;
      const vDate = v.DATA_REGISTRO_VISITA.split('T')[0];
      return vDate >= dateStart && vDate <= dateEnd;
    });
  }, [visitasBrutas, dateStart, dateEnd]);

  const getNomeComprador = (id?: number) => {
    if (!id) return "NÃO DEFINIDO";
    const usuario = usuariosData.find(u => Number(u.SEQUSUARIO) === Number(id));
    return usuario ? usuario.CODUSUARIO : `ID: ${id}`;
  };

  const mapVisitaToReport = (v: ApiVisita & { lotesDaApi: ApiLote[] }): CheckinReport => ({
    id: String(v.ID_VISITA),
    nome: v.NOME_PRODUTOR || "N/A", ie: v.INSCRICAO || "", propriedade: v.NOME_FAZENDA || "N/A",
    car: v.POSSUI_CAR || "N/A", municipio: v.MUNICIPIO || "N/A", telefone: v.TELEFONE || "",
    melhorDiaContato: v.MELHOR_DIA_CONTATO || "", proprietario: v.NOME_PRODUTOR || "N/A",
    tipoVisita: v.NATUREZA_VISITA || "", nomeRecebedor: v.NOME_RECEBEDOR || "", cargoRecebedor: v.CARGO_RECEBEDOR || "",
    frigorificoCostume: v.FRIGORIFICO_COSTUME || "", cabecasAbatidasAno: v.CABECAS_ABATIDAS_ANO ? String(v.CABECAS_ABATIDAS_ANO) : "",
    tipoVenda: v.TIPO_VENDA || "", atividade: v.TIPO_ATIVIDADE || "", habilitacao: v.HABILITACAO || "", terminacao: v.TIPO_TERMINACAO || "",
    
    lotesDaApi: v.lotesDaApi, // <-- Passando os lotes pro Relatório
    
    numAnimais: v.EFETIVO_TOTAL_ANIMAIS ? String(v.EFETIVO_TOTAL_ANIMAIS) : "",
    data: v.DATA_REGISTRO_VISITA ? v.DATA_REGISTRO_VISITA.split('T')[0] : "",
    visitante: getNomeComprador(v.ID_COMPRADOR), produtorAssinatura: v.ASSINATURA_DIGITAL || "",
    distancia: v.DISTANCIA_PERCORRIDA_REAL !== null ? `${Number(v.DISTANCIA_PERCORRIDA_REAL).toFixed(1)} km (Ida e Volta)` : "DISTÂNCIA NÃO COLETADA",
    statusDatavale: v.COD_PRODUTOR ? "cadastrado" : "pendente"
  });

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !selectedReport) return;
    try {
      setIsGeneratingPDF(true);
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Checkin_${selectedReport.nome.replace(/\s+/g, '_')}_${selectedReport.data}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar o PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const { mapData, kpis } = useMemo(() => {
    let totalHeads = 0; let novosPecuaristas = 0;
    const cidadesSet = new Set<string>(); const citiesMap = new Map<string, CityData>();

    visitas.forEach(v => {
      const cabecas = Number(v.EFETIVO_TOTAL_ANIMAIS) || 0;
      totalHeads += cabecas;
      
      if (v.NATUREZA_VISITA?.toUpperCase() === "PROSPECÇÃO") novosPecuaristas += 1;
      
      if (v.MUNICIPIO) cidadesSet.add(v.MUNICIPIO.toUpperCase());

      if (v.GPS_LATITUDE && v.GPS_LONGITUDE) {
        const city = (v.MUNICIPIO || "Não Informado").toUpperCase();
        if (!citiesMap.has(city)) citiesMap.set(city, { city, lat: v.GPS_LATITUDE, lng: v.GPS_LONGITUDE, ranchersCount: 0, ranchersList: [] });
        
        const cityData = citiesMap.get(city)!;
        cityData.ranchersCount += 1;
        cityData.ranchersList.push({ id: String(v.ID_VISITA), name: v.NOME_PRODUTOR || "Sem Nome", farm: v.NOME_FAZENDA || "Sem Fazenda", headCount: cabecas });
      }
    });

    return { mapData: Array.from(citiesMap.values()), kpis: { totalHeads, totalVisitas: visitas.length, novosPecuaristas, cidadesCobertas: cidadesSet.size } };
  }, [visitas]);

  // 👇 NOVA LÓGICA DO FORECAST BASEADO NOS LOTES DINÂMICOS 👇
  const { forecast, auditoriaFrete } = useMemo(() => {
    let f30 = 0, f60 = 0, f90 = 0;
    const alertasFrete: any[] = [];
    visitas.forEach(v => {
      // Varre todos os lotes cadastrados para a visita
      if (v.lotesDaApi && v.lotesDaApi.length > 0) {
        v.lotesDaApi.forEach(lote => {
          if (lote.status_lote !== 'DISPONIVEL' || !lote.quantidade_cabecas) return;
          
          const diff = getDiffEmDias(v.DATA_REGISTRO_VISITA, lote.prazo_dias);
          
          // Classifica nos 3 "baldes" de tempo baseados no diff em dias de hoje
          if (diff >= -7 && diff <= 30) f30 += Number(lote.quantidade_cabecas);
          else if (diff > 30 && diff <= 60) f60 += Number(lote.quantidade_cabecas);
          else if (diff > 60) f90 += Number(lote.quantidade_cabecas);
        });
      }

      // Validação de Frete (mantida igual)
      // Validação de Frete (Corrigida para bater com o Visitas.tsx)
      if (v.DISTANCIA_PERCORRIDA_REAL !== null && v.DISTANCIA_PERCORRIDA_REAL !== undefined) {
        
        // 1º Tenta pegar a distância que o ERP tinha no momento da visita (se existir na View)
        let distErp = v.DISTANCIAERP !== null && v.DISTANCIAERP !== undefined ? Number(v.DISTANCIAERP) : null;
        
        // 2º Se não tiver, busca do array de pecuaristas protegendo contra erro de tipo (String vs Number)
        if (distErp === null && v.COD_PRODUTOR) {
          const pecuaristaERP = pecuaristas.find(p => String(p.COD_PRODUTOR) === String(v.COD_PRODUTOR));
          if (pecuaristaERP && pecuaristaERP.DISTANCIA_CADASTRADA !== undefined && pecuaristaERP.DISTANCIA_CADASTRADA !== null) {
             distErp = Number(pecuaristaERP.DISTANCIA_CADASTRADA);
          }
        }
        if (distErp !== null) {
           // O valor do banco já é a distância total, então não multiplicamos por 2
           const distGpsIdaVolta = Number(v.DISTANCIA_PERCORRIDA_REAL);
           const divergencia = distErp - distGpsIdaVolta;
           if (divergencia > 3) {
             alertasFrete.push({ 
               id: v.ID_VISITA, 
               data: v.DATA_REGISTRO_VISITA, 
               produtor: v.NOME_PRODUTOR, 
               fazenda: v.NOME_FAZENDA, 
               erp: distErp, 
               gps: distGpsIdaVolta, 
               diff: divergencia 
             });
           }
        }
      }
    });

    return { forecast: { f30, f60, f90 }, auditoriaFrete: alertasFrete.sort((a,b) => b.diff - a.diff).slice(0, 15) };
  }, [visitas, pecuaristas]);

  const formatDiasFaltantes = (diffEmDias: number) => {
    if (diffEmDias < 0) return { text: `${diffEmDias} dias`, style: 'text-red-700 bg-red-100' };
    if (diffEmDias === 0) return { text: `Vence Hoje`, style: 'text-amber-700 bg-amber-100' };
    if (diffEmDias <= 7) return { text: `Em ${diffEmDias} dias`, style: 'text-amber-700 bg-amber-100' };
    return { text: `Faltam ${diffEmDias} dias`, style: 'text-emerald-700 bg-emerald-100' };
  };

  // 👇 LÓGICA DO MODAL DO FORECAST ATUALIZADA 👇
  const getDetalhesForecast = () => {
    if (!forecastModal) return [];
    const targetBucket = forecastModal.periodo;
    
    const filtrados = visitas.map(v => {
       let totalQtd = 0;
       let minDiff = Infinity;

       if (v.lotesDaApi && v.lotesDaApi.length > 0) {
         v.lotesDaApi.forEach(lote => {
           if (lote.status_lote !== 'DISPONIVEL' || !lote.quantidade_cabecas) return;
           const diff = getDiffEmDias(v.DATA_REGISTRO_VISITA, lote.prazo_dias);
           
           let belongsToThisBucket = false;
           if (targetBucket === 30 && diff >= -7 && diff <= 30) belongsToThisBucket = true;
           else if (targetBucket === 60 && diff > 30 && diff <= 60) belongsToThisBucket = true;
           else if (targetBucket === 90 && diff > 60) belongsToThisBucket = true;

           if (belongsToThisBucket) {
               totalQtd += Number(lote.quantidade_cabecas);
               if (diff < minDiff) minDiff = diff;
           }
         });
       }

       return { ...v, _computedQtd: totalQtd, _computedMinDiff: minDiff };
    }).filter(v => v._computedQtd > 0);

    filtrados.sort((a, b) => {
      if (forecastSortBy === 'qtd') {
         return forecastSortOrder === 'desc' ? b._computedQtd - a._computedQtd : a._computedQtd - b._computedQtd;
      } else {
         return forecastSortOrder === 'desc' ? b._computedMinDiff - a._computedMinDiff : a._computedMinDiff - b._computedMinDiff;
      }
    });

    return filtrados;
  };

  const handleSort = (column: 'qtd' | 'vencimento') => {
    if (forecastSortBy === column) {
      setForecastSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setForecastSortBy(column);
      setForecastSortOrder(column === 'vencimento' ? 'asc' : 'desc');
    }
  };

  const openForecastModal = (periodo: 30 | 60 | 90, titulo: string) => {
    setIsMapExpanded(false);
    setForecastSortBy('vencimento');
    setForecastSortOrder('asc');
    setForecastModal({ isOpen: true, periodo, titulo });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-8 animate-fade-in relative pb-24">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row justify-between md:items-start gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard Estratégico</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">Visão geral de originação baseada em dados em tempo real</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-end gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 font-bold mb-1 sm:mb-0">
              <Filter className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase tracking-wider">Filtro Temporal</span>
            </div>
            <div className="flex gap-3 items-center">
              <div className="flex flex-col">
                <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Início</Label>
                <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="h-9 text-xs font-bold bg-slate-50 border-slate-200" />
              </div>
              <div className="flex flex-col">
                <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Fim</Label>
                <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="h-9 text-xs font-bold bg-slate-50 border-slate-200" />
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="h-[140px] flex items-center justify-center border-none shadow-sm"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></Card>
            ))
          ) : (
            <>
              <MetricCard title="Gado Prospectado" value={kpis.totalHeads.toLocaleString('pt-BR')} icon={<TrendingUp className="w-7 h-7 text-blue-600" />} colorClass="bg-blue-50 text-blue-600" sub="Efetivo total registrado em visitas" />
              <MetricCard title="Visitas Realizadas" value={kpis.totalVisitas} icon={<Navigation className="w-7 h-7 text-indigo-600" />} colorClass="bg-indigo-50 text-indigo-600" sub="Total de registros no banco" />
              <MetricCard title="Novos Pecuaristas" value={kpis.novosPecuaristas} icon={<Users className="w-7 h-7 text-emerald-600" />} colorClass="bg-emerald-50 text-emerald-600" sub="Visitas com natureza de Prospecção" />
              <MetricCard title="Cidades Cobertas" value={kpis.cidadesCobertas} icon={<Building2 className="w-7 h-7 text-amber-600" />} colorClass="bg-amber-50 text-amber-600" sub="Abrangência geográfica real" />
            </>
          )}
        </div>

        <Card className={`overflow-hidden border-slate-200 shadow-sm transition-all duration-300 bg-white ${isMapExpanded ? 'fixed inset-4 z-[200] flex flex-col' : ''}`}>
          <CardHeader className="bg-white border-b pb-4 shrink-0 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">Mapa de Densidade de Compra</CardTitle>
              <CardDescription className="font-medium">Distribuição geográfica e potencial baseados no GPS das visitas</CardDescription>
            </div>
            <div className="flex gap-2">
              {!isMapExpanded && <Button variant="outline" size="sm" onClick={() => setSelectedCity(null)} className="font-bold text-slate-600">Resetar Mapa</Button>}
              <Button size="sm" variant={isMapExpanded ? "ghost" : "default"} onClick={() => setIsMapExpanded(!isMapExpanded)} className="font-bold">
                {isMapExpanded ? <X className="w-5 h-5 text-slate-500" /> : <><Maximize2 className="w-4 h-4 mr-2" /> Expandir Mapa</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 relative flex-1">
            {isLoading ? (
              <div className="h-[400px] flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              </div>
            ) : (
              <div className={`w-full z-0 ${isMapExpanded ? 'h-full min-h-[600px]' : 'h-[400px]'}`}>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <CalendarDays className="w-5 h-5 text-indigo-500" />
                Forecast de Abate (Fluxo Real)
              </CardTitle>
              <CardDescription className="font-medium">O gado move de janela automaticamente pelo tempo restante</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div 
                  className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
                  onClick={() => openForecastModal(30, 'Previsão para 30 Dias')}
                >
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">Em 30 Dias</p>
                    <p className="text-3xl font-black text-indigo-600 mt-1">{forecast.f30}</p>
                  </div>
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors">1M</div>
                </div>
                
                <div 
                  className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
                  onClick={() => openForecastModal(60, 'Previsão para 60 Dias')}
                >
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">Em 60 Dias</p>
                    <p className="text-3xl font-black text-indigo-500 mt-1">{forecast.f60}</p>
                  </div>
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 font-black group-hover:bg-indigo-500 group-hover:text-white transition-colors">2M</div>
                </div>
                
                <div 
                  className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:border-slate-400 hover:shadow-md transition-all group"
                  onClick={() => openForecastModal(90, 'Previsão para 90 Dias')}
                >
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-700 transition-colors">Em 90 Dias</p>
                    <p className="text-3xl font-black text-slate-700 mt-1">{forecast.f90}</p>
                  </div>
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 font-black group-hover:bg-slate-700 group-hover:text-white transition-colors">3M</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Route className="w-5 h-5 text-red-500" />
                Auditoria de Rota (Gargalo de Frete)
              </CardTitle>
              <CardDescription className="font-medium">Fazendas onde a empresa paga mais frete do que o real rodado (&gt; 3km)</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto">
              {temPermissaoAdmin ? (
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-xs text-slate-500 uppercase tracking-wider">Pecuarista</TableHead>
                      <TableHead className="font-bold text-xs text-right text-slate-500 uppercase tracking-wider" title="GPS * 2">GPS (Ida e Volta)</TableHead>
                      <TableHead className="font-bold text-xs text-right text-slate-500 uppercase tracking-wider">ERP</TableHead>
                      <TableHead className="font-bold text-xs text-right text-slate-500 uppercase tracking-wider">Divergência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></TableCell></TableRow>
                    ) : auditoriaFrete.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-500 font-medium">Nenhuma divergência de custo encontrada no período.</TableCell></TableRow>
                    ) : (
                      auditoriaFrete.map((alerta) => (
                        <TableRow key={alerta.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell>
                            <p className="font-bold text-xs text-slate-800 uppercase line-clamp-1">{alerta.produtor}</p>
                          </TableCell>
                          <TableCell className="text-right text-slate-600 font-bold whitespace-nowrap">{alerta.gps.toFixed(1)} km</TableCell>
                          <TableCell className="text-right text-slate-500 font-medium whitespace-nowrap">{alerta.erp.toFixed(1)} km</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive" className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 gap-1 rounded-md shadow-none font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              + {alerta.diff.toFixed(1)} km
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                 <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-6 text-center text-slate-400">
                    <AlertTriangle className="w-10 h-10 mb-3 opacity-20" />
                    <p className="font-bold text-sm">O Módulo de Auditoria é restrito para usuários Administradores.</p>
                 </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {forecastModal && forecastModal.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border-none">
            <CardHeader className="bg-white border-b shrink-0 flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-xl text-slate-800">{forecastModal.titulo}</CardTitle>
                <CardDescription>Detalhamento de pecuaristas com gado <span className="font-bold">DISPONÍVEL</span> neste período</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setForecastModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 bg-slate-50">
              <Table>
                <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="font-bold text-xs uppercase text-slate-500">Pecuarista</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-slate-500">Município / Contato</TableHead>
                    
                    <TableHead 
                      className={`font-bold text-xs uppercase text-center cursor-pointer transition-colors select-none ${forecastSortBy === 'qtd' ? 'text-primary bg-primary/5' : 'text-slate-500 hover:bg-slate-100'}`}
                      onClick={() => handleSort('qtd')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Cabeças
                        <ArrowUpDown className={`w-3.5 h-3.5 ${forecastSortBy === 'qtd' ? 'opacity-100' : 'opacity-30'}`} />
                      </div>
                    </TableHead>
                    
                    <TableHead 
                      className={`font-bold text-xs uppercase text-center cursor-pointer transition-colors select-none ${forecastSortBy === 'vencimento' ? 'text-primary bg-primary/5' : 'text-slate-500 hover:bg-slate-100'}`}
                      onClick={() => handleSort('vencimento')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Vencimento
                        <ArrowUpDown className={`w-3.5 h-3.5 ${forecastSortBy === 'vencimento' ? 'opacity-100' : 'opacity-30'}`} />
                      </div>
                    </TableHead>
                    
                    <TableHead className="font-bold text-xs uppercase text-slate-500 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getDetalhesForecast().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-slate-500 font-medium">Nenhum gado disponível para este período.</TableCell>
                    </TableRow>
                  ) : (
                    getDetalhesForecast().map((v: any) => {
                      const faltantes = formatDiasFaltantes(v._computedMinDiff);
                      
                      return (
                        <TableRow key={v.ID_VISITA} className="bg-white hover:bg-slate-50 transition-colors">
                          <TableCell>
                            <p className="font-bold text-sm text-slate-800 uppercase line-clamp-1">{v.NOME_PRODUTOR}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{v.NOME_FAZENDA}</p>
                          </TableCell>
                          
                          <TableCell>
                            <p className="text-xs text-slate-600 uppercase font-bold">{v.MUNICIPIO}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{v.TELEFONE || '--'}</p>
                          </TableCell>
                          
                          <TableCell className="text-center font-black text-indigo-600 text-sm bg-indigo-50/50">
                            {v._computedQtd}
                          </TableCell>
                          
                          <TableCell className="text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${faltantes.style}`}>
                              {faltantes.text}
                            </span>
                          </TableCell>
                          
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              className="text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                              onClick={() => setSelectedReport(mapVisitaToReport(v))}
                            >
                              <FileText className="w-3.5 h-3.5 mr-1.5" />
                              Ver Relatório
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =======================================================
          MODAL: RELATÓRIO DO CHECK-IN
          ======================================================= */}
      {selectedReport && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border-t-4 border-t-primary">
            
            <CardHeader className="border-b bg-slate-50 pb-4 shrink-0 rounded-t-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                    <FileText className="w-5 h-5" /> Relatório de Check-in (Visita)
                  </CardTitle>
                </div>
                <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </CardHeader>
            
            <CardContent className="overflow-y-auto p-0 bg-slate-50/50">
              <div ref={reportRef} className="p-8 space-y-6 bg-white">
                
                <div className="border-b-2 border-primary pb-4 mb-6 flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Ficha de Visita</h2>
                    <p className="text-sm text-slate-500 mt-1">Originação de Gado - Beauvallet</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-bold uppercase">Data da Visita</p>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedReport.data && selectedReport.data !== "-" ? new Date(selectedReport.data).toLocaleDateString("pt-BR") : "-"}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" /> Rota Calculada
                  </h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">Distância (Ida e Volta)</p>
                      <p className="font-bold text-primary text-lg">{selectedReport.distancia}</p>
                    </div>
                  </div>
                </div>

                {/* BLOCO A */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">A. Dados da Propriedade e Contato</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Pecuarista (Nome)</p><p className="font-bold text-slate-800 uppercase">{selectedReport.nome}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Natureza da Visita</p><p className="font-bold text-primary uppercase">{selectedReport.tipoVisita}</p></div>
                    
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Inscrição Estadual (I.E.)</p><p className="font-bold text-slate-800 font-mono uppercase">{selectedReport.ie || "Não informada"}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Possui CAR?</p><p className="font-bold text-slate-800 uppercase">{selectedReport.car}</p></div>

                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Propriedade</p><p className="font-bold text-slate-800 uppercase">{selectedReport.propriedade}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Município</p><p className="font-bold text-slate-800 uppercase">{selectedReport.municipio}</p></div>
                    
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Telefone</p><p className="font-bold text-slate-800 uppercase">{selectedReport.telefone || "N/A"}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Melhor dia de contato</p><p className="font-bold text-slate-800 uppercase">{selectedReport.melhorDiaContato || "N/A"}</p></div>
                    
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Contato no Local (Nome)</p><p className="font-bold text-slate-800 uppercase">{selectedReport.nomeRecebedor || selectedReport.proprietario}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Cargo (Contato)</p><p className="font-bold text-slate-800 uppercase">{selectedReport.cargoRecebedor || "Proprietário"}</p></div>
                  </div>
                </div>

                {/* BLOCO B */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">B. Detalhes Comerciais e Atividade</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Frigorífico Costumaz</p><p className="font-bold text-slate-800 uppercase">{selectedReport.frigorificoCostume || "Não informado"}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Abates (Último Ano)</p><p className="font-bold text-slate-800">{selectedReport.cabecasAbatidasAno || "Não informado"}</p></div>
                    
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Tipo de Venda</p><p className="font-bold text-slate-800 uppercase">{selectedReport.tipoVenda}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Habilitação</p><p className="font-bold text-slate-800 uppercase">{selectedReport.habilitacao}</p></div>

                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Tipo de Atividade</p><p className="font-bold text-primary uppercase">{selectedReport.atividade}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Tipo de Terminação</p><p className="font-bold text-primary uppercase">{selectedReport.terminacao}</p></div>
                  </div>
                </div>

                {/* BLOCO C 👇 ATUALIZADO PARA LOTES DINÂMICOS 👇 */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">C. Rebanho e Lotes para Abate</h3>
                  
                  <div className="mb-6">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">Efetivo Total (Propriedade)</p>
                    <p className="font-bold text-blue-700 text-lg tabular-nums">{selectedReport.numAnimais || "Não informado"} cabeças</p>
                  </div>

                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Previsão de Abate (Lotes)</h4>
                  <div className="space-y-2">
                    {selectedReport.lotesDaApi && selectedReport.lotesDaApi.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {selectedReport.lotesDaApi.map((lote, index) => (
                          <div key={index} className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-200 gap-1.5">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                              <span className="font-black text-sm text-slate-800">{lote.prazo_dias} Dias</span>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${lote.status_lote === 'VENDIDO' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                {lote.status_lote}
                              </span>
                            </div>
                            <div className="flex justify-between items-end mt-1">
                              <span className="text-xl text-slate-700 font-black tabular-nums">{lote.quantidade_cabecas}</span>
                              <span className="text-[11px] text-slate-500 font-bold uppercase mb-1">cab. ({lote.sexo_animal})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Nenhum lote com previsão de abate a curto prazo.</p>
                    )}
                  </div>
                </div>

              </div>
            </CardContent>
            
            <div className="border-t bg-slate-50 p-4 rounded-b-lg flex justify-between items-center">
              <Button variant="outline" className="font-bold text-primary border-primary hover:bg-primary/10 bg-white" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} BAIXAR PDF
              </Button>
              <Button onClick={() => setSelectedReport(null)} className="font-bold">FECHAR RELATÓRIO</Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}