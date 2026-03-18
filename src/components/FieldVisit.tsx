import { useState } from "react";
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
} from "lucide-react";
import { api } from "@/services/api";
import { toast } from "sonner";

type Step = "idle" | "routing" | "form";

export function FieldVisit() {
  const [step, setStep] = useState<Step>("idle");
  const [distance, setDistance] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coords] = useState({ lat: "-15.9419", lng: "-49.8753" });

  const simulateRoute = () => {
    setStep("routing");
    setTimeout(() => {
      setDistance("42.8 km");
      setStep("form");
    }, 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await api.saveVisit({ distance, coords });
    setSaving(false);
    if (result.success) {
      toast.success("Visita salva e sincronizada com sucesso!");
      setStep("idle");
      setDistance(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Top Nav */}
      <nav className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <h2 className="font-bold flex items-center gap-2 text-base">
          <Navigation className="w-5 h-5" /> Nova Visita de Campo
        </h2>
      </nav>

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
            <Button
              variant="field"
              size="xxl"
              className="w-full"
              onClick={simulateRoute}
            >
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
                  <span className="text-sm font-bold text-accent tabular-nums">
                    {distance}
                  </span>
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

            {/* Section A */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  A. Dados da Propriedade e Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldInput label="Nome" placeholder="Nome do contato" />
                <FieldInput label="I.E. (Inscrição Estadual)" placeholder="000.000.000" type="text" inputMode="numeric" />
                <FieldInput label="Propriedade" placeholder="Ex: Fazenda Santa Fé" />
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">CAR</Label>
                  <RadioGroup defaultValue="sim" className="flex gap-4">
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
                <FieldInput label="Município" placeholder="Ex: Goiânia" />
                <FieldInput label="Telefone" placeholder="(62) 99999-0000" type="tel" icon={<Phone className="w-4 h-4" />} />
                <FieldInput label="Melhor dia de contato" placeholder="Ex: Segunda-feira" />
                <FieldInput label="Proprietário" placeholder="Nome do proprietário" icon={<User className="w-4 h-4" />} />
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
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">
                    Tipo de Atividade
                  </Label>
                  <RadioGroup defaultValue="cria" className="grid grid-cols-3 gap-2">
                    {["Cria", "Recria", "Engorda"].map((t) => (
                      <div
                        key={t}
                        className="flex items-center justify-center border rounded-lg p-3 has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-colors"
                      >
                        <RadioGroupItem value={t.toLowerCase()} id={`act-${t}`} className="sr-only" />
                        <Label htmlFor={`act-${t}`} className="cursor-pointer font-medium text-sm">
                          {t}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">
                    Tipo de Terminação
                  </Label>
                  <RadioGroup defaultValue="pasto" className="grid grid-cols-3 gap-2">
                    {["Confinado", "Semi-conf.", "Pasto"].map((t) => (
                      <div
                        key={t}
                        className="flex items-center justify-center border rounded-lg p-3 has-[:checked]:bg-primary/5 has-[:checked]:border-primary transition-colors"
                      >
                        <RadioGroupItem value={t.toLowerCase()} id={`term-${t}`} className="sr-only" />
                        <Label htmlFor={`term-${t}`} className="cursor-pointer font-medium text-sm">
                          {t}
                        </Label>
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
                  <FieldInput label="Nº de Animais" type="number" placeholder="0" />
                  <FieldInput label="Disponibilidade" placeholder="Ex: Imediata" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FieldInput label="Data da Visita" type="date" defaultValue={today} />
                  <FieldInput label="Visitante" placeholder="Seu nome" />
                </div>
                <FieldInput
                  label="Produtor (Assinatura)"
                  placeholder="Nome completo do produtor"
                  className="border-b-2 border-t-0 border-x-0 rounded-none focus-visible:ring-0"
                />
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              variant="action"
              size="xl"
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
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
  ...props
}: {
  label: string;
  icon?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase">{label}</Label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <Input
          {...props}
          className={`h-12 ${icon ? "pl-10" : ""} ${className || ""}`}
        />
      </div>
    </div>
  );
}
