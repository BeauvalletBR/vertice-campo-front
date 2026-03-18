import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { api, type Rancher } from "@/services/api";
import { toast } from "sonner";

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

const emptyForm = (today: string): FormData => ({
  nome: "",
  ie: "",
  propriedade: "",
  car: "sim",
  municipio: "",
  telefone: "",
  melhorDiaContato: "",
  proprietario: "",
  tipoAtividade: "cria",
  tipoTerminacao: "pasto",
  numAnimais: "",
  disponibilidade: "",
  dataVisita: today,
  visitante: "",
  produtorAssinatura: "",
});

export function FieldVisit() {
  const [step, setStep] = useState<Step>("idle");
  const [distance, setDistance] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coords] = useState({ lat: "-15.9419", lng: "-49.8753" });

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Rancher[]>([]);
  const [searching, setSearching] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [selectedRancher, setSelectedRancher] = useState<Rancher | null>(null);
  const [showResults, setShowResults] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<FormData>(emptyForm(today));

  // Search ranchers
  useEffect(() => {
    if (!searchQuery.trim() || isManual) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      const results = await api.searchRanchers(searchQuery);
      setSearchResults(results);
      setSearching(false);
      setShowResults(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, isManual]);

  const selectRancher = (r: Rancher) => {
    setSelectedRancher(r);
    setShowResults(false);
    setSearchQuery(r.nome);
    setForm((prev) => ({
      ...prev,
      nome: r.nome,
      ie: r.ie,
      propriedade: r.propriedade,
      car: r.car,
      municipio: r.municipio,
      telefone: r.telefone,
      melhorDiaContato: r.melhorDiaContato,
      proprietario: r.proprietario,
      tipoAtividade: r.tipoAtividade,
      tipoTerminacao: r.tipoTerminacao,
      numAnimais: String(r.numAnimais),
    }));
  };

  const switchToManual = () => {
    setIsManual(true);
    setSelectedRancher(null);
    setSearchQuery("");
    setSearchResults([]);
    setForm(emptyForm(today));
  };

  const switchToSearch = () => {
    setIsManual(false);
    setSelectedRancher(null);
    setSearchQuery("");
    setForm(emptyForm(today));
  };

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const simulateRoute = () => {
    setStep("routing");
    setTimeout(() => {
      setDistance("42.8 km");
      setStep("form");
    }, 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await api.saveVisit({ ...form, distance, coords });
    setSaving(false);
    if (result.success) {
      toast.success("Visita salva e sincronizada com sucesso!");
      setStep("idle");
      setDistance(null);
      setForm(emptyForm(today));
      setSelectedRancher(null);
      setSearchQuery("");
      setIsManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="p-4 space-y-5 max-w-lg mx-auto">
        {/* Idle */}
        {step === "idle" && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center pt-8 pb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Navigation className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Pronto para sair?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Inicie a rota para registrar sua visita de campo.
              </p>
            </div>
            <Button variant="field" size="xxl" className="w-full" onClick={simulateRoute}>
              INICIAR ROTA
            </Button>
          </div>
        )}

        {/* Routing */}
        {step === "routing" && (
          <Card className="text-center py-12 animate-fade-in">
            <CardContent>
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-accent animate-spin" />
              <p className="font-bold text-foreground">Capturando Coordenadas GPS...</p>
              <p className="text-xs text-muted-foreground mt-1">Aguarde a localização</p>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {step === "form" && (
          <div className="space-y-5 animate-fade-in">
            {/* Route Map Card */}
            <Card className="border-2 border-primary/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Trajeto Calculado
                  </span>
                  <span className="text-sm font-bold text-accent tabular-nums">{distance}</span>
                </div>
                <div className="h-28 bg-muted rounded-lg flex items-center justify-center border border-dashed border-border relative overflow-hidden">
                  <div className="relative w-full px-12">
                    <div className="h-0.5 bg-primary w-full" />
                    <div className="absolute left-10 -top-2.5 flex flex-col items-center">
                      <MapPin className="w-5 h-5 text-primary" />
                      <span className="text-[9px] font-semibold text-primary mt-0.5">Empresa</span>
                    </div>
                    <div className="absolute right-10 -top-2.5 flex flex-col items-center">
                      <MapPin className="w-5 h-5 text-accent" />
                      <span className="text-[9px] font-semibold text-accent mt-0.5">Fazenda</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-[10px] text-muted-foreground">
                  <span>Lat: {coords.lat}</span>
                  <span>Lng: {coords.lng}</span>
                </div>
              </CardContent>
            </Card>

            {/* Rancher Search / Manual Toggle */}
            <Card className="border-2 border-accent/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-accent flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Selecionar Pecuarista
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant={!isManual ? "action" : "outline"}
                    size="sm"
                    onClick={switchToSearch}
                    className="flex-1 text-xs"
                  >
                    <Search className="w-3 h-3 mr-1" /> Cadastrado
                  </Button>
                  <Button
                    variant={isManual ? "action" : "outline"}
                    size="sm"
                    onClick={switchToManual}
                    className="flex-1 text-xs"
                  >
                    <UserPlus className="w-3 h-3 mr-1" /> Não Cadastrado
                  </Button>
                </div>

                {!isManual && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, fazenda ou município..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowResults(true);
                      }}
                      onFocus={() => searchResults.length > 0 && setShowResults(true)}
                      className="h-12 pl-10"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {searchResults.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => selectRancher(r)}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border last:border-b-0"
                          >
                            <div className="text-sm font-medium text-foreground">{r.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.propriedade} — {r.municipio}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showResults && searchQuery.trim() && !searching && searchResults.length === 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-3 text-center">
                        <p className="text-sm text-muted-foreground">Nenhum pecuarista encontrado.</p>
                        <Button variant="ghost" size="sm" onClick={switchToManual} className="mt-1 text-xs text-accent">
                          Inserir manualmente
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {selectedRancher && !isManual && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-primary">
                        {selectedRancher.nome} — {selectedRancher.propriedade}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dados preenchidos automaticamente abaixo.
                    </p>
                  </div>
                )}

                {isManual && (
                  <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-accent">Inserção manual</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Preencha todos os campos manualmente.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section A */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  A. Dados da Propriedade e Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldInput label="Nome" placeholder="Nome do contato" value={form.nome} onChange={(v) => updateField("nome", v)} />
                <FieldInput label="I.E. (Inscrição Estadual)" placeholder="000.000.000" value={form.ie} onChange={(v) => updateField("ie", v)} inputMode="numeric" />
                <FieldInput label="Propriedade" placeholder="Ex: Fazenda Santa Fé" value={form.propriedade} onChange={(v) => updateField("propriedade", v)} />
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">CAR</Label>
                  <RadioGroup value={form.car} onValueChange={(v) => updateField("car", v)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="car-sim" />
                      <Label htmlFor="car-sim">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="car-nao" />
                      <Label htmlFor="car-nao">Não</Label>
                    </div>
                  </RadioGroup>
                </div>
                <FieldInput label="Município" placeholder="Ex: Goiânia" value={form.municipio} onChange={(v) => updateField("municipio", v)} />
                <FieldInput label="Telefone" placeholder="(62) 99999-0000" type="tel" value={form.telefone} onChange={(v) => updateField("telefone", v)} icon={<Phone className="w-4 h-4" />} />
                <FieldInput label="Melhor dia de contato" placeholder="Ex: Segunda-feira" value={form.melhorDiaContato} onChange={(v) => updateField("melhorDiaContato", v)} />
                <FieldInput label="Proprietário" placeholder="Nome do proprietário" value={form.proprietario} onChange={(v) => updateField("proprietario", v)} icon={<User className="w-4 h-4" />} />
              </CardContent>
            </Card>

            {/* Section B */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                  <Landmark className="w-4 h-4" />
                  B. Detalhes da Atividade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de Atividade</Label>
                  <RadioGroup value={form.tipoAtividade} onValueChange={(v) => updateField("tipoAtividade", v)} className="grid grid-cols-3 gap-2">
                    {["Cria", "Recria", "Engorda"].map((t) => (
                      <div key={t} className="flex items-center justify-center border rounded-lg p-3 has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-colors">
                        <RadioGroupItem value={t.toLowerCase()} id={`act-${t}`} className="sr-only" />
                        <Label htmlFor={`act-${t}`} className="cursor-pointer font-medium text-sm">{t}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de Terminação</Label>
                  <RadioGroup value={form.tipoTerminacao} onValueChange={(v) => updateField("tipoTerminacao", v)} className="grid grid-cols-3 gap-2">
                    {["Confinado", "Semi-conf.", "Pasto"].map((t) => (
                      <div key={t} className="flex items-center justify-center border rounded-lg p-3 has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-colors">
                        <RadioGroupItem value={t.toLowerCase()} id={`term-${t}`} className="sr-only" />
                        <Label htmlFor={`term-${t}`} className="cursor-pointer font-medium text-sm">{t}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* Section C */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  C. Rebanho e Fechamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldInput label="Nº de Animais" type="number" placeholder="0" value={form.numAnimais} onChange={(v) => updateField("numAnimais", v)} />
                  <FieldInput label="Disponibilidade" placeholder="Ex: Imediata" value={form.disponibilidade} onChange={(v) => updateField("disponibilidade", v)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FieldInput label="Data da Visita" type="date" value={form.dataVisita} onChange={(v) => updateField("dataVisita", v)} />
                  <FieldInput label="Visitante" placeholder="Seu nome" value={form.visitante} onChange={(v) => updateField("visitante", v)} />
                </div>
                <FieldInput
                  label="Produtor (Assinatura)"
                  placeholder="Nome completo do produtor"
                  value={form.produtorAssinatura}
                  onChange={(v) => updateField("produtorAssinatura", v)}
                  className="border-b-2 border-t-0 border-x-0 rounded-none focus-visible:ring-0"
                />
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button variant="action" size="xl" className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  SINCRONIZANDO...
                </>
              ) : (
                "SALVAR VISITA E SINCRONIZAR"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  label,
  icon,
  className,
  value,
  onChange,
  ...props
}: {
  label: string;
  icon?: React.ReactNode;
  value?: string;
  onChange?: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase">{label}</Label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>
        )}
        <Input
          {...props}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`h-12 ${icon ? "pl-10" : ""} ${className || ""}`}
        />
      </div>
    </div>
  );
}
