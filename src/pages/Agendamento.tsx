import { useState, useMemo } from "react";
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
  Map, 
  CheckSquare, 
  ArrowLeft, 
  UserSquare2, 
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Building2,
  Users,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { toast } from "sonner";

// --- TIPAGENS ---
type Rancher = {
  id: string;
  cidade: string;
  codPecuarista: string;
  nome: string;
  distancia: string;
  qtdComprados12m: number;
  car: "S" | "N";
  ultimaVisita?: string; 
  habilitacao: "China" | "Não China";
};

type Region = {
  id: string;
  name: string;
  cityCount: number;
  description: string;
  ranchers: Rancher[];
};

// --- DADOS MOCKADOS DAS 10 REGIÕES DE GOIÁS ---
const regionsData: Region[] = [
  {
    id: "rmg",
    name: "Região Metropolitana de Goiânia",
    cityCount: 21,
    description: "Goiânia, Aparecida, Trindade, Senador Canedo, Inhumas, Bela Vista, Nerópolis, Guapó, etc.",
    ranchers: [
      { id: "p1", cidade: "Inhumas", codPecuarista: "PEC-0012", nome: "Fazenda Esperança (João)", distancia: "35 km", qtdComprados12m: 120, car: "S", ultimaVisita: "2026-01-10", habilitacao: "China" },
      { id: "p2", cidade: "Goiânia", codPecuarista: "PEC-0089", nome: "Sítio Vale Verde (Maria)", distancia: "12 km", qtdComprados12m: 0, car: "N", habilitacao: "Não China" },
      { id: "p12", cidade: "Trindade", codPecuarista: "PEC-0105", nome: "Agro Trindade", distancia: "25 km", qtdComprados12m: 350, car: "S", ultimaVisita: "2025-11-20", habilitacao: "China" },
    ]
  },
  {
    id: "rcg",
    name: "Centro Goiano",
    cityCount: 30,
    description: "Anápolis, Jaraguá, Ceres, Rialma, Rubiataba, Itapaci, Carmo do Rio Verde, etc.",
    ranchers: [
      { id: "p3", cidade: "Anápolis", codPecuarista: "PEC-0144", nome: "Fazenda São José", distancia: "55 km", qtdComprados12m: 45, car: "S", ultimaVisita: "2026-03-01", habilitacao: "Não China" },
    ]
  },
  {
    id: "entorno",
    name: "Entorno do Distrito Federal",
    cityCount: 20,
    description: "Águas Lindas, Luziânia, Valparaíso, Formosa, Planaltina, Cristalina, Alexânia, etc.",
    ranchers: [] 
  },
  {
    id: "sul",
    name: "Sul Goiano",
    cityCount: 26,
    description: "Itumbiara, Morrinhos, Caldas Novas, Goiatuba, Piracanjuba, Buriti Alegre, etc.",
    ranchers: [
      { id: "p4", cidade: "Itumbiara", codPecuarista: "PEC-0210", nome: "Agropecuária Sul", distancia: "205 km", qtdComprados12m: 350, car: "S", ultimaVisita: "2026-02-15", habilitacao: "China" },
      { id: "p5", cidade: "Morrinhos", codPecuarista: "PEC-0211", nome: "Estância Água Limpa", distancia: "130 km", qtdComprados12m: 80, car: "S", habilitacao: "Não China" },
    ]
  },
  {
    id: "sudoeste",
    name: "Sudoeste Goiano",
    cityCount: 26,
    description: "Rio Verde, Jataí, Mineiros, Quirinópolis, Santa Helena, São Simão, etc.",
    ranchers: [
      { id: "p6", cidade: "Rio Verde", codPecuarista: "PEC-0301", nome: "Confinamento RV", distancia: "230 km", qtdComprados12m: 1200, car: "S", ultimaVisita: "2026-03-10", habilitacao: "China" },
      { id: "p7", cidade: "Jataí", codPecuarista: "PEC-0305", nome: "Fazenda Boa Vista", distancia: "320 km", qtdComprados12m: 410, car: "S", ultimaVisita: "2025-10-05", habilitacao: "China" },
      { id: "p13", cidade: "Mineiros", codPecuarista: "PEC-0350", nome: "Fazenda Estrela", distancia: "420 km", qtdComprados12m: 25, car: "N", habilitacao: "Não China" },
    ]
  },
  {
    id: "sudeste",
    name: "Sudeste Goiano",
    cityCount: 22,
    description: "Catalão, Ipameri, Pires do Rio, Silvânia, Vianópolis, Orizona, etc.",
    ranchers: []
  },
  {
    id: "norte",
    name: "Norte Goiano",
    cityCount: 27,
    description: "Porangatu, Uruaçu, Niquelândia, Minaçu, Campinorte, Mara Rosa, etc.",
    ranchers: [
      { id: "p8", cidade: "Porangatu", codPecuarista: "PEC-0412", nome: "Estrela do Norte Agro", distancia: "400 km", qtdComprados12m: 600, car: "N", ultimaVisita: "2026-01-20", habilitacao: "Não China" },
    ]
  },
  {
    id: "nordeste",
    name: "Nordeste Goiano",
    cityCount: 20,
    description: "Posse, Campos Belos, São Domingos, Alto Paraíso, Cavalcante, etc.",
    ranchers: []
  },
  {
    id: "oeste",
    name: "Oeste Goiano",
    cityCount: 43,
    description: "Iporá, São Luís de MB, Piranhas, Caiapônia, Aragarças, Jussara, etc.",
    ranchers: [
      { id: "p9", cidade: "Jussara", codPecuarista: "PEC-0555", nome: "Fazenda Cristal", distancia: "220 km", qtdComprados12m: 150, car: "S", ultimaVisita: "2026-03-05", habilitacao: "China" },
      { id: "p10", cidade: "Iporá", codPecuarista: "PEC-0580", nome: "Sítio do Boi", distancia: "226 km", qtdComprados12m: 30, car: "S", habilitacao: "Não China" },
    ]
  },
  {
    id: "noroeste",
    name: "Noroeste Goiano",
    cityCount: 15,
    description: "Goiás, Itaberaí, Itapuranga, Aruanã, Nova Crixás, Araguapaz, etc.",
    ranchers: [
      { id: "p11", cidade: "Itaberaí", codPecuarista: "PEC-0601", nome: "Agro Itaberaí", distancia: "100 km", qtdComprados12m: 220, car: "S", ultimaVisita: "2025-12-12", habilitacao: "China" },
    ]
  }
];

export default function Agendamento() {
  // --- ESTADOS GERAIS ---
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [selectedRanchers, setSelectedRanchers] = useState<string[]>([]);
  const [isSchedulingMode, setIsSchedulingMode] = useState(false);
  
  // --- ESTADOS DOS FILTROS DA REGIÃO EXPANDIDA ---
  const [filterCity, setFilterCity] = useState("");
  const [filterCar, setFilterCar] = useState("Todos");
  const [filterHab, setFilterHab] = useState("Todos");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  
  // Estados do Formulário Final
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  // --- LÓGICA DE ABRIR/FECHAR REGIÃO ---
  const handleExpandRegion = (regionId: string) => {
    if (expandedRegion === regionId) {
      setExpandedRegion(null);
    } else {
      setExpandedRegion(regionId);
      // Reseta os filtros ao abrir uma nova região
      setFilterCity("");
      setFilterCar("Todos");
      setFilterHab("Todos");
      setSortOrder(null);
    }
  };

  // --- LÓGICA DE SELEÇÃO ---
  const toggleRancher = (rancherId: string) => {
    setSelectedRanchers((prev) => 
      prev.includes(rancherId) 
        ? prev.filter(id => id !== rancherId) 
        : [...prev, rancherId]
    );
  };

  const toggleAllVisible = (visibleRanchers: Rancher[]) => {
    const visibleIds = visibleRanchers.map(r => r.id);
    const allSelected = visibleIds.every(id => selectedRanchers.includes(id));
    
    if (allSelected) {
      setSelectedRanchers(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedRanchers(prev => {
        const newSet = new Set([...prev, ...visibleIds]);
        return Array.from(newSet);
      });
    }
  };

  const selectedRanchersData = useMemo(() => {
    const allRanchers = regionsData.flatMap(r => r.ranchers);
    return allRanchers.filter(r => selectedRanchers.includes(r.id));
  }, [selectedRanchers]);

  const handleConfirmSchedule = () => {
    if (!scheduleDate || !selectedUser) {
      toast.error("Por favor, selecione a data e o comprador responsável.");
      return;
    }
    toast.success(`Visitas agendadas com sucesso para ${selectedUser}!`);
    setSelectedRanchers([]);
    setScheduleDate("");
    setSelectedUser("");
    setIsSchedulingMode(false);
  };

  // =========================================================================
  // TELA 2: MODO DE CONFIRMAÇÃO DE AGENDAMENTO
  // =========================================================================
  if (isSchedulingMode) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 border-b pb-4">
          <Button variant="outline" size="icon" onClick={() => setIsSchedulingMode(false)}>
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
                <CalendarPlus className="w-5 h-5 text-primary" />
                Configurar Agenda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data da Visita</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    type="date" 
                    className="pl-9 h-11"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comprador Responsável</Label>
                <div className="relative">
                  <UserSquare2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-transparent px-9 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="" disabled>Selecione um usuário...</option>
                    <option value="Leandro">Leandro</option>
                    <option value="Renato">Renato</option>
                  </select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t p-4">
              <Button 
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold tracking-wide"
                onClick={handleConfirmSchedule}
              >
                REALIZAR AGENDAMENTO
              </Button>
            </CardFooter>
          </Card>

          <Card className="md:col-span-2 shadow-sm border-slate-200">
            <CardHeader className="border-b bg-white">
              <CardTitle className="text-base text-slate-700">
                Pecuaristas Selecionados ({selectedRanchers.length})
              </CardTitle>
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
                  {selectedRanchersData.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-bold text-sm text-primary">{r.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{r.codPecuarista}</p>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{r.cidade}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-bold text-blue-700">
                        {r.qtdComprados12m}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA 1: MODO DE SELEÇÃO POR REGIÕES
  // =========================================================================
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in relative pb-24">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl lg:text-3xl font-bold text-primary flex items-center gap-2">
          <CalendarPlus className="w-7 h-7" />
          Agendamento de Visitas
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione os pecuaristas disponíveis nas regiões de Goiás para gerar rotas.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {regionsData.map((region) => {
          const isExpanded = expandedRegion === region.id;
          const hasRanchers = region.ranchers.length > 0;
          
          // Calcula o TOTAL de cabeças compradas nesta região nos últimos 12 meses
          const totalComprados = region.ranchers.reduce((sum, r) => sum + r.qtdComprados12m, 0);

          const uniqueCities = Array.from(new Set(region.ranchers.map(r => r.cidade))).sort();
          
          let visibleRanchers = [...region.ranchers];
          
          if (isExpanded) {
            visibleRanchers = visibleRanchers.filter(r => {
              const matchCity = filterCity === "" || r.cidade.toLowerCase().includes(filterCity.toLowerCase());
              const matchCar = filterCar === "Todos" || r.car === filterCar;
              const matchHab = filterHab === "Todos" || r.habilitacao === filterHab;
              return matchCity && matchCar && matchHab;
            });

            if (sortOrder === "asc") {
              visibleRanchers.sort((a, b) => a.qtdComprados12m - b.qtdComprados12m);
            } else if (sortOrder === "desc") {
              visibleRanchers.sort((a, b) => b.qtdComprados12m - a.qtdComprados12m);
            }
          }
          
          return (
            <Card 
              key={region.id} 
              className={`border-2 transition-all duration-300 overflow-hidden ${isExpanded ? 'border-primary shadow-md md:col-span-2' : 'border-slate-200 hover:border-primary/50'}`}
            >
              <div 
                className={`p-4 cursor-pointer select-none ${isExpanded ? 'bg-primary/5 border-b border-primary/10' : 'bg-white'}`}
                onClick={() => handleExpandRegion(region.id)}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5 flex-1">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Map className="w-5 h-5 text-primary" />
                      {region.name}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {region.description}
                    </p>
                    
                    <div className="flex items-center gap-3 pt-2">
                      <span className="inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                        <Building2 className="w-3 h-3 mr-1" /> {region.cityCount} Cidades
                      </span>
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-1 rounded-md ${hasRanchers ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                        <Users className="w-3 h-3 mr-1" /> {region.ranchers.length} Pecuaristas Disp.
                      </span>
                    </div>
                  </div>
                  
                  {/* LADO DIREITO: BADGE AZUL + ÍCONE DA SETA */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 mt-1 sm:mt-0">
                    {/* Badge Azul de Total Comprado */}
                    <span 
                      className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap"
                      title="Total de animais comprados nos últimos 12 meses nesta região"
                    >
                      {totalComprados} cab. compradas
                    </span>
                    <div className="text-slate-400 hidden sm:block">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-white animate-in slide-in-from-top-2 duration-200">
                  {!hasRanchers ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm font-medium">Nenhum pecuarista disponível nesta região no momento.</p>
                    </div>
                  ) : (
                    <>
                      {/* BARRA DE FILTROS COM DATALIST (COMBOBOX) */}
                      <div className="bg-slate-50/50 p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                        <div className="space-y-1.5 flex-1 w-full">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Filtrar Cidade</Label>
                          <Input 
                            list={`cities-list-${region.id}`}
                            placeholder="Selecione ou digite a cidade..." 
                            className="h-9 bg-white text-xs"
                            value={filterCity}
                            onChange={(e) => setFilterCity(e.target.value)}
                          />
                          <datalist id={`cities-list-${region.id}`}>
                            {uniqueCities.map(city => (
                              <option key={city} value={city} />
                            ))}
                          </datalist>
                        </div>
                        <div className="space-y-1.5 w-full md:w-32">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">CAR</Label>
                          <select 
                            className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={filterCar}
                            onChange={(e) => setFilterCar(e.target.value)}
                          >
                            <option value="Todos">Todos</option>
                            <option value="S">Sim</option>
                            <option value="N">Não</option>
                          </select>
                        </div>
                        <div className="space-y-1.5 w-full md:w-40">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Habilitação</Label>
                          <select 
                            className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={filterHab}
                            onChange={(e) => setFilterHab(e.target.value)}
                          >
                            <option value="Todos">Todos</option>
                            <option value="China">China</option>
                            <option value="Não China">Não China</option>
                          </select>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 px-2 text-slate-400 hover:text-slate-700"
                          onClick={() => {
                            setFilterCity(""); setFilterCar("Todos"); setFilterHab("Todos"); setSortOrder(null);
                          }}
                          title="Limpar Filtros"
                        >
                          <Filter className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* TABELA DE RESULTADOS */}
                      {visibleRanchers.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <p className="text-sm font-medium">Nenhum resultado para estes filtros.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="w-[50px] text-center">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                                  checked={visibleRanchers.length > 0 && visibleRanchers.every(r => selectedRanchers.includes(r.id))}
                                  onChange={() => toggleAllVisible(visibleRanchers)}
                                  title="Selecionar visíveis"
                                />
                              </TableHead>
                              <TableHead className="text-xs font-bold">Cidade</TableHead>
                              <TableHead className="text-xs font-bold">Produtor</TableHead>
                              <TableHead className="text-xs font-bold">Distância</TableHead>
                              
                              <TableHead 
                                className="text-xs font-bold text-right cursor-pointer hover:bg-slate-200 select-none transition-colors"
                                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : prev === "desc" ? null : "asc")}
                                title="Clique para ordenar"
                              >
                                <div className="flex items-center justify-end gap-1">
                                  Comprados (12m)
                                  {sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : 
                                   sortOrder === "desc" ? <ArrowDown className="w-3 h-3 text-primary" /> : 
                                   <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                                </div>
                              </TableHead>
                              
                              <TableHead className="text-xs font-bold text-center">Hab.</TableHead>
                              <TableHead className="text-xs font-bold text-center">CAR</TableHead>
                              <TableHead className="text-xs font-bold text-center">Últ. Visita</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleRanchers.map((r) => (
                              <TableRow 
                                key={r.id} 
                                className={`cursor-pointer transition-colors ${selectedRanchers.includes(r.id) ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                                onClick={() => toggleRancher(r.id)}
                              >
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                                    checked={selectedRanchers.includes(r.id)}
                                    onChange={() => toggleRancher(r.id)}
                                  />
                                </TableCell>
                                <TableCell className="text-sm font-medium text-slate-700">{r.cidade}</TableCell>
                                <TableCell>
                                  <p className="font-bold text-sm text-primary">{r.nome}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground">{r.codPecuarista}</p>
                                </TableCell>
                                <TableCell className="text-sm tabular-nums text-slate-600">{r.distancia}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums font-bold text-blue-700">
                                  {r.qtdComprados12m}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${r.habilitacao === "China" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                    {r.habilitacao === "China" ? "CHINA" : "NACIONAL"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {r.car === "S" 
                                    ? <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">SIM</span>
                                    : <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">NÃO</span>
                                  }
                                </TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground font-medium tabular-nums">
                                  {r.ultimaVisita ? new Date(r.ultimaVisita).toLocaleDateString('pt-BR') : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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
                {selectedRanchers.length} {selectedRanchers.length === 1 ? 'pecuarista selecionado' : 'pecuaristas selecionados'}
              </span>
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90 text-white font-bold rounded-full px-8"
              onClick={() => setIsSchedulingMode(true)}
            >
              AGENDAR VISITAS
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}