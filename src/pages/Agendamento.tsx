import { useState, useRef, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Clock, 
  MapPin, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  X,
  Calendar,
  CalendarPlus,
  Download,
  Loader2,
  Navigation,
  FilterX,
  CheckCircle2,
  AlertTriangle,
  User,
  Link as LinkIcon,
  Search,
  Check,
  Filter,
  Trash2,
  AlertCircle,
  ImageIcon,
  ArrowLeft,
  CalendarDays,
  UserSquare2,
  Building2,
  Users,
  Map as MapIcon,
  CheckSquare,
  Sparkles,
  Trophy,
  Target,
  Truck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { api, fetchPecuaristasAgendamento, saveAgendamento, type ApiUsuario, type ApiHistoricoCompra } from "@/services/api";
import { calculateScoreVolume, calculateScoreProspeccao, calculateScoreLogistica } from "@/services/pecuaristas";

// 👇 ATUALIZADO: Inclui nome_representante e as novas métricas de histórico 👇
export interface ApiRancher {
  COD_PRODUTOR: number;
  NOME_PRODUTOR: string;
  NOME_FAZENDA: string;
  MUNICIPIO: string;
  UF_FAZENDA: string;
  INSCRICAO: string;
  NUMERO1: string | null;
  POSSUI_CAR: "S" | "N";
  DISTANCIA_CADASTRADA: number;
  QTD_COMPRADA_12M_CHINA: number;
  QTD_COMPRADA_12M_NAO_CHINA: number;
  JA_VENDEU: "S" | "N";
  DATA_ULTIMA_VISITA?: string | null; 
  VENDAREPRESENTANTE: "S" | "N";
  NOME_REPRESENTANTE?: string | null; 
  
  // Criado dinamicamente no Front-end após calcular o histórico
  totalCompradoCalculado?: number;
  totalChinaCalculado?: number;
  totalNaoChinaCalculado?: number;
}

interface GlobalSearchItem {
  tipo: 'cidade' | 'fazenda';
  valor: string;
  produtor?: string;
  cidade?: string;
}

const formatNumber = (num: number | string) => {
  if (num === null || num === undefined) return "0";
  return Number(num).toLocaleString('pt-BR');
};

const cityToRegionMap: Record<string, string> = {
  "GOIANIA": "rmg", "APARECIDA DE GOIANIA": "rmg", "TRINDADE": "rmg", "SENADOR CANEDO": "rmg", "INHUMAS": "rmg", "BELA VISTA DE GOIAS": "rmg", "NEROPOLIS": "rmg", "GUAPO": "rmg", "GOIANIRA": "rmg", "ABADIA DE GOIAS": "rmg", "SANTO ANTONIO DE GOIAS": "rmg", "HIDROLANDIA": "rmg", "BONFINOPOLIS": "rmg", "CALDAZINHA": "rmg", "TEREZOPOLIS DE GOIAS": "rmg", "BRAZABRANTES": "rmg", "CATURAI": "rmg", "DAMOLANDIA": "rmg", "ITAUCU": "rmg", "TAQUARAL DE GOIAS": "rmg", "NOVA VENEZA": "rmg", "GOIANAPOLIS": "rmg", "AVELINOPOLIS": "rmg", "ARAGOIANIA": "rmg",
  "ANAPOLIS": "rcg", "JARAGUA": "rcg", "CERES": "rcg", "RIALMA": "rcg", "RUBIATABA": "rcg", "ITAPACI": "rcg", "CARMO DO RIO VERDE": "rcg", "GOIANESIA": "rcg", "PIRENOPOLIS": "rcg", "CORUMBA DE GOIAS": "rcg", "COCALZINHO DE GOIAS": "rcg", "PETROLINA DE GOIAS": "rcg", "SANTA ISABEL": "rcg", "BARRO ALTO": "rcg", "VILA PROPICIO": "rcg", "CAMPO LIMPO DE GOIAS": "rcg", "OURO VERDE DE GOIAS": "rcg", "JESUPOLIS": "rcg", "SANTA ROSA DE GOIAS": "rcg", "HEITORAI": "rcg", "ITAGUARI": "rcg", "SANTA RITA DO NOVO DESTINO": "rcg", "ITAGUARU": "rcg", "SAO FRANCISCO DE GOIAS": "rcg", "URUANA": "rcg", "SAO PATRICIO": "rcg", "NOVA AMERICA": "rcg", "MORRO AGUDO DE GOIAS": "rcg", "IPIRANGA DE GOIAS": "rcg",
  "LUZIANIA": "entorno", "CRISTALINA": "entorno", "FORMOSA": "entorno", "SANTO ANTONIO DO DESCOBERTO": "entorno", "PADRE BERNARDO": "entorno", "CABECEIRAS": "entorno", "ABADIANIA": "entorno",
  "ITUMBIARA": "sul", "MORRINHOS": "sul", "CALDAS NOVAS": "sul", "GOIATUBA": "sul", "PIRACANJUBA": "sul", "BURITI ALEGRE": "sul", "RIO QUENTE": "sul", "MARZAGAO": "sul", "AGUA LIMPA": "sul", "ALOANDIA": "sul", "CROMINIA": "sul", "MAIRIPOTABA": "sul", "PONTALINA": "sul", "VICENTINOPOLIS": "sul", "EDEIA": "sul", "EDEALINA": "sul", "INACIOLANDIA": "sul", "GOUVELANDIA": "sul", "ITARUMA": "sul", "PROFESSOR JAMIL": "sul",
  "RIO VERDE": "sudoeste", "JATAI": "sudoeste", "MINEIROS": "sudoeste", "QUIRINOPOLIS": "sudoeste", "SANTA HELENA DE GOIAS": "sudoeste", "SAO SIMAO": "sudoeste", "ACREUNA": "sudoeste", "MONTIVIDIU": "sudoeste", "TURVELANDIA": "sudoeste", "CASTELANDIA": "sudoeste", "PARANAIGUARA": "sudoeste", "CACU": "sudoeste", "CACHOEIRA ALTA": "sudoeste", "PEROLANDIA": "sudoeste", "SANTA RITA DO ARAGUAIA": "sudoeste", "SANTO ANTONIO DA BARRA": "sudoeste",
  "CATALAO": "sudeste", "IPAMERI": "sudeste", "PIRES DO RIO": "sudeste", "SILVANIA": "sudeste", "VIANOPOLIS": "sudeste", "ORIZONA": "sudeste", "OUVIDOR": "sudeste", "TRES RANCHOS": "sudeste", "GOIANDIRA": "sudeste", "CUMARI": "sudeste", "ANHANGUERA": "sudeste", "DAVINOPOLIS": "sudeste", "CORUMBAIBA": "sudeste", "NOVA AURORA": "sudeste", "CAMPO ALEGRE DE GOIAS": "sudeste", "LEOPOLDO DE BULHOES": "sudeste", "GAMELEIRA DE GOIAS": "sudeste", "CRISTIANOPOLIS": "sudeste", "URUTAI": "sudeste", "PALMELO": "sudeste", "SANTA CRUZ DE GOIAS": "sudeste",
  "PORANGATU": "norte", "URUACU": "norte", "NIQUELANDIA": "norte", "MINACU": "norte", "CAMPINORTE": "norte", "MARA ROSA": "norte", "ALTO HORIZONTE": "norte", "NOVA IGUACU DE GOIAS": "norte", "CAMPINACU": "norte", "MUTUNOPOLIS": "norte", "ESTRELA DO NORTE": "norte", "SANTA TEREZA DE GOIAS": "norte", "TROMBAS": "norte", "FORMOSO": "norte", "SAO LUIZ DO NORTE": "norte", "GUARINOS": "norte", "PILAR DE GOIAS": "norte", "AMARALINA": "norte", "CAMPOS VERDES": "norte", "SANTA TEREZINHA DE GOIAS": "norte", "UIRAPURU": "norte", "HIDROLINA": "norte", "BONOPOLIS": "norte", "NOVO PLANALTO": "norte", "MONTIVIDIU DO NORTE": "norte",
  "POSSE": "nordeste", "CAMPOS BELOS": "nordeste", "SAO DOMINGOS": "nordeste", "ALTO PARAISO DE GOIAS": "nordeste", "CAVALCANTE": "nordeste", "IACIARA": "nordeste", "ALVORADA DO NORTE": "nordeste", "SIMOLANDIA": "nordeste", "FLORES DE GOIAS": "nordeste", "GUARANI DE GOIAS": "nordeste", "COLINAS DO SUL": "nordeste", "MONTE ALEGRE DE GOIAS": "nordeste", "SITIO D ABADIA": "nordeste", "DIVINOPOLIS DE GOIAS": "nordeste",
  "IPORA": "oeste", "SAO LUIS DE MONTES BELOS": "oeste", "PIRANHAS": "oeste", "CAIAPONIA": "oeste", "ARAGARCAS": "oeste", "JUSSARA": "oeste", "FAZENDA NOVA": "oeste", "ISRAELANDIA": "oeste", "IVOLANDIA": "oeste", "MOIPORA": "oeste", "CACHOEIRA DE GOIAS": "oeste", "AURILANDIA": "oeste", "FIRMINOPOLIS": "oeste", "TURVANIA": "oeste", "PALMINOPOLIS": "oeste", "CEZARINA": "oeste", "INDIARA": "oeste", "JANDAIA": "oeste", "PARAUNA": "oeste", "SAO JOAO DA PARAUNA": "oeste", "BALIZA": "oeste", "BOM JARDIM DE GOIAS": "oeste", "ARENOPOLIS": "oeste", "DIORAMA": "oeste", "MONTES CLAROS DE GOIAS": "oeste", "DOVERLANDIA": "oeste", "CORREGO DO OURO": "oeste", "PALMEIRAS DE GOIAS": "oeste", "AMORINOPOLIS": "oeste", "NAZARIO": "oeste", "VARJAO": "oeste", "PONTES E LACERDA": "oeste", "SANTA BARBARA DE GOIAS": "oeste", "NOVO BRASIL": "oeste",  
  "GOIAS": "noroeste", "ITABERAI": "noroeste", "ITAPURANGA": "noroeste", "ARUANA": "noroeste", "NOVA CRIXAS": "noroeste", "ARAGUAPAZ": "noroeste", "MOZARLANDIA": "noroeste", "CRIXAS": "noroeste", "SAO MIGUEL DO ARAGUAIA": "noroeste", "MUNDO NOVO": "noroeste", "MATRINCHA": "noroeste", "SANTA FE DE GOIAS": "noroeste", "BRITANIA": "noroeste", "FAINA": "noroeste", "ITAPIRAPUA": "noroeste", "SANCLERLANDIA": "noroeste", "BURITI DE GOIAS": "noroeste", "MOSSAMEDES": "noroeste", "ADELANDIA": "noroeste", "AMERICANO DO BRASIL": "noroeste", "ANICUNS": "noroeste", "CAMPESTRE DE GOIAS": "noroeste", "GUARAITA": "noroeste", "COCALINHO": "noroeste", "ARACU": "noroeste"
};

const mapCityToRegion = (city: string): string => {
  if (!city) return "outros"; 
  const c = city.trim().toUpperCase();
  return cityToRegionMap[c] || "outros"; 
};

const getUniqueId = (r: ApiRancher) => `${r.COD_PRODUTOR}-${r.INSCRICAO || 'sn'}-${r.NOME_FAZENDA}-${r.MUNICIPIO}`;

export default function Agendamento() {
  const { user } = useAuth();
  
  const [apiDataBruto, setApiDataBruto] = useState<ApiRancher[]>([]);
  const [historicoData, setHistoricoData] = useState<ApiHistoricoCompra[]>([]);
  const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ESTADOS DA PESQUISA GLOBAL
  const [globalSearch, setGlobalSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [regionFilterAtiva, setRegionFilterAtiva] = useState<string | null>(null);

  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [selectedRanchers, setSelectedRanchers] = useState<string[]>([]); 
  const [isSchedulingMode, setIsSchedulingMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15); 
  
  // 👇 ESTADOS DOS FILTROS INTERNOS 👇
  const [filterText, setFilterText] = useState("");
  const [filterCar, setFilterCar] = useState("Todos");
  const [filterHab, setFilterHab] = useState("Todos"); 
  const [filterJaVendeu, setFilterJaVendeu] = useState("Todos"); 
  const [filterRepStatus, setFilterRepStatus] = useState("Todos"); 
  const [filterNomeRep, setFilterNomeRep] = useState(""); 
  
  // 👇 ESTADOS DA TIMELINE (12, 24, 36, 48, 60+) 👇
  const [mesesFiltro, setMesesFiltro] = useState<number>(12); 
  const [flashAnimation, setFlashAnimation] = useState<boolean>(false);
  
  const [sortColumn, setSortColumn] = useState<string | null>("quantidade");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>("desc");
  
  const [aiMode, setAiMode] = useState<string | null>(null);
  const [showAiMenu, setShowAiMenu] = useState<boolean>(false); 
  
  const [scheduleDate, setScheduleDate] = useState("");
  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      const [dataPecuaristas, dataUsuarios, dataHistorico] = await Promise.all([
        fetchPecuaristasAgendamento(),
        api.getUsuarios(),
        api.fetchHistoricoCompras() // <-- BATE NA API DO HISTÓRICO
      ]);
      
      const uniqueDataMap = new Map();
      dataPecuaristas.forEach((item: any) => {
        const uid = getUniqueId(item);
        if (!uniqueDataMap.has(uid)) {
          uniqueDataMap.set(uid, item);
        }
      });
      
      setApiDataBruto(Array.from(uniqueDataMap.values()));
      setUsuariosData(dataUsuarios);
      setHistoricoData(dataHistorico);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // 👇 LÓGICA DE CRUZAMENTO DE DADOS (Pecuarista + Histórico por Meses) 👇
  const apiDataComHistorico = useMemo(() => {
    if (!apiDataBruto.length) return [];
    
    const hoje = new Date();
    // Calcula a data de corte baseada no filtro selecionado (ex: 24 meses atrás)
    const dataCorte = new Date(hoje.setMonth(hoje.getMonth() - mesesFiltro));
    const dataCorteString = dataCorte.toISOString().split('T')[0].substring(0, 7); // Formato YYYY-MM

    return apiDataBruto.map(rancher => {
      // Se for 12 meses (padrão da View do Oracle), não precisa recalcular
      if (mesesFiltro === 12) {
        return {
          ...rancher,
          totalChinaCalculado: Number(rancher.QTD_COMPRADA_12M_CHINA) || 0,
          totalNaoChinaCalculado: Number(rancher.QTD_COMPRADA_12M_NAO_CHINA) || 0,
          totalCompradoCalculado: (Number(rancher.QTD_COMPRADA_12M_CHINA) || 0) + (Number(rancher.QTD_COMPRADA_12M_NAO_CHINA) || 0)
        };
      }

      // Se o usuário selecionou 24, 36, 48, etc., a gente soma cruzando com a tabela de Histórico
      const historicoFazenda = historicoData.filter(h => 
        h.COD_PRODUTOR === rancher.COD_PRODUTOR && 
        // Compara ignorando os limites de tempo caso seja "60+" (pra 60+ a gente soma a vida toda)
        (mesesFiltro === 60 ? true : h.MES_ANO >= dataCorteString)
      );

      const chinaSomado = historicoFazenda.reduce((acc, curr) => acc + (Number(curr.QTD_CHINA) || 0), 0);
      const naoChinaSomado = historicoFazenda.reduce((acc, curr) => acc + (Number(curr.QTD_NAO_CHINA) || 0), 0);

      return {
        ...rancher,
        totalChinaCalculado: chinaSomado,
        totalNaoChinaCalculado: naoChinaSomado,
        totalCompradoCalculado: chinaSomado + naoChinaSomado
      };
    });
  }, [apiDataBruto, historicoData, mesesFiltro]);

  // Animação de Flash quando troca os meses
  useEffect(() => {
    setFlashAnimation(true);
    const timer = setTimeout(() => setFlashAnimation(false), 800);
    return () => clearTimeout(timer);
  }, [mesesFiltro]);

  const regionsData = useMemo(() => {
    const regionsMap: Record<string, { id: string, name: string, description: string, ranchers: ApiRancher[] }> = {
      "rmg": { id: "rmg", name: "1 Região Metropolitana de Goiânia", description: "Goiânia, Aparecida, Trindade, Senador Canedo, Inhumas...", ranchers: [] },
      "rcg": { id: "rcg", name: "2 Centro Goiano", description: "Anápolis, Jaraguá, Ceres, Rialma, Rubiataba...", ranchers: [] },
      "entorno": { id: "entorno", name: "3 Entorno do Distrito Federal", description: "Águas Lindas, Luziânia, Valparaíso, Formosa...", ranchers: [] },
      "sul": { id: "sul", name: "4 Sul Goiano", description: "Itumbiara, Morrinhos, Caldas Novas, Goiatuba...", ranchers: [] },
      "sudoeste": { id: "sudoeste", name: "5 Sudoeste Goiano", description: "Rio Verde, Jataí, Mineiros, Quirinópolis...", ranchers: [] },
      "sudeste": { id: "sudeste", name: "6 Sudeste Goiano", description: "Catalão, Ipameri, Pires do Rio, Silvânia...", ranchers: [] },
      "norte": { id: "norte", name: "7 Norte Goiano", description: "Porangatu, Uruaçu, Niquelândia, Minaçu...", ranchers: [] },
      "nordeste": { id: "nordeste", name: "8 Nordeste Goiano", description: "Posse, Campos Belos, São Domingos...", ranchers: [] },
      "oeste": { id: "oeste", name: "9 Oeste Goiano", description: "Iporá, São Luís de MB, Piranhas, Caiapônia...", ranchers: [] },
      "noroeste": { id: "noroeste", name: "10 Noroeste Goiano", description: "Goiás, Itaberaí, Itapuranga, Aruanã...", ranchers: [] },
      "outros": { id: "outros", name: "Outras Regiões / Não Mapeadas", description: "Cidades fora do mapeamento padrão de Goiás.", ranchers: [] }
    };

    apiDataComHistorico.forEach(rancher => {
      const regionId = mapCityToRegion(rancher.MUNICIPIO);
      regionsMap[regionId].ranchers.push(rancher);
    });

    return Object.values(regionsMap);
  }, [apiDataComHistorico]);

  const globalSearchResults = useMemo<GlobalSearchItem[]>(() => {
    if (globalSearch.length < 2) return [];
    
    const search = globalSearch.toLowerCase();
    
    const todasCidades = Array.from(new Set(apiDataComHistorico.map(r => r.MUNICIPIO)));
    const cidadesFiltradas: GlobalSearchItem[] = todasCidades
      .filter(c => c.toLowerCase().includes(search))
      .map(c => ({ tipo: 'cidade', valor: c }));

    const fazendasFiltradas: GlobalSearchItem[] = apiDataComHistorico
      .filter(r => 
        r.NOME_FAZENDA.toLowerCase().includes(search) || 
        r.NOME_PRODUTOR.toLowerCase().includes(search)
      )
      .slice(0, 10) 
      .map(r => ({ tipo: 'fazenda', valor: r.NOME_FAZENDA, produtor: r.NOME_PRODUTOR, cidade: r.MUNICIPIO }));

    return [...cidadesFiltradas.slice(0, 5), ...fazendasFiltradas];
  }, [globalSearch, apiDataComHistorico]);

  const handleSelectGlobalSearch = (item: GlobalSearchItem) => {
    const regionId = mapCityToRegion(item.tipo === 'cidade' ? item.valor : (item.cidade || ''));
    
    setGlobalSearch("");
    setIsSearchFocused(false);
    setRegionFilterAtiva(regionId);
    setExpandedRegion(null); 
    
    if (item.tipo === 'cidade') {
      setFilterText(item.valor);
    } else {
      setFilterText(item.produtor || item.valor); 
    }

    setFilterCar("Todos"); 
    setFilterHab("Todos");
    setFilterJaVendeu("Todos"); 
    setFilterRepStatus("Todos");
    setFilterNomeRep("");
    setSortColumn("quantidade"); 
    setSortDirection("desc");
    setVisibleCount(15); 
    setAiMode(null); 
    setShowAiMenu(false);
  };

  const handleClearGlobalFilter = () => {
    setRegionFilterAtiva(null);
    setFilterText("");
  };

  const handleExpandRegion = (regionId: string | null) => {
    setExpandedRegion(regionId);
    
    if (regionId && regionFilterAtiva !== regionId) {
      setFilterText(""); 
      setFilterCar("Todos"); 
      setFilterHab("Todos");
      setFilterJaVendeu("Todos"); 
      setFilterRepStatus("Todos");
      setFilterNomeRep("");
      setSortColumn("quantidade"); 
      setSortDirection("desc");
      setVisibleCount(15); 
      setAiMode(null); 
      setShowAiMenu(false);
      setRegionFilterAtiva(null); 
    }
  };

  // 👇 LÓGICA DE EXIBIÇÃO DE QUANTIDADE (Usa os campos calculados agora) 👇
  const getDisplayQuantidade = (r: ApiRancher) => {
    const china = r.totalChinaCalculado || 0;
    const naoChina = r.totalNaoChinaCalculado || 0;
    
    if (filterHab === "China") return china;
    if (filterHab === "Não China") return naoChina;
    return china + naoChina; 
  };

  const activeRegionData = useMemo(() => {
    if (!expandedRegion) return null;
    const region = regionsData.find(r => r.id === expandedRegion);
    if (!region) return null;

    let visibleRanchers = [...region.ranchers];

    visibleRanchers = visibleRanchers.filter(r => {
      const searchTerm = filterText.toLowerCase();
      const matchText = filterText === "" || 
        r.MUNICIPIO.toLowerCase().includes(searchTerm) ||
        r.NOME_PRODUTOR.toLowerCase().includes(searchTerm) ||
        r.NOME_FAZENDA.toLowerCase().includes(searchTerm);

      const matchCar = filterCar === "Todos" || r.POSSUI_CAR === filterCar;
      const matchHab = filterHab === "Todos" || 
        (filterHab === "China" && (r.totalChinaCalculado || 0) > 0) ||
        (filterHab === "Não China" && (r.totalNaoChinaCalculado || 0) > 0);
      
      const matchJaVendeu = filterJaVendeu === "Todos" || r.JA_VENDEU === filterJaVendeu;
      const matchRepStatus = filterRepStatus === "Todos" || r.VENDAREPRESENTANTE === filterRepStatus;
      
      const matchNomeRep = filterNomeRep === "" || 
        (r.NOME_REPRESENTANTE && r.NOME_REPRESENTANTE.toLowerCase().includes(filterNomeRep.toLowerCase()));

      return matchText && matchCar && matchHab && matchJaVendeu && matchRepStatus && matchNomeRep; 
    });

    if (aiMode) {
      visibleRanchers.sort((a, b) => {
        if (aiMode === 'volume') return calculateScoreVolume(b, filterHab) - calculateScoreVolume(a, filterHab);
        if (aiMode === 'prospeccao') return calculateScoreProspeccao(b) - calculateScoreProspeccao(a); 
        if (aiMode === 'logistica') return calculateScoreLogistica(b, filterHab) - calculateScoreLogistica(a, filterHab);
        return 0;
      });
    } else if (sortColumn && sortDirection) {
      visibleRanchers.sort((a, b) => {
        let valA: any, valB: any;
        
        if (sortColumn === 'cidade') { valA = a.MUNICIPIO; valB = b.MUNICIPIO; }
        else if (sortColumn === 'distancia') { valA = Number(a.DISTANCIA_CADASTRADA) || 0; valB = Number(b.DISTANCIA_CADASTRADA) || 0; }
        else if (sortColumn === 'quantidade') { valA = getDisplayQuantidade(a); valB = getDisplayQuantidade(b); }
        else if (sortColumn === 'car') { valA = a.POSSUI_CAR; valB = b.POSSUI_CAR; }
        else if (sortColumn === 'javendeu') { valA = a.JA_VENDEU; valB = b.JA_VENDEU; }
        else if (sortColumn === 'representante') { valA = a.NOME_REPRESENTANTE || ""; valB = b.NOME_REPRESENTANTE || ""; }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const currentUniqueCitiesArray = Array.from(new Set(visibleRanchers.map(r => r.MUNICIPIO))).sort();
    const allCitiesString = currentUniqueCitiesArray.length > 0 ? currentUniqueCitiesArray.join(", ") : "Nenhuma cidade encontrada com os filtros.";
    const currentCitiesCount = currentUniqueCitiesArray.length;
    const currentTotalComprados = visibleRanchers.reduce((sum, r) => sum + getDisplayQuantidade(r), 0);
    const displayedRanchers = aiMode ? visibleRanchers.slice(0, 10) : visibleRanchers.slice(0, visibleCount);

    return {
      ...region,
      visibleRanchers,
      allCitiesString,
      currentCitiesCount,
      currentTotalComprados,
      displayedRanchers
    };
  }, [expandedRegion, regionsData, filterText, filterCar, filterHab, filterJaVendeu, filterRepStatus, filterNomeRep, aiMode, sortColumn, sortDirection, visibleCount, mesesFiltro]);

  const handleSort = (column: string) => {
    setAiMode(null); 
    if (sortColumn === column) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") { setSortColumn(null); setSortDirection(null); }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (column: string) => {
    if (aiMode) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const toggleRancher = (uniqueId: string) => {
    setSelectedRanchers((prev) => prev.includes(uniqueId) ? prev.filter(id => id !== uniqueId) : [...prev, uniqueId]);
  };

  const toggleAllVisible = (visibleRanchers: ApiRancher[]) => {
    const visibleIds = visibleRanchers.map(getUniqueId);
    const allSelected = visibleIds.every(id => selectedRanchers.includes(id));
    if (allSelected) {
      setSelectedRanchers(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedRanchers(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const selectedRanchersData = useMemo(() => apiDataComHistorico.filter(r => selectedRanchers.includes(getUniqueId(r))), [selectedRanchers, apiDataComHistorico]);

  const handleConfirmSchedule = async () => {
    if (!scheduleDate || !searchUser) {
      toast.error("Por favor, selecione a data e o comprador responsável.");
      return;
    }

    const userObj = usuariosData.find(u => u.CODUSUARIO.toUpperCase() === searchUser.toUpperCase());
    
    if (!userObj) {
      toast.error("Usuário não encontrado! Escolha uma opção válida da lista.");
      return;
    }

    setIsSaving(true);
    const compradorId = userObj.SEQUSUARIO; 
    let salvos = 0;

    try {
      for (const r of selectedRanchersData) {
        const resultado = await saveAgendamento({
          cod_produtor: r.COD_PRODUTOR,
          id_comprador: compradorId, 
          data_agendada: scheduleDate,
          status_agendamento: "Pendente",
          inscricao: r.INSCRICAO
        });
        
        if(!resultado.success) {
           toast.error(`Falha ao salvar agendamento para ${r.NOME_PRODUTOR}`);
           setIsSaving(false);
           return;
        }
        salvos++;
      }

      toast.success(`${salvos} visita(s) agendada(s) e gravada(s) no banco com sucesso!`);
      setSelectedRanchers([]);
      setScheduleDate("");
      setSearchUser("");
      setIsSchedulingMode(false);
      
    } catch (error) {
       toast.error("Ocorreu um erro crítico durante a gravação.");
    } finally {
       setIsSaving(false);
    }
  };

  const handleSetAiMode = (mode: string | null, message: string) => {
    setAiMode(mode);
    setShowAiMenu(false);
    if (mode) toast.success(message);
    else toast.info(message);
  };

  const renderCompradosDetalhes = (r: ApiRancher) => {
    if (filterHab !== "Todos") return null;
    const china = r.totalChinaCalculado || 0;
    const naoChina = r.totalNaoChinaCalculado || 0;
    const total = china + naoChina;
    if (total === 0) return null;
    const pctChina = Math.round((china / total) * 100);
    const pctNaoChina = Math.round((naoChina / total) * 100);
    return (
      <span className="text-[11px] font-bold text-slate-800 mt-0.5 bg-slate-100 px-2 py-0.5 rounded shadow-sm border border-slate-200">
        {pctChina}% China / {pctNaoChina}% N-China
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-surface">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Carregando base de dados...</h2>
        <p className="text-slate-500">Por favor aguarde um momento.</p>
      </div>
    );
  }

  if (isSchedulingMode) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 border-b pb-4">
          <Button variant="outline" size="icon" onClick={() => setIsSchedulingMode(false)} disabled={isSaving}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Finalizar Agendamento</h1>
            <p className="text-muted-foreground text-sm">Atribua a data e o comprador para as visitas.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 border-primary/20 shadow-md h-fit">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-primary" /> Configurar Agenda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data da Visita</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="date" className="pl-9 h-11 bg-white" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} disabled={isSaving} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comprador Responsável</Label>
                <div className="relative">
                  <UserSquare2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    list="usuarios-list"
                    className="pl-9 h-11 bg-white uppercase"
                    placeholder="Digite para buscar usuário..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value.toUpperCase())}
                    disabled={isSaving}
                    autoComplete="off"
                  />
                  <datalist id="usuarios-list">
                    {usuariosData.map(u => (
                      <option key={u.SEQUSUARIO} value={u.CODUSUARIO} />
                    ))}
                  </datalist>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t p-4">
              <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold" onClick={handleConfirmSchedule} disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> SALVANDO...</> : "REALIZAR AGENDAMENTO"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="md:col-span-2 shadow-sm border-slate-200">
            <CardHeader className="border-b bg-white">
              <CardTitle className="text-base text-slate-700">Pecuaristas Selecionados ({selectedRanchers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-xs">Produtor / Fazenda</TableHead>
                    <TableHead className="font-semibold text-xs">Cidade</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Comprados ({mesesFiltro}m)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRanchersData.map((r) => {
                    const uniqueId = getUniqueId(r);
                    return (
                      <TableRow key={uniqueId}>
                        <TableCell>
                          <p className="font-black text-[15px] text-slate-900 uppercase">{r.NOME_PRODUTOR}</p>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {r.NOME_FAZENDA} <span className="font-normal">(IE: <span className="text-slate-800 font-bold">{r.INSCRICAO || "N/A"}</span>)</span>
                          </p>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{r.MUNICIPIO}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-bold text-blue-700">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-blue-700 text-base">{formatNumber(getDisplayQuantidade(r))}</span>
                            {renderCompradosDetalhes(r)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const displayedRegionsCards = regionFilterAtiva 
    ? regionsData.filter(r => r.id === regionFilterAtiva)
    : regionsData;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in relative pb-24">
      
      <header className="border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-primary flex items-center gap-2">
            <CalendarPlus className="w-7 h-7" /> Agendamento de Visitas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selecione as regiões para explorar a base de pecuaristas e gerar rotas otimizadas.
          </p>
        </div>

        <div className="relative w-full md:w-80 lg:w-96 z-40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Pesquisar Cidade, Produtor ou Fazenda..." 
              className="pl-9 h-11 bg-white border-slate-300 shadow-sm font-medium focus-visible:ring-primary"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
            />
            {globalSearch && (
              <button 
                onClick={() => { setGlobalSearch(""); setIsSearchFocused(false); }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {isSearchFocused && globalSearch.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-80 overflow-y-auto">
              {globalSearchResults.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">Nenhum resultado encontrado.</div>
              ) : (
                <div className="py-2">
                  {globalSearchResults.map((item, i) => (
                    <div 
                      key={i} 
                      className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0"
                      onClick={() => handleSelectGlobalSearch(item)}
                    >
                      {item.tipo === 'cidade' ? (
                        <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : (
                        <UserSquare2 className="w-4 h-4 text-green-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-700 uppercase leading-none">
                          {item.tipo === 'cidade' ? item.valor : item.produtor}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase">
                          {item.tipo === 'cidade' ? 'FILTRAR POR CIDADE' : `${item.valor} • ${item.cidade}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {isSearchFocused && (
        <div className="fixed inset-0 z-30" onClick={() => setIsSearchFocused(false)} />
      )}

      {regionFilterAtiva && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm font-bold text-blue-800">Mostrando apenas a região que contém sua busca.</p>
              <p className="text-xs text-blue-600 font-medium">Você pesquisou por: <strong className="uppercase">{filterText}</strong></p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleClearGlobalFilter} className="bg-white hover:bg-blue-100 text-blue-700 border-blue-200">
            Limpar Busca
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
        {displayedRegionsCards.map((region) => {
          if (region.id === "outros" && region.ranchers.length === 0) return null;

          return (
            <Card 
              key={region.id} 
              className={`cursor-pointer border-slate-200 hover:border-primary/50 hover:shadow-lg transition-all duration-200 flex flex-col group ${regionFilterAtiva ? 'bg-blue-50/30 ring-2 ring-blue-500/20' : 'bg-white'}`}
              onClick={() => handleExpandRegion(region.id)}
            >
              <CardContent className="p-5 flex-grow flex flex-col">
                <h2 className="text-[17px] font-bold text-slate-800 flex items-center gap-2 group-hover:text-primary transition-colors">
                  <MapIcon className="w-5 h-5 text-primary opacity-80" />
                  {region.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed flex-grow">
                  {region.description}
                </p>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="inline-flex items-center text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md">
                    <Users className="w-3.5 h-3.5 mr-1" /> {region.ranchers.length} Propriedades
                  </span>
                  <div className="text-slate-300 group-hover:text-primary/70 transition-colors">
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {expandedRegion && activeRegionData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-50 w-full max-w-7xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative border border-slate-700/20">
            
            <div className="bg-white border-b border-slate-200 p-5 md:p-6 shrink-0 flex flex-col gap-4 relative z-20 shadow-sm">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 pr-8">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <MapIcon className="w-6 h-6 text-primary" /> 
                    {activeRegionData.name}
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2" title={activeRegionData.allCitiesString}>
                    <span className="font-semibold text-slate-600">Cidades englobadas:</span> {activeRegionData.allCitiesString}
                  </p>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleExpandRegion(null)} 
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center text-[10px] md:text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-md border border-slate-200">
                    <Building2 className="w-3.5 h-3.5 mr-1" /> {activeRegionData.currentCitiesCount} Cidades
                  </span>
                  <span className={`inline-flex items-center text-[10px] md:text-xs font-bold px-2.5 py-1.5 rounded-md border ${activeRegionData.visibleRanchers.length > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    <Users className="w-3.5 h-3.5 mr-1" /> {activeRegionData.visibleRanchers.length} Propriedades
                  </span>
                  <span className="bg-blue-600 text-white text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-md shadow-sm border border-blue-700">
                    {formatNumber(activeRegionData.currentTotalComprados)} cab. compradas
                  </span>
                </div>

                <div className="relative">
                  {showAiMenu && (
                    <div 
                      className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 shadow-2xl rounded-xl p-3 flex flex-col gap-2 z-[150] animate-in fade-in slide-in-from-top-2"
                      onClick={(e) => e.stopPropagation()} 
                    >
                      <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1 px-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> Foco da Sugestão
                      </Label>
                      <Button 
                        variant={aiMode === 'volume' ? 'default' : 'outline'} size="sm"
                        className={`justify-start h-8 text-xs font-bold ${aiMode === 'volume' ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                        onClick={() => handleSetAiMode('volume', 'Sugerindo: Parceiros & Volume')}
                      >
                        <Trophy className={`w-3.5 h-3.5 mr-2 ${aiMode === 'volume' ? 'text-amber-100' : 'text-amber-500'}`} /> Parceiros & Volume
                      </Button>
                      <Button 
                        variant={aiMode === 'prospeccao' ? 'default' : 'outline'} size="sm"
                        className={`justify-start h-8 text-xs font-bold ${aiMode === 'prospeccao' ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                        onClick={() => handleSetAiMode('prospeccao', 'Sugerindo: Prospecção (Novos)')}
                      >
                        <Target className={`w-3.5 h-3.5 mr-2 ${aiMode === 'prospeccao' ? 'text-amber-100' : 'text-amber-500'}`} /> Prospecção (Novos)
                      </Button>
                      <Button 
                        variant={aiMode === 'logistica' ? 'default' : 'outline'} size="sm"
                        className={`justify-start h-8 text-xs font-bold ${aiMode === 'logistica' ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                        onClick={() => handleSetAiMode('logistica', 'Sugerindo: Logística Otimizada')}
                      >
                        <Truck className={`w-3.5 h-3.5 mr-2 ${aiMode === 'logistica' ? 'text-amber-100' : 'text-amber-500'}`} /> Logística Otimizada
                      </Button>
                      
                      {aiMode && (
                        <Button 
                          variant="ghost" size="sm"
                          className="justify-start h-8 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 mt-1"
                          onClick={() => handleSetAiMode(null, 'Sugestão Inteligente removida.')}
                        >
                          Remover Sugestão
                        </Button>
                      )}
                    </div>
                  )}

                  <Button 
                    size="sm"
                    className={`h-9 text-xs font-bold px-4 ${aiMode ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none shadow-md shadow-amber-500/30" : "bg-gradient-to-r from-orange-50 to-amber-50 border border-amber-500 text-amber-600 hover:from-amber-100 hover:to-orange-100"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAiMenu(!showAiMenu);
                    }}
                  >
                    <Sparkles className={`w-4 h-4 mr-2 ${aiMode ? "text-white" : "text-amber-500"}`} />
                    {aiMode ? "SUGESTÃO ATIVA" : "SUGERIR VISITAS COM IA"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30 relative">
              
              <div className="bg-white p-4 border-b border-slate-200 flex flex-col md:flex-row flex-wrap gap-3 items-end shrink-0 shadow-sm z-10">
                <div className="space-y-1.5 flex-1 w-full min-w-[200px]">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Buscar Produtor, Fazenda ou Cidade</Label>
                  <Input 
                    placeholder="Digite para buscar nesta região..." 
                    className="h-9 bg-white text-xs border-slate-300 focus-visible:ring-primary"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 w-full md:w-28">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">CAR</Label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={filterCar} onChange={(e) => setFilterCar(e.target.value)}
                  >
                    <option value="Todos">Todos</option>
                    <option value="S">Sim</option>
                    <option value="N">Não</option>
                  </select>
                </div>
                
                {filterJaVendeu !== "N" && (
                  <div className="space-y-1.5 w-full md:w-32">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Habilitação</Label>
                    <select 
                      className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={filterHab} onChange={(e) => setFilterHab(e.target.value)}
                    >
                      <option value="Todos">Todos</option>
                      <option value="China">China</option>
                      <option value="Não China">Não China</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1.5 w-full md:w-28">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Já Compramos?</Label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={filterJaVendeu} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilterJaVendeu(val);
                      // Tirei a limpeza de dados aqui para os filtros não sumirem e o cara ficar travado
                    }}
                  >
                    <option value="Todos">Todos</option>
                    <option value="S">Sim</option>
                    <option value="N">Não</option>
                  </select>
                </div>

                {/* 👇 FILTROS DO REPRESENTANTE 👇 */}
                {filterJaVendeu !== "N" && (
                  <>
                    <div className="space-y-1.5 w-full md:w-32">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Representação?</Label>
                      <select 
                        className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={filterRepStatus} 
                        onChange={(e) => {
                          setFilterRepStatus(e.target.value);
                          if (e.target.value !== "S") setFilterNomeRep(""); 
                        }}
                      >
                        <option value="Todos">Todos</option>
                        <option value="S">Sim</option>
                        <option value="N">Não</option>
                      </select>
                    </div>
                    {filterRepStatus === "S" && (
                      <div className="space-y-1.5 w-full md:w-40 animate-in fade-in">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Nome Representante</Label>
                        <Input 
                          placeholder="Buscar rep..." 
                          className="h-9 bg-white text-xs border-slate-300 focus-visible:ring-primary"
                          value={filterNomeRep}
                          onChange={(e) => setFilterNomeRep(e.target.value)}
                        />
                      </div>
                    )}
                  </>
                )}

                <Button 
                  variant="outline" size="icon" className="h-9 w-9 text-slate-500 hover:text-slate-800 border-slate-300 shrink-0 bg-white"
                  title="Limpar todos os filtros"
                  onClick={() => { 
                    setFilterText(""); 
                    setFilterCar("Todos"); 
                    setFilterHab("Todos"); 
                    setFilterJaVendeu("Todos"); 
                    setFilterRepStatus("Todos"); 
                    setFilterNomeRep("");
                    setMesesFiltro(12);
                    setSortColumn("quantidade"); 
                    setSortDirection("desc"); 
                    setVisibleCount(15); 
                    setAiMode(null); 
                    setShowAiMenu(false); 
                  }}
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 relative">
                {activeRegionData.visibleRanchers.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                    <div className="bg-white p-4 rounded-full shadow-sm border border-slate-100 mb-4">
                      <Users className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Nenhum pecuarista encontrado</h3>
                    <p className="text-sm mt-1">Tente remover alguns filtros da barra superior para exibir resultados.</p>
                  </div>
                ) : (
                  <Card className="shadow-sm border-slate-200 overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                          <TableRow>
                            <TableHead className="w-[50px] text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                                checked={activeRegionData.visibleRanchers.length > 0 && activeRegionData.visibleRanchers.every(r => selectedRanchers.includes(getUniqueId(r)))}
                                onChange={() => toggleAllVisible(activeRegionData.visibleRanchers)}
                              />
                            </TableHead>
                            
                            <TableHead className="text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('cidade')}>
                              <div className="flex items-center gap-1">Cidade {renderSortIcon('cidade')}</div>
                            </TableHead>
                            
                            {/* TÍTULO DA COLUNA ALTERADO: PRODUTOR VEM ANTES */}
                            <TableHead className="text-xs font-bold text-slate-700">Produtor / Fazenda</TableHead>
                            
                            <TableHead className="text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('distancia')}>
                              <div className="flex items-center gap-1">Distância {renderSortIcon('distancia')}</div>
                            </TableHead>

                            {/* 👇 COLUNA DA QUANTIDADE COM SELETOR DE MESES TRAVADO 👇 */}
                            <TableHead className="text-xs font-bold text-slate-700 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div 
                                  className="cursor-pointer hover:bg-slate-200 px-2 py-1 rounded flex items-center gap-1 select-none transition-colors" 
                                  onClick={() => handleSort('quantidade')}
                                >
                                  Comprados {renderSortIcon('quantidade')}
                                </div>
                                <select 
                                  className="h-7 w-20 text-[10px] font-black rounded-md border border-slate-300 bg-white px-1.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-600"
                                  value={mesesFiltro} 
                                  onChange={(e) => setMesesFiltro(Number(e.target.value))}
                                >
                                  <option value={12}>12 M</option>
                                  <option value={24}>24 M</option>
                                  <option value={36}>36 M</option>
                                  <option value={48}>48 M</option>
                                  <option value={60}>60+ M</option>
                                </select>
                              </div>
                            </TableHead>
                            
                            <TableHead className="text-xs font-bold text-slate-700 text-center cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('car')}>
                              <div className="flex items-center justify-center gap-1">CAR {renderSortIcon('car')}</div>
                            </TableHead>
                            
                            <TableHead className="text-xs font-bold text-slate-700 text-center cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('javendeu')}>
                              <div className="flex items-center justify-center gap-1">Já Compramos? {renderSortIcon('javendeu')}</div>
                            </TableHead>

                            {/* 👇 COLUNA DE ÚLTIMA VISITA 👇 */}
                            <TableHead className="text-xs font-bold text-slate-700 text-center">Últ. Visita</TableHead>
                            
                            {/* 👇 COLUNA DO REPRESENTANTE 👇 */}
                            <TableHead className="text-xs font-bold text-slate-700 text-center cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('representante')}>
                              <div className="flex items-center justify-center gap-1">Nome Representante {renderSortIcon('representante')}</div>
                            </TableHead>

                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeRegionData.displayedRanchers.map((r, index) => {
                            const uniqueId = getUniqueId(r);
                            const isSelected = selectedRanchers.includes(uniqueId);
                            const displayQuantidade = getDisplayQuantidade(r);

                            return (
                              <TableRow 
                                key={uniqueId} 
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                                onClick={() => toggleRancher(uniqueId)}
                              >
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                                    checked={isSelected}
                                    onChange={() => toggleRancher(uniqueId)}
                                  />
                                </TableCell>
                                <TableCell className="text-sm font-medium text-slate-700">
                                  {aiMode && <span className="inline-block mr-2 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">#{index + 1}</span>}
                                  {r.MUNICIPIO}
                                </TableCell>
                                <TableCell>
                                  {/* 👇 INVERTIDO: NOME_PRODUTOR EM CIMA E NOME_FAZENDA EMBAIXO 👇 */}
                                  <p className="font-black text-[15px] text-slate-900 uppercase">{r.NOME_PRODUTOR}</p>
                                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                    {r.NOME_FAZENDA} <span className="font-normal">(IE: <span className="text-slate-800 font-bold">{r.INSCRICAO || "N/A"}</span>)</span>
                                  </p>
                                </TableCell>
                                <TableCell className="text-sm tabular-nums text-slate-600">{formatNumber(r.DISTANCIA_CADASTRADA)} km</TableCell>
                                
                                {/* 👇 CÉLULA DA QUANTIDADE (COM O FLASH AZUL) 👇 */}
                                <TableCell className={`text-right tabular-nums text-sm font-bold text-blue-700 transition-colors duration-500 ${flashAnimation ? 'bg-blue-100/80' : ''}`}>
                                  <div className="flex flex-col items-end">
                                    <span className="font-bold text-blue-700 text-base">{formatNumber(displayQuantidade)}</span>
                                    {renderCompradosDetalhes(r)}
                                  </div>
                                </TableCell>

                                <TableCell className="text-center">
                                  {r.POSSUI_CAR === "S" 
                                    ? <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">SIM</span>
                                    : <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">NÃO</span>
                                  }
                                </TableCell>
                                <TableCell className="text-center">
                                  {r.JA_VENDEU === "S" 
                                    ? <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">SIM</span>
                                    : <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">NÃO</span>
                                  }
                                </TableCell>

                                {/* 👇 CÉLULA DA DATA DA ÚLTIMA VISITA 👇 */}
                                <TableCell className="text-center text-xs font-medium text-slate-500">
                                  {r.DATA_ULTIMA_VISITA ? new Date(r.DATA_ULTIMA_VISITA).toLocaleDateString('pt-BR') : "-"}
                                </TableCell>
                                
                                {/* 👇 CÉLULA DO REPRESENTANTE (VERMELHO CLARO) 👇 */}
                                <TableCell className={`text-center text-[11px] font-black uppercase ${r.NOME_REPRESENTANTE ? 'bg-red-50 text-red-700' : 'text-slate-400'}`}>
                                  {r.NOME_REPRESENTANTE || "-"}
                                </TableCell>

                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {(!aiMode && activeRegionData.visibleRanchers.length > visibleCount) && (
                      <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-center">
                        <Button 
                          variant="outline" 
                          className="font-bold text-primary flex items-center gap-2 hover:bg-primary hover:text-white transition-colors bg-white"
                          onClick={() => setVisibleCount(prev => prev + 15)}
                        >
                          CARREGAR MAIS RESULTADOS <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRanchers.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-[200] flex justify-center animate-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 border border-slate-700">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-green-400" />
              <span className="font-bold text-sm">
                {selectedRanchers.length} {selectedRanchers.length === 1 ? 'propriedade selecionada' : 'propriedades selecionadas'}
              </span>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold rounded-full px-8" onClick={() => setIsSchedulingMode(true)}>
              AGENDAR VISITAS
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}