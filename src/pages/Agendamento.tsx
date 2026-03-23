import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { 
  CalendarPlus, 
  Map as MapIcon, 
  CheckSquare, ArrowLeft, UserSquare2, CalendarDays,
  ChevronDown, ChevronUp, Building2, Users, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  Loader2, Sparkles, Trophy, Target, Truck
} from "lucide-react";
import { toast } from "sonner";
import { fetchPecuaristasAgendamento, saveAgendamento, type ApiRancher } from "@/services/api";
import { calculateScoreVolume, calculateScoreProspeccao, calculateScoreLogistica } from "@/services/pecuaristas";

const formatNumber = (num: number | string) => {
  if (num === null || num === undefined) return "0";
  return Number(num).toLocaleString('pt-BR');
};

const cityToRegionMap: Record<string, string> = {
  "GOIANIA": "rmg", "APARECIDA DE GOIANIA": "rmg", "TRINDADE": "rmg", "SENADOR CANEDO": "rmg", "INHUMAS": "rmg", "BELA VISTA DE GOIAS": "rmg", "NEROPOLIS": "rmg", "GUAPO": "rmg", "GOIANIRA": "rmg", "ABADIA DE GOIAS": "rmg", "SANTO ANTONIO DE GOIAS": "rmg", "HIDROLANDIA": "rmg", "BONFINOPOLIS": "rmg", "CALDAZINHA": "rmg", "TEREZOPOLIS DE GOIAS": "rmg", "BRAZABRANTES": "rmg", "CATURAI": "rmg", "DAMOLANDIA": "rmg", "ITAUCU": "rmg", "TAQUARAL DE GOIAS": "rmg", "NOVA VENEZA": "rmg", "GOIANAPOLIS": "rmg", "AVELINOPOLIS": "rmg", "ARAGOIANIA": "rmg",
  "ANAPOLIS": "rcg", "JARAGUA": "rcg", "CERES": "rcg", "RIALMA": "rcg", "RUBIATABA": "rcg", "ITAPACI": "rcg", "CARMO DO RIO VERDE": "rcg", "GOIANESIA": "rcg", "PIRENOPOLIS": "rcg", "CORUMBA DE GOIAS": "rcg", "COCALZINHO DE GOIAS": "rcg", "PETROLINA DE GOIAS": "rcg", "SANTA ISABEL": "rcg", "BARRO ALTO": "rcg", "VILA PROPICIO": "rcg", "CAMPO LIMPO DE GOIAS": "rcg", "OURO VERDE DE GOIAS": "rcg", "JESUPOLIS": "rcg", "SANTA ROSA DE GOIAS": "rcg", "HEITORAI": "rcg", "ITAGUARI": "rcg", "SANTA RITA DO NOVO DESTINO": "rcg", "ITAGUARU": "rcg", "SAO FRANCISCO DE GOIAS": "rcg", "URUANA": "rcg", "SAO PATRICIO": "rcg", "NOVA AMERICA": "rcg", "MORRO AGUDO DE GOIAS": "rcg",
  "LUZIANIA": "entorno", "CRISTALINA": "entorno", "FORMOSA": "entorno", "SANTO ANTONIO DO DESCOBERTO": "entorno", "PADRE BERNARDO": "entorno", "CABECEIRAS": "entorno", "ABADIANIA": "entorno",
  "ITUMBIARA": "sul", "MORRINHOS": "sul", "CALDAS NOVAS": "sul", "GOIATUBA": "sul", "PIRACANJUBA": "sul", "BURITI ALEGRE": "sul", "RIO QUENTE": "sul", "MARZAGAO": "sul", "AGUA LIMPA": "sul", "ALOANDIA": "sul", "CROMINIA": "sul", "MAIRIPOTABA": "sul", "PONTALINA": "sul", "VICENTINOPOLIS": "sul", "EDEIA": "sul", "EDEALINA": "sul", "INACIOLANDIA": "sul", "GOUVELANDIA": "sul", "ITARUMA": "sul", "PROFESSOR JAMIL": "sul",
  "RIO VERDE": "sudoeste", "JATAI": "sudoeste", "MINEIROS": "sudoeste", "QUIRINOPOLIS": "sudoeste", "SANTA HELENA DE GOIAS": "sudoeste", "SAO SIMAO": "sudoeste", "ACREUNA": "sudoeste", "MONTIVIDIU": "sudoeste", "TURVELANDIA": "sudoeste", "CASTELANDIA": "sudoeste", "PARANAIGUARA": "sudoeste", "CACU": "sudoeste", "CACHOEIRA ALTA": "sudoeste", "PEROLANDIA": "sudoeste", "SANTA RITA DO ARAGUAIA": "sudoeste", "SANTO ANTONIO DA BARRA": "sudoeste",
  "CATALAO": "sudeste", "IPAMERI": "sudeste", "PIRES DO RIO": "sudeste", "SILVANIA": "sudeste", "VIANOPOLIS": "sudeste", "ORIZONA": "sudeste", "OUVIDOR": "sudeste", "TRES RANCHOS": "sudeste", "GOIANDIRA": "sudeste", "CUMARI": "sudeste", "ANHANGUERA": "sudeste", "DAVINOPOLIS": "sudeste", "CORUMBAIBA": "sudeste", "NOVA AURORA": "sudeste", "CAMPO ALEGRE DE GOIAS": "sudeste", "LEOPOLDO DE BULHOES": "sudeste", "GAMELEIRA DE GOIAS": "sudeste", "CRISTIANOPOLIS": "sudeste", "URUTAI": "sudeste", "PALMELO": "sudeste", "SANTA CRUZ DE GOIAS": "sudeste",
  "PORANGATU": "norte", "URUACU": "norte", "NIQUELANDIA": "norte", "MINACU": "norte", "CAMPINORTE": "norte", "MARA ROSA": "norte", "ALTO HORIZONTE": "norte", "NOVA IGUACU DE GOIAS": "norte", "CAMPINACU": "norte", "MUTUNOPOLIS": "norte", "ESTRELA DO NORTE": "norte", "SANTA TEREZA DE GOIAS": "norte", "TROMBAS": "norte", "FORMOSO": "norte", "SAO LUIZ DO NORTE": "norte", "GUARINOS": "norte", "PILAR DE GOIAS": "norte", "AMARALINA": "norte", "CAMPOS VERDES": "norte", "SANTA TEREZINHA DE GOIAS": "norte", "UIRAPURU": "norte", "HIDROLINA": "norte", "BONOPOLIS": "norte", "NOVO PLANALTO": "norte", "MONTIVIDIU DO NORTE": "norte",
  "POSSE": "nordeste", "CAMPOS BELOS": "nordeste", "SAO DOMINGOS": "nordeste", "ALTO PARAISO DE GOIAS": "nordeste", "CAVALCANTE": "nordeste", "IACIARA": "nordeste", "ALVORADA DO NORTE": "nordeste", "SIMOLANDIA": "nordeste", "FLORES DE GOIAS": "nordeste", "GUARANI DE GOIAS": "nordeste", "COLINAS DO SUL": "nordeste", "MONTE ALEGRE DE GOIAS": "nordeste", "SITIO D ABADIA": "nordeste",
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
  const [apiData, setApiData] = useState<ApiRancher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [selectedRanchers, setSelectedRanchers] = useState<string[]>([]); 
  const [isSchedulingMode, setIsSchedulingMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15); 
  
  const [filterText, setFilterText] = useState("");
  const [filterCar, setFilterCar] = useState("Todos");
  const [filterHab, setFilterHab] = useState("Todos"); 
  const [filterJaVendeu, setFilterJaVendeu] = useState("Todos"); 
  
  const [sortColumn, setSortColumn] = useState<string | null>("quantidade");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>("desc");
  
  const [aiMode, setAiMode] = useState<string | null>(null);
  const [showAiMenu, setShowAiMenu] = useState<boolean>(false); 
  
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchPecuaristasAgendamento();
      
      const uniqueDataMap = new Map();
      data.forEach(item => {
        const uid = getUniqueId(item);
        if (!uniqueDataMap.has(uid)) {
          uniqueDataMap.set(uid, item);
        }
      });
      
      setApiData(Array.from(uniqueDataMap.values()));
      setIsLoading(false);
    };
    loadData();
  }, []);

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

    apiData.forEach(rancher => {
      const regionId = mapCityToRegion(rancher.MUNICIPIO);
      regionsMap[regionId].ranchers.push(rancher);
    });

    return Object.values(regionsMap);
  }, [apiData]);

  const handleExpandRegion = (regionId: string) => {
    if (expandedRegion === regionId) {
      setExpandedRegion(null);
    } else {
      setExpandedRegion(regionId);
      setFilterText(""); 
      setFilterCar("Todos"); 
      setFilterHab("Todos");
      setFilterJaVendeu("Todos"); 
      setSortColumn("quantidade"); 
      setSortDirection("desc");
      setVisibleCount(15); 
      setAiMode(null); 
      setShowAiMenu(false);
    }
  };

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

  const selectedRanchersData = useMemo(() => apiData.filter(r => selectedRanchers.includes(getUniqueId(r))), [selectedRanchers, apiData]);

  // LOGICA REAL DE SALVAMENTO COM A NOVA API
  const handleConfirmSchedule = async () => {
    if (!scheduleDate || !selectedUser) {
      toast.error("Por favor, selecione a data e o comprador responsável.");
      return;
    }

    setIsSaving(true);
    
    // Mapeamento fictício de ID de comprador. Ajuste conforme os IDs reais do seu banco
    const compradorId = selectedUser === "Leandro" ? 1 : selectedUser === "Renato" ? 2 : 3;

    try {
      let salvos = 0;
      for (const r of selectedRanchersData) {
        const resultado = await saveAgendamento({
          cod_produtor: r.COD_PRODUTOR,
          id_comprador: compradorId,
          data_agendada: scheduleDate,
          status_agendamento: "Pendente",
          inscricao: r.INSCRICAO // <--- ADICIONADO A INSCRIÇÃO AQUI
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
      setSelectedUser("");
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

  const getDisplayQuantidade = (r: ApiRancher) => {
    const china = Number(r.QTD_COMPRADA_12M_CHINA) || 0;
    const naoChina = Number(r.QTD_COMPRADA_12M_NAO_CHINA) || 0;
    
    if (filterHab === "China") return china;
    if (filterHab === "Não China") return naoChina;
    return china + naoChina; 
  };

  // --- NOVA FUNÇÃO PARA RENDERIZAR PERCENTUAL DE CHINA/NÃO-CHINA ---
  const renderCompradosDetalhes = (r: ApiRancher) => {
    if (filterHab !== "Todos") return null;

    const china = Number(r.QTD_COMPRADA_12M_CHINA) || 0;
    const naoChina = Number(r.QTD_COMPRADA_12M_NAO_CHINA) || 0;
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
        <h2 className="text-xl font-bold text-slate-700">Carregando base de pecuaristas...</h2>
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
                  <Input type="date" className="pl-9 h-11" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} disabled={isSaving} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comprador Responsável</Label>
                <div className="relative">
                  <UserSquare2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-transparent px-9 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
                    disabled={isSaving}
                  >
                    <option value="" disabled>Selecione um usuário...</option>
                    <option value="Leandro">Leandro</option>
                    <option value="Renato">Renato</option>
                  </select>
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
                    <TableHead className="font-semibold text-xs">Pecuarista</TableHead>
                    <TableHead className="font-semibold text-xs">Cidade</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Comprados (12m)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRanchersData.map((r) => {
                    const uniqueId = getUniqueId(r);
                    return (
                      <TableRow key={uniqueId}>
                        <TableCell>
                          <p className="font-black text-[15px] text-slate-900 uppercase">{r.NOME_FAZENDA}</p>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {r.NOME_PRODUTOR} <span className="font-normal">(IE: <span className="text-slate-800 font-bold">{r.INSCRICAO || "N/A"}</span>)</span>
                          </p>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{r.MUNICIPIO}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-bold text-blue-700">
                          {formatNumber(getDisplayQuantidade(r))}
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

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in relative pb-24">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl lg:text-3xl font-bold text-primary flex items-center gap-2">
          <CalendarPlus className="w-7 h-7" /> Agendamento de Visitas
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione os pecuaristas disponíveis nas regiões de Goiás para gerar rotas.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {regionsData.map((region) => {
          if (region.id === "outros" && region.ranchers.length === 0) return null;

          const isExpanded = expandedRegion === region.id;
          const hasRanchers = region.ranchers.length > 0;
          
          let visibleRanchers = [...region.ranchers];
          
          if (isExpanded) {
            visibleRanchers = visibleRanchers.filter(r => {
              const searchTerm = filterText.toLowerCase();
              const matchText = filterText === "" || 
                r.MUNICIPIO.toLowerCase().includes(searchTerm) ||
                r.NOME_PRODUTOR.toLowerCase().includes(searchTerm) ||
                r.NOME_FAZENDA.toLowerCase().includes(searchTerm);

              const matchCar = filterCar === "Todos" || r.POSSUI_CAR === filterCar;
              const matchHab = filterHab === "Todos" || 
                (filterHab === "China" && Number(r.QTD_COMPRADA_12M_CHINA) > 0) ||
                (filterHab === "Não China" && Number(r.QTD_COMPRADA_12M_NAO_CHINA) > 0);
              
              const matchJaVendeu = filterJaVendeu === "Todos" || r.JA_VENDEU === filterJaVendeu;

              return matchText && matchCar && matchHab && matchJaVendeu; 
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
                else if (sortColumn === 'quantidade') { 
                  valA = getDisplayQuantidade(a); 
                  valB = getDisplayQuantidade(b); 
                }
                else if (sortColumn === 'car') { valA = a.POSSUI_CAR; valB = b.POSSUI_CAR; }
                else if (sortColumn === 'javendeu') { valA = a.JA_VENDEU; valB = b.JA_VENDEU; }

                if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                return 0;
              });
            }
          }

          const currentUniqueCitiesArray = Array.from(new Set(visibleRanchers.map(r => r.MUNICIPIO))).sort();
          const allCitiesString = currentUniqueCitiesArray.length > 0 ? currentUniqueCitiesArray.join(", ") : "Nenhuma cidade encontrada.";
          const currentCitiesCount = currentUniqueCitiesArray.length;
          const currentRanchersCount = visibleRanchers.length;
          const currentTotalComprados = visibleRanchers.reduce((sum, r) => sum + getDisplayQuantidade(r), 0);
          
          const displayedRanchers = aiMode ? visibleRanchers.slice(0, 10) : visibleRanchers.slice(0, visibleCount);

          return (
            <Card 
              key={region.id} 
              className={`border-2 transition-all duration-300 rounded-xl flex flex-col ${isExpanded ? 'border-primary shadow-lg md:col-span-2 z-20 relative' : 'border-slate-200 hover:border-primary/50 z-0 relative'}`}
            >
              <div 
                className={`p-4 cursor-pointer select-none rounded-t-xl flex-grow flex flex-col ${isExpanded ? 'bg-primary/5 border-b border-primary/10' : 'bg-white rounded-b-xl'}`}
                onClick={() => handleExpandRegion(region.id)}
              >
                <div className="flex justify-between items-start gap-4 mb-auto">
                  <div className="space-y-1.5 flex-1">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <MapIcon className="w-5 h-5 text-primary" />
                      {region.name}
                    </h2>
                    
                    <p className={`text-xs text-muted-foreground leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                      {isExpanded ? allCitiesString : region.description}
                    </p>
                    
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 mt-1 sm:mt-0 relative">
                    
                    {isExpanded && (
                      <div className="relative">
                        
                        {showAiMenu && (
                          <div 
                            className="absolute bottom-full right-0 mb-3 w-56 bg-white border border-slate-200 shadow-2xl rounded-xl p-3 flex flex-col gap-2 z-[100] animate-in fade-in slide-in-from-bottom-2"
                            onClick={(e) => e.stopPropagation()} 
                          >
                            <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1 px-1">
                              <Sparkles className="w-3 h-3 text-amber-500" /> Foco da Sugestão
                            </Label>
                            <Button 
                              variant={aiMode === 'volume' ? 'default' : 'outline'} 
                              size="sm"
                              className={`justify-start h-8 text-xs font-bold ${aiMode === 'volume' ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                              onClick={() => handleSetAiMode('volume', 'Sugerindo: Parceiros & Volume')}
                            >
                              <Trophy className={`w-3.5 h-3.5 mr-2 ${aiMode === 'volume' ? 'text-amber-100' : 'text-amber-500'}`} /> Parceiros & Volume
                            </Button>
                            <Button 
                              variant={aiMode === 'prospeccao' ? 'default' : 'outline'} 
                              size="sm"
                              className={`justify-start h-8 text-xs font-bold ${aiMode === 'prospeccao' ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                              onClick={() => handleSetAiMode('prospeccao', 'Sugerindo: Prospecção (Novos)')}
                            >
                              <Target className={`w-3.5 h-3.5 mr-2 ${aiMode === 'prospeccao' ? 'text-amber-100' : 'text-amber-500'}`} /> Prospecção (Novos)
                            </Button>
                            <Button 
                              variant={aiMode === 'logistica' ? 'default' : 'outline'} 
                              size="sm"
                              className={`justify-start h-8 text-xs font-bold ${aiMode === 'logistica' ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                              onClick={() => handleSetAiMode('logistica', 'Sugerindo: Logística Otimizada')}
                            >
                              <Truck className={`w-3.5 h-3.5 mr-2 ${aiMode === 'logistica' ? 'text-amber-100' : 'text-amber-500'}`} /> Logística Otimizada
                            </Button>
                            
                            {aiMode && (
                              <Button 
                                variant="ghost" 
                                size="sm"
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
                          title="IA DE SUGESTÃO"
                          className={`h-8 text-[11px] font-bold ${aiMode ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none shadow-md shadow-amber-500/30" : "bg-gradient-to-r from-orange-50 to-amber-50 border border-amber-500 text-amber-600 hover:from-amber-100 hover:to-orange-100"}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAiMenu(!showAiMenu);
                          }}
                        >
                          <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${aiMode ? "text-white" : "text-amber-500"}`} />
                          {aiMode ? "SUGESTÃO ATIVA" : "SUGERIR VISITAS"}
                        </Button>
                      </div>
                    )}

                    <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap">
                      {formatNumber(currentTotalComprados)} cab. compradas
                    </span>
                    <div className="text-slate-400 hidden sm:block">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 mt-2 border-t border-slate-100/50">
                  <span className="inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                    <Building2 className="w-3 h-3 mr-1" /> {currentCitiesCount} {isExpanded ? "Cidades Encontradas" : "Cidades"}
                  </span>
                  <span className={`inline-flex items-center text-[10px] font-bold px-2 py-1 rounded-md ${currentRanchersCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    <Users className="w-3 h-3 mr-1" /> {currentRanchersCount} Propriedades
                  </span>
                </div>

              </div>

              {isExpanded && (
                <div className="bg-white animate-in slide-in-from-top-2 duration-200 rounded-b-xl overflow-hidden">
                  {currentRanchersCount === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm font-medium">Nenhum pecuarista retornado com esses filtros.</p>
                    </div>
                  ) : (
                    <>
                      <div className={`bg-slate-50/50 p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3 items-end transition-opacity`}>
                        <div className="space-y-1.5 flex-1 w-full min-w-[200px]">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Buscar Cidade, Produtor ou Fazenda</Label>
                          <Input 
                            placeholder="Digite para buscar..." 
                            className="h-9 bg-white text-xs"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5 w-full md:w-32">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">CAR</Label>
                          <select 
                            className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
                              className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              value={filterHab} onChange={(e) => setFilterHab(e.target.value)}
                            >
                              <option value="Todos">Todos</option>
                              <option value="China">China</option>
                              <option value="Não China">Não China</option>
                            </select>
                          </div>
                        )}

                        <div className="space-y-1.5 w-full md:w-32">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Já Vendeu?</Label>
                          <select 
                            className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={filterJaVendeu} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setFilterJaVendeu(val);
                              if (val === "N") {
                                setFilterHab("Todos");
                              }
                            }}
                          >
                            <option value="Todos">Todos</option>
                            <option value="S">Sim</option>
                            <option value="N">Não</option>
                          </select>
                        </div>

                        <Button 
                          variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-700 shrink-0"
                          title="Limpar todos os filtros"
                          onClick={() => { 
                            setFilterText(""); 
                            setFilterCar("Todos"); 
                            setFilterHab("Todos"); 
                            setFilterJaVendeu("Todos"); 
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

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                              <TableHead className="w-[50px] text-center">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                                  checked={visibleRanchers.length > 0 && visibleRanchers.every(r => selectedRanchers.includes(getUniqueId(r)))}
                                  onChange={() => toggleAllVisible(visibleRanchers)}
                                />
                              </TableHead>
                              
                              <TableHead className="text-xs font-bold cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('cidade')}>
                                <div className="flex items-center gap-1">Cidade {renderSortIcon('cidade')}</div>
                              </TableHead>
                              
                              <TableHead className="text-xs font-bold">Fazenda / Produtor</TableHead>
                              
                              <TableHead className="text-xs font-bold cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('distancia')}>
                                <div className="flex items-center gap-1">Distância {renderSortIcon('distancia')}</div>
                              </TableHead>

                              <TableHead className="text-xs font-bold text-right cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('quantidade')}>
                                <div className="flex items-center justify-end gap-1">Comprados (12m) {renderSortIcon('quantidade')}</div>
                              </TableHead>
                              
                              <TableHead className="text-xs font-bold text-center cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('car')}>
                                <div className="flex items-center justify-center gap-1">CAR {renderSortIcon('car')}</div>
                              </TableHead>
                              
                              <TableHead className="text-xs font-bold text-center cursor-pointer hover:bg-slate-200 select-none transition-colors" onClick={() => handleSort('javendeu')}>
                                <div className="flex items-center justify-center gap-1">Já Vendeu? {renderSortIcon('javendeu')}</div>
                              </TableHead>

                              <TableHead className="text-xs font-bold text-center">Últ. Visita</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {displayedRanchers.map((r, index) => {
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
                                    <p className="font-black text-[15px] text-slate-900 uppercase">{r.NOME_FAZENDA}</p>
                                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                      {r.NOME_PRODUTOR} <span className="font-normal">(IE: <span className="text-slate-800 font-bold">{r.INSCRICAO || "N/A"}</span>)</span>
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-sm tabular-nums text-slate-600">{formatNumber(r.DISTANCIA_CADASTRADA)} km</TableCell>
                                  
                                  <TableCell className="text-right text-sm tabular-nums">
                                    <div className="flex flex-col items-end">
                                      <span className="font-bold text-blue-700 text-base">{formatNumber(displayQuantidade)}</span>
                                      {renderCompradosDetalhes(r)}
                                    </div>
                                  </TableCell>

                                  <TableCell className="text-center">
                                    {r.POSSUI_CAR === "S" 
                                      ? <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">SIM</span>
                                      : <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">NÃO</span>
                                    }
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {r.JA_VENDEU === "S" 
                                      ? <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">SIM</span>
                                      : <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">NÃO</span>
                                    }
                                  </TableCell>
                                  <TableCell className="text-center text-xs font-medium text-slate-500">
                                    {r.DATA_ULTIMA_VISITA ? new Date(r.DATA_ULTIMA_VISITA).toLocaleDateString('pt-BR') : "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {(!aiMode && visibleRanchers.length > visibleCount) && (
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-center">
                          <Button 
                            variant="ghost" 
                            className="font-bold text-primary flex items-center gap-2 hover:bg-primary/10"
                            onClick={() => setVisibleCount(prev => prev + 15)}
                          >
                            MOSTRAR MAIS <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {selectedRanchers.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center animate-in slide-in-from-bottom-5">
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