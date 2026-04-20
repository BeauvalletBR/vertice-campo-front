import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  RefreshCw
} from "lucide-react";
import { api, fetchPecuaristasAgendamento, fetchAgendamentosPendentes, type ApiRancher, type ApiAgendamento, type ApiUsuario } from "@/services/api";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import SignatureCanvas from 'react-signature-canvas';

type Step = "idle" | "routing" | "form";

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
}

const EMPRESA_COORDS: [number, number] = [-16.3419669, -49.4708347]; 

const cityToRegionMap: Record<string, string> = {
  "GOIANIA": "RMG", "APARECIDA DE GOIANIA": "RMG", "TRINDADE": "RMG", "SENADOR CANEDO": "RMG", "INHUMAS": "RMG", "BELA VISTA DE GOIAS": "RMG", "NEROPOLIS": "RMG", "GUAPO": "RMG", "GOIANIRA": "RMG", "ABADIA DE GOIAS": "RMG", "SANTO ANTONIO DE GOIAS": "RMG", "HIDROLANDIA": "RMG", "BONFINOPOLIS": "RMG", "CALDAZINHA": "RMG", "TEREZOPOLIS DE GOIAS": "RMG", "BRAZABRANTES": "RMG", "CATURAI": "RMG", "DAMOLANDIA": "RMG", "ITAUCU": "RMG", "TAQUARAL DE GOIAS": "RMG", "NOVA VENEZA": "RMG", "GOIANAPOLIS": "RMG", "AVELINOPOLIS": "RMG", "ARAGOIANIA": "RMG",
  "ANAPOLIS": "RCG", "JARAGUA": "RCG", "CERES": "RCG", "RIALMA": "RCG", "RUBIATABA": "RCG", "ITAPACI": "RCG", "CARMO DO RIO VERDE": "RCG", "GOIANESIA": "RCG", "PIRENOPOLIS": "RCG", "CORUMBA DE GOIAS": "RCG", "COCALZINHO DE GOIAS": "RCG", "PETROLINA DE GOIAS": "RCG", "SANTA ISABEL": "RCG", "BARRO ALTO": "RCG", "VILA PROPICIO": "RCG", "CAMPO LIMPO DE GOIAS": "RCG", "OURO VERDE DE GOIAS": "RCG", "JESUPOLIS": "RCG", "SANTA ROSA DE GOIAS": "RCG", "HEITORAI": "RCG", "ITAGUARI": "RCG", "SANTA RITA DO NOVO DESTINO": "RCG", "ITAGUARU": "RCG", "SAO FRANCISCO DE GOIAS": "RCG", "URUANA": "RCG", "SAO PATRICIO": "RCG", "NOVA AMERICA": "RCG", "MORRO AGUDO DE GOIAS": "RCG",
  "LUZIANIA": "ENTORNO", "CRISTALINA": "ENTORNO", "FORMOSA": "ENTORNO", "SANTO ANTONIO DO DESCOBERTO": "ENTORNO", "PADRE BERNARDO": "ENTORNO", "CABECEIRAS": "ENTORNO", "ABADIANIA": "ENTORNO",
  "ITUMBIARA": "SUL", "MORRINHOS": "SUL", "CALDAS NOVAS": "SUL", "GOIATUBA": "SUL", "PIRACANJUBA": "SUL", "BURITI ALEGRE": "SUL", "RIO QUENTE": "SUL", "MARZAGAO": "SUL", "AGUA LIMPA": "SUL", "ALOANDIA": "SUL", "CROMINIA": "SUL", "MAIRIPOTABA": "SUL", "PONTALINA": "SUL", "VICENTINOPOLIS": "SUL", "EDEIA": "SUL", "EDEALINA": "SUL", "INACIOLANDIA": "SUL", "GOUVELANDIA": "SUL", "ITARUMA": "SUL", "PROFESSOR JAMIL": "SUL",
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

const emptyForm = (today: string,  userName : string): FormData => ({
  id_agendamento: "", cod_produtor: "",
  nome: "", ie: "", propriedade: "", car: "SIM", municipio: "", telefone: "",
  melhorDiaContato: "", proprietario: "", tipoVisita: "PROSPECÇÃO",
  nomeRecebedor: "", cargoRecebedor: "", frigorificoCostume: "", cabecasAbatidasAno: "", 
  tipoVenda: "", tipoAtividade: "", habilitacao: "", tipoTerminacao: "",
  
  disp30Dias: false, qtd30Dias: "", sexo30Dias: "BOI", status30Dias: "DISPONIVEL",
  disp60Dias: false, qtd60Dias: "", sexo60Dias: "BOI", status60Dias: "DISPONIVEL",
  disp90Dias: false, qtd90Dias: "", sexo90Dias: "BOI", status90Dias: "DISPONIVEL",
  
  numAnimais: "", dataVisita: today, visitante: userName, produtorAssinatura: "",
});

function RouteMapController({ routePath }: { routePath: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (routePath && routePath.length > 0) {
      const bounds = L.latLngBounds(routePath);
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.5 });
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

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<FormData>(emptyForm(today, userName));

  const sigCanvas = useRef<SignatureCanvas>(null);

  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0];
  
  const [dateStart, setDateStart] = useState(firstDayOfMonth);
  const [dateEnd, setDateEnd] = useState(lastDayOfMonth);

  const [isManual, setIsManual] = useState(false);
  const [selectedRancher, setSelectedRancher] = useState<any | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState("");

  const [apiRanchers, setApiRanchers] = useState<ApiRancher[]>([]);
  const [agendamentosPendentes, setAgendamentosPendentes] = useState<ApiAgendamento[]>([]);
  const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error";
  } | null>(null);

  const isScheduled = !!form.id_agendamento;

  useEffect(() => {
    const loadApiData = async () => {
      setIsLoadingApi(true);
      try {
        const [agendamentosData, ranchersData, usersData] = await Promise.all([
          fetchAgendamentosPendentes(),
          fetchPecuaristasAgendamento(),
          api.getUsuarios()
        ]);
        
        const pendentes = agendamentosData.filter(ag => (ag.STATUS_AGENDAMENTO || "").toLowerCase() === 'pendente');
        setAgendamentosPendentes(pendentes);
        setApiRanchers(ranchersData);
        setUsuariosData(usersData);

      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
      setIsLoadingApi(false);
    };
    loadApiData();
  }, []);

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
      const dataStr = ag.DATA_AGENDADA.split("T")[0];
      return dataStr >= dateStart && dataStr <= dateEnd;
    });
  }, [dateStart, dateEnd, agendamentosPendentes, user?.id, user?.role]);

  const fetchCityName = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
      if (city) setForm(prev => ({ ...prev, municipio: city.toUpperCase() }));
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
        }
      })
      .catch(() => {
        setRoutePath([EMPRESA_COORDS, [fallbackLat, fallbackLng]]);
        setDistance("Aprox. 42 km");
      });
  };

  const fetchRealRouteAndLocation = (callback: () => void) => {
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
  };

  const retryLocation = () => {
    setStep("routing");
    fetchRealRouteAndLocation(() => setStep("form"));
  };

  const startScheduledVisit = (ag: ApiAgendamento) => {
    setStep("routing");
    
    setSelectedRancher({
      NOME_PRODUTOR: ag.NOME_PRODUTOR,
      NOME_FAZENDA: ag.NOME_FAZENDA,
      MUNICIPIO: ag.MUNICIPIO,
      INSCRICAO: ag.INSCRICAO
    }); 
    
    setForm({
      ...emptyForm(today, userName),
      id_agendamento: String(ag.ID_AGENDAMENTO || ""),
      cod_produtor: String(ag.COD_PRODUTOR || ""),
      nome: ag.NOME_PRODUTOR || "",
      ie: ag.INSCRICAO || "",
      propriedade: ag.NOME_FAZENDA || "",
      car: ag.POSSUI_CAR === "S" ? "SIM" : "NAO",
      municipio: ag.MUNICIPIO || "",
      telefone: ag.NUMERO1 || "",
      proprietario: ag.NOME_PRODUTOR || "",
    });
    
    fetchRealRouteAndLocation(() => setStep("form"));
  };

  const startNewVisit = () => {
    setIsManual(false);
    setSelectedRancher(null);
    setForm(emptyForm(today, userName));
    setStep("routing");
    fetchRealRouteAndLocation(() => setStep("form"));
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
      car: r.POSSUI_CAR === "S" ? "SIM" : "NAO",
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
  };

  const switchToManual = () => {
    setIsManual(true); setSelectedRancher(null); setForm(emptyForm(today, userName));
  };

  const switchToSearch = () => {
    setIsManual(false); setSelectedRancher(null); setForm(emptyForm(today, userName));
  };

  const updateField = (key: keyof FormData, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const formatToUpper = (val: any) => (val === null || val === undefined) ? "" : typeof val === 'string' ? val.trim().toUpperCase() : val;

  const limparAssinatura = () => {
    sigCanvas.current?.clear();
    updateField("produtorAssinatura", "");
  };

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

    // 👇 CAPTURA A ASSINATURA USANDO getCanvas() PARA NÃO QUEBRAR O VITE 👇
    let assinaturaPronta = form.produtorAssinatura;
    
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
       assinaturaPronta = sigCanvas.current.getCanvas().toDataURL('image/png');
       updateField("produtorAssinatura", assinaturaPronta);
    }

    if (!assinaturaPronta) {
      setAlertModal({ isOpen: true, type: "error", title: "Assinatura Pendente!", message: "O produtor ou recebedor precisa assinar no quadro no final do formulário." });
      return;
    }

    if (!isRealLocation) {
      setConfirmSaveModal(true);
      return;
    }

    executeSavePayload(assinaturaPronta);
  };

  const executeSavePayload = async (assinaturaForcada?: string) => {
    setConfirmSaveModal(false);
    setSaving(true);
    
    const base64Assinatura = assinaturaForcada || form.produtorAssinatura;

    const lotes = [];
    if (form.disp30Dias) lotes.push({ prazo_dias: 30, quantidade_cabecas: form.qtd30Dias || 0, sexo_animal: formatToUpper(form.sexo30Dias), status_lote: formatToUpper(form.status30Dias) });
    if (form.disp60Dias) lotes.push({ prazo_dias: 60, quantidade_cabecas: form.qtd60Dias || 0, sexo_animal: formatToUpper(form.sexo60Dias), status_lote: formatToUpper(form.status60Dias) });
    if (form.disp90Dias) lotes.push({ prazo_dias: 90, quantidade_cabecas: form.qtd90Dias || 0, sexo_animal: formatToUpper(form.sexo90Dias), status_lote: formatToUpper(form.status90Dias) });

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
      
      disp30Dias: form.disp30Dias, qtd30Dias: form.qtd30Dias, sexo30Dias: formatToUpper(form.sexo30Dias), status30Dias: formatToUpper(form.status30Dias),
      disp60Dias: form.disp60Dias, qtd60Dias: form.qtd60Dias, sexo60Dias: formatToUpper(form.sexo60Dias), status60Dias: formatToUpper(form.status60Dias),
      disp90Dias: form.disp90Dias, qtd90Dias: form.qtd90Dias, sexo90Dias: formatToUpper(form.sexo90Dias), status90Dias: formatToUpper(form.status90Dias),
      
      gps_latitude: userLocation ? userLocation[0] : null, 
      gps_longitude: userLocation ? userLocation[1] : null,
      distancia_percorrida_real: distance ? parseFloat(distance.replace(" km", "")) : 0, 
      distancia_real: distance ? parseFloat(distance.replace(" km", "")) : 0, 
      
      id_comprador: (user as any)?.id, 
      lotes
    };

    try {
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
    `py-3 rounded-lg font-bold text-[11px] sm:text-xs transition-all border ${currentValue.toLowerCase() === expectedValue.toLowerCase() ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`;

  return (
    <div className="min-h-screen bg-surface pb-24 relative">
      <div className="p-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          <div className="space-y-5 order-2 lg:order-1">
            {step === "idle" && (
              <div className="space-y-6 animate-fade-in pt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><Navigation className="w-6 h-6" /> Minhas Visitas</h1>
                    <p className="text-sm text-muted-foreground mt-1">Sua agenda de prospecção.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm w-full sm:w-auto">
                    <div className="space-y-1 flex-1 sm:flex-initial"><Label className="text-[10px] font-black uppercase text-slate-400">Início</Label><Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="h-8 text-xs border-none focus-visible:ring-0 p-0" /></div>
                    <div className="h-8 w-[1px] bg-slate-200 self-end mb-1" />
                    <div className="space-y-1 flex-1 sm:flex-initial"><Label className="text-[10px] font-black uppercase text-slate-400">Fim</Label><Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="h-8 text-xs border-none focus-visible:ring-0 p-0" /></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-amber-500" /> Agendamentos do Período</h2>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{isLoadingApi ? "..." : filteredAgendamentos.length}</span>
                  </div>

                  {isLoadingApi ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary w-8 h-8" /></div> : filteredAgendamentos.length === 0 ? (
                    <div className="text-center p-10 bg-slate-50 border border-dashed rounded-xl text-slate-400"><CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-sm font-medium">Nenhum agendamento pendente para este intervalo.</p></div>
                  ) : (
                    filteredAgendamentos.map((ag) => {
                      const agDateStr = ag.DATA_AGENDADA ? ag.DATA_AGENDADA.split('T')[0] : '';
                      const isAtrasada = agDateStr && agDateStr < today;
                      const isHoje = agDateStr === today;

                      let cardClass = "border-2 border-slate-200 hover:border-primary/50 transition-colors cursor-pointer shadow-sm group";
                      let badge = null;
                      let dateIconClass = "text-slate-600";

                      if (isAtrasada) {
                        cardClass = "border-2 border-red-400 bg-red-50/50 hover:border-red-500 transition-colors cursor-pointer shadow-sm group";
                        badge = <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase ml-2">Atrasada</span>;
                        dateIconClass = "text-red-600 font-bold";
                      } else if (isHoje) {
                        cardClass = "border-2 border-blue-400 bg-blue-50/50 hover:border-blue-500 transition-colors cursor-pointer shadow-sm group";
                        badge = <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase ml-2">Hoje</span>;
                        dateIconClass = "text-blue-600 font-bold";
                      }

                      return (
                        <Card key={ag.ID_AGENDAMENTO} className={cardClass} onClick={() => startScheduledVisit(ag)}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <div className="flex items-center mb-1">
                                <h3 className="font-bold text-primary text-base group-hover:text-blue-700">{ag.NOME_PRODUTOR}</h3>
                                {badge}
                              </div>
                              <p className="text-sm font-medium text-slate-700">{ag.NOME_FAZENDA}</p>
                              
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {ag.MUNICIPIO}</span>
                                <span>•</span>
                                <span className={`flex items-center gap-1 ${dateIconClass}`}>
                                  <CalendarClock className="w-3 h-3" /> {ag.DATA_AGENDADA ? new Date(ag.DATA_AGENDADA.split('T')[0] + "T12:00:00").toLocaleDateString("pt-BR") : ''}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1 font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md uppercase">
                                  <User className="w-3 h-3" /> {getNomeComprador(ag.ID_COMPRADOR)}
                                </span>
                              </div>

                            </div>
                            <div className={`p-2 rounded-full transition-colors ${isAtrasada ? 'text-red-600 bg-red-100 group-hover:bg-red-600 group-hover:text-white' : isHoje ? 'text-blue-600 bg-blue-100 group-hover:bg-blue-600 group-hover:text-white' : 'text-primary bg-primary/10 group-hover:bg-primary group-hover:text-white'}`}>
                              <Navigation className="w-5 h-5" />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
                <div className="pt-6"><Button size="xl" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-md h-14" onClick={startNewVisit}><Plus className="w-5 h-5 mr-2" /> NOVA VISITA AVULSA</Button></div>
              </div>
            )}

            {step === "routing" && <Card className="text-center py-32 animate-fade-in border-0 shadow-none bg-transparent"><CardContent><div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div><h2 className="text-xl font-bold text-foreground">Traçando Rota Real...</h2><p className="text-sm text-muted-foreground mt-2">Buscando sua localização e mapeando as estradas a partir de Inhumas.</p></CardContent></Card>}

            {step === "form" && (
              <div className="space-y-5 animate-fade-in">
                
                {/* AVISO DE GPS */}
                {isRealLocation ? (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-bold">Localização Coletada com Sucesso!</p>
                      <p className="text-xs opacity-80">Sua posição GPS real está sendo usada no relatório.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-3 text-red-700">
                      <MapPinOff className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-sm font-bold">GPS Não Coletado</p>
                        <p className="text-[11px] opacity-80 leading-tight mt-0.5">O navegador bloqueou ou não achou o sinal. O mapa está usando uma simulação (Goiânia).</p>
                      </div>
                    </div>
                    <Button size="sm" variant="destructive" className="shrink-0 h-8 font-bold shadow-sm" onClick={retryLocation}>
                      <RefreshCw className="w-3.5 h-3.5 mr-2" /> TENTAR GPS DE NOVO
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between pb-2"><h2 className="text-lg font-bold text-primary flex items-center gap-2"><FileText className="w-5 h-5" /> Checklist de Campo</h2><Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setStep("idle"); setRoutePath([]); setUserLocation(null); setIsRealLocation(false); }}><X className="w-4 h-4 mr-1" /> Cancelar</Button></div>
                <Card className="border-2 border-primary/20 shadow-sm"><CardContent className="pt-4 pb-4"><div className="flex justify-between items-center mb-3"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Trajeto Calculado (GPS)</span><span className="text-sm font-bold text-primary tabular-nums">{distance || "Calculando..."}</span></div><div className="h-24 bg-slate-50 rounded-lg flex items-center justify-center border border-dashed border-slate-300 relative overflow-hidden"><div className="relative w-full px-12"><div className="h-0.5 bg-primary/30 w-full" /><div className="absolute left-10 -top-2.5 flex flex-col items-center"><MapPin className="w-5 h-5 text-slate-400" /><span className="text-[9px] font-semibold text-slate-500 mt-0.5">Sede (Inhumas)</span></div><div className="absolute right-10 -top-2.5 flex flex-col items-center"><Navigation className="w-5 h-5 text-primary" /><span className="text-[9px] font-semibold text-primary mt-0.5">Local Atual</span></div></div></div></CardContent></Card>
                <Card className="border-2 border-slate-200 shadow-sm">
                  <CardHeader className="pb-3 bg-slate-50 border-b flex flex-row justify-between items-center"><CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><User className="w-4 h-4" /> Identificação e Tipo de Visita</CardTitle></CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    
                    {!isScheduled && (
                      <>
                        <div className="flex gap-2">
                          <Button variant={!isManual ? "default" : "outline"} size="sm" onClick={switchToSearch} className={getToggleClass(isManual ? "MANUAL" : "BASE", "BASE")}>
                            <Search className="w-3 h-3 mr-1" /> Base de Dados
                          </Button>
                          <Button variant={isManual ? "default" : "outline"} size="sm" onClick={switchToManual} className={getToggleClass(isManual ? "MANUAL" : "BASE", "MANUAL")}>
                            <UserPlus className="w-3 h-3 mr-1" /> Novo Manual
                          </Button>
                        </div>
                        {!isManual && (
                          <Button className={`w-full h-12 flex justify-start items-center transition-colors shadow-sm ${selectedRancher ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-primary text-white hover:bg-primary/90"}`} onClick={() => setIsSearchModalOpen(true)}>
                            <Search className="w-5 h-5 mr-3" />
                            <span className="font-medium">{selectedRancher ? "Trocar pecuarista..." : "Clique para buscar na base..."}</span>
                          </Button>
                        )}
                      </>
                    )}

                    {selectedRancher && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between items-center animate-in fade-in">
                        <div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-bold text-green-800">{selectedRancher.NOME_PRODUTOR || selectedRancher.nome}</span>
                          </div>
                          <p className="text-xs text-green-700 mt-1 ml-6">{selectedRancher.NOME_FAZENDA || selectedRancher.propriedade} — {selectedRancher.MUNICIPIO || selectedRancher.municipio}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="border-t border-slate-100 pt-4 mt-2"><Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Natureza da Visita</Label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{["PROSPECÇÃO", "REATIVAÇÃO", "OBRIGATÓRIA", "ACOMP. EMBARQUE", "CORTESIA"].map((t) => (<button key={t} type="button" onClick={() => updateField("tipoVisita", t)} className={getToggleClass(form.tipoVisita, t)}>{t}</button>))}</div></div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> A. Dados da Propriedade e Contato</CardTitle></CardHeader><CardContent className="space-y-4"><FieldInput label="Nome do Produtor" placeholder="Nome do proprietário/empresa" value={form.nome} onChange={(v) => updateField("nome", v)} /><FieldInput label="I.E. (Inscrição Estadual)" placeholder="000.000.000" value={form.ie} onChange={(v) => updateField("ie", v)} inputMode="numeric" /><FieldInput label="Propriedade" placeholder="Ex: Fazenda Santa Fé" value={form.propriedade} onChange={(v) => updateField("propriedade", v)} /><FieldInput label="Município (Preenchido pelo GPS ou Base)" placeholder="Ex: Goiânia" value={form.municipio} onChange={(v) => updateField("municipio", v)} icon={<MapPin className="w-4 h-4 text-primary" />} /><div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Possui CAR?</Label><div className="flex gap-4"><button type="button" onClick={() => updateField("car", "SIM")} className={`flex-1 py-4 rounded-xl font-bold text-base transition-all border-2 ${form.car.toUpperCase() === "SIM" ? "bg-primary border-primary text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>SIM</button><button type="button" onClick={() => updateField("car", "NAO")} className={`flex-1 py-4 rounded-xl font-bold text-base transition-all border-2 ${form.car.toUpperCase() === "NAO" ? "bg-red-600 border-red-600 text-white shadow-md" : "bg-red-50 border-red-200 text-red-500 hover:bg-red-100"}`}>NÃO</button></div></div><FieldInput label="Telefone" placeholder="(62) 99999-0000" type="tel" value={form.telefone} onChange={(v) => updateField("telefone", v)} icon={<Phone className="w-4 h-4" />} />
                
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Melhor dia de contato</Label>
                  <select 
                    className="flex h-12 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase font-medium"
                    value={form.melhorDiaContato}
                    onChange={(e) => updateField("melhorDiaContato", e.target.value)}
                  >
                    <option value="">Selecione um dia...</option>
                    <option value="SEGUNDA-FEIRA">Segunda-feira</option>
                    <option value="TERCA-FEIRA">Terça-feira</option>
                    <option value="QUARTA-FEIRA">Quarta-feira</option>
                    <option value="QUINTA-FEIRA">Quinta-feira</option>
                    <option value="SEXTA-FEIRA">Sexta-feira</option>
                    <option value="SABADO">Sábado</option>
                    <option value="DOMINGO">Domingo</option>
                  </select>
                </div>
                
                <div className="border-t border-slate-100 pt-4 mt-4 space-y-4"><h3 className="text-xs font-bold text-slate-400 uppercase">Informações do Contato no Local</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FieldInput label="Nome de quem recebeu a visita" placeholder="Ex: José Silva" value={form.nomeRecebedor} onChange={(v) => updateField("nomeRecebedor", v)} icon={<User className="w-4 h-4" />} /><FieldInput label="Cargo do Recebedor" placeholder="Ex: Gerente, Capataz" value={form.cargoRecebedor} onChange={(v) => updateField("cargoRecebedor", v)} /></div></div></CardContent></Card>
                <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2"><Landmark className="w-4 h-4 text-primary" /> B. Detalhes Comerciais e Atividade</CardTitle></CardHeader><CardContent className="space-y-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Frigorífico Costumaz</Label>
                    <select 
                      className="flex h-12 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase font-medium"
                      value={form.frigorificoCostume}
                      onChange={(e) => updateField("frigorificoCostume", e.target.value)}
                    >
                      <option value="">Selecione um frigorífico...</option>
                      <option value="OUTROS">Outros</option>
                      <option value="JBS">JBS</option>
                      <option value="MINERVA">Minerva</option>
                      <option value="BEAUVALLET">Beauvallet</option>
                      <option value="MARFRIG">Marfrig</option>
                      <option value="PLENA">Plena</option>
                      <option value="MERCOFRIGO">Mercofrigo</option>
                    </select>
                  </div>
                  
                  <FieldInput label="Qtd. cabeças abatidas (último ano)" type="number" placeholder="Ex: 500" value={form.cabecasAbatidasAno} onChange={(v) => updateField("cabecasAbatidasAno", v)} /></div><div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Venda</Label><div className="flex gap-2">{["DIRETO", "CONTRATO"].map((t) => (<button key={t} type="button" onClick={() => updateField("tipoVenda", t)} className={getToggleClass(form.tipoVenda, t)}>{t}</button>))}</div></div><div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Atividade</Label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{["CRIA", "RECRIA", "ENGORDA", "CICLO COMPLETO"].map((t) => (<button key={t} type="button" onClick={() => updateField("tipoAtividade", t)} className={getToggleClass(form.tipoAtividade, t)}>{t}</button>))}</div></div><div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Terminação</Label><div className="grid grid-cols-3 gap-2">{["CONFINADO", "SEMI-CONF.", "PASTO"].map((t) => (<button key={t} type="button" onClick={() => updateField("tipoTerminacao", t)} className={getToggleClass(form.tipoTerminacao, t)}>{t}</button>))}</div></div><div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Habilitação</Label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{["CHINA", "EUROPA", "MI", "OUTROS"].map((t) => (<button key={t} type="button" onClick={() => updateField("habilitacao", t)} className={getToggleClass(form.habilitacao, t)}>{t}</button>))}</div></div></CardContent></Card>
                <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> C. Rebanho e Fechamento</CardTitle></CardHeader><CardContent className="space-y-6"><FieldInput label="Nº de Animais na Propriedade (Efetivo Total)" type="number" placeholder="Ex: 1500" value={form.numAnimais} onChange={(v) => updateField("numAnimais", v)} /><div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200"><Label className="text-xs font-bold text-slate-500 uppercase block mb-3">Disponibilidade p/ Abate</Label><div className="space-y-3"><div className="flex flex-col sm:flex-row items-start sm:items-center gap-2"><button type="button" onClick={() => updateField("disp30Dias", !form.disp30Dias)} className={`w-full sm:w-32 py-2 rounded-md font-bold text-xs transition-all border ${form.disp30Dias ? "bg-primary border-primary text-white shadow-md" : "bg-white border-slate-300 text-slate-500 hover:bg-slate-100"}`}>30 Dias {form.disp30Dias && "✓"}</button>{form.disp30Dias && (<div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full animate-in fade-in slide-in-from-left-2"><Input type="number" placeholder="Qtd. cabeças" className="h-9 bg-white text-xs font-bold" value={form.qtd30Dias} onChange={(e) => updateField("qtd30Dias", e.target.value)} /><select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase" value={form.sexo30Dias} onChange={(e) => updateField("sexo30Dias", e.target.value)}><option value="BOI">BOI</option><option value="VACA">VACA</option><option value="AMBOS">MISTO</option></select><select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase" value={form.status30Dias} onChange={(e) => updateField("status30Dias", e.target.value)}><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select></div>)}</div><div className="flex flex-col sm:flex-row items-start sm:items-center gap-2"><button type="button" onClick={() => updateField("disp60Dias", !form.disp60Dias)} className={`w-full sm:w-32 py-2 rounded-md font-bold text-xs transition-all border ${form.disp60Dias ? "bg-primary border-primary text-white shadow-md" : "bg-white border-slate-300 text-slate-500 hover:bg-slate-100"}`}>60 Dias {form.disp60Dias && "✓"}</button>{form.disp60Dias && (<div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full animate-in fade-in slide-in-from-left-2"><Input type="number" placeholder="Qtd. cabeças" className="h-9 bg-white text-xs font-bold" value={form.qtd60Dias} onChange={(e) => updateField("qtd60Dias", e.target.value)} /><select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase" value={form.sexo60Dias} onChange={(e) => updateField("sexo60Dias", e.target.value)}><option value="BOI">MACHO (BOI)</option><option value="VACA">FÊMEA (VACA)</option><option value="AMBOS">MISTO</option></select><select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase" value={form.status60Dias} onChange={(e) => updateField("status60Dias", e.target.value)}><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select></div>)}</div><div className="flex flex-col sm:flex-row items-start sm:items-center gap-2"><button type="button" onClick={() => updateField("disp90Dias", !form.disp90Dias)} className={`w-full sm:w-32 py-2 rounded-md font-bold text-xs transition-all border ${form.disp90Dias ? "bg-primary border-primary text-white shadow-md" : "bg-white border-slate-300 text-slate-500 hover:bg-slate-100"}`}>90 Dias {form.disp90Dias && "✓"}</button>{form.disp90Dias && (<div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full animate-in fade-in slide-in-from-left-2"><Input type="number" placeholder="Qtd. cabeças" className="h-9 bg-white text-xs font-bold" value={form.qtd90Dias} onChange={(e) => updateField("qtd90Dias", e.target.value)} /><select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase" value={form.sexo90Dias} onChange={(e) => updateField("sexo90Dias", e.target.value)}><option value="BOI">MACHO (BOI)</option><option value="VACA">FÊMEA (VACA)</option><option value="AMBOS">MISTO</option></select><select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase" value={form.status90Dias} onChange={(e) => updateField("status90Dias", e.target.value)}><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select></div>)}</div></div></div><div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4"><FieldInput label="Data da Visita" type="date" value={form.dataVisita} onChange={(v) => updateField("dataVisita", v)} /><div className="space-y-1.5 opacity-70"><Label className="text-xs font-bold text-slate-500 uppercase">Visitante</Label><Input disabled value={form.visitante} className="h-12 bg-slate-100 font-bold uppercase" /></div></div>
                
                {/* 👇 MODULO DE ASSINATURA DIGITAL 👇 */}
                <div className="border-t border-slate-100 pt-4 mt-6">
                  <Label className="text-xs font-bold text-slate-500 uppercase block mb-3 text-center">
                    Assinatura do Produtor / Recebedor
                  </Label>
                  
                  <div className="flex flex-col items-center">
                    <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-lg overflow-hidden w-full max-w-sm">
                      <SignatureCanvas 
                        ref={sigCanvas} 
                        penColor="black"
                        canvasProps={{ className: "w-full h-40 bg-transparent cursor-crosshair touch-none" }} 
                      />
                    </div>
                    <div className="flex gap-2 mt-3 w-full max-w-sm">
                      <Button variant="outline" className="w-full" onClick={limparAssinatura}>Limpar Assinatura</Button>
                    </div>
                  </div>
                </div>
                
                </CardContent></Card>
                <Button className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg mt-4" onClick={validateAndProceed} disabled={saving}>{saving ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> SINCRONIZANDO...</> : "SALVAR VISITA E SINCRONIZAR"}</Button>
              </div>
            )}
          </div>
          <div className="order-1 lg:order-2 h-[400px] lg:h-[calc(100vh-6rem)] lg:sticky lg:top-8 w-full rounded-2xl overflow-hidden border-2 border-primary/20 shadow-xl z-0">{typeof window !== "undefined" && (<MapContainer center={EMPRESA_COORDS} zoom={7} style={{ height: "100%", width: "100%", zIndex: 1 }}><RouteMapController routePath={routePath} /><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><CircleMarker center={EMPRESA_COORDS} radius={8} fillColor="#dc2626" color="#7f1d1d" weight={2} fillOpacity={1}><Tooltip direction="top" className="font-bold text-red-700" permanent={!userLocation}>Sede Beauvallet (Inhumas)</Tooltip></CircleMarker>{userLocation && (<><CircleMarker center={userLocation} radius={8} fillColor={isRealLocation ? "#2563eb" : "#94a3b8"} color={isRealLocation ? "#1e3a8a" : "#475569"} weight={2} fillOpacity={1}><Tooltip direction="top" className={`font-bold ${isRealLocation ? 'text-blue-700' : 'text-slate-600'}`} permanent>{isRealLocation ? "Sua Posição (Fazenda)" : "Simulação (Goiânia)"}</Tooltip></CircleMarker>{routePath.length > 0 && (<Polyline positions={routePath} color={isRealLocation ? "#3b82f6" : "#94a3b8"} weight={5} dashArray="15, 15" opacity={0.8} />)}</>)}</MapContainer>)}{!userLocation && (<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-200 z-[1000] pointer-events-none"><p className="text-xs font-bold text-slate-700 flex items-center gap-2"><Building2 className="w-4 h-4 text-red-600" /> Sede em Inhumas-GO. Inicie uma visita para ligar o GPS.</p></div>)}</div>
        </div>

        {isSearchModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
              <CardHeader className="border-b bg-surface pb-4 shrink-0 rounded-t-lg">
                <div className="flex justify-between items-center mb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                    <Search className="w-5 h-5" /> Buscar Pecuarista
                  </CardTitle>
                  <button onClick={() => setIsSearchModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input autoFocus placeholder="Filtrar por nome, município ou fazenda..." value={modalSearchTerm} onChange={(e) => setModalSearchTerm(e.target.value)} className="pl-10 h-12 text-sm" />
                </div>
              </CardHeader>
              
              <CardContent className="overflow-y-auto p-0">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 shadow-sm">
                    <TableRow>
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Pecuarista</TableHead>
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Local</TableHead>
                      <TableHead className="text-right font-semibold text-xs w-20">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRanchers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Nenhum registro encontrado.</TableCell>
                      </TableRow>
                    ) : (
                      filteredRanchers.map((r, index) => {
                        const uniqueKey = `${r.COD_PRODUTOR}-${r.INSCRICAO || 'sn'}-${r.NOME_FAZENDA}-${r.MUNICIPIO}-${index}`;
                        
                        return (
                          <TableRow key={uniqueKey} className="hover:bg-accent/5 cursor-pointer" onClick={() => selectRancher(r)}>
                            <TableCell className="py-3">
                              <p className="font-bold text-sm text-foreground">{r.NOME_PRODUTOR}</p>
                              <p className="text-[10px] text-muted-foreground">IE: {r.INSCRICAO}</p>
                            </TableCell>
                            <TableCell className="py-3">
                              <p className="text-xs font-medium text-foreground">{r.NOME_FAZENDA}</p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5"><MapPin className="w-3 h-3" /> {r.MUNICIPIO}</div>
                            </TableCell>
                            <TableCell className="text-right py-3">
                             <Button size="sm" className="text-[10px] h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider">SELECIONAR</Button>
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

        {/* 👇 MODAL DE CONFIRMAÇÃO PARA SALVAR SEM GPS */}
        {confirmSaveModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden border-0">
              <div className="h-2 w-full bg-amber-500" />
              <CardHeader className="text-center pt-8 pb-2">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-amber-100 text-amber-600">
                  <MapPinOff className="w-8 h-8" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-800">Atenção!</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8 px-8">
                <p className="text-slate-600 font-medium leading-relaxed mb-8">A localização real do seu dispositivo não foi coletada. Se você salvar agora, o relatório ficará registrado com a localização de simulação (Goiânia). Tem certeza que deseja continuar?</p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 font-bold h-12" onClick={() => setConfirmSaveModal(false)}>VOLTAR</Button>
                  <Button className="flex-1 font-bold h-12 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => executeSavePayload()}>SIM, SALVAR ASSIM</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MODAL DE ALERTAS GERAIS */}
        {alertModal && alertModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden border-0">
              <div className={`h-2 w-full ${alertModal.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
              <CardHeader className="text-center pt-8 pb-2">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${alertModal.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {alertModal.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                </div>
                <CardTitle className="text-2xl font-bold text-slate-800">{alertModal.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8 px-8">
                <p className="text-slate-600 font-medium leading-relaxed mb-8">{alertModal.message}</p>
                <Button 
                  className={`w-full h-14 text-lg font-bold shadow-md ${alertModal.type === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                  onClick={() => setAlertModal(null)}
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
      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</Label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <Input {...props} value={value} onChange={(e) => onChange?.(e.target.value)} className={`h-12 bg-white border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary uppercase ${icon ? "pl-10" : ""} ${className || ""}`} />
      </div>
    </div>
  );
}