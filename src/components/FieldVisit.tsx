import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Navigation,
  MapPin,
  Loader2,
  CheckCircle2,
  Phone,
  User,
  FileText,
  Landmark,
  Search,
  UserPlus,
  X,
  CalendarClock,
  Plus,
  Building2,
  Calendar as CalendarIcon,
  AlertCircle,
  MapPinOff,
  RefreshCw,
  Maximize2,
  Eraser,    
  Check,
  ChevronRight,
  Camera, 
  ImageIcon, 
  Trash2, 
  ClipboardCheck 
} from "lucide-react";
import { api, fetchPecuaristasAgendamento, fetchAgendamentosPendentes, type ApiRancher, type ApiAgendamento, type ApiUsuario } from "@/services/api";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import SignatureCanvas from 'react-signature-canvas';

type Step = "idle" | "routing" | "form";

const CHECKLIST_TEMPLATE = [
  // 1. MANEJO PRÉ ABATE
  { id: 'c1_1', category: '1- MANEJO PRÉ ABATE', text: 'Horário de fechamento dos animais: preferência nas horas mais frescas do dia', severity: 'Menor' },
  { id: 'c1_2', category: '1- MANEJO PRÉ ABATE', text: 'Horário de pesagem e embarque nos horários mais frescos', severity: 'Menor' },
  { id: 'c1_3', category: '1- MANEJO PRÉ ABATE', text: 'Condições dos currais, tronco, cercas e porteiras em boas condições de uso', severity: 'Menor' },
  { id: 'c1_4', category: '1- MANEJO PRÉ ABATE', text: 'Condições do piso: deverá evitar quedas, escorregões e atolamentos', severity: 'Menor' },
  { id: 'c1_5', category: '1- MANEJO PRÉ ABATE', text: 'Rampa de embarque: preferencialmente cimentada, com inclinação adequada', severity: 'Menor' },
  { id: 'c1_6', category: '1- MANEJO PRÉ ABATE', text: 'O uso de bastões elétricos: deverá ser evitado', severity: 'Maior' },
  { id: 'c1_7', category: '1- MANEJO PRÉ ABATE', text: 'O uso de bastão perfurocortante (Ferrão): não deverá ser usado', severity: 'Crítico' },
  { id: 'c1_8', category: '1- MANEJO PRÉ ABATE', text: 'Gritos e ruídos: deverão ser moderados sem excessos', severity: 'Maior' },

  // 2. SISTEMA DE CRIAÇÃO
  { id: 'c2_1', category: '2. SISTEMA DE CRIAÇÃO DOS ANIMAIS', text: 'Sistema Intensivo: as condições do local de manejo adequadas à finalidade', severity: 'Maior' },
  { id: 'c2_2', category: '2. SISTEMA DE CRIAÇÃO DOS ANIMAIS', text: 'Sistema Extensivo: manejo de forma tranquila (Bem Estar Animal)', severity: 'Maior' },
  { id: 'c2_3', category: '2. SISTEMA DE CRIAÇÃO DOS ANIMAIS', text: 'Sistema Semi Intensivo: etapas de manejo bem definidas e alimentação garantida', severity: 'Maior' },
  { id: 'c2_4', category: '2. SISTEMA DE CRIAÇÃO DOS ANIMAIS', text: 'A propriedade possui algum tipo de enriquecimento ambiental', severity: 'Obs' },

  // 3. MANEJO SANITÁRIO
  { id: 'c3_1', category: '3. MANEJO SANITÁRIO', text: 'Animais fora do período de carência de medicamentos', severity: 'Crítico' },
  { id: 'c3_2', category: '3. MANEJO SANITÁRIO', text: 'Proibido uso de anabolizantes', severity: 'Crítico' },
  { id: 'c3_3', category: '3. MANEJO SANITÁRIO', text: 'Uso de antibióticos somente quando prescrito', severity: 'Crítico' },
  { id: 'c3_4', category: '3. MANEJO SANITÁRIO', text: 'Comprovantes de vacinas obrigatórias', severity: 'Maior' },
  { id: 'c3_5', category: '3. MANEJO SANITÁRIO', text: 'Vacinas não obrigatórias sob prescrição', severity: 'Crítico' },
  { id: 'c3_6', category: '3. MANEJO SANITÁRIO', text: 'Endoparasitas com acompanhamento técnico', severity: 'Menor' },
  { id: 'c3_7', category: '3. MANEJO SANITÁRIO', text: 'Ectoparasitas com acompanhamento técnico', severity: 'Menor' },

  // 4. TIPO DE TRATO
  { id: 'c4_1', category: '4. TIPO DE TRATO OFERECIDO', text: 'Armazenamento adequado', severity: 'Maior' },
  { id: 'c4_2', category: '4. TIPO DE TRATO OFERECIDO', text: 'Suplementação programada', severity: 'Maior' },
  { id: 'c4_3', category: '4. TIPO DE TRATO OFERECIDO', text: 'Comprovação da alimentação via notas', severity: 'Menor' },
  { id: 'c4_4', category: '4. TIPO DE TRATO OFERECIDO', text: 'Água limpa, abundante e renovada', severity: 'Crítico' },
  { id: 'c4_5', category: '4. TIPO DE TRATO OFERECIDO', text: 'Sem produtos de origem animal ou cama de frango', severity: 'Crítico' },

  // 5. ORIGEM DO REBANHO
  { id: 'c5_1', category: '5. ORIGEM DO REBANHO', text: 'Comprovação de origem (GTA/DIA)', severity: 'Maior' },
  { id: 'c5_2', category: '5. ORIGEM DO REBANHO', text: 'Sistema de rastreabilidade na propriedade', severity: 'Maior' },

  // 6. QUALIDADE DO REBANHO
  { id: 'c6_1', category: '6. QUALIDADE DO REBANHO', text: 'Uniformidade de peso e genética', severity: 'Obs' },

  // 7. ORIENTAÇÕES
  { id: 'c7_1', category: '7. ORIENTAÇÕES', text: 'Produtor orientado sobre Bem Estar Animal', severity: 'Maior' },
  { id: 'c7_2', category: '7. ORIENTAÇÕES', text: 'Produtor orientado sobre vacinação', severity: 'Maior' },
];

interface FormData {
  id_agendamento: string;
  cod_produtor: string;
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
  tipoAtividade: string;
  habilitacao: string;
  tipoTerminacao: string;
  disp30Dias: boolean;
  qtd30Dias: string;
  sexo30Dias: string;
  status30Dias: string;
  disp60Dias: boolean;
  qtd60Dias: string;
  sexo60Dias: string;
  status60Dias: string;
  disp90Dias: boolean;
  qtd90Dias: string;
  sexo90Dias: string;
  status90Dias: string;
  numAnimais: string; 
  dataVisita: string;
  visitante: string; 
  produtorAssinatura: string;
  observacoes: string;
  imagem: string; 
  checklist: Record<string, 'C' | 'NC' | 'NA' | null>;
  checklistObs: Record<string, string>;
  checklistFinalStatus: 'APROVADA' | 'REPROVADA' | null;
}

const EMPRESA_COORDS: [number, number] = [-16.3419669, -49.4708347]; 

const cityToRegionMap: Record<string, string> = {
  "GOIANIA": "RMG", "APARECIDA DE GOIANIA": "RMG", "TRINDADE": "RMG", "SENADOR CANEDO": "RMG", "INHUMAS": "RMG", "BELA VISTA DE GOIAS": "RMG", "NEROPOLIS": "RMG", "GUAPO": "RMG", "GOIANIRA": "RMG", "ABADIA DE GOIAS": "RMG", "SANTO ANTONIO DE GOIAS": "RMG", "HIDROLANDIA": "RMG", "BONFINOPOLIS": "RMG", "CALDAZINHA": "RMG", "TEREZOPOLIS DE GOIAS": "RMG", "BRAZABRANTES": "RMG", "CATURAI": "RMG", "DAMOLANDIA": "RMG", "ITAUCU": "RMG", "TAQUARAL DE GOIAS": "RMG", "NOVA VENEZA": "RMG", "GOIANAPOLIS": "RMG", "AVELINOPOLIS": "RMG", "ARAGOIANIA": "RMG",
  "ANAPOLIS": "RCG", "JARAGUA": "RCG", "CERES": "RCG", "RIALMA": "RCG", "RUBIATABA": "RCG", "ITAPACI": "RCG", "CARMO DO RIO VERDE": "RCG", "GOIANESIA": "RCG", "PIRENOPOLIS": "RCG", "CORUMBA DE GOIAS": "RCG", "COCALZINHO DE GOIAS": "RCG", "PETROLINA DE GOIAS": "RCG", "SANTA ISABEL": "RCG", "BARRO ALTO": "RCG", "VILA PROPICIO": "RCG", "CAMPO LIMPO DE GOIAS": "RCG", "OURO VERDE DE GOIAS": "RCG", "JESUPOLIS": "RCG", "SANTA ROSA DE GOIAS": "RCG", "HEITORAI": "RCG", "ITAGUARI": "RCG", "SANTA RITA DO NOVO DESTINO": "RCG", "ITAGUARU": "RCG", "SAO FRANCISCO DE GOIAS": "RCG", "URUANA": "RCG", "SAO PATRICIO": "RCG", "NOVA AMERICA": "RCG", "MORRO AGUDO DE GOIAS": "RCG",
  "LUZIANIA": "ENTORNO", "CRISTALINA": "ENTORNO", "FORMOSA": "ENTORNO", "SANTO ANTONIO DO DESCOBERTO": "ENTORNO", "PADRE BERNARDO": "ENTORNO", "CABECEIRAS": "ENTORNO", "ABADIANIA": "ENTORNO",
  "ITUMBIARA": "SUL", "MORRINHOS": "SUL", "CALDAS NOVAS": "SUL", "GOIATUBA": "SUL", "PIRACANJUBA": "SUL", "BURITI BLEGRE": "SUL", "RIO QUENTE": "SUL", "MARZAGAO": "SUL", "AGUA LIMPA": "SUL", "ALOANDIA": "SUL", "CROMINIA": "SUL", "MAIRIPOTABA": "SUL", "PONTALINA": "SUL", "VICENTINOPOLIS": "SUL", "EDEIA": "SUL", "EDEALINA": "SUL", "INACIOLANDIA": "SUL", "GOUVELANDIA": "SUL", "ITARUMA": "SUL", "PROFESSOR JAMIL": "SUL",
  "RIO VERDE": "SUDOESTE", "JATAI": "SUDOESTE", "MINEIROS": "SUDOESTE", "QUIRINOPOLIS": "SUDOESTE", "SANTA HELENA DE GOIAS": "SUDOESTE", "SAO SIMAO": "SUDOESTE", "ACREUNA": "SUDOESTE", "MONTIVIDIU": "SUDOESTE", "TURVELANDIA": "SUDOESTE", "CASTELANDIA": "SUDOESTE", "PARANAIGUARA": "SUDOESTE", "CACU": "SUDOESTE", "CACHOEIRA ALTA": "SUDOESTE", "PEROLANDIA": "SUDOESTE", "SANTA RITA DO ARAGUAIA": "SUDOESTE", "SANTO ANTONIO DA BARRA": "SUDOESTE",
  "CATALAO": "SUDESTE", "IPAMERI": "SUDESTE", "PIRES DO RIO": "SUDESTE", "SILVANIA": "SUDESTE", "VIANOPOLIS": "SUDESTE", "ORIZONA": "SUDESTE", "OUVIDOR": "SUDESTE", "TRES RANCHOS": "SUDESTE", "GOIANDIRA": "SUDESTE", "CUMARI": "SUDESTE", "ANHANGUERA": "SUDESTE", "DAVINOPOLIS": "SUDESTE", "CORUMBAIBA": "SUDESTE", "NOVA AURORA": "SUDESTE", "CAMPO ALEGRE DE GOIAS": "SUDESTE", "LEOPOLDO DE BULHOES": "SUDESTE", "GAMELEIRA DE GOIAS": "SUDESTE", "CRISTIANOPOLIS": "SUDESTE", "URUTAI": "SUDESTE", "PALMELO": "SUDESTE", "SANTA CRUZ DE GOIAS": "SUDESTE",
  "PORANGATU": "NORTE", "URUACU": "NORTE", "NIQUELANDIA": "NORTE", "MINACU": "NORTE", "CAMPINORTE": "NORTE", "MARA ROSA": "NORTE", "ALTO HORIZONTE": "NORTE", "NOVA IGUACU DE GOIAS": "NORTE", "CAMPINACU": "NORTE", "MUTUNOPOLIS": "NORTE", "ESTRELA DO NORTE": "NORTE", "SANTA TEREZA DE GOIAS": "NORTE", "TROMBAS": "NORTE", "FORMOSO": "NORTE", "SAO LUIZ DO NORTE": "NORTE", "GUARINOS": "NORTE", "PILAR DE GOIAS": "NORTE", "AMARALINA": "NORTE", "CAMPOS VERDES": "NORTE", "SANTA TEREZINHA DE GOIAS": "NORTE", "UIRAPURU": "NORTE", "HIDROLINA": "NORTE", "BONOPOLIS": "NORTE", "NOVO PLANALTO": "NORTE", "MONTIVIDIU DO NORTE": "NORTE",
  "POSSE": "NORDESTE", "CAMPOS BELOS": "NORDESTE", "SAO DOMINGOS": "NORDESTE", "ALTO PARAISO DE GOIAS": "NORDESTE", "CAVALCANTE": "NORDESTE", "IACIARA": "NORDESTE", "ALVORADA DO NORTE": "NORDESTE", "SIMOLANDIA": "NORDESTE", "FLORES DE GOIAS": "NORDESTE", "GUARANI DE GOIAS": "NORDESTE", "COLINAS DO SUL": "NORDESTE", "MONTE ALEGRE DE GOIAS": "NORDESTE", "SITIO D ABADIA": "NORDESTE",
  "IPORA": "OESTE", "SAO LUIS DE MONTES BELOS": "OESTE", "PIRANHAS": "OESTE", "CAIAPONIA": "OESTE", "ARAGARCAS": "OESTE", "JUSSARA": "OESTE", "FAZENDA NOVA": "OESTE", "ISRAELANDIA": "OESTE", "IVOLANDIA": "OESTE", "MOIPORA": "OESTE", "CACHOEIRA DE GOIAS": "OESTE", "AURILANDIA": "OESTE", "FIRMINOPOLIS": "OESTE", "TURVANIA": "OESTE", "PALMINOPOLIS": "OESTE", "CEZARINA": "OESTE", "INDIARA": "OESTE", "JANDAIA": "OESTE", "PARAUNA": "OESTE", "SAO JOAO DA PARAUNA": "OESTE", "BALIZA": "OESTE", "BOM JARDIM DE GOIAS": "OESTE", "ARENOPOLIS": "OESTE", "DIORAMA": "OESTE", "MONTES CLAROS DE GOIAS": "OESTE", "DOVERLANDIA": "OESTE", "CORREGO DO OURO": "OESTE", "PALMEIRAS DE GOIAS": "OESTE", "AMORINOPOLIS": "OESTE", "NAZARIO": "OESTE", "VARJAO": "OESTE", "PONTES E LACERDA": "OESTE", "SANTA BARBARA DE GOIAS": "OESTE", "NOVO BRASIL": "OESTE",
  "GOIAS": "NOROESTE", "ITABERAI": "NOROESTE", "ITAPURANGA": "NOROESTE", "ARUANA": "NOROESTE", "NOVA CRIXAS": "NOROESTE", "ARAGUAPAZ": "NOROESTE", "MOZARLANDIA": "NOROESTE", "CRIXAS": "NOROESTE", "SAO MIGUEL DO ARAGUAIA": "NOROESTE", "MUNDO NOVO": "NOROESTE", "MATRINCHA": "NOROESTE", "SANTA FE DE GOIAS": "NOROESTE", "BRITANIA": "NOROESTE", "FAINA": "NOROESTE", "ITAPIRAPUA": "NOROESTE", "SANCLERLANDIA": "NOROESTE", "BURITI DE GOIAS": "NOROESTE", "MOSSAMEDES": "NOROESTE", "ADELANDIA": "NOROESTE", "AMERICANO DO BRASIL": "NOROESTE", "ANICUNS": "NOROESTE", "CAMPESTRE DE GOIAS": "NOROESTE", "GUARAITA": "NOROESTE", "COCALINHO": "NOROESTE", "ARACU": "NOROESTE"
};

const mapCityToRegion = (city: string): string => {
  if (!city) return "OUTROS"; 
  const c = city.trim().toUpperCase();
  return cityToRegionMap[c] || "OUTROS"; 
};

const emptyForm = (today: string, userName : string): FormData => ({
  id_agendamento: "", cod_produtor: "",
  nome: "", ie: "", propriedade: "", car: "S", municipio: "", telefone: "",
  melhorDiaContato: "", proprietario: "", tipoVisita: "PROSPECÇÃO",
  nomeRecebedor: "", cargoRecebedor: "", frigorificoCostume: "", cabecasAbatidasAno: "", 
  tipoVenda: "", tipoAtividade: "", habilitacao: "", tipoTerminacao: "",
  
  disp30Dias: false, qtd30Dias: "", sexo30Dias: "BOI", status30Dias: "DISPONIVEL",
  disp60Dias: false, qtd60Dias: "", sexo60Dias: "BOI", status60Dias: "DISPONIVEL",
  disp90Dias: false, qtd90Dias: "", sexo90Dias: "BOI", status90Dias: "DISPONIVEL",
  
  numAnimais: "", dataVisita: today, visitante: userName, produtorAssinatura: "",
  observacoes: "", 
  imagem: "",
  checklist: {},
  checklistObs: {}, 
  checklistFinalStatus: null
});

function RouteMapController({ routePath }: { routePath: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (routePath && routePath.length > 1) {
      const bounds = L.latLngBounds(routePath);
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.5 });
    } else if (routePath && routePath.length === 1) {
      map.flyTo(routePath[0], 13, { duration: 1.5 });
    } else {
      map.flyTo(EMPRESA_COORDS, 7, { duration: 1.5 });
    }
  }, [routePath, map]);
  return null;
}

export function FieldVisit() {
  const {user} = useAuth();
  const userName = user?.name || "COMPRADOR";
  
  const [step, setStep] = useState<Step>("idle");
  const [distance, setDistance] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  const [isRealLocation, setIsRealLocation] = useState<boolean>(false);
  const [confirmSaveModal, setConfirmSaveModal] = useState<boolean>(false);

  const [isSignatureFullscreen, setIsSignatureFullscreen] = useState<boolean>(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState<boolean>(false);
  
  // 👇 ESTADO FLUXO AUDITORIA AVULSA 👇
  const [isStandaloneAuditFlow, setIsStandaloneAuditFlow] = useState<boolean>(false);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ 
    width: typeof window !== 'undefined' ? Math.max(window.innerWidth, 300) : 300, 
    height: typeof window !== 'undefined' ? Math.max(window.innerHeight - 150, 200) : 300 
  });

  const getLocalYYYYMMDD = () => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split("T")[0];
  };

  const today = getLocalYYYYMMDD();
  const [form, setForm] = useState<FormData>(emptyForm(today, userName));

  const sigCanvas = useRef<SignatureCanvas>(null);
  const sigCanvasFullscreen = useRef<SignatureCanvas>(null); 
  
  const fileInputImageRef = useRef<HTMLInputElement>(null); 
  const fileInputSignatureRef = useRef<HTMLInputElement>(null); 

  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 2, 0).toISOString().split("T")[0];
  });

  const [isManual, setIsManual] = useState(false);
  const [selectedRancher, setSelectedRancher] = useState<any | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState("");

  const [apiRanchers, setApiRanchers] = useState<ApiRancher[]>([]);
  const [agendamentosPendentes, setAgendamentosPendentes] = useState<ApiAgendamento[]>([]);
  const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]);
  const [allData, setAllData] = useState<any[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error";
    onCloseAction?: () => void;
  } | null>(null);

  const isScheduled = !!form.id_agendamento;

  useEffect(() => {
    const loadApiData = async () => {
      setIsLoadingApi(true);
      try {
        const [agendamentosData, ranchersData, usersData] = await Promise.all([
          fetchAgendamentosPendentes().catch(() => []),
          fetchPecuaristasAgendamento().catch(() => []),
          api.getUsuarios().catch(() => [])
        ]);
        
        const validAgendamentos = Array.isArray(agendamentosData) ? agendamentosData : [];
        const pendentes = validAgendamentos.filter(ag => (ag.STATUS_AGENDAMENTO || "").toLowerCase() === 'pendente');
        
        setAgendamentosPendentes(pendentes);
        setApiRanchers(Array.isArray(ranchersData) ? ranchersData : []);
        setUsuariosData(Array.isArray(usersData) ? usersData : []);

      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
      setIsLoadingApi(false);
    };
    loadApiData();
  }, []);

  useEffect(() => {
    if (isSignatureFullscreen) {
      const timer = setTimeout(() => {
        if (canvasWrapperRef.current) {
          setCanvasSize({
            width: Math.max(canvasWrapperRef.current.offsetWidth, 300),
            height: Math.max(canvasWrapperRef.current.offsetHeight, 200),
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSignatureFullscreen]);

  const getNomeComprador = (id?: number) => {
    if (!id) return "NÃO DEFINIDO";
    const usuario = usuariosData.find(u => Number(u.SEQUSUARIO) === Number(id));
    return usuario ? usuario.CODUSUARIO : `ID: ${id}`;
  };

  const filteredRanchers = useMemo(() => {
    const term = modalSearchTerm.toLowerCase();
    if (!term) return apiRanchers.slice(0, 20); 
    return apiRanchers.filter(
      (r) => 
        (r.NOME_PRODUTOR?.toLowerCase() || "").includes(term) || 
        (r.MUNICIPIO?.toLowerCase() || "").includes(term) || 
        (r.NOME_FAZENDA?.toLowerCase() || "").includes(term)
    ).slice(0, 20);
  }, [modalSearchTerm, apiRanchers]);

  const filteredAgendamentos = useMemo(() => {
    return agendamentosPendentes.filter(ag => {
      if (user?.role !== "ADMIN" && String(ag.ID_COMPRADOR) !== String(user?.id)) {
        return false;
      }
      if (!ag.DATA_AGENDADA) return false;
      const dataStr = String(ag.DATA_AGENDADA).split("T")[0];
      return dataStr >= dateStart && dataStr <= dateEnd;
    });
  }, [dateStart, dateEnd, agendamentosPendentes, user?.id, user?.role]);

  const fetchCityName = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
      if (city) setForm(prev => ({ ...prev, municipio: String(city).toUpperCase() }));
    } catch (error) { }
  };

  const executeFallbackLocation = (callback: () => void) => {
    setIsRealLocation(false); 
    const fallbackLat = -16.6868;
    const fallbackLng = -49.2643;
    setUserLocation([fallbackLat, fallbackLng]);
    
    callback();

    fetchCityName(fallbackLat, fallbackLng);
    
    fetch(`https://router.project-osrm.org/route/v1/driving/${EMPRESA_COORDS[1]},${EMPRESA_COORDS[0]};${fallbackLng},${fallbackLat}?overview=full&geometries=geojson`)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          const routeCoords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
          setRoutePath(routeCoords);
          setDistance(`${(data.routes[0].distance / 1000).toFixed(1)} km`);
        } else {
          setRoutePath([EMPRESA_COORDS, [fallbackLat, fallbackLng]]);
          setDistance("Aprox. 42 km");
        }
      })
      .catch(() => {
        setRoutePath([EMPRESA_COORDS, [fallbackLat, fallbackLng]]);
        setDistance("Aprox. 42 km");
      });
  };

  const fetchRealRouteAndLocation = (callback: () => void) => {
    try {
      if (!navigator.geolocation) return executeFallbackLocation(callback);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsRealLocation(true); 
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          
          callback();

          fetchCityName(latitude, longitude);

          fetch(`https://router.project-osrm.org/route/v1/driving/${EMPRESA_COORDS[1]},${EMPRESA_COORDS[0]};${longitude},${latitude}?overview=full&geometries=geojson`)
            .then(res => res.json())
            .then(data => {
              if (data.routes && data.routes.length > 0) {
                setRoutePath(data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]));
                setDistance(`${(data.routes[0].distance / 1000).toFixed(1)} km`);
              } else {
                setRoutePath([EMPRESA_COORDS, [latitude, longitude]]);
                setDistance("Distância aproximada");
              }
            })
            .catch(() => {
              setRoutePath([EMPRESA_COORDS, [latitude, longitude]]);
              setDistance("Sem conexão p/ rotas");
            });
        },
        () => executeFallbackLocation(callback),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 } 
      );
    } catch (e) {
      executeFallbackLocation(callback);
    }
  };

  const retryLocation = () => {
    setStep("routing");
    fetchRealRouteAndLocation(() => setStep("form"));
  };

  const startScheduledVisit = (ag: ApiAgendamento) => {
    setIsStandaloneAuditFlow(false);
    setStep("routing");
    
    setSelectedRancher({
      NOME_PRODUTOR: ag.NOME_PRODUTOR,
      NOME_FAZENDA: ag.NOME_FAZENDA,
      MUNICIPIO: ag.MUNICIPIO,
      INSCRICAO: ag.INSCRICAO,
      DISTANCIA_CADASTRADA: ag.DISTANCIA_CADASTRADA 
    }); 
    
    setForm({
      ...emptyForm(today, userName),
      id_agendamento: String(ag.ID_AGENDAMENTO || ""),
      cod_produtor: String(ag.COD_PRODUTOR || ""),
      nome: ag.NOME_PRODUTOR || "",
      ie: ag.INSCRICAO || "",
      propriedade: ag.NOME_FAZENDA || "",
      car: ag.POSSUI_CAR === "S" ? "S" : "N",
      municipio: ag.MUNICIPIO || "",
      telefone: ag.NUMERO1 || "",
      proprietario: ag.NOME_PRODUTOR || "",
    });
    
    fetchRealRouteAndLocation(() => setStep("form"));
  };

  const startNewVisit = () => {
    setIsStandaloneAuditFlow(false);
    setIsManual(false);
    setSelectedRancher(null);
    setForm(emptyForm(today, userName));
    setStep("routing");
    fetchRealRouteAndLocation(() => setStep("form"));
  };

  // 👇 ATIVA O FLUXO DE AUDITORIA TÉCNICA DIRETA 👇
  const startStandaloneAuditFlow = () => {
    setIsStandaloneAuditFlow(true);
    setIsManual(false);
    setSelectedRancher(null);
    setForm(emptyForm(today, userName));
    setIsSearchModalOpen(true);
  };

  const selectRancher = (r: ApiRancher) => {
    setSelectedRancher(r);
    setIsSearchModalOpen(false);
    setModalSearchTerm("");
    setIsManual(false);
    
    setForm((prev) => ({
      ...prev, 
      cod_produtor: String(r.COD_PRODUTOR || ""),
      nome: r.NOME_PRODUTOR || "", 
      ie: r.INSCRICAO || "", 
      propriedade: r.NOME_FAZENDA || "", 
      car: r.POSSUI_CAR === "S" ? "S" : "N",
      municipio: r.MUNICIPIO || "", 
      telefone: r.NUMERO1 || "", 
      melhorDiaContato: "",
      proprietario: r.NOME_PRODUTOR || "", 
      tipoAtividade: "", 
      tipoTerminacao: "",
      tipoVenda: "",
      habilitacao: "",
      numAnimais: "",
    }));

    if (isStandaloneAuditFlow) {
      setStep("form");
    }
  };

  const switchToManual = () => {
    setIsManual(true); setSelectedRancher(null); setForm(emptyForm(today, userName));
  };

  const switchToSearch = () => {
    setIsManual(false); setSelectedRancher(null); setForm(emptyForm(today, userName));
  };

  const updateField = (key: keyof FormData, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const formatToUpper = (val: any) => (val === null || val === undefined) ? "" : typeof val === 'string' ? val.trim().toUpperCase() : String(val).toUpperCase();

  const updateChecklistItem = (id: string, value: 'C' | 'NC' | 'NA') => {
    setForm(prev => ({
      ...prev,
      checklist: { ...prev.checklist, [id]: value }
    }));
  };

  const updateChecklistObs = (id: string, value: string) => {
    setForm(prev => ({
      ...prev,
      checklistObs: { ...prev.checklistObs, [id]: value }
    }));
  };

  const checklistProgress = useMemo(() => {
    const answered = Object.keys(form.checklist).length;
    const total = CHECKLIST_TEMPLATE.length;
    return { answered, total, isComplete: answered === total && form.checklistFinalStatus };
  }, [form.checklist, form.checklistFinalStatus]);

  const handleCaptureImagePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          updateField("imagem", reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearCapturedPhoto = () => {
    updateField("imagem", "");
    if (fileInputImageRef.current) fileInputImageRef.current.value = "";
  };

  const handleCaptureSignaturePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          updateField("produtorAssinatura", reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const limparAssinatura = () => {
    sigCanvas.current?.clear();
    updateField("produtorAssinatura", "");
    if (fileInputSignatureRef.current) fileInputSignatureRef.current.value = "";
  };

  const limparAssinaturaModal = () => {
    if (sigCanvasFullscreen.current) {
      sigCanvasFullscreen.current.clear();
      updateField("produtorAssinatura", "");
    }
  };

  const salvarAssinaturaModal = () => {
    if (sigCanvasFullscreen.current && !sigCanvasFullscreen.current.isEmpty()) {
      const assinaturaImg = sigCanvasFullscreen.current.getCanvas().toDataURL('image/png');
      updateField("produtorAssinatura", assinaturaImg);
      setIsSignatureFullscreen(false);
    } else {
      toast.error("O quadro de assinatura está vazio.");
    }
  };
  
  const apagarAssinaturaSalva = () => {
    updateField("produtorAssinatura", "");
  }

  const validateAndProceed = () => {
    const camposObrigatorios: { key: keyof FormData, label: string }[] = [
      { key: "nome", label: "Nome do Produtor" }, { key: "propriedade", label: "Propriedade" },
      { key: "telefone", label: "Telefone" }, { key: "melhorDiaContato", label: "Melhor dia de contato" },
      { key: "nomeRecebedor", label: "Nome de quem recebeu a visita" }, { key: "cargoRecebedor", label: "Cargo do Recebedor" },
      { key: "frigorificoCostume", label: "Frigorífico de Costume" }, { key: "cabecasAbatidasAno", label: "Qtd. cabeças abatidas/ano" },
      { key: "tipoVenda", label: "Tipo de Venda" }, { key: "tipoAtividade", label: "Tipo de Atividade" },
      { key: "tipoTerminacao", label: "Tipo de Terminação" }, { key: "habilitacao", label: "Habilitação" },
      { key: "numAnimais", label: "Nº de Animais na Propriedade" }
    ];

    const camposFaltando = camposObrigatorios.filter(campo => !form[campo.key] || String(form[campo.key]).trim() === "");

    if (camposFaltando.length >= 3) {
      setAlertModal({ isOpen: true, type: "error", title: "Campos Incompletos!", message: "Atenção: Você precisa preencher todos os dados obrigatórios do formulário antes de salvar." });
      return;
    } else if (camposFaltando.length > 0) {
      setAlertModal({ isOpen: true, type: "error", title: "Atenção!", message: `Falta preencher os seguintes campos: ${camposFaltando.map(c => c.label).join(" e ")}.` });
      return;
    }

    const errosLotes = [];
    if (form.disp30Dias && String(form.qtd30Dias).trim() === "") errosLotes.push("30 Dias");
    if (form.disp60Dias && String(form.qtd60Dias).trim() === "") errosLotes.push("60 Dias");
    if (form.disp90Dias && String(form.qtd90Dias).trim() === "") errosLotes.push("90 Dias");

    if (errosLotes.length > 0) {
      setAlertModal({ 
        isOpen: true, 
        type: "error", 
        title: "Quantidade Inválida", 
        message: `Você marcou a disponibilidade para ${errosLotes.join(", ")}, mas não informou a quantidade de cabeças. Digite um valor (mesmo que seja 0).` 
      });
      return;
    }

    if (!form.checklistFinalStatus) {
      setAlertModal({ 
        isOpen: true, 
        type: "error", 
        title: "Auditoria Pendente!", 
        message: "O preenchimento da Auditoria Técnica (Checklist de Bem-Estar Animal) é obrigatório para finalizar a visita.",
        onCloseAction: () => setIsChecklistModalOpen(true) 
      });
      return;
    }

    let assinaturaPronta = form.produtorAssinatura;
    
    if (sigCanvas.current && !sigCanvas.current.isEmpty() && !assinaturaPronta) {
       assinaturaPronta = sigCanvas.current.getCanvas().toDataURL('image/png');
       updateField("produtorAssinatura", assinaturaPronta);
    }

    if (!assinaturaPronta) {
      setAlertModal({ isOpen: true, type: "error", title: "Assinatura Pendente!", message: "O produtor ou recebedor precisa assinar a ficha da visita (ou enviar uma foto da assinatura)." });
      return;
    }

    if (!isRealLocation) {
      setConfirmSaveModal(true);
      return;
    }

    executeSavePayload(assinaturaPronta);
  };

  // 👇 EXECUTA O SALVAMENTO DA AUDITORIA AVULSA COM A NOVA API 👇
  const executeSaveStandaloneAudit = async () => {
    if (!form.checklistFinalStatus) {
      setAlertModal({ 
        isOpen: true, 
        type: "error", 
        title: "Conclusão Ausente!", 
        message: "Você deve selecionar se a propriedade foi APROVADA ou REPROVADA na conclusão técnica antes de salvar." 
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        cod_produtor: form.cod_produtor ? Number(form.cod_produtor) : null,
        propriedade: formatToUpper(form.propriedade),
        checklist_dados: form.checklist,
        checklist_obs: form.checklistObs,
        checklist_status: form.checklistFinalStatus
      };

      const result = await api.saveAuditoriaAvulsa(payload);
      if (result.success) {
        setAlertModal({ isOpen: true, type: "success", title: "Sucesso!", message: "A auditoria avulsa foi processada e salva no banco de dados." });
        setStep("idle");
        setForm(emptyForm(today, userName));
        setSelectedRancher(null);
        setIsStandaloneAuditFlow(false);
      } else {
        setAlertModal({ isOpen: true, type: "error", title: "Erro na Gravação", message: result.message || "Não foi possível registrar o checklist." });
      }
    } catch (e) {
      setAlertModal({ isOpen: true, type: "error", title: "Erro Crítico", message: "Falha na comunicação de rede com o servidor." });
    } finally {
      setSaving(false);
    }
  };

  const executeSavePayload = async (assinaturaForcada?: string) => {
    setConfirmSaveModal(false);
    setSaving(true);
    try {
      const base64Assinatura = assinaturaForcada || form.produtorAssinatura;
      const lotes = [];
      if (form.disp30Dias) lotes.push({ prazo_dias: 30, quantity_cabecas: form.qtd30Dias || 0, sexo_animal: formatToUpper(form.sexo30Dias), status_lote: formatToUpper(form.status30Dias) });
      if (form.disp60Dias) lotes.push({ prazo_dias: 60, quantity_cabecas: form.qtd60Dias || 0, sexo_animal: formatToUpper(form.sexo60Dias), status_lote: formatToUpper(form.status60Dias) });
      if (form.disp90Dias) lotes.push({ prazo_dias: 90, quantity_cabecas: form.qtd90Dias || 0, sexo_animal: formatToUpper(form.sexo90Dias), status_lote: formatToUpper(form.status90Dias) });

      const payload = {
        id_agendamento: form.id_agendamento, 
        cod_produtor: form.cod_produtor, 
        tipo_registro: form.cod_produtor ? "CADASTRADO" : "S_CADASTRO", 
        nome: formatToUpper(form.nome), 
        propriedade: formatToUpper(form.propriedade), 
        municipio: formatToUpper(form.municipio),
        regiao: formatToUpper(mapCityToRegion(form.municipio)), 
        telefone: formatToUpper(form.telefone), 
        car: formatToUpper(form.car), 
        ie: formatToUpper(form.ie),
        inscricao: formatToUpper(form.ie), 
        melhorDiaContato: formatToUpper(form.melhorDiaContato), 
        proprietario: formatToUpper(form.proprietario),
        tipoVisita: formatToUpper(form.tipoVisita), 
        nomeRecebedor: formatToUpper(form.nomeRecebedor), 
        cargoRecebedor: formatToUpper(form.cargoRecebedor),
        frigorificoCostume: formatToUpper(form.frigorificoCostume), 
        cabecasAbatidasAno: form.cabecasAbatidasAno, 
        tipoVenda: formatToUpper(form.tipoVenda),
        tipoAtividade: formatToUpper(form.tipoAtividade), 
        habilitacao: formatToUpper(form.habilitacao), 
        tipoTerminacao: formatToUpper(form.tipoTerminacao),
        numAnimais: form.numAnimais, 
        dataVisita: form.dataVisita, 
        visitante: formatToUpper(form.visitante), 
        
        produtorAssinatura: base64Assinatura, 
        observacoes: form.observacoes, 
        imagem: form.imagem,            
        
        disp30Dias: form.disp30Dias, qtd30Dias: form.qtd30Dias, sexo30Dias: formatToUpper(form.sexo30Dias), status30Dias: formatToUpper(form.status30Dias),
        disp60Dias: form.disp60Dias, qtd60Dias: form.qtd60Dias, sexo60Dias: formatToUpper(form.sexo60Dias), status60Dias: formatToUpper(form.status60Dias),
        disp90Dias: form.disp90Dias, qtd90Dias: form.qtd90Dias, sexo90Dias: formatToUpper(form.sexo90Dias), status90Dias: formatToUpper(form.status90Dias),
        
        gps_latitude: userLocation ? userLocation[0] : null, 
        gps_longitude: userLocation ? userLocation[1] : null,
        distancia_percorrida_real: distance ? parseFloat(distance.replace(" km", "")) : 0, 
        distancia_real: distance ? parseFloat(distance.replace(" km", "")) : 0, 
        
        distancia_sistema: selectedRancher ? Number(selectedRancher.DISTANCIA_CADASTRADA) || 0 : 0,
        
        id_comprador: (user as any)?.id, 
        lotes: lotes,
        checklist_dados: form.checklist,
        checklist_obs: form.checklistObs, 
        checklist_status: form.checklistFinalStatus
      };

      const result = await api.saveVisit(payload);
      if (result.success) {
        setAlertModal({ isOpen: true, type: "success", title: "Sucesso!", message: "A visita foi salva e sincronizada com o banco de dados." });
        setStep("idle"); setDistance(null); setRoutePath([]); setUserLocation(null); setForm(emptyForm(today, userName)); setSelectedRancher(null); setIsManual(false);
        setIsRealLocation(false);
        setAgendamentosPendentes(prev => prev.filter(ag => String(ag.ID_AGENDAMENTO) !== String(form.id_agendamento)));
      } else {
        setAlertModal({ isOpen: true, type: "error", title: "Erro na Sincronização", message: "Ocorreu um problema ao enviar para o banco de dados. A visita NÃO foi salva." });
      }
    } catch (error) {
      setAlertModal({ isOpen: true, type: "error", title: "Erro Crítico", message: "Falha na comunicação com o sistema. Verifique sua internet e tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const getToggleClass = (currentValue: string, expectedValue: string) => 
    `py-3 rounded-lg font-bold text-[11px] sm:text-xs transition-all border shadow-sm ${currentValue.toUpperCase() === expectedValue.toUpperCase() ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300"}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 relative font-sans">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        
        {/* 👇 DINAMISMO DO CONTEXTO DE TELA INTERA AQUI 👇 */}
        <div className={step === "form" && isStandaloneAuditFlow ? "max-w-4xl mx-auto w-full" : "grid grid-cols-1 lg:grid-cols-2 gap-8 relative items-start"}>
          <div className="flex flex-col gap-6 w-full">
            
            {step === "idle" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                      <Navigation className="w-8 h-8 text-primary" /> Minhas Visitas
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Sua agenda de prospecção e rota de campo.</p>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                    <div className="flex flex-col flex-1 sm:flex-initial">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 mb-1">Início</Label>
                      <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="h-9 text-xs font-bold bg-slate-50 border-slate-100" />
                    </div>
                    <div className="flex flex-col flex-1 sm:flex-initial">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 mb-1">Fim</Label>
                      <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="h-9 text-xs font-bold bg-slate-50 border-slate-100" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                      <CalendarClock className="w-5 h-5 text-primary" /> Agendamentos
                    </h2>
                    <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">{isLoadingApi ? "..." : filteredAgendamentos.length} Pendentes</span>
                  </div>

                  {isLoadingApi ? (
                    <div className="flex justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm"><Loader2 className="animate-spin text-primary w-8 h-8" /></div> 
                  ) : filteredAgendamentos.length === 0 ? (
                    <div className="text-center p-12 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm">
                      <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-bold">Nenhum agendamento pendente para este intervalo.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredAgendamentos.map((ag) => {
                        const agDateStr = ag.DATA_AGENDADA ? String(ag.DATA_AGENDADA).split('T')[0] : '';
                        const isAtrasada = agDateStr && agDateStr < today;
                        const isHoje = agDateStr === today;

                        let cardClass = "bg-white border border-slate-200 hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md group rounded-xl overflow-hidden";
                        let badge = null;
                        let dateIconClass = "text-slate-500 bg-slate-50";

                        if (isAtrasada) {
                          cardClass = "bg-white border border-red-200 hover:border-red-400 transition-all cursor-pointer shadow-sm hover:shadow-md group rounded-xl overflow-hidden";
                          badge = <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Atrasada</span>;
                          dateIconClass = "text-red-700 font-bold bg-red-50 border border-red-100";
                        } else if (isHoje) {
                          cardClass = "bg-white border border-blue-200 hover:border-blue-400 transition-all cursor-pointer shadow-sm hover:shadow-md group rounded-xl overflow-hidden";
                          badge = <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Hoje</span>;
                          dateIconClass = "text-blue-700 font-bold bg-blue-50 border border-blue-100";
                        }

                        return (
                          <Card key={ag.ID_AGENDAMENTO} className={cardClass} onClick={() => startScheduledVisit(ag)}>
                            <CardContent className="p-0 flex items-stretch">
                              <div className={`w-2 shrink-0 transition-colors ${isAtrasada ? 'bg-red-500' : isHoje ? 'bg-blue-500' : 'bg-primary'}`} />
                              <div className="p-4 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-slate-800 text-base uppercase">{ag.NOME_FAZENDA}</h3>
                                    {badge}
                                  </div>
                                  <p className="text-xs font-bold text-slate-500 uppercase">{ag.NOME_PRODUTOR}</p>
                                  
                                  <div className="flex items-center gap-2 pt-2 text-[11px] flex-wrap">
                                    <span className="flex items-center gap-1 font-bold text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md uppercase">
                                      <MapPin className="w-3 h-3 text-slate-400" /> {ag.MUNICIPIO}
                                    </span>
                                    <span className={`flex items-center gap-1 px-2 py-1 rounded-md uppercase ${dateIconClass}`}>
                                      <CalendarClock className="w-3 h-3" /> {ag.DATA_AGENDADA ? new Date(String(ag.DATA_AGENDADA).split('T')[0] + "T12:00:00").toLocaleDateString("pt-BR") : ''}
                                    </span>
                                    <span className="flex items-center gap-1 font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md uppercase">
                                      <User className="w-3 h-3 text-slate-400" /> {getNomeComprador(ag.ID_COMPRADOR)}
                                    </span>
                                  </div>
                                </div>
                                <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-full bg-slate-50 border border-slate-100 items-center justify-center group-hover:bg-primary group-hover:border-primary transition-colors">
                                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1 bg-white border-2 border-primary text-primary hover:bg-primary/5 font-bold shadow-sm h-14 rounded-xl" onClick={startNewVisit}>
                    <Plus className="w-5 h-5 mr-2" /> INICIAR VISITA AVULSA
                  </Button>
                  {/* <Button className="bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50/50 font-bold shadow-sm h-14 rounded-xl px-5 text-xs uppercase shrink-0" onClick={startStandaloneAuditFlow}>
                    <ClipboardCheck className="w-4 h-4 mr-2" /> INICIAR AUDITORIA AVULSA
                  </Button> */}
                </div>
              </div>
            )}

            {step === "routing" && (
              <Card className="text-center py-32 animate-fade-in border-none shadow-sm bg-white rounded-2xl">
                <CardContent>
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Traçando Rota Real...</h2>
                  <p className="text-sm font-medium text-slate-500 mt-2">Buscando sua localização GPS e mapeando a logística.</p>
                </CardContent>
              </Card>
            )}

            {step === "form" && (
              <div className="space-y-6 animate-fade-in pb-10">
                
                <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    {isStandaloneAuditFlow ? <ClipboardCheck className="w-5 h-5 text-emerald-600" /> : <FileText className="w-5 h-5 text-primary" />}
                    {isStandaloneAuditFlow ? "Auditoria Técnica Avulsa" : "Formulário de Campo"}
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* 👇 ADICIONADO O BOTÃO DE VOLTAR EXCLUSIVO DO FLUXO AVULSO 👇 */}
                    {isStandaloneAuditFlow && (
                      <Button variant="outline" size="sm" className="font-bold border-slate-200 text-slate-600 h-9" onClick={() => { setStep("idle"); setIsStandaloneAuditFlow(false); setSelectedRancher(null); }}>
                        VOLTAR
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:bg-slate-100 font-bold" onClick={() => { setStep("idle"); setRoutePath([]); setUserLocation(null); setIsRealLocation(false); setIsStandaloneAuditFlow(false); }}>
                      <X className="w-4 h-4 mr-1" /> FECHAR
                    </Button>
                  </div>
                </div>

                {isStandaloneAuditFlow ? (
                  <div className="space-y-6">
                    {/* 👇 FORMULÁRIO DE EXIBIÇÃO EM TELA CHEIA 👇 */}
                    <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
                      <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5">
                        <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <User className="w-4 h-4 text-emerald-600" /> Identificação da Propriedade Avaliada
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-4">
                        {selectedRancher && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in fade-in">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="w-5 h-5 text-blue-600" />
                              <span className="text-sm font-black text-blue-900 uppercase">{selectedRancher.NOME_PRODUTOR || selectedRancher.nome}</span>
                            </div>
                            <p className="text-xs font-bold text-blue-700/70 uppercase ml-7">{selectedRancher.NOME_FAZENDA || selectedRancher.propriedade} • {selectedRancher.MUNICIPIO || selectedRancher.municipio}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <CardDescription className="text-slate-500 font-bold text-xs uppercase mb-2">Responda as notas de conformidade (C, NC, NA) e preencha as observações por linha.</CardDescription>
                      
                      {Array.from(new Set(CHECKLIST_TEMPLATE.map(q => q.category))).map(category => (
                        <div key={category} className="space-y-3">
                          <h3 className="text-sm font-black text-slate-800 border-b border-slate-300 pb-2 uppercase tracking-widest">{category}</h3>
                          
                          {CHECKLIST_TEMPLATE.filter(q => q.category === category).map(q => {
                            const answer = form.checklist[q.id];
                            const obs = form.checklistObs[q.id] || "";
                            return (
                              <div key={q.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                <div className="flex-1 pr-4">
                                  <p className="text-sm font-bold text-slate-700 leading-snug">{q.text}</p>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase mt-1 inline-block bg-slate-100 px-2 py-0.5 rounded">Risco: {q.severity}</span>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                  <div className="flex bg-slate-100 p-1 rounded-lg gap-1 h-12">
                                    <button 
                                      type="button"
                                      className={`w-12 sm:w-14 rounded-md font-black text-sm transition-all border ${answer === 'C' ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200'}`}
                                      onClick={() => updateChecklistItem(q.id, 'C')}
                                    >C</button>
                                    <button 
                                      type="button"
                                      className={`w-12 sm:w-14 rounded-md font-black text-sm transition-all border ${answer === 'NC' ? 'bg-red-500 text-white border-red-600 shadow-md scale-105' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200'}`}
                                      onClick={() => updateChecklistItem(q.id, 'NC')}
                                    >NC</button>
                                    <button 
                                      type="button"
                                      className={`w-12 sm:w-14 rounded-md font-black text-sm transition-all border ${answer === 'NA' ? 'bg-slate-600 text-white border-slate-700 shadow-md scale-105' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200'}`}
                                      onClick={() => updateChecklistItem(q.id, 'NA')}
                                    >NA</button>
                                  </div>
                                  <Input 
                                    placeholder="Observação..." 
                                    className="h-12 w-full sm:w-48 bg-slate-50 border-slate-200 text-xs font-bold text-slate-700 uppercase"
                                    value={obs}
                                    onChange={(e) => updateChecklistObs(q.id, e.target.value)}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))}

                      <div className="pt-6 border-t-2 border-slate-200 border-dashed">
                        <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-widest text-center">Conclusão da Auditoria</h3>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
                          <button 
                            type="button"
                            className={`flex-1 py-4 rounded-xl font-black text-lg transition-all border-2 flex items-center justify-center gap-2 ${form.checklistFinalStatus === 'APROVADA' ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                            onClick={() => updateField("checklistFinalStatus", "APROVADA")}
                          >
                            <CheckCircle2 className="w-6 h-6" /> FAZENDA APROVADA
                          </button>
                          <button 
                            type="button"
                            className={`flex-1 py-4 rounded-xl font-black text-lg transition-all border-2 flex items-center justify-center gap-2 ${form.checklistFinalStatus === 'REPROVADA' ? 'bg-red-50 text-red-700 border-red-500 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                            onClick={() => updateField("checklistFinalStatus", "REPROVADA")}
                          >
                            <X className="w-5 h-5" /> FAZENDA REPROVADA
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button 
                      className="w-full h-16 text-lg font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 rounded-xl tracking-wide transition-all active:scale-[0.98]" 
                      onClick={executeSaveStandaloneAudit} 
                      disabled={saving}
                    >
                      {saving ? <><Loader2 className="w-6 h-6 animate-spin mr-3" /> SALVANDO NO SISTEMA...</> : "SALVAR AUDITORIA AVULSA"}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* FLUXO ORIGINAL DE VISITA DE CAMPO */}
                    {!isStandaloneAuditFlow && (
                      <>
                        {isRealLocation ? (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                            <div>
                              <p className="text-sm font-bold">Sinal de GPS Conectado</p>
                              <p className="text-xs font-medium opacity-80 mt-0.5">Sua posição exata está sendo usada para o cálculo de frete.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                            <div className="flex items-center gap-3 text-red-800">
                              <MapPinOff className="w-6 h-6 text-red-600 shrink-0" />
                              <div>
                                <p className="text-sm font-bold">GPS Não Coletado</p>
                                <p className="text-xs font-medium opacity-80 mt-0.5">O navegador bloqueou ou não há sinal. Usando simulação.</p>
                              </div>
                            </div>
                            <Button size="sm" variant="destructive" className="shrink-0 h-10 font-bold shadow-sm rounded-lg" onClick={retryLocation}>
                              <RefreshCw className="w-4 h-4 mr-2" /> RECONECTAR
                            </Button>
                          </div>
                        )}

                        <Card className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
                          <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5">
                            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <Navigation className="w-4 h-4 text-primary" /> Rota & Distância
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-5">
                            <div className="flex justify-between items-end mb-4">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distância Oficial (Ida)</span>
                              <span className="text-2xl font-black text-slate-800 tabular-nums">{distance || "Calculando..."}</span>
                            </div>
                            <div className="h-16 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200 relative overflow-hidden px-10">
                              <div className="h-1 bg-slate-200 w-full rounded-full" />
                              <div className="absolute left-6 flex flex-col items-center">
                                <Building2 className="w-5 h-5 text-slate-400 bg-white" />
                              </div>
                              <div className="absolute right-6 flex flex-col items-center">
                                <MapPin className="w-5 h-5 text-primary bg-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}

                    <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
                      <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5">
                        <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <User className="w-4 h-4 text-primary" /> A. Identificação do Pecuarista
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5 p-5">
                        {!isScheduled && (
                          <>
                            <div className="flex gap-2">
                              <Button variant={!isManual ? "default" : "outline"} size="sm" onClick={switchToSearch} className={`flex-1 h-10 text-xs ${!isManual ? 'bg-slate-800 text-white hover:bg-slate-700 shadow-sm' : 'font-bold text-slate-500 border-slate-200'}`}>
                                <Search className="w-3.5 h-3.5 mr-1.5" /> Buscar na Base
                              </Button>
                              <Button variant={isManual ? "default" : "outline"} size="sm" onClick={switchToManual} className={`flex-1 h-10 text-xs ${isManual ? 'bg-slate-800 text-white hover:bg-slate-700 shadow-sm' : 'font-bold text-slate-500 border-slate-200'}`}>
                                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Digitar Manual
                              </Button>
                            </div>
                            {!isManual && (
                              <Button className={`w-full h-12 flex justify-start items-center transition-colors shadow-sm border border-slate-200 rounded-lg ${selectedRancher ? "bg-slate-50 text-slate-700 hover:bg-slate-100" : "bg-white text-slate-500 hover:bg-slate-50 hover:text-primary hover:border-primary"}`} onClick={() => setIsSearchModalOpen(true)}>
                                <Search className={`w-5 h-5 mr-3 ${selectedRancher ? 'text-slate-400' : 'text-primary'}`} />
                                <span className="font-bold text-sm">{selectedRancher ? "Trocar pecuarista selecionado..." : "Clique para pesquisar no ERP..."}</span>
                              </Button>
                            )}
                          </>
                        )}

                        <div className="border-t border-slate-100 pt-5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Qual a natureza desta visita?</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {["PROSPECÇÃO", "REATIVAÇÃO", "OBRIGATÓRIA", "ACOMP. EMBARQUE", "CORTESIA"].map((t) => (
                              <button key={t} type="button" onClick={() => updateField("tipoVisita", t)} className={getToggleClass(form.tipoVisita, t)}>{t}</button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
                      <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5">
                        <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" /> B. Dados e Contato
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 p-5">
                        <FieldInput label="Nome do Produtor" placeholder="Nome do proprietário/empresa" value={form.nome} onChange={(v) => updateField("nome", v)} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FieldInput label="Propriedade" placeholder="Ex: Fazenda Santa Fé" value={form.propriedade} onChange={(v) => updateField("propriedade", v)} />
                          <FieldInput label="Município" placeholder="Ex: Goiânia" value={form.municipio} onChange={(v) => updateField("municipio", v)} />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FieldInput label="I.E. (Inscrição Estadual)" placeholder="0000000" value={form.ie} onChange={(v) => updateField("ie", v)} inputMode="numeric" />
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Possui CAR?</Label>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => updateField("car", "S")} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border shadow-sm ${form.car.toUpperCase() === "S" ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>SIM</button>
                              <button type="button" onClick={() => updateField("car", "N")} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border shadow-sm ${form.car.toUpperCase() === "N" ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>NÃO</button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                          <FieldInput label="Telefone" placeholder="(62) 90000-0000" type="tel" value={form.telefone} onChange={(v) => updateField("telefone", v)} icon={<Phone className="w-4 h-4" />} />
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Melhor dia p/ ligar</Label>
                            <select className="flex h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-primary uppercase" value={form.melhorDiaContato} onChange={(e) => updateField("melhorDiaContato", e.target.value)}>
                              <option value="">Selecione...</option><option value="SEGUNDA-FEIRA">Segunda-feira</option><option value="TERCA-FEIRA">Terça-feira</option><option value="QUARTA-FEIRA">Quarta-feira</option><option value="QUINTA-FEIRA">Quinta-feira</option><option value="SEXTA-FEIRA">Sexta-feira</option><option value="SABADO">Sábado</option><option value="DOMINGO">Domingo</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                          <FieldInput label="Nome (Quem recebeu a visita)" placeholder="Ex: José Silva" value={form.nomeRecebedor} onChange={(v) => updateField("nomeRecebedor", v)} />
                          <FieldInput label="Cargo do Recebedor" placeholder="Ex: Gerente, Capataz" value={form.cargoRecebedor} onChange={(v) => updateField("cargoRecebedor", v)} />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
                      <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5">
                        <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <Landmark className="w-4 h-4 text-primary" /> C. Detalhes Comerciais
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frigorífico Costumaz</Label>
                            <select className="flex h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-primary uppercase" value={form.frigorificoCostume} onChange={(e) => updateField("frigorificoCostume", e.target.value)}>
                              <option value="">Selecione...</option><option value="OUTROS">Outros</option><option value="JBS">JBS</option><option value="MINERVA">Minerva</option><option value="BEAUVALLET">Beauvallet</option><option value="MARFRIG">Marfrig</option><option value="PLENA">Plena</option><option value="MERCOFRIGO">Mercofrigo</option>
                            </select>
                          </div>
                          <FieldInput label="Abates (Cabeças no último ano)" type="number" placeholder="Ex: 500" value={form.cabecasAbatidasAno} onChange={(v) => updateField("cabecasAbatidasAno", v)} />
                        </div>
                        
                        <div className="space-y-2"><Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Venda</Label><div className="flex gap-2">{["DIRETO", "CONTRATO"].map((t) => (<button key={t} type="button" onClick={() => updateField("tipoVenda", t)} className={getToggleClass(form.tipoVenda, t)}>{t}</button>))}</div></div>
                        <div className="space-y-2"><Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Atividade</Label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{["CRIA", "RECRIA", "ENGORDA", "CICLO COMPLETO"].map((t) => (<button key={t} type="button" onClick={() => updateField("tipoAtividade", t)} className={getToggleClass(form.tipoAtividade, t)}>{t}</button>))}</div></div>
                        <div className="space-y-2"><Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Terminação</Label><div className="grid grid-cols-3 gap-2">{["CONFINADO", "SEMI-CONF.", "PASTO"].map((t) => (<button key={t} type="button" onClick={() => updateField("tipoTerminacao", t)} className={getToggleClass(form.tipoTerminacao, t)}>{t}</button>))}</div></div>
                        <div className="space-y-2"><Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Habilitação</Label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{["CHINA", "EUROPA", "MI", "OUTROS"].map((t) => (<button key={t} type="button" onClick={() => updateField("habilitacao", t)} className={getToggleClass(form.habilitacao, t)}>{t}</button>))}</div></div>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
                      <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5">
                        <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" /> D. Rebanho e Fechamento
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 p-5">
                        <FieldInput label="Nº de Animais na Propriedade (Efetivo Total)" type="number" placeholder="Ex: 1500" value={form.numAnimais} onChange={(v) => updateField("numAnimais", v)} className="bg-blue-50/50 border-blue-200 focus:border-blue-500 font-black text-blue-900 text-lg" />
                        
                        <div className="space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-200">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Disponibilidade p/ Abate</Label>
                          <div className="space-y-3">
                            <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3">
                              <button type="button" onClick={() => updateField("disp30Dias", !form.disp30Dias)} className={`w-full xl:w-32 h-11 rounded-lg font-bold text-xs transition-all border shadow-sm ${form.disp30Dias ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"}`}>30 Dias {form.disp30Dias && "✓"}</button>
                              {form.disp30Dias && (
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full animate-in fade-in slide-in-from-left-2">
                                  <Input type="number" placeholder="Qtd. cabeças" className="h-11 bg-white text-sm font-black text-slate-800 shadow-sm" value={form.qtd30Dias} onChange={(e) => updateField("qtd30Dias", e.target.value)} />
                                  <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold uppercase shadow-sm text-slate-700" value={form.sexo30Dias} onChange={(e) => updateField("sexo30Dias", e.target.value)}><option value="BOI">BOI</option><option value="VACA">VACA</option><option value="AMBOS">MISTO</option></select>
                                  <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold uppercase shadow-sm text-slate-700" value={form.status30Dias} onChange={(e) => updateField("status30Dias", e.target.value)}><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3">
                              <button type="button" onClick={() => updateField("disp60Dias", !form.disp60Dias)} className={`w-full xl:w-32 h-11 rounded-lg font-bold text-xs transition-all border shadow-sm ${form.disp60Dias ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"}`}>60 Dias {form.disp60Dias && "✓"}</button>
                              {form.disp60Dias && (
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full animate-in fade-in slide-in-from-left-2">
                                  <Input type="number" placeholder="Qtd. cabeças" className="h-11 bg-white text-sm font-black text-slate-800 shadow-sm" value={form.qtd60Dias} onChange={(e) => updateField("qtd60Dias", e.target.value)} />
                                  <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold uppercase shadow-sm text-slate-700" value={form.sexo60Dias} onChange={(e) => updateField("sexo60Dias", e.target.value)}><option value="BOI">BOI</option><option value="VACA">VACA</option><option value="AMBOS">MISTO</option></select>
                                  <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold uppercase shadow-sm text-slate-700" value={form.status60Dias} onChange={(e) => updateField("status60Dias", e.target.value)}><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3">
                              <button type="button" onClick={() => updateField("disp90Dias", !form.disp90Dias)} className={`w-full xl:w-32 h-11 rounded-lg font-bold text-xs transition-all border shadow-sm ${form.disp90Dias ? "bg-primary border-primary text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"}`}>90 Dias {form.disp90Dias && "✓"}</button>
                              {form.disp90Dias && (
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full animate-in fade-in slide-in-from-left-2">
                                  <Input type="number" placeholder="Qtd. cabeças" className="h-11 bg-white text-sm font-black text-slate-800 shadow-sm" value={form.qtd90Dias} onChange={(e) => updateField("qtd90Dias", e.target.value)} />
                                  <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold uppercase shadow-sm text-slate-700" value={form.sexo90Dias} onChange={(e) => updateField("sexo90Dias", e.target.value)}><option value="BOI">BOI</option><option value="VACA">VACA</option><option value="AMBOS">MISTO</option></select>
                                  <select className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold uppercase shadow-sm text-slate-700" value={form.status90Dias} onChange={(e) => updateField("status90Dias", e.target.value)}><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <FieldInput label="Data" type="date" value={form.dataVisita} onChange={(v) => updateField("dataVisita", v)} />
                      <div className="space-y-1.5 opacity-70">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Visitante</Label>
                        <Input disabled value={form.visitante} className="h-12 bg-slate-100 font-bold uppercase" />
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observações da Visita (Opcional)</Label>
                      <textarea 
                        className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary uppercase transition-colors resize-none"
                        placeholder="Escreva detalhes da negociação, pendências ou características do lote..."
                        value={form.observacoes}
                        onChange={(e) => updateField("observacoes", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Foto do Curral / Propriedade (Opcional)</Label>
                      
                      {form.imagem ? (
                         <div className="flex flex-col items-start gap-3">
                           <div className="border border-slate-200 bg-slate-50 rounded-xl p-2 w-full max-w-[200px] h-32 flex items-center justify-center overflow-hidden">
                             <img src={form.imagem} alt="Foto Capturada" className="w-full h-full object-cover rounded-lg" />
                           </div>
                           <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200" onClick={clearCapturedPhoto}>
                             <Trash2 className="w-4 h-4 mr-2" /> Excluir Foto
                           </Button>
                         </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputImageRef} 
                            onChange={handleCaptureImagePhoto} 
                          />
                          <Button variant="outline" className="w-full sm:w-auto h-12 font-bold text-slate-600 border-slate-200 hover:bg-slate-50" onClick={() => {
                            if (fileInputImageRef.current) {
                               fileInputImageRef.current.setAttribute('capture', 'environment');
                               fileInputImageRef.current.click();
                            }
                          }}>
                            <Camera className="w-4 h-4 mr-2" /> TIRAR FOTO NA HORA
                          </Button>
                          <Button variant="outline" className="w-full sm:w-auto h-12 font-bold text-slate-600 border-slate-200 hover:bg-slate-50" onClick={() => {
                            if (fileInputImageRef.current) {
                               fileInputImageRef.current.removeAttribute('capture');
                               fileInputImageRef.current.click();
                            }
                          }}>
                            <ImageIcon className="w-4 h-4 mr-2" /> ESCOLHER DA GALERIA
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="my-8">
                      <Button
                        type="button"
                        onClick={() => setIsChecklistModalOpen(true)}
                        className={`w-full h-16 rounded-xl font-black text-sm uppercase shadow-lg transition-all ${
                          form.checklistFinalStatus 
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                            : "bg-primary hover:bg-primary/90 text-white animate-pulse"
                        }`}
                      >
                        <ClipboardCheck className="w-5 h-5 mr-2" />
                        {form.checklistFinalStatus ? `CHECKLIST DE BEM ESTAR ANIMAL: ${form.checklistFinalStatus}` : "RESPONDER CHECKLIST OBRIGATÓRIO (BEM ESTAR ANIMAL)"}
                      </Button>
                    </div>

                    <div className="border-t border-slate-200 pt-6 mt-6">
                      <Label className="text-xs font-bold text-slate-700 uppercase block mb-3 text-center tracking-widest">
                        Assinatura do Produtor / Recebedor
                      </Label>

                      <div className="flex flex-col items-center">
                        {form.produtorAssinatura ? (
                          <div className="flex flex-col items-center">
                            <div className="border border-slate-200 bg-white rounded-xl p-4 shadow-sm relative group overflow-hidden w-full max-w-[340px] flex justify-center">
                              <img src={form.produtorAssinatura} alt="Assinatura salva" className="max-h-32 w-auto object-contain mix-blend-multiply" />
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button variant="outline" size="sm" className="font-bold text-slate-600 border-slate-200 hover:bg-slate-100" onClick={apagarAssinaturaSalva}>
                                <Eraser className="w-4 h-4 mr-2" /> APAGAR E REFAZER
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center w-full">
                            <div className="relative border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-white transition-colors rounded-xl overflow-hidden shadow-sm" style={{ width: 340, height: 200 }}>
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-2 right-2 z-20 text-slate-400 hover:text-primary bg-white/50 backdrop-blur-sm"
                                onClick={() => setIsSignatureFullscreen(true)}
                                title="Assinar em Tela Cheia"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </Button>

                              <div className="absolute left-8 right-8 bottom-12 border-b-2 border-slate-300 border-dashed pointer-events-none opacity-50" />
                              
                              <SignatureCanvas 
                                ref={sigCanvas} 
                                penColor="black"
                                clearOnResize={false}
                                canvasProps={{ 
                                  width: 340, 
                                  height: 200,
                                  className: "absolute inset-0 cursor-crosshair touch-none z-10" 
                                }} 
                              />
                            </div>
                            
                            <div className="flex justify-between mt-3 w-[340px] gap-2">
                              <Button variant="outline" className="flex-1 text-slate-500 font-bold border-slate-200" onClick={limparAssinatura}>
                                <Eraser className="w-4 h-4 mr-2" /> Limpar
                              </Button>
                              
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                ref={fileInputSignatureRef} 
                                onChange={handleCaptureSignaturePhoto} 
                              />
                              <Button variant="outline" className="flex-1 text-blue-600 font-bold border-blue-200 hover:bg-blue-50" onClick={() => {
                                if (fileInputSignatureRef.current) {
                                  fileInputSignatureRef.current.removeAttribute('capture');
                                  fileInputSignatureRef.current.click();
                                }
                              }}>
                                <ImageIcon className="w-4 h-4 mr-2" /> Galeria de Assin.
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full h-16 text-lg font-black bg-slate-800 hover:bg-slate-900 text-white shadow-xl shadow-slate-800/20 rounded-xl tracking-wide transition-all active:scale-[0.98]" 
                      onClick={validateAndProceed} 
                      disabled={saving}
                    >
                      {saving ? <><Loader2 className="w-6 h-6 animate-spin mr-3" /> SINCRONIZANDO COM ERP...</> : "SALVAR VISITA E SINCRONIZAR"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 👇 OCULTA O MAPA COMPLETO CASO SEJA FLUXO AVULSO EM FILA 👇 */}
          {!(step === "form" && isStandaloneAuditFlow) && (
            <div className="order-1 lg:order-2 h-[400px] lg:h-[calc(100vh-6rem)] lg:sticky lg:top-8 w-full rounded-2xl overflow-hidden border-4 border-white shadow-xl z-0 bg-slate-200">
              {typeof window !== "undefined" && (
                <MapContainer center={EMPRESA_COORDS} zoom={7} style={{ height: "100%", width: "100%", zIndex: 1 }}>
                  <RouteMapController routePath={routePath} />
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />                
                  <CircleMarker center={EMPRESA_COORDS} radius={8} fillColor="#dc2626" color="#7f1d1d" weight={2} fillOpacity={1}>
                    <Tooltip direction="top" className="font-bold text-red-700" permanent={!userLocation}>Sede Beauvallet (Inhumas)</Tooltip>
                  </CircleMarker>
                  
                  {userLocation && (
                    <>
                      <CircleMarker center={userLocation} radius={8} fillColor={isRealLocation ? "#2563eb" : "#94a3b8"} color={isRealLocation ? "#1e3a8a" : "#475569"} weight={2} fillOpacity={1}>
                        <Tooltip direction="top" className={`font-bold ${isRealLocation ? 'text-blue-700' : 'text-slate-600'}`} permanent>{isRealLocation ? "Sua Posição GPS" : "Simulação (Goiânia)"}</Tooltip>
                      </CircleMarker>
                      {routePath.length > 0 && (
                        <Polyline positions={routePath} color={isRealLocation ? "#3b82f6" : "#94a3b8"} weight={5} dashArray="15, 15" opacity={0.8} />
                      )}
                    </>
                  )}
                </MapContainer>
              )}
                {!userLocation && (
                  <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-lg border border-slate-200 z-[1000] pointer-events-none">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-red-600" /> Sede em Inhumas-GO. Inicie uma visita p/ traçar rota.
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
        
        {/* MODAL FULLSCREEN DE ASSINATURA */}
        {isSignatureFullscreen && (
          <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-100 animate-in slide-in-from-bottom-full duration-300">
            <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm border-b border-slate-200 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-800">Assinatura Digital</h2>
                <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">Assine no espaço em branco</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setIsSignatureFullscreen(false); }} className="text-slate-400 hover:text-slate-700">
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div ref={canvasWrapperRef} className="flex-1 bg-white relative overflow-hidden">
              <div className="absolute bottom-[20%] left-10 right-10 border-b-2 border-slate-200 border-dashed pointer-events-none opacity-50" />
              
              <SignatureCanvas 
                ref={sigCanvasFullscreen} 
                penColor="black"
                minWidth={4.0} 
                maxWidth={7.0} 
                dotSize={5.0}
                clearOnResize={false}
                canvasProps={{ 
                  width: Math.max(canvasSize.width, 300),
                  height: Math.max(canvasSize.height, 200),
                  className: "absolute inset-0 cursor-crosshair touch-none z-10" 
                }} 
              />
            </div>

            <div className="bg-white p-4 pb-8 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] shrink-0 flex gap-3 z-10 border-t border-slate-200">
              <Button variant="outline" className="flex-1 h-14 font-bold text-red-600 border-red-200 hover:bg-red-50 text-sm" onClick={limparAssinaturaModal}>
                <Eraser className="w-5 h-5 mr-2" /> LIMPAR
              </Button>
              <Button className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/20" onClick={salvarAssinaturaModal}>
                <Check className="w-5 h-5 mr-2" /> CONFIRMAR
              </Button>
            </div>
          </div>
        )}

        {/* MODAL DE BUSCA */}
        {isSearchModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border-none rounded-2xl overflow-hidden">
              <CardHeader className="border-b bg-slate-50 pb-4 shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-800">
                    <Search className="w-5 h-5 text-primary" /> Buscar Pecuarista no ERP
                  </CardTitle>
                  <button onClick={() => { setIsSearchModalOpen(false); setIsStandaloneAuditFlow(false); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input autoFocus placeholder="Filtrar por nome, município ou fazenda..." value={modalSearchTerm} onChange={(e) => setModalSearchTerm(e.target.value)} className="pl-10 h-12 text-sm font-bold text-slate-700 bg-white" />
                </div>
              </CardHeader>
              
              <CardContent className="overflow-y-auto p-0 bg-white">
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 shadow-sm backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-500">Pecuarista</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-slate-500">Local</TableHead>
                      <TableHead className="text-right font-bold text-[11px] uppercase tracking-wider text-slate-500 w-24">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRanchers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-10 text-slate-400 font-medium">Nenhum registro encontrado na base.</TableCell>
                      </TableRow>
                    ) : (
                      filteredRanchers.map((r, index) => {
                        const uniqueKey = `${r.COD_PRODUTOR}-${r.INSCRICAO || 'sn'}-${r.NOME_FAZENDA}-${r.MUNICIPIO}-${index}`;
                        return (
                          <TableRow key={uniqueKey} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => selectRancher(r)}>
                            <TableCell className="py-4">
                              <p className="font-black text-sm text-slate-800 uppercase">{r.NOME_PRODUTOR}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">CÓD: {r.COD_PRODUTOR} • IE: {r.INSCRICAO}</p>
                            </TableCell>
                            <TableCell className="py-4">
                              <p className="text-xs font-bold text-slate-700 uppercase">{r.NOME_FAZENDA}</p>
                              <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 mt-0.5"><MapPin className="w-3 h-3" /> {r.MUNICIPIO}</div>
                            </TableCell>
                            <TableCell className="text-right py-4 pr-4">
                             <Button size="sm" className="text-[10px] h-8 bg-slate-800 text-white hover:bg-slate-700 font-bold tracking-wider rounded-md">USAR DADOS</Button>
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

        {/* MODAL DO CHECKLIST INTERNO DE AUDITORIA */}
        {isChecklistModalOpen && (
          <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-50 animate-in slide-in-from-bottom-full duration-300">
            <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm border-b border-slate-200 shrink-0 sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-primary" /> Auditoria em Fazendas
                </h2>
                <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">
                  {form.propriedade ? form.propriedade : 'Propriedade não informada'} • Aquisição de Matéria Prima
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsChecklistModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full">
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar max-w-4xl mx-auto w-full">
              <div className="flex flex-wrap gap-4 mb-6 bg-white p-3 rounded-lg border border-slate-200 justify-center">
                <div className="flex items-center gap-2"><span className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs border border-emerald-200">C</span> <span className="text-xs font-bold text-slate-600">Conforme</span></div>
                <div className="flex items-center gap-2"><span className="w-6 h-6 rounded bg-red-100 text-red-700 font-bold flex items-center justify-center text-xs border border-red-200">NC</span> <span className="text-xs font-bold text-slate-600">Não Conforme</span></div>
                <div className="flex items-center gap-2"><span className="w-6 h-6 rounded bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-xs border border-slate-200">NA</span> <span className="text-xs font-bold text-slate-600">Não Aplicável</span></div>
              </div>

              <div className="space-y-8 pb-10">
                {Array.from(new Set(CHECKLIST_TEMPLATE.map(q => q.category))).map(category => (
                  <div key={category} className="space-y-3">
                    <h3 className="text-sm font-black text-slate-800 border-b border-slate-300 pb-2 uppercase tracking-widest">{category}</h3>
                    
                    {CHECKLIST_TEMPLATE.filter(q => q.category === category).map(q => {
                      const answer = form.checklist[q.id];
                      const obs = form.checklistObs[q.id] || "";
                      return (
                        <div key={q.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                          <div className="flex-1 pr-4">
                            <p className="text-sm font-bold text-slate-700 leading-snug">{q.text}</p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase mt-1 inline-block bg-slate-100 px-2 py-0.5 rounded">Risco: {q.severity}</span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                            <div className="flex bg-slate-100 p-1 rounded-lg gap-1 h-12">
                              <button 
                                type="button"
                                className={`w-12 sm:w-14 rounded-md font-black text-sm transition-all border ${answer === 'C' ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200'}`}
                                onClick={() => updateChecklistItem(q.id, 'C')}
                              >C</button>
                              <button 
                                type="button"
                                className={`w-12 sm:w-14 rounded-md font-black text-sm transition-all border ${answer === 'NC' ? 'bg-red-500 text-white border-red-600 shadow-md scale-105' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200'}`}
                                onClick={() => updateChecklistItem(q.id, 'NC')}
                              >NC</button>
                              <button 
                                type="button"
                                className={`w-12 sm:w-14 rounded-md font-black text-sm transition-all border ${answer === 'NA' ? 'bg-slate-600 text-white border-slate-700 shadow-md scale-105' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200'}`}
                                onClick={() => updateChecklistItem(q.id, 'NA')}
                              >NA</button>
                            </div>
                            <Input 
                              placeholder="Observação..." 
                              className="h-12 w-full sm:w-48 bg-slate-50 border-slate-200 text-xs font-bold text-slate-700 uppercase"
                              value={obs}
                              onChange={(e) => updateChecklistObs(q.id, e.target.value)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}

                <div className="pt-6 border-t-2 border-slate-200 border-dashed">
                  <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-widest text-center">Conclusão da Auditoria</h3>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
                    <button 
                      type="button"
                      className={`flex-1 py-4 rounded-xl font-black text-lg transition-all border-2 flex items-center justify-center gap-2 ${form.checklistFinalStatus === 'APROVADA' ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                      onClick={() => updateField("checklistFinalStatus", "APROVADA")}
                    >
                      <CheckCircle2 className="w-6 h-6" /> FAZENDA APROVADA
                    </button>
                    <button 
                      type="button"
                      className={`flex-1 py-4 rounded-xl font-black text-lg transition-all border-2 flex items-center justify-center gap-2 ${form.checklistFinalStatus === 'REPROVADA' ? 'bg-red-50 text-red-700 border-red-500 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                      onClick={() => updateField("checklistFinalStatus", "REPROVADA")}
                    >
                      <X className="w-6 h-6" /> FAZENDA REPROVADA
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] shrink-0 z-10 border-t border-slate-200 flex justify-end">
               <Button className="h-14 bg-slate-800 hover:bg-slate-900 text-white font-black text-sm px-8 w-full sm:w-auto rounded-xl shadow-lg shadow-slate-800/20" onClick={() => setIsChecklistModalOpen(false)}>
                 SALVAR E VOLTAR PARA A VISITA
               </Button>
            </div>
          </div>
        )}

        {/* MODAL DE ALERTA DE GPS FALTANDO */}
        {confirmSaveModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden border-none rounded-2xl">
              <div className="h-2 w-full bg-amber-500" />
              <CardHeader className="text-center pt-8 pb-2">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-amber-50 border border-amber-100 text-amber-500">
                  <MapPinOff className="w-8 h-8" />
                </div>
                <CardTitle className="text-2xl font-black text-slate-800">Atenção ao GPS!</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8 px-8">
                <p className="text-slate-500 font-medium leading-relaxed mb-8">A localização real do seu dispositivo não foi coletada. Se você salvar agora, o relatório ficará registrado com a localização de simulação (Sede). Tem certeza que deseja continuar?</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" className="flex-1 font-bold h-12 border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setConfirmSaveModal(false)}>VOLTAR</Button>
                  <Button className="flex-1 font-bold h-12 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20" onClick={() => executeSavePayload()}>SIM, GRAVAR ASSIM</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MODAL DE ALERTAS GERAIS E ERROS */}
        {alertModal && alertModal.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden border-none rounded-2xl">
              <div className={`h-2 w-full ${alertModal.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <CardHeader className="text-center pt-8 pb-2">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${alertModal.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-red-50 border-red-100 text-red-500'}`}>
                  {alertModal.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                </div>
                <CardTitle className="text-2xl font-black text-slate-800 tracking-tight">{alertModal.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8 px-8">
                <p className="text-slate-500 font-medium leading-relaxed mb-8">{alertModal.message}</p>
                <Button 
                  className={`w-full h-14 text-base tracking-wide font-black shadow-lg ${alertModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                  onClick={() => {
                    const action = alertModal.onCloseAction;
                    setAlertModal(null);
                    if (action) {
                      setTimeout(() => action(), 150);
                    }
                  }}
                >
                  OK, ENTENDIDO
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}

function FieldInput({ label, icon, className, value, onChange, ...props }: { label: string; icon?: React.ReactNode; value?: string; onChange?: (value: string) => void; } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</Label>
      <div className="relative">
        {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <Input {...props} value={value} onChange={(e) => onChange?.(e.target.value)} className={`h-12 bg-slate-50 font-bold text-slate-700 border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary uppercase transition-colors ${icon ? "pl-10" : ""} ${className || ""}`} />
      </div>
    </div>
  );
}