import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Building2
} from "lucide-react";
import { api, type Rancher } from "@/services/api";
import { toast } from "sonner";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Step = "idle" | "routing" | "form";

interface FormData {
  nome: string;
  ie: string;
  propriedade: string;
  car: string;
  municipio: string;
  telefone: string;
  melhorDiaContato: string;
  proprietario: string;
  tipoAtividade: string;
  tipoTerminacao: string;
  numAnimais: string;
  disponibilidade: string;
  dataVisita: string;
  visitante: string;
  produtorAssinatura: string;
}

// COORDENADAS DA SEDE (INHUMAS)
const EMPRESA_COORDS: [number, number] = [-16.3419669, -49.4708347]; 
const LOGGED_USER_NAME = "Yuri Jube";

const mockAgendamentosPendentes = [
  {
    id: "ag1",
    dataAgendamento: "2026-03-20",
    rancherInfo: {
      id: "1", nome: "João Batista", ie: "10293847", propriedade: "Fazenda Esperança", 
      car: "sim", municipio: "Goiânia", telefone: "62999991111", melhorDiaContato: "Segunda", 
      proprietario: "João Batista", tipoAtividade: "cria", tipoTerminacao: "pasto", numAnimais: "450"
    }
  },
  {
    id: "ag2",
    dataAgendamento: "2026-03-21",
    rancherInfo: {
      id: "4", nome: "Agropecuária Sul", ie: "47561239", propriedade: "Confinamento RS", 
      car: "sim", municipio: "Rio Verde", telefone: "64966664444", melhorDiaContato: "Quinta", 
      proprietario: "Grupo Sul", tipoAtividade: "engorda", tipoTerminacao: "confinado", numAnimais: "3200"
    }
  }
];

const mockDatabaseRanchers: any[] = [
  { id: "1", nome: "João Batista", ie: "10293847", propriedade: "Fazenda Esperança", car: "sim", municipio: "Goiânia", telefone: "62999991111", melhorDiaContato: "Segunda", proprietario: "João Batista", tipoAtividade: "cria", tipoTerminacao: "pasto", numAnimais: 450 },
  { id: "2", nome: "Maria Silva", ie: "29384756", propriedade: "Sítio Vale Verde", car: "nao", municipio: "Rio Verde", telefone: "64988882222", melhorDiaContato: "Terça", proprietario: "Maria Silva", tipoAtividade: "recria", tipoTerminacao: "semi-conf", numAnimais: 120 },
  { id: "3", nome: "Carlos Mendes", ie: "38475612", propriedade: "Fazenda Boa Vista", car: "sim", municipio: "Jussara", telefone: "62977773333", melhorDiaContato: "Quarta", proprietario: "Carlos Mendes", tipoAtividade: "engorda", tipoTerminacao: "confinado", numAnimais: 1500 },
];

