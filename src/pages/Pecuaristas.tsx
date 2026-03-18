import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Clock, 
  MapPin, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  X,
  Calendar,
  Download,
  Loader2,
  Navigation,
  Search,
  FilterX,
  CheckCircle2 // Adicionado aqui
} from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Tipagem do Relatório
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
  atividade: string;
  terminacao: string;
  animais: number;
  disponibilidade: string;
  data: string;
  visitante: string;
  produtorAssinatura: string;
  distancia: string;
  statusDatavale: "pendente" | "cadastrado";
}

// MOCK: Dados unificados
const allDataMock: CheckinReport[] = [
  { id: "101", nome: "Antônio Ferreira", ie: "12345678", propriedade: "Fazenda Rio Claro", car: "Sim", municipio: "Jussara", telefone: "(62) 99999-1111", melhorDiaContato: "Segunda de manhã", proprietario: "Antônio Ferreira", atividade: "Engorda", terminacao: "Confinado", animais: 450, disponibilidade: "Imediata", data: "2026-03-15", visitante: "Yuri Jube", produtorAssinatura: "Antônio Ferreira", distancia: "42.8 km", statusDatavale: "pendente" },
  { id: "102", nome: "Mário Fernandes", ie: "87654321", propriedade: "Sítio São José", car: "Não", municipio: "Rio Verde", telefone: "(64) 98888-2222", melhorDiaContato: "Quinta à tarde", proprietario: "Mário Fernandes", atividade: "Recria", terminacao: "Pasto", animais: 120, disponibilidade: "Em 30 dias", data: "2026-03-16", visitante: "Yuri Jube", produtorAssinatura: "Mário Fernandes", distancia: "15.3 km", statusDatavale: "pendente" },
  { id: "201", nome: "Carlos Mendes", ie: "38475612", propriedade: "Fazenda Boa Vista", car: "Sim", municipio: "Jussara", telefone: "(62) 97777-3333", melhorDiaContato: "Quarta-feira", proprietario: "Carlos Mendes", atividade: "Engorda", terminacao: "Confinado", animais: 1500, disponibilidade: "15 dias", data: "2026-03-18", visitante: "Yuri Jube", produtorAssinatura: "Carlos Mendes", distancia: "89.1 km", statusDatavale: "cadastrado" },
  { id: "202", nome: "João Batista", ie: "10293847", propriedade: "Fazenda Esperança", car: "Sim", municipio: "Goiânia", telefone: "(62) 99999-1111", melhorDiaContato: "Sexta-feira", proprietario: "João Batista", atividade: "Cria", terminacao: "Pasto", animais: 450, disponibilidade: "Imediata", data: "2026-03-17", visitante: "Yuri Jube", produtorAssinatura: "João B.", distancia: "12.0 km", statusDatavale: "cadastrado" },
];

export default function Pecuaristas() {
  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [selectedReport, setSelectedReport] = useState<CheckinReport | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // --- ESTADOS DOS FILTROS ---
  const [filterProdutor, setFilterProdutor] = useState("");
  const [filterFazenda, setFilterFazenda] = useState("");
  const [filterCidade, setFilterCidade] = useState("");
  const [filterData, setFilterData] = useState("");

  const uniqueCities = useMemo(() => Array.from(new Set(allDataMock.map(v => v.municipio))).sort(), []);

  // Lógica de filtragem aplicada
  const applyFilters = (data: CheckinReport[]) => {
    return data.filter(v => {
      const matchProdutor = v.nome.toLowerCase().includes(filterProdutor.toLowerCase());
      const matchFazenda = v.propriedade.toLowerCase().includes(filterFazenda.toLowerCase());
      const matchCidade = filterCidade === "" || v.municipio === filterCidade;
      const matchData = filterData === "" || v.data === filterData;
      return matchProdutor && matchFazenda && matchCidade && matchData;
    });
  };

  const filteredPendentes = useMemo(() => applyFilters(allDataMock.filter(v => v.statusDatavale === "pendente")), [filterProdutor, filterFazenda, filterCidade, filterData]);
  const filteredHistorico = useMemo(() => applyFilters(allDataMock), [filterProdutor, filterFazenda, filterCidade, filterData]);

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

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in relative">
      <header className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-border pb-6 gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-primary">Gestão de Pecuaristas</h1>
          <p className="text-muted-foreground text-sm mt-1">Análise de Check-ins e arquivo vivo do campo</p>
        </div>
      </header>

      {/* 1. SEÇÃO: PENDENTES DE CADASTRO */}
      <Card className="border-2 border-amber-200 shadow-sm overflow-hidden transition-all duration-300">
        <div 
          onClick={() => setIsPendingOpen(!isPendingOpen)}
          className={`flex items-center justify-between p-4 cursor-pointer select-none transition-colors hover:bg-amber-50/80 ${isPendingOpen ? 'bg-amber-50 border-b border-amber-100' : 'bg-white'}`}
        >
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900">Pendentes de Cadastro no Datavale</h2>
            <span className="flex items-center justify-center bg-red-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
              {filteredPendentes.length}
            </span>
          </div>
          <div className="text-amber-600 bg-amber-100 p-1.5 rounded-full">
            {isPendingOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {isPendingOpen && (
          <CardContent className="p-0 animate-in slide-in-from-top-2 duration-200">
            <Table>
              <TableHeader className="bg-amber-50/30">
                <TableRow>
                  <TableHead className="font-semibold px-6">Pecuarista / Fazenda</TableHead>
                  <TableHead className="font-semibold">Localização</TableHead>
                  <TableHead className="font-semibold">Data Visita</TableHead>
                  <TableHead className="text-right font-semibold px-6">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPendentes.map((p) => (
                  <TableRow key={`pend-${p.id}`} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="px-6 py-4">
                      <p className="font-bold text-sm text-primary">{p.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.propriedade}</p>
                    </TableCell>
                    <TableCell className="py-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3 h-3" /> {p.municipio}</div>
                    </TableCell>
                    <TableCell className="py-4 text-sm">
                      <div className="flex items-center gap-1 font-medium text-slate-600"><Calendar className="w-3 h-3" /> {new Date(p.data).toLocaleDateString("pt-BR")}</div>
                    </TableCell>
                    <TableCell className="text-right px-6 py-4">
                      <Button size="sm" variant="outline" className="text-[11px] h-8 border-amber-600 text-amber-700 hover:bg-amber-600 hover:text-white font-bold" onClick={() => setSelectedReport(p)}>
                        <FileText className="w-3 h-3 mr-2" /> VER RELATÓRIO
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* 2. FILTROS */}
      <Card className="bg-slate-50/50 border-none shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Nome Produtor</Label>
            <Input placeholder="Escreva o nome..." className="h-9 bg-white" value={filterProdutor} onChange={(e) => setFilterProdutor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Nome Fazenda</Label>
            <Input placeholder="Propriedade..." className="h-9 bg-white" value={filterFazenda} onChange={(e) => setFilterFazenda(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Cidade</Label>
            <select 
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={filterCidade}
              onChange={(e) => setFilterCidade(e.target.value)}
            >
              <option value="">Todas as cidades</option>
              {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Data da Visita</Label>
            <Input type="date" className="h-9 bg-white text-xs" value={filterData} onChange={(e) => setFilterData(e.target.value)} />
          </div>
          <Button variant="ghost" size="sm" className="h-9 text-slate-500" onClick={() => {setFilterProdutor(""); setFilterFazenda(""); setFilterCidade(""); setFilterData("");}}>
            <FilterX className="w-4 h-4 mr-2" /> Limpar
          </Button>
        </CardContent>
      </Card>

      {/* 3. ARQUIVO GERAL */}
      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 pb-4 border-b border-slate-100">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Histórico Geral de Visitas
          </CardTitle>
          <CardDescription className="mt-1">Histórico recente de visitas a pecuaristas no campo.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white">
              <TableRow>
                <TableHead className="font-semibold px-6">Pecuarista / Fazenda</TableHead>
                <TableHead className="font-semibold">Localização</TableHead>
                <TableHead className="font-semibold text-center">Data Visita</TableHead>
                <TableHead className="text-right font-semibold px-6">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistorico.map((c) => (
                <TableRow key={`ult-${c.id}`} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="px-6 py-4">
                    <p className="font-bold text-sm text-primary">{c.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.propriedade}</p>
                  </TableCell>
                  <TableCell className="py-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3 h-3" /> {c.municipio}</div>
                  </TableCell>
                  <TableCell className="py-4 text-sm text-center">
                    <div className="flex items-center justify-center gap-1 font-medium text-slate-600"><Calendar className="w-3 h-3" /> {new Date(c.data).toLocaleDateString("pt-BR")}</div>
                  </TableCell>
                  <TableCell className="text-right px-6 py-4">
                    <Button size="sm" className="text-[11px] h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold" onClick={() => setSelectedReport(c)}>
                      <FileText className="w-3 h-3 mr-2" /> VER RELATÓRIO
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL: RELATÓRIO (FORMATO ORIGINAL MANTIDO) */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border-t-4 border-t-primary">
            <CardHeader className="border-b bg-surface pb-4 shrink-0 rounded-t-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                    <FileText className="w-5 h-5" /> Relatório de Check-in (Visita)
                  </CardTitle>
                </div>
                <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
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
                    <p className="text-sm font-bold text-slate-800">{new Date(selectedReport.data).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" /> Rota Calculada
                  </h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">Distância (Kilometragem)</p>
                      <p className="font-bold text-primary text-lg">{selectedReport.distancia}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">A. Dados da Propriedade e Contato</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Pecuarista (Nome)</p><p className="font-bold text-slate-800">{selectedReport.nome}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Inscrição Estadual (I.E.)</p><p className="font-bold text-slate-800 font-mono">{selectedReport.ie || "Não informada"}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Propriedade</p><p className="font-bold text-slate-800">{selectedReport.propriedade}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Município</p><p className="font-bold text-slate-800">{selectedReport.municipio}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Telefone</p><p className="font-bold text-slate-800">{selectedReport.telefone || "N/A"}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Melhor dia de contato</p><p className="font-bold text-slate-800">{selectedReport.melhorDiaContato || "N/A"}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Proprietário</p><p className="font-bold text-slate-800">{selectedReport.proprietario}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Possui CAR?</p><p className="font-bold text-slate-800 uppercase">{selectedReport.car}</p></div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">B. Detalhes da Atividade</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Tipo de Atividade</p><p className="font-bold text-primary uppercase">{selectedReport.atividade}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Tipo de Terminação</p><p className="font-bold text-primary uppercase">{selectedReport.terminacao}</p></div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">C. Rebanho e Fechamento</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Número de Animais</p><p className="font-bold text-blue-700 text-lg tabular-nums">{selectedReport.animais}</p></div>
                    <div><p className="text-[10px] text-slate-500 font-semibold uppercase">Disponibilidade</p><p className="font-bold text-slate-800">{selectedReport.disponibilidade || "Não informada"}</p></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 mt-10">
                    <div className="border-t border-slate-300 pt-2 text-center">
                      <p className="font-bold text-sm text-slate-800">{selectedReport.visitante}</p>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">Comprador (Visitante)</p>
                    </div>
                    <div className="border-t border-slate-300 pt-2 text-center">
                      <p className="font-bold text-sm text-slate-800 font-serif italic">{selectedReport.produtorAssinatura || "Assinatura Digital Ausente"}</p>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">Produtor</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            
            <div className="border-t bg-white p-4 rounded-b-lg flex justify-between items-center">
              <Button variant="outline" className="font-bold text-primary border-primary hover:bg-primary/10" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} BAIXAR PDF
              </Button>
              <Button onClick={() => setSelectedReport(null)} className="font-bold">FECHAR</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}