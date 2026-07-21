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
  Filter,
  ShoppingCart,
  Search,
  BellRing,
  MessageCircle,
  Truck,
  PhoneOff,
  CheckCircle2
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

type MetricKey = "prospectado" | "comprado" | "visitas" | "novos" | "cidades";
type MetricSortColumn = "codigo" | "nome" | "fazenda" | "informacao";
type SortOrder = "asc" | "desc";

interface MetricDetailRow {
  key: string;
  codigo: string;
  nome: string;
  fazenda: string;
  municipio: string;
  visitas: number;
  prospectado: number;
  comprado: number;
  prospeccoes: number;
}

interface MetricDisplayRow {
  key: string;
  codigo: string;
  nome: string;
  fazenda: string;
  informacao: string;
  sortValue: string | number;
}

interface BuyerParticipationItem {
  id: string;
  nome: string;
  valor: number;
}

interface BuyerParticipationAccumulator {
  id: string;
  nome: string;
  prospectado: number;
  comprado: number;
  visitas: number;
  novos: number;
  cidades: Set<string>;
}

interface ForecastReadyAlert {
  key: string;
  codigoProdutor: string;
  produtor: string;
  fazenda: string;
  quantidade: number;
  diasRestantes: number;
  telefoneOriginal: string | null;
  whatsappNumero: string | null;
  whatsappUrl: string | null;
}

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

function MetricCard({
  title,
  value,
  icon,
  sub,
  colorClass,
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  sub: string;
  colorClass: string;
  onClick?: () => void;
}) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`bg-white border-slate-200 shadow-sm transition-all hover:shadow-md ${
        onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          : ""
      }`}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${colorClass}`}>
            {icon}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-bold text-slate-500 tracking-wide uppercase">{title}</p>
            <h3 className="text-4xl font-black text-slate-800 tracking-tight mt-1">{value}</h3>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-slate-400">{sub}</p>
          {onClick && (
            <span className="text-[10px] font-black uppercase tracking-wider text-primary whitespace-nowrap">
              Ver detalhes
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


const PARTICIPATION_COLORS = [
  "#ef4444", // vermelho
  "#2563eb", // azul
  "#facc15", // amarelo
  "#22c55e", // verde
  "#f97316", // laranja
  "#a855f7", // roxo
  "#ec4899", // rosa
  "#06b6d4", // ciano
  "#84cc16", // verde-limão
  "#4f46e5", // índigo
  "#ffffff", // branco
  "#14b8a6", // turquesa
];

const OTHER_BUYERS_COLOR = "#64748b";
const UNDEFINED_BUYER_COLOR = "#94a3b8";

function BuyerParticipationChart({
  title,
  items,
  centerLabel,
  selectedBuyerId,
  buyerColorMap,
}: {
  title: string;
  items: BuyerParticipationItem[];
  centerLabel: string;
  selectedBuyerId?: string;
  buyerColorMap: Record<string, string>;
}) {
  const preparedItems = useMemo(() => {
    const sorted = [...items]
      .filter((item) => Number.isFinite(item.valor) && item.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    const firstFive = sorted.slice(0, 5);
    const remaining = sorted.slice(5);
    const remainingValue = remaining.reduce((sum, item) => sum + item.valor, 0);

    const visibleItems = remainingValue > 0
      ? [
          ...firstFive,
          {
            id: "OUTROS",
            nome: `OUTROS (${remaining.length})`,
            valor: remainingValue,
          },
        ]
      : firstFive;

    const total = visibleItems.reduce((sum, item) => sum + item.valor, 0);

    return {
      total,
      items: visibleItems.map((item) => ({
        ...item,
        cor:
          item.id === "OUTROS"
            ? OTHER_BUYERS_COLOR
            : buyerColorMap[item.id] || UNDEFINED_BUYER_COLOR,
        percentual: total > 0 ? (item.valor / total) * 100 : 0,
      })),
    };
  }, [items, buyerColorMap]);

  const donutBackground = useMemo(() => {
    if (preparedItems.total <= 0 || preparedItems.items.length === 0) {
      return "conic-gradient(#e2e8f0 0% 100%)";
    }

    let accumulated = 0;
    const stops = preparedItems.items.map((item) => {
      const start = accumulated;
      accumulated += item.percentual;
      return `${item.cor} ${start.toFixed(4)}% ${accumulated.toFixed(4)}%`;
    });

    return `conic-gradient(${stops.join(", ")})`;
  }, [preparedItems]);

  return (
    <Card className="h-[180px] border-slate-200 bg-white shadow-sm overflow-hidden">
      <CardHeader className="px-4 py-3 border-b border-slate-100">
        <CardTitle className="text-[12px] font-black uppercase tracking-wide text-slate-800 leading-tight">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="h-[136px] p-3">
        {preparedItems.total <= 0 ? (
          <div className="h-full flex items-center justify-center text-center text-slate-400">
            <p className="text-[10px] font-bold">Sem dados no período.</p>
          </div>
        ) : (
          <div className="h-full flex items-center gap-3">
            <div className="relative h-[88px] w-[88px] shrink-0">
              <div
                className="absolute inset-0 rounded-full border border-slate-300 shadow-inner"
                style={{ background: donutBackground }}
                aria-label={`${title}: participação percentual por comprador`}
              />
              <div className="absolute inset-[18px] rounded-full bg-white border border-slate-100 flex flex-col items-center justify-center text-center px-1">
                <span className="text-[15px] font-black text-slate-800 tabular-nums leading-none">
                  {preparedItems.total.toLocaleString("pt-BR")}
                </span>
                <span className="mt-1 text-[7px] font-black uppercase tracking-wide text-slate-400 leading-none">
                  {centerLabel}
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              {preparedItems.items.map((item) => {
                const isSelected = selectedBuyerId && item.id === selectedBuyerId;
                const isWhite = item.cor.toLowerCase() === "#ffffff";

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 rounded px-1.5 py-0.5 ${
                      isSelected ? "bg-primary/5 ring-1 ring-primary/20" : ""
                    }`}
                    title={`${item.nome}: ${item.valor.toLocaleString("pt-BR")} (${item.percentual.toFixed(1)}%)`}
                  >
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: item.cor,
                          border: isWhite ? "1px solid #94a3b8" : undefined,
                        }}
                      />
                      <span className="truncate text-[10px] font-black uppercase leading-tight text-slate-700">
                        {item.nome}
                      </span>
                    </div>

                    <span className="shrink-0 text-[9px] font-black text-slate-700 tabular-nums">
                      {item.percentual.toLocaleString("pt-BR", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const normalizarInscricao = (valor: string | null | undefined): string => {
  return String(valor || "").replace(/\D/g, "");
};

const normalizarTelefoneWhatsApp = (
  telefone: string | number | null | undefined
): string | null => {
  let numero = String(telefone ?? "").replace(/\D/g, "");

  if (!numero) return null;

  if (numero.startsWith("00")) {
    numero = numero.slice(2);
  }

  if (
    numero.startsWith("0") &&
    (numero.length === 11 || numero.length === 12)
  ) {
    numero = numero.slice(1);
  }

  if (numero.startsWith("55")) {
    const numeroNacional = numero.slice(2);
    return numeroNacional.length === 10 || numeroNacional.length === 11
      ? numero
      : null;
  }

  if (numero.length === 10 || numero.length === 11) {
    return `55${numero}`;
  }

  return null;
};

const formatarPrazoForecast = (dias: number): string => {
  if (dias === 0) return "prontos hoje";
  if (dias === 1) return "prontos em 1 dia";
  return `prontos em ${dias} dias`;
};

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

  const [dateStart, setDateStart] = useState("2026-04-01");
  const [dateEnd, setDateEnd] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedBuyer, setSelectedBuyer] = useState("");

  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isForecastTipOpen, setIsForecastTipOpen] = useState(false);
  
  // Agora armazenamos as visitas já com os Lotes preenchidos
  const [visitasBrutas, setVisitasBrutas] = useState<(ApiVisita & { lotesDaApi: ApiLote[] })[]>([]);
  
  const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]);
  const [pecuaristas, setPecuaristas] = useState<ApiRancher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [metricSearch, setMetricSearch] = useState("");
  const [metricSortBy, setMetricSortBy] = useState<MetricSortColumn>("informacao");
  const [metricSortOrder, setMetricSortOrder] = useState<SortOrder>("desc");

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

  const compradoresDisponiveis = useMemo(() => {
    const compradoresMap = new Map<string, string>();

    visitasBrutas.forEach((visita) => {
      if (visita.ID_COMPRADOR === null || visita.ID_COMPRADOR === undefined) return;

      const id = String(visita.ID_COMPRADOR);
      const usuario = usuariosData.find(
        (u) => Number(u.SEQUSUARIO) === Number(visita.ID_COMPRADOR)
      );

      compradoresMap.set(id, usuario?.CODUSUARIO || `ID: ${id}`);
    });

    return Array.from(compradoresMap.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [visitasBrutas, usuariosData]);

  // Base somente com o período. Os gráficos de participação usam esta lista
  // para manter a comparação entre todos os compradores.
  const buyerColorMap = useMemo<Record<string, string>>(() => {
    const colorMap: Record<string, string> = {};

    compradoresDisponiveis.forEach((comprador, index) => {
      colorMap[comprador.id] =
        PARTICIPATION_COLORS[index % PARTICIPATION_COLORS.length];
    });

    colorMap.SEM_COMPRADOR = UNDEFINED_BUYER_COLOR;
    colorMap.OUTROS = OTHER_BUYERS_COLOR;

    return colorMap;
  }, [compradoresDisponiveis]);

  const visitasPeriodo = useMemo(() => {
    return visitasBrutas.filter((v) => {
      if (!v.DATA_REGISTRO_VISITA) return false;

      const vDate = v.DATA_REGISTRO_VISITA.split("T")[0];
      return (
        (!dateStart || vDate >= dateStart) &&
        (!dateEnd || vDate <= dateEnd)
      );
    });
  }, [visitasBrutas, dateStart, dateEnd]);

  // Cards, mapa, forecast, auditoria e tabelas continuam respeitando
  // também o filtro de comprador selecionado.
  const visitas = useMemo(() => {
    if (!selectedBuyer) return visitasPeriodo;

    return visitasPeriodo.filter(
      (v) => String(v.ID_COMPRADOR) === selectedBuyer
    );
  }, [visitasPeriodo, selectedBuyer]);

  const getNomeComprador = (id?: number) => {
    if (!id) return "NÃO DEFINIDO";
    const usuario = usuariosData.find(u => Number(u.SEQUSUARIO) === Number(id));
    return usuario ? usuario.CODUSUARIO : `ID: ${id}`;
  };

  // Mesma regra do selo verde no painel de Visitas:
  // 1) o KM atual do ERP foi alterado em relação ao KM existente no dia da visita;
  // 2) o KM existente no dia da visita era maior que o KM coletado pelo GPS.
  const fretesReduzidosAtualizados = useMemo(() => {
    const pecuaristasDistintos = new Set<string>();

    visitas.forEach((visita) => {
      const inscricaoVisita = normalizarInscricao(visita.INSCRICAO);

      const cadastroAtual = pecuaristas.find((pecuarista) => {
        const mesmaInscricao =
          inscricaoVisita !== "" &&
          normalizarInscricao(pecuarista.INSCRICAO) === inscricaoVisita;

        const mesmoProdutor =
          visita.COD_PRODUTOR === null ||
          visita.COD_PRODUTOR === undefined ||
          String(pecuarista.COD_PRODUTOR) === String(visita.COD_PRODUTOR);

        return mesmaInscricao && mesmoProdutor;
      });

      const distanciaAtualRaw =
        visita.DISTANCIA_CADASTRADA !== null &&
        visita.DISTANCIA_CADASTRADA !== undefined
          ? visita.DISTANCIA_CADASTRADA
          : cadastroAtual?.DISTANCIA_CADASTRADA;

      const distanciaAnteriorRaw = visita.DISTANCIAERP;
      const distanciaGpsRaw = visita.DISTANCIA_PERCORRIDA_REAL;

      const distanciaAtual = Number(distanciaAtualRaw);
      const distanciaAnterior = Number(distanciaAnteriorRaw);
      const distanciaGps = Number(distanciaGpsRaw);

      const possuiTodasAsDistancias =
        distanciaAtualRaw !== null &&
        distanciaAtualRaw !== undefined &&
        distanciaAnteriorRaw !== null &&
        distanciaAnteriorRaw !== undefined &&
        distanciaGpsRaw !== null &&
        distanciaGpsRaw !== undefined &&
        Number.isFinite(distanciaAtual) &&
        Number.isFinite(distanciaAnterior) &&
        Number.isFinite(distanciaGps);

      if (!possuiTodasAsDistancias) return;

      const distanciaFoiAlterada =
        Math.abs(distanciaAtual - distanciaAnterior) > 0.001;

      const economiaIdentificadaNaVisita =
        distanciaAnterior - distanciaGps > 0;

      if (distanciaFoiAlterada && economiaIdentificadaNaVisita) {
        const chavePecuarista =
          visita.COD_PRODUTOR !== null &&
          visita.COD_PRODUTOR !== undefined
            ? String(visita.COD_PRODUTOR)
            : inscricaoVisita ||
              String(visita.NOME_PRODUTOR || "SEM CADASTRO").trim().toUpperCase();

        pecuaristasDistintos.add(chavePecuarista);
      }
    });

    return {
      totalPecuaristas: pecuaristasDistintos.size,
    };
  }, [visitas, pecuaristas]);

  const alertasForecastCincoDias = useMemo<ForecastReadyAlert[]>(() => {
    const agrupados = new Map<
      string,
      {
        key: string;
        codigoProdutor: string;
        produtor: string;
        fazenda: string;
        quantidade: number;
        diasRestantes: number;
        telefoneOriginal: string | null;
      }
    >();

    visitas.forEach((visita) => {
      if (!visita.lotesDaApi || visita.lotesDaApi.length === 0) return;

      const inscricaoVisita = normalizarInscricao(visita.INSCRICAO);

      const cadastroAtual = pecuaristas.find((pecuarista) => {
        const mesmaInscricao =
          inscricaoVisita !== "" &&
          normalizarInscricao(pecuarista.INSCRICAO) === inscricaoVisita;

        const mesmoProdutor =
          visita.COD_PRODUTOR === null ||
          visita.COD_PRODUTOR === undefined ||
          String(pecuarista.COD_PRODUTOR) === String(visita.COD_PRODUTOR);

        return mesmaInscricao && mesmoProdutor;
      });

      const telefoneBruto =
        String(visita.TELEFONE || cadastroAtual?.NUMERO1 || "").trim() || null;

      visita.lotesDaApi.forEach((lote) => {
        if (
          String(lote.status_lote || "").trim().toUpperCase() !== "DISPONIVEL"
        ) {
          return;
        }

        const quantidade = Number(lote.quantidade_cabecas) || 0;
        if (quantidade <= 0) return;

        const diasRestantes = getDiffEmDias(
          visita.DATA_REGISTRO_VISITA,
          lote.prazo_dias
        );

        if (diasRestantes < 0 || diasRestantes > 5) return;

        const codigoProdutor =
          visita.COD_PRODUTOR !== null &&
          visita.COD_PRODUTOR !== undefined
            ? String(visita.COD_PRODUTOR)
            : "SEM CADASTRO";

        const produtor = String(
          visita.NOME_PRODUTOR || "PECUARISTA NÃO INFORMADO"
        )
          .trim()
          .toUpperCase();

        const fazenda = String(
          visita.NOME_FAZENDA || "FAZENDA NÃO INFORMADA"
        )
          .trim()
          .toUpperCase();

        const chave =
          `${codigoProdutor}|${inscricaoVisita}|${fazenda}|${diasRestantes}`;

        const atual = agrupados.get(chave) || {
          key: chave,
          codigoProdutor,
          produtor,
          fazenda,
          quantidade: 0,
          diasRestantes,
          telefoneOriginal: telefoneBruto,
        };

        atual.quantidade += quantidade;

        if (!atual.telefoneOriginal && telefoneBruto) {
          atual.telefoneOriginal = telefoneBruto;
        }

        agrupados.set(chave, atual);
      });
    });

    return Array.from(agrupados.values())
      .map((item): ForecastReadyAlert => {
        const whatsappNumero = normalizarTelefoneWhatsApp(
          item.telefoneOriginal
        );

        const prazoMensagem =
          item.diasRestantes === 0
            ? "já estão previstos para hoje"
            : item.diasRestantes === 1
              ? "estarão prontos em 1 dia"
              : `estarão prontos em ${item.diasRestantes} dias`;

        const mensagem =
          `Olá! Conforme nossa visita à ${item.fazenda}, ` +
          `${item.quantidade.toLocaleString("pt-BR")} animais ${prazoMensagem}. ` +
          "Podemos conversar sobre a programação da compra?";

        return {
          ...item,
          whatsappNumero,
          whatsappUrl: whatsappNumero
            ? `https://wa.me/${whatsappNumero}?text=${encodeURIComponent(mensagem)}`
            : null,
        };
      })
      .sort((a, b) => {
        if (a.diasRestantes !== b.diasRestantes) {
          return a.diasRestantes - b.diasRestantes;
        }

        return b.quantidade - a.quantidade;
      });
  }, [visitas, pecuaristas]);


  const resumoForecastCincoDias = useMemo(() => {
    return {
      totalAnimais: alertasForecastCincoDias.reduce(
        (total, alerta) => total + alerta.quantidade,
        0
      ),
      previa: alertasForecastCincoDias.slice(0, 2),
    };
  }, [alertasForecastCincoDias]);

  const participacaoCompradores = useMemo(() => {
    const agrupados = new Map<string, BuyerParticipationAccumulator>();

    visitasPeriodo.forEach((visita) => {
      const compradorId = visita.ID_COMPRADOR !== null && visita.ID_COMPRADOR !== undefined
        ? String(visita.ID_COMPRADOR)
        : "SEM_COMPRADOR";

      const usuario = usuariosData.find(
        (item) => Number(item.SEQUSUARIO) === Number(visita.ID_COMPRADOR)
      );

      const compradorNome = usuario?.CODUSUARIO ||
        (compradorId === "SEM_COMPRADOR" ? "NÃO DEFINIDO" : `ID: ${compradorId}`);

      const atual = agrupados.get(compradorId) || {
        id: compradorId,
        nome: compradorNome,
        prospectado: 0,
        comprado: 0,
        visitas: 0,
        novos: 0,
        cidades: new Set<string>(),
      };

      atual.prospectado += Number(visita.EFETIVO_TOTAL_ANIMAIS) || 0;
      atual.comprado += Number(visita.QUANTIDADECOMPRADA) || 0;
      atual.visitas += 1;

      if (String(visita.NATUREZA_VISITA || "").trim().toUpperCase() === "PROSPECÇÃO") {
        atual.novos += 1;
      }

      const municipio = String(visita.MUNICIPIO || "").trim().toUpperCase();
      if (municipio) atual.cidades.add(municipio);

      agrupados.set(compradorId, atual);
    });

    const compradores = Array.from(agrupados.values());
    const converter = (
      obterValor: (item: BuyerParticipationAccumulator) => number
    ): BuyerParticipationItem[] => compradores
      .map((item) => ({
        id: item.id,
        nome: item.nome,
        valor: obterValor(item),
      }))
      .filter((item) => item.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    return {
      prospectado: converter((item) => item.prospectado),
      comprado: converter((item) => item.comprado),
      visitas: converter((item) => item.visitas),
      novos: converter((item) => item.novos),
      cidades: converter((item) => item.cidades.size),
    };
  }, [visitasPeriodo, usuariosData]);

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
    let totalHeads = 0;
    let totalComprada = 0;
    let novosPecuaristas = 0;
    const cidadesSet = new Set<string>(); const citiesMap = new Map<string, CityData>();

    visitas.forEach(v => {
      const cabecas = Number(v.EFETIVO_TOTAL_ANIMAIS) || 0;
      const quantidadeComprada = Number(v.QUANTIDADECOMPRADA) || 0;

      totalHeads += cabecas;
      totalComprada += quantidadeComprada;
      
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

    return {
      mapData: Array.from(citiesMap.values()),
      kpis: {
        totalHeads,
        totalComprada,
        totalVisitas: visitas.length,
        novosPecuaristas,
        cidadesCobertas: cidadesSet.size
      }
    };
  }, [visitas]);

  const metricDetailRows = useMemo<MetricDetailRow[]>(() => {
    const agrupados = new Map<string, MetricDetailRow>();

    visitas.forEach((visita) => {
      const codigo = visita.COD_PRODUTOR !== null && visita.COD_PRODUTOR !== undefined
        ? String(visita.COD_PRODUTOR)
        : "SEM CADASTRO";
      const nome = String(visita.NOME_PRODUTOR || "NÃO INFORMADO").trim().toUpperCase();
      const fazenda = String(visita.NOME_FAZENDA || "NÃO INFORMADA").trim().toUpperCase();
      const municipio = String(visita.MUNICIPIO || "NÃO INFORMADO").trim().toUpperCase();
      const inscricao = String(visita.INSCRICAO || "").replace(/\D/g, "");
      const chave = `${codigo}|${inscricao}|${fazenda}`;

      const atual = agrupados.get(chave) || {
        key: chave,
        codigo,
        nome,
        fazenda,
        municipio,
        visitas: 0,
        prospectado: 0,
        comprado: 0,
        prospeccoes: 0,
      };

      atual.visitas += 1;
      atual.prospectado += Number(visita.EFETIVO_TOTAL_ANIMAIS) || 0;
      atual.comprado += Number(visita.QUANTIDADECOMPRADA) || 0;

      if (String(visita.NATUREZA_VISITA || "").trim().toUpperCase() === "PROSPECÇÃO") {
        atual.prospeccoes += 1;
      }

      agrupados.set(chave, atual);
    });

    return Array.from(agrupados.values());
  }, [visitas]);

  const metricConfig = useMemo(() => {
    const configs: Record<MetricKey, { title: string; description: string; infoLabel: string }> = {
      prospectado: {
        title: "Detalhamento — Gado Prospectado",
        description: "Efetivo total informado nas visitas do período e comprador selecionados.",
        infoLabel: "Gado prospectado",
      },
      comprado: {
        title: "Detalhamento — Quantidade Comprada",
        description: "Quantidade comprada registrada para cada pecuarista e propriedade.",
        infoLabel: "Quantidade comprada",
      },
      visitas: {
        title: "Detalhamento — Visitas Realizadas",
        description: "Quantidade de visitas realizadas por pecuarista e propriedade.",
        infoLabel: "Visitas",
      },
      novos: {
        title: "Detalhamento — Novos Pecuaristas",
        description: "Visitas cuja natureza foi registrada como PROSPECÇÃO.",
        infoLabel: "Visitas de prospecção",
      },
      cidades: {
        title: "Detalhamento — Cidades Cobertas",
        description: "Propriedades alcançadas no período, com município e quantidade de visitas.",
        infoLabel: "Município / visitas",
      },
    };

    return selectedMetric ? configs[selectedMetric] : null;
  }, [selectedMetric]);

  const metricRows = useMemo<MetricDisplayRow[]>(() => {
    if (!selectedMetric) return [];

    return metricDetailRows
      .filter((row) => {
        if (selectedMetric === "prospectado") return row.prospectado > 0;
        if (selectedMetric === "comprado") return row.comprado > 0;
        if (selectedMetric === "novos") return row.prospeccoes > 0;
        return true;
      })
      .map((row) => {
        if (selectedMetric === "prospectado") {
          return {
            key: row.key,
            codigo: row.codigo,
            nome: row.nome,
            fazenda: row.fazenda,
            informacao: `${row.prospectado.toLocaleString("pt-BR")} cabeças`,
            sortValue: row.prospectado,
          };
        }

        if (selectedMetric === "comprado") {
          return {
            key: row.key,
            codigo: row.codigo,
            nome: row.nome,
            fazenda: row.fazenda,
            informacao: `${row.comprado.toLocaleString("pt-BR")} cabeças`,
            sortValue: row.comprado,
          };
        }

        if (selectedMetric === "visitas") {
          return {
            key: row.key,
            codigo: row.codigo,
            nome: row.nome,
            fazenda: row.fazenda,
            informacao: `${row.visitas.toLocaleString("pt-BR")} ${row.visitas === 1 ? "visita" : "visitas"}`,
            sortValue: row.visitas,
          };
        }

        if (selectedMetric === "novos") {
          return {
            key: row.key,
            codigo: row.codigo,
            nome: row.nome,
            fazenda: row.fazenda,
            informacao: `${row.prospeccoes.toLocaleString("pt-BR")} ${row.prospeccoes === 1 ? "prospecção" : "prospecções"}`,
            sortValue: row.prospeccoes,
          };
        }

        return {
          key: row.key,
          codigo: row.codigo,
          nome: row.nome,
          fazenda: row.fazenda,
          informacao: `${row.municipio} • ${row.visitas.toLocaleString("pt-BR")} ${row.visitas === 1 ? "visita" : "visitas"}`,
          sortValue: row.visitas,
        };
      });
  }, [metricDetailRows, selectedMetric]);

  const sortedMetricRows = useMemo(() => {
    const pesquisa = metricSearch.trim().toLocaleLowerCase("pt-BR");

    const filtrados = metricRows.filter((row) => {
      if (!pesquisa) return true;
      return [row.codigo, row.nome, row.fazenda, row.informacao]
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(pesquisa));
    });

    return [...filtrados].sort((a, b) => {
      let valorA: string | number;
      let valorB: string | number;

      if (metricSortBy === "codigo") {
        const codigoA = Number(a.codigo);
        const codigoB = Number(b.codigo);
        valorA = Number.isFinite(codigoA) ? codigoA : a.codigo;
        valorB = Number.isFinite(codigoB) ? codigoB : b.codigo;
      } else if (metricSortBy === "nome") {
        valorA = a.nome;
        valorB = b.nome;
      } else if (metricSortBy === "fazenda") {
        valorA = a.fazenda;
        valorB = b.fazenda;
      } else {
        valorA = a.sortValue;
        valorB = b.sortValue;
      }

      let comparacao = 0;
      if (typeof valorA === "number" && typeof valorB === "number") {
        comparacao = valorA - valorB;
      } else {
        comparacao = String(valorA).localeCompare(String(valorB), "pt-BR", { numeric: true });
      }

      return metricSortOrder === "asc" ? comparacao : -comparacao;
    });
  }, [metricRows, metricSearch, metricSortBy, metricSortOrder]);

  const openMetricDetails = (metric: MetricKey) => {
    setMetricSearch("");
    setMetricSortBy("informacao");
    setMetricSortOrder("desc");
    setSelectedMetric(metric);
  };

  const handleMetricSort = (column: MetricSortColumn) => {
    if (metricSortBy === column) {
      setMetricSortOrder((current) => current === "desc" ? "asc" : "desc");
      return;
    }

    setMetricSortBy(column);
    setMetricSortOrder(column === "informacao" || column === "codigo" ? "desc" : "asc");
  };

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
          
          <div className="w-full md:w-auto bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-slate-600 font-bold">
                <Filter className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-wider">Filtros do Relatório</span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsForecastTipOpen((current) => !current)}
                  className={`relative h-8 inline-flex items-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-wide transition-all ${
                    alertasForecastCincoDias.length > 0
                      ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
                  aria-expanded={isForecastTipOpen}
                  aria-label={`Ver animais previstos para os próximos cinco dias. ${alertasForecastCincoDias.length} pendente(s).`}
                >
                  <BellRing
                    className={`w-4 h-4 ${
                      alertasForecastCincoDias.length > 0 ? "animate-pulse" : ""
                    }`}
                  />
                  <span className="hidden sm:inline">Alertas 5 dias</span>

                  {alertasForecastCincoDias.length > 0 && (
                    <span
                      className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[9px] font-black leading-none text-white shadow-md tabular-nums"
                      title={`${alertasForecastCincoDias.length} alerta(s) pendente(s)`}
                    >
                      {alertasForecastCincoDias.length > 99
                        ? "99+"
                        : alertasForecastCincoDias.length}
                    </span>
                  )}
                </button>

                {isForecastTipOpen && (
                  <div className="absolute right-0 top-full z-[700] mt-2 w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-amber-50 px-4 py-3">
                      <div>
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-900">
                          <BellRing className="w-4 h-4" />
                          Animais prontos em até 5 dias
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-amber-800/80">
                          Acompanhamento dos lotes disponíveis mais próximos.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsForecastTipOpen(false)}
                        className="rounded-full p-1 text-amber-700 hover:bg-amber-100"
                        aria-label="Fechar aviso"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto p-3">
                      {alertasForecastCincoDias.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
                          <p className="text-xs font-bold text-slate-600">
                            Nenhum lote disponível previsto para os próximos 5 dias.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {alertasForecastCincoDias.map((alerta) => (
                            <div
                              key={alerta.key}
                              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-black uppercase text-slate-800">
                                    {alerta.produtor}
                                  </p>
                                  <p className="mt-0.5 truncate text-[9px] font-bold uppercase text-slate-500">
                                    {alerta.fazenda}
                                  </p>
                                </div>

                                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800">
                                  {formatarPrazoForecast(alerta.diasRestantes)}
                                </span>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[9px] font-bold uppercase text-slate-400">
                                    Animais
                                  </p>
                                  <p className="text-lg font-black leading-none text-slate-800 tabular-nums">
                                    {alerta.quantidade.toLocaleString("pt-BR")}
                                  </p>
                                </div>

                                {alerta.whatsappUrl ? (
                                  <a
                                    href={alerta.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[10px] font-black uppercase text-white shadow-sm transition-colors hover:bg-emerald-700"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                    WhatsApp
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-2 text-[9px] font-bold uppercase text-slate-500">
                                    <PhoneOff className="w-3.5 h-3.5" />
                                    Sem contato válido
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col min-w-[150px]">
                <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Início</Label>
                <Input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="h-9 text-xs font-bold bg-slate-50 border-slate-200"
                />
              </div>

              <div className="flex flex-col min-w-[150px]">
                <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Fim</Label>
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="h-9 text-xs font-bold bg-slate-50 border-slate-200"
                />
              </div>

              <div className="flex flex-col min-w-[220px]">
                <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Comprador</Label>
                <select
                  value={selectedBuyer}
                  onChange={(e) => setSelectedBuyer(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 shadow-sm outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">TODOS OS COMPRADORES</option>
                  {compradoresDisponiveis.map((comprador) => (
                    <option key={comprador.id} value={comprador.id}>
                      {comprador.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="pt-11">
                <Card className="h-[140px] flex items-center justify-center border-none shadow-sm">
                  <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                </Card>
              </div>
            ))
          ) : (
            <>
              <div className="relative pt-11">
                <div
                  className="absolute left-2 right-2 top-0 z-20 flex min-h-9 items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white/95 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-800 shadow-[0_10px_24px_rgba(16,185,129,0.22)] backdrop-blur-sm"
                  title="Pecuaristas distintos com redução de distância identificada na visita e distância já alterada no ERP."
                >
                  <Truck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="shrink-0 text-[12px]">
                    {fretesReduzidosAtualizados.totalPecuaristas}
                  </span>
                  <span className="truncate">
                    {fretesReduzidosAtualizados.totalPecuaristas === 1
                      ? "pecuarista com frete reduzido e atualizado"
                      : "pecuaristas com frete reduzido e atualizado"}
                  </span>
                  <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-emerald-300 bg-white" />
                </div>

                <MetricCard
                  title="Gado Prospectado"
                  value={kpis.totalHeads.toLocaleString("pt-BR")}
                  icon={<TrendingUp className="w-7 h-7 text-blue-600" />}
                  colorClass="bg-blue-50 text-blue-600"
                  sub="Efetivo total registrado em visitas"
                  onClick={() => openMetricDetails("prospectado")}
                />
              </div>

              <div className="pt-11">
                <MetricCard
                  title="Quantidade Comprada"
                  value={kpis.totalComprada.toLocaleString("pt-BR")}
                  icon={<ShoppingCart className="w-7 h-7 text-violet-600" />}
                  colorClass="bg-violet-50 text-violet-600"
                  sub="Total comprado no período filtrado"
                  onClick={() => openMetricDetails("comprado")}
                />
              </div>

              <div className="pt-11">
                <MetricCard
                  title="Visitas Realizadas"
                  value={kpis.totalVisitas}
                  icon={<Navigation className="w-7 h-7 text-indigo-600" />}
                  colorClass="bg-indigo-50 text-indigo-600"
                  sub="Total de registros no banco"
                  onClick={() => openMetricDetails("visitas")}
                />
              </div>

              <div className="pt-11">
                <MetricCard
                  title="Novos Pecuaristas"
                  value={kpis.novosPecuaristas}
                  icon={<Users className="w-7 h-7 text-emerald-600" />}
                  colorClass="bg-emerald-50 text-emerald-600"
                  sub="Visitas com natureza de Prospecção"
                  onClick={() => openMetricDetails("novos")}
                />
              </div>

              <div className="pt-11">
                <MetricCard
                  title="Cidades Cobertas"
                  value={kpis.cidadesCobertas}
                  icon={<Building2 className="w-7 h-7 text-amber-600" />}
                  colorClass="bg-amber-50 text-amber-600"
                  sub="Abrangência geográfica real"
                  onClick={() => openMetricDetails("cidades")}
                />
              </div>
            </>
          )}
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-black text-slate-800">Participação por Comprador</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {Array(5).fill(0).map((_, index) => (
                <Card key={index} className="h-[180px] flex items-center justify-center border-slate-200 shadow-sm">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-start">
              <BuyerParticipationChart
                title="Gado Prospectado"
                items={participacaoCompradores.prospectado}
                centerLabel="Cabeças"
                selectedBuyerId={selectedBuyer || undefined}
                buyerColorMap={buyerColorMap}
              />

              <BuyerParticipationChart
                title="Quantidade Comprada"
                items={participacaoCompradores.comprado}
                centerLabel="Cabeças"
                selectedBuyerId={selectedBuyer || undefined}
                buyerColorMap={buyerColorMap}
              />

              <BuyerParticipationChart
                title="Visitas Realizadas"
                items={participacaoCompradores.visitas}
                centerLabel="Visitas"
                selectedBuyerId={selectedBuyer || undefined}
                buyerColorMap={buyerColorMap}
              />

              <BuyerParticipationChart
                title="Novos Pecuaristas"
                items={participacaoCompradores.novos}
                centerLabel="Prospecções"
                selectedBuyerId={selectedBuyer || undefined}
                buyerColorMap={buyerColorMap}
              />

              <BuyerParticipationChart
                title="Cidades Cobertas"
                items={participacaoCompradores.cidades}
                centerLabel="Coberturas"
                selectedBuyerId={selectedBuyer || undefined}
                buyerColorMap={buyerColorMap}
              />
            </div>
          )}
        </section>

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

      {selectedMetric && metricConfig && (
        <div className="fixed inset-0 z-[9998] bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border-none overflow-hidden">
            <CardHeader className="bg-white border-b shrink-0 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black text-slate-800">
                    {metricConfig.title}
                  </CardTitle>
                  <CardDescription className="mt-1 font-medium">
                    {metricConfig.description}
                  </CardDescription>
                  <p className="mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Período: {dateStart ? new Date(`${dateStart}T12:00:00`).toLocaleDateString("pt-BR") : "Início livre"}
                    {" até "}
                    {dateEnd ? new Date(`${dateEnd}T12:00:00`).toLocaleDateString("pt-BR") : "Fim livre"}
                    {selectedBuyer ? ` • Comprador: ${getNomeComprador(Number(selectedBuyer))}` : " • Todos os compradores"}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMetric(null)}
                  className="shrink-0"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </Button>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={metricSearch}
                    onChange={(event) => setMetricSearch(event.target.value)}
                    placeholder="Pesquisar código, pecuarista, fazenda ou informação..."
                    className="pl-9 h-10 bg-slate-50"
                  />
                </div>

                <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
                  {sortedMetricRows.length.toLocaleString("pt-BR")} registro(s)
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-auto flex-1 bg-white">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead
                      className={`font-bold text-xs uppercase cursor-pointer select-none hover:bg-slate-100 ${metricSortBy === "codigo" ? "text-primary bg-primary/5" : "text-slate-500"}`}
                      onClick={() => handleMetricSort("codigo")}
                    >
                      <div className="flex items-center gap-1">
                        Cód. Pecuarista
                        <ArrowUpDown className={`w-3.5 h-3.5 ${metricSortBy === "codigo" ? "opacity-100" : "opacity-30"}`} />
                      </div>
                    </TableHead>

                    <TableHead
                      className={`font-bold text-xs uppercase cursor-pointer select-none hover:bg-slate-100 min-w-[240px] ${metricSortBy === "nome" ? "text-primary bg-primary/5" : "text-slate-500"}`}
                      onClick={() => handleMetricSort("nome")}
                    >
                      <div className="flex items-center gap-1">
                        Pecuarista
                        <ArrowUpDown className={`w-3.5 h-3.5 ${metricSortBy === "nome" ? "opacity-100" : "opacity-30"}`} />
                      </div>
                    </TableHead>

                    <TableHead
                      className={`font-bold text-xs uppercase cursor-pointer select-none hover:bg-slate-100 min-w-[240px] ${metricSortBy === "fazenda" ? "text-primary bg-primary/5" : "text-slate-500"}`}
                      onClick={() => handleMetricSort("fazenda")}
                    >
                      <div className="flex items-center gap-1">
                        Fazenda
                        <ArrowUpDown className={`w-3.5 h-3.5 ${metricSortBy === "fazenda" ? "opacity-100" : "opacity-30"}`} />
                      </div>
                    </TableHead>

                    <TableHead
                      className={`font-bold text-xs uppercase text-right cursor-pointer select-none hover:bg-slate-100 min-w-[190px] ${metricSortBy === "informacao" ? "text-primary bg-primary/5" : "text-slate-500"}`}
                      onClick={() => handleMetricSort("informacao")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {metricConfig.infoLabel}
                        <ArrowUpDown className={`w-3.5 h-3.5 ${metricSortBy === "informacao" ? "opacity-100" : "opacity-30"}`} />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {sortedMetricRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-14 text-slate-500 font-medium">
                        Nenhum registro encontrado para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedMetricRows.map((row, index) => (
                      <TableRow key={row.key} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-black text-slate-700 tabular-nums whitespace-nowrap">
                          {row.codigo}
                        </TableCell>
                        <TableCell>
                          <p className="font-bold text-sm text-slate-800 uppercase">{row.nome}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-sm text-slate-600 uppercase">{row.fazenda}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex rounded-md bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 whitespace-nowrap tabular-nums">
                            {row.informacao}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>

            <div className="border-t bg-slate-50 px-5 py-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium text-slate-400">
                A tabela abre ordenada do maior para o menor. Clique nos títulos para alterar a ordenação.
              </p>
              <Button onClick={() => setSelectedMetric(null)} className="font-bold shrink-0">
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}

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