const emptyForm = (today: string): FormData => ({
  nome: "", ie: "", propriedade: "", car: "sim", municipio: "", telefone: "",
  melhorDiaContato: "", proprietario: "", tipoAtividade: "cria", tipoTerminacao: "pasto",
  numAnimais: "", disponibilidade: "", dataVisita: today, visitante: LOGGED_USER_NAME, produtorAssinatura: "",
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
  const [step, setStep] = useState<Step>("idle");
  const [distance, setDistance] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<FormData>(emptyForm(today));

  const [isManual, setIsManual] = useState(false);
  const [selectedRancher, setSelectedRancher] = useState<any | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState("");

  const filteredRanchers = useMemo(() => {
    const term = modalSearchTerm.toLowerCase();
    if (!term) return mockDatabaseRanchers.slice(0, 20);
    return mockDatabaseRanchers.filter(
      (r) => r.nome.toLowerCase().includes(term) || r.municipio.toLowerCase().includes(term) || r.propriedade.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [modalSearchTerm]);

  // PLANO B (FALLBACK): Se o navegador bloquear o GPS, ele simula a localização de Goiânia
  const executeFallbackLocation = async (callback: () => void) => {
    const fallbackLat = -16.6868; // Goiânia
    const fallbackLng = -49.2643; // Goiânia
    setUserLocation([fallbackLat, fallbackLng]);

    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${EMPRESA_COORDS[1]},${EMPRESA_COORDS[0]};${fallbackLng},${fallbackLat}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const routeCoords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        setRoutePath(routeCoords);
        setDistance(`${(data.routes[0].distance / 1000).toFixed(1)} km`);
      }
    } catch (error) {
      setRoutePath([EMPRESA_COORDS, [fallbackLat, fallbackLng]]);
      setDistance("Aprox. 42 km");
    }
    callback();
  };

  // FUNÇÃO QUE PEGA O GPS E CONSULTA A ESTRADA REAL (Atualizada para PC)
  const fetchRealRouteAndLocation = (callback: () => void) => {
    if (!navigator.geolocation) {
      toast.warning("Navegador não suporta GPS. Usando localização simulada (Goiânia).");
      executeFallbackLocation(callback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);

        try {
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${EMPRESA_COORDS[1]},${EMPRESA_COORDS[0]};${longitude},${latitude}?overview=full&geometries=geojson`);
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const routeCoords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
            setRoutePath(routeCoords);
            setDistance(`${(data.routes[0].distance / 1000).toFixed(1)} km`);
          } else {
            setRoutePath([EMPRESA_COORDS, [latitude, longitude]]);
            setDistance("Distância aproximada");
          }
        } catch (error) {
          setRoutePath([EMPRESA_COORDS, [latitude, longitude]]);
          setDistance("Sem conexão p/ rotas");
        }
        callback();
      },
      (error) => {
        console.warn("Erro do GPS:", error.message, "Código:", error.code);
        toast.warning("Não foi possível obter a localização real. Usando teste (Goiânia).");
        executeFallbackLocation(callback);
      },
      { 
        enableHighAccuracy: false, // Desligado para funcionar melhor no PC
        timeout: 15000,            // 15 segundos para o PC conseguir triangular o IP
        maximumAge: 10000          // Usa cache de GPS recente se houver
      } 
    );
  };

  const startScheduledVisit = (agendamento: any) => {
    setStep("routing");
    setSelectedRancher(agendamento.rancherInfo); 
    setForm((prev) => ({ ...prev, ...agendamento.rancherInfo }));
    fetchRealRouteAndLocation(() => setStep("form"));
  };

  const startNewVisit = () => {
    setIsManual(false);
    setSelectedRancher(null);
    setForm(emptyForm(today));
    setStep("routing");
    fetchRealRouteAndLocation(() => setStep("form"));
  };

  const selectRancher = (r: any) => {
    setSelectedRancher(r);
    setIsSearchModalOpen(false);
    setModalSearchTerm("");
    setIsManual(false);
    
    setForm((prev) => ({
      ...prev, nome: r.nome, ie: r.ie || "", propriedade: r.propriedade, car: r.car || "sim",
      municipio: r.municipio, telefone: r.telefone || "", melhorDiaContato: r.melhorDiaContato || "",
      proprietario: r.proprietario || "", tipoAtividade: r.tipoAtividade || "cria", tipoTerminacao: r.tipoTerminacao || "pasto",
      numAnimais: r.numAnimais ? String(r.numAnimais) : "",
    }));
  };

  const switchToManual = () => {
    setIsManual(true); setSelectedRancher(null); setForm(emptyForm(today));
  };

  const switchToSearch = () => {
    setIsManual(false); setSelectedRancher(null); setForm(emptyForm(today));
  };

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.nome || !form.propriedade) {
      toast.error("Preencha ao menos o Nome e a Propriedade.");
      return;
    }
    setSaving(true);
    const coordsToSave = userLocation ? { lat: String(userLocation[0]), lng: String(userLocation[1]) } : { lat: "", lng: "" };
    const result = await api.saveVisit({ ...form, distance, coords: coordsToSave });
    setSaving(false);
    
    if (result.success) {
      toast.success("Visita salva e sincronizada com sucesso!");
      setStep("idle"); setDistance(null); setRoutePath([]); setUserLocation(null);
      setForm(emptyForm(today)); setSelectedRancher(null); setIsManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-24 relative">
      <div className="p-4 max-w-7xl mx-auto">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          
          {/* LADO ESQUERDO: Formulários e Passos */}
          <div className="space-y-5 order-2 lg:order-1">
            
            {step === "idle" && (
              <div className="space-y-6 animate-fade-in pt-4">
                <div>
                  <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Navigation className="w-6 h-6" /> Minhas Visitas
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">Sua agenda de prospecção para hoje.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                      <CalendarClock className="w-5 h-5 text-amber-500" /> Agendamentos Pendentes
                    </h2>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                      {mockAgendamentosPendentes.length}
                    </span>
                  </div>

                  {mockAgendamentosPendentes.length === 0 ? (
                    <div className="text-center p-6 bg-slate-50 border border-dashed rounded-lg text-slate-400">
                      Nenhum agendamento pendente para você.
                    </div>
                  ) : (
                    mockAgendamentosPendentes.map((agendamento) => (
                      <Card 
                        key={agendamento.id} 
                        className="border-2 border-slate-200 hover:border-primary/50 transition-colors cursor-pointer shadow-sm"
                        onClick={() => startScheduledVisit(agendamento)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-primary text-base">{agendamento.rancherInfo.nome}</h3>
                            <p className="text-sm font-medium text-slate-700">{agendamento.rancherInfo.propriedade}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {agendamento.rancherInfo.municipio}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {new Date(agendamento.dataAgendamento).toLocaleDateString("pt-BR")}</span>
                            </div>
                          </div>
                          <div className="text-primary bg-primary/10 p-2 rounded-full">
                            <Navigation className="w-5 h-5" />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                <div className="pt-6">
                  <Button size="xl" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-md h-14" onClick={startNewVisit}>
                    <Plus className="w-5 h-5 mr-2" /> NOVA VISITA AVULSA
                  </Button>
                </div>
              </div>
            )}

            {step === "routing" && (
              <Card className="text-center py-32 animate-fade-in border-0 shadow-none bg-transparent">
                <CardContent>
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Traçando Rota Real...</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Buscando sua localização e mapeando as estradas a partir de Inhumas.
                  </p>
                </CardContent>
              </Card>
            )}

            {step === "form" && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center justify-between pb-2">
                  <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Checklist de Campo
                  </h2>
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => {
                    setStep("idle"); setRoutePath([]); setUserLocation(null);
                  }}>
                    <X className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                </div>

                {/* Route Map Card (Resumo da Rota) */}
                <Card className="border-2 border-primary/20 shadow-sm">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Trajeto Calculado (GPS)</span>
                      <span className="text-sm font-bold text-primary tabular-nums">{distance || "Calculando..."}</span>
                    </div>
                    <div className="h-24 bg-slate-50 rounded-lg flex items-center justify-center border border-dashed border-slate-300 relative overflow-hidden">
                      <div className="relative w-full px-12">
                        <div className="h-0.5 bg-primary/30 w-full" />
                        <div className="absolute left-10 -top-2.5 flex flex-col items-center">
                          <MapPin className="w-5 h-5 text-slate-400" />
                          <span className="text-[9px] font-semibold text-slate-500 mt-0.5">Sede (Inhumas)</span>
                        </div>
                        <div className="absolute right-10 -top-2.5 flex flex-col items-center">
                          <Navigation className="w-5 h-5 text-primary" />
                          <span className="text-[9px] font-semibold text-primary mt-0.5">Local Atual</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-4 text-[10px] text-slate-400 font-mono">
                      <span>Lat: {userLocation?.[0]?.toFixed(5) || "..."}</span>
                      <span>Lng: {userLocation?.[1]?.toFixed(5) || "..."}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-slate-200 shadow-sm">
                  <CardHeader className="pb-3 bg-slate-50 border-b flex flex-row justify-between items-center">
                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <User className="w-4 h-4" /> Identificação do Pecuarista
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex gap-2">
                      <Button variant={!isManual ? "default" : "outline"} size="sm" onClick={switchToSearch} className={`flex-1 text-xs transition-colors ${!isManual ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground"}`}>
                        <Search className="w-3 h-3 mr-1" /> Base de Dados
                      </Button>
                      <Button variant={isManual ? "default" : "outline"} size="sm" onClick={switchToManual} className={`flex-1 text-xs transition-colors ${isManual ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground"}`}>
                        <UserPlus className="w-3 h-3 mr-1" /> Novo Manual
                      </Button>
                    </div>

                    {!isManual && (
                      <Button className={`w-full h-12 flex justify-start items-center transition-colors mt-2 shadow-sm ${selectedRancher ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-primary text-white hover:bg-primary/90"}`} onClick={() => setIsSearchModalOpen(true)}>
                        <Search className="w-5 h-5 mr-3" />
                        <span className="font-medium">{selectedRancher ? "Trocar pecuarista..." : "Clique para buscar na base..."}</span>
                      </Button>
                    )}

                    {selectedRancher && !isManual && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between items-center mt-2 animate-in fade-in">
                        <div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-bold text-green-800">{selectedRancher.nome}</span>
                          </div>
                          <p className="text-xs text-green-700 mt-1 ml-6">{selectedRancher.propriedade} — {selectedRancher.municipio}</p>
                        </div>
                      </div>
                    )}

                    {isManual && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-bold text-amber-800">Inserção manual livre</span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1 ml-6">Preencha os dados do novo cliente abaixo.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" /> A. Dados da Propriedade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FieldInput label="Nome" placeholder="Nome do contato" value={form.nome} onChange={(v) => updateField("nome", v)} />
                    <FieldInput label="I.E. (Inscrição Estadual)" placeholder="000.000.000" value={form.ie} onChange={(v) => updateField("ie", v)} inputMode="numeric" />
                    <FieldInput label="Propriedade" placeholder="Ex: Fazenda Santa Fé" value={form.propriedade} onChange={(v) => updateField("propriedade", v)} />
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Possui CAR?</Label>
                      <div className="flex gap-4">
                        <button type="button" onClick={() => updateField("car", "sim")} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border ${form.car === "sim" ? "bg-primary/10 border-primary text-primary shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>Sim</button>
                        <button type="button" onClick={() => updateField("car", "nao")} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border ${form.car === "nao" ? "bg-red-50 border-red-500 text-red-700 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>Não</button>
                      </div>
                    </div>

                    <FieldInput label="Município" placeholder="Ex: Goiânia" value={form.municipio} onChange={(v) => updateField("municipio", v)} />
                    <FieldInput label="Telefone" placeholder="(62) 99999-0000" type="tel" value={form.telefone} onChange={(v) => updateField("telefone", v)} icon={<Phone className="w-4 h-4" />} />
                    <FieldInput label="Melhor dia de contato" placeholder="Ex: Segunda-feira" value={form.melhorDiaContato} onChange={(v) => updateField("melhorDiaContato", v)} />
                    <FieldInput label="Proprietário" placeholder="Nome do proprietário" value={form.proprietario} onChange={(v) => updateField("proprietario", v)} icon={<User className="w-4 h-4" />} />
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-primary" /> B. Detalhes da Atividade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Atividade</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {["Cria", "Recria", "Engorda"].map((t) => (
                          <button key={t} type="button" onClick={() => updateField("tipoAtividade", t.toLowerCase())} className={`py-3 rounded-lg font-bold text-xs transition-all border ${form.tipoAtividade === t.toLowerCase() ? "bg-primary border-primary text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Terminação</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {["Confinado", "Semi-conf.", "Pasto"].map((t) => (
                          <button key={t} type="button" onClick={() => updateField("tipoTerminacao", t.toLowerCase())} className={`py-3 rounded-lg font-bold text-xs transition-all border ${form.tipoTerminacao === t.toLowerCase() ? "bg-primary border-primary text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" /> C. Rebanho e Fechamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FieldInput label="Nº de Animais" type="number" placeholder="0" value={form.numAnimais} onChange={(v) => updateField("numAnimais", v)} />
                      <FieldInput label="Disponibilidade" placeholder="Ex: Imediata" value={form.disponibilidade} onChange={(v) => updateField("disponibilidade", v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FieldInput label="Data da Visita" type="date" value={form.dataVisita} onChange={(v) => updateField("dataVisita", v)} />
                      <div className="space-y-1.5 opacity-70">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Visitante</Label>
                        <Input disabled value={form.visitante} className="h-12 bg-slate-100 font-semibold" />
                      </div>
                    </div>
                    <FieldInput label="Produtor (Assinatura)" placeholder="Nome completo do produtor" value={form.produtorAssinatura} onChange={(v) => updateField("produtorAssinatura", v)} className="border-b-2 border-t-0 border-x-0 border-slate-300 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent text-center font-serif text-lg italic mt-2" />
                  </CardContent>
                </Card>

                <Button className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg mt-4" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> SINCRONIZANDO...</>
                  ) : "SALVAR VISITA E SINCRONIZAR"}
                </Button>
              </div>
            )}
          </div>

          {/* LADO DIREITO: MAPA AO VIVO */}
          <div className="order-1 lg:order-2 h-[400px] lg:h-[calc(100vh-6rem)] lg:sticky lg:top-8 w-full rounded-2xl overflow-hidden border-2 border-primary/20 shadow-xl z-0">
            {typeof window !== "undefined" && (
              <MapContainer
                center={EMPRESA_COORDS} 
                zoom={7}
                style={{ height: "100%", width: "100%", zIndex: 1 }}
                scrollWheelZoom={true}
              >
                <RouteMapController routePath={routePath} />
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <CircleMarker center={EMPRESA_COORDS} radius={8} fillColor="#dc2626" color="#7f1d1d" weight={2} fillOpacity={1}>
                  <Tooltip direction="top" className="font-bold text-red-700" permanent={!userLocation}>Sede Beauvallet (Inhumas)</Tooltip>
                </CircleMarker>

                {userLocation && (
                  <>
                    <CircleMarker center={userLocation} radius={8} fillColor="#2563eb" color="#1e3a8a" weight={2} fillOpacity={1}>
                      <Tooltip direction="top" className="font-bold text-blue-700" permanent>Sua Posição (Fazenda)</Tooltip>
                    </CircleMarker>
                    
                    {routePath.length > 0 && (
                      <Polyline positions={routePath} color="#3b82f6" weight={5} dashArray="15, 15" opacity={0.8} />
                    )}
                  </>
                )}
              </MapContainer>
            )}
            
            {!userLocation && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-200 z-[1000] pointer-events-none">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-red-600" /> Sede em Inhumas-GO. Inicie uma visita para ligar o GPS.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MODAL DE BUSCA COM A TABELA */}
        {isSearchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
              <CardHeader className="border-b bg-surface pb-4 shrink-0 rounded-t-lg">
                <div className="flex justify-between items-center mb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                    <Search className="w-5 h-5" />
                    Buscar Pecuarista
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
                        <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Nenhum registro encontrado para "{modalSearchTerm}".</TableCell>
                      </TableRow>
                    ) : (
                      filteredRanchers.map((r) => (
                        <TableRow key={r.id} className="hover:bg-accent/5">
                          <TableCell className="py-3">
                            <p className="font-bold text-sm text-foreground">{r.nome}</p>
                            <p className="text-[10px] text-muted-foreground">IE: {r.ie}</p>
                          </TableCell>
                          <TableCell className="py-3">
                            <p className="text-xs font-medium text-foreground">{r.propriedade}</p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5"><MapPin className="w-3 h-3" /> {r.municipio}</div>
                          </TableCell>
                          <TableCell className="text-right py-3">
                           <Button size="sm" className="text-[10px] h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider" onClick={() => selectRancher(r)}>SELECIONAR</Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
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
        <Input {...props} value={value} onChange={(e) => onChange?.(e.target.value)} className={`h-12 bg-white border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary ${icon ? "pl-10" : ""} ${className || ""}`} />
      </div>
    </div>
  );
}