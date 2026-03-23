import { useState, useRef, useMemo, useEffect } from "react";
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
  FilterX,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { api } from "@/services/api";

// Tipagem do Relatório mapeada para refletir o JSON e a Tela
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
  data: string; 
  visitante: string;
  produtorAssinatura: string;
  distancia: string;
  statusDatavale: "pendente" | "cadastrado";
}

export default function Pecuaristas() {
  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [selectedReport, setSelectedReport] = useState<CheckinReport | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [allData, setAllData] = useState<CheckinReport[]>([]);

  // --- ESTADOS DOS FILTROS ---
  const [filterProdutor, setFilterProdutor] = useState("");
  const [filterFazenda, setFilterFazenda] = useState("");
  const [filterCidade, setFilterCidade] = useState("");
  const [filterData, setFilterData] = useState("");

  // Buscar dados da API de Visitas ao montar
  useEffect(() => {
    const carregarVisitas = async () => {
      setIsLoading(true);
      try {
        const data = await api.getVisitasConsulta();
        
        // Transformar o JSON que vem do Oracle para o formato do Componente
        const mappedData: CheckinReport[] = data.map((v) => ({
          id: String(v.ID_VISITA),
          nome: v.NOME_PRODUTOR || "N/A",
          ie: v.INSCRICAO || "",
          propriedade: v.NOME_FAZENDA || "N/A",
          car: v.POSSUI_CAR || "N/A",
          municipio: v.MUNICIPIO || "N/A",
          telefone: v.TELEFONE || "",
          melhorDiaContato: v.MELHOR_DIA_CONTATO || "",
          proprietario: v.NOME_PRODUTOR || "N/A",
          tipoVisita: v.NATUREZA_VISITA || "",
          nomeRecebedor: v.NOME_RECEBEDOR || "",
          cargoRecebedor: v.CARGO_RECEBEDOR || "",
          frigorificoCostume: v.FRIGORIFICO_COSTUME || "",
          cabecasAbatidasAno: v.CABECAS_ABATIDAS_ANO ? String(v.CABECAS_ABATIDAS_ANO) : "",
          tipoVenda: v.TIPO_VENDA || "",
          atividade: v.TIPO_ATIVIDADE || "",
          habilitacao: v.HABILITACAO || "",
          terminacao: v.TIPO_TERMINACAO || "",
          
          disp30Dias: v.QTD_30DIAS !== null,
          qtd30Dias: v.QTD_30DIAS ? String(v.QTD_30DIAS) : "",
          sexo30Dias: v.SEXO_30DIAS || "",
          status30Dias: v.STATUS_30DIAS || "",
          
          disp60Dias: v.QTD_60DIAS !== null,
          qtd60Dias: v.QTD_60DIAS ? String(v.QTD_60DIAS) : "",
          sexo60Dias: v.SEXO_60DIAS || "",
          status60Dias: v.STATUS_60DIAS || "",
          
          disp90Dias: v.QTD_90DIAS !== null,
          qtd90Dias: v.QTD_90DIAS ? String(v.QTD_90DIAS) : "",
          sexo90Dias: v.SEXO_90DIAS || "",
          status90Dias: v.STATUS_90DIAS || "",
          
          numAnimais: v.EFETIVO_TOTAL_ANIMAIS ? String(v.EFETIVO_TOTAL_ANIMAIS) : "",
          data: v.DATA_REGISTRO_VISITA ? v.DATA_REGISTRO_VISITA.split('T')[0] : "",
          visitante: "COMPRADOR", // Aqui você pode mapear o ID_COMPRADOR se quiser
          produtorAssinatura: v.ASSINATURA_DIGITAL || "",
          distancia: v.DISTANCIA_PERCORRIDA_REAL ? `${v.DISTANCIA_PERCORRIDA_REAL} km` : "N/A",
          
          // REGRA DE OURO: Se o COD_PRODUTOR estiver vazio, significa que é um PENDENTE de cadastro!
          statusDatavale: v.COD_PRODUTOR ? "cadastrado" : "pendente"
        }));

        setAllData(mappedData);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar o relatório de visitas.");
      } finally {
        setIsLoading(false);
      }
    };
    
    carregarVisitas();
  }, []);

  const uniqueCities = useMemo(() => Array.from(new Set(allData.map(v => v.municipio))).sort(), [allData]);

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

  const filteredPendentes = useMemo(() => applyFilters(allData.filter(v => v.statusDatavale === "pendente")), [filterProdutor, filterFazenda, filterCidade, filterData, allData]);
  const filteredHistorico = useMemo(() => applyFilters(allData.filter(v => v.statusDatavale === "cadastrado")), [filterProdutor, filterFazenda, filterCidade, filterData, allData]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-surface">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Carregando Histórico de Visitas...</h2>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in relative pb-24">
      <header className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-border pb-6 gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-primary">Gestão de Visitas</h1>
          <p className="text-muted-foreground text-sm mt-1">Análise de Check-ins e arquivo vivo do campo</p>
        </div>
      </header>

      {/* ÁREA DE FILTROS */}
      <Card className="bg-slate-50/50 border-none shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Nome Produtor</Label>
            <Input placeholder="Escreva o nome..." className="h-9 bg-white uppercase" value={filterProdutor} onChange={(e) => setFilterProdutor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Nome Fazenda</Label>
            <Input placeholder="Propriedade..." className="h-9 bg-white uppercase" value={filterFazenda} onChange={(e) => setFilterFazenda(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">Cidade</Label>
            <select 
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase"
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
                {filteredPendentes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Nenhum registro pendente encontrado com esses filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPendentes.map((p) => (
                    <TableRow key={`pend-${p.id}`} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-6 py-4">
                        <p className="font-bold text-sm text-primary uppercase">{p.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 uppercase">{p.propriedade}</p>
                      </TableCell>
                      <TableCell className="py-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground uppercase"><MapPin className="w-3 h-3" /> {p.municipio}</div>
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* 2. SEÇÃO: ARQUIVO GERAL */}
      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 pb-4 border-b border-slate-100">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Histórico Geral de Visitas
          </CardTitle>
          <CardDescription className="mt-1">Histórico completo de visitas no campo.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white">
              <TableRow>
                <TableHead className="font-semibold px-6">Pecuarista / Fazenda</TableHead>
                <TableHead className="font-semibold">Localização</TableHead>
                <TableHead className="font-semibold">Data Visita</TableHead>
                <TableHead className="text-right font-semibold px-6">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistorico.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    Nenhum registro histórico encontrado com esses filtros.
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistorico.map((c) => (
                  <TableRow key={`ult-${c.id}`} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="px-6 py-4">
                      <p className="font-bold text-sm text-primary uppercase">{c.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 uppercase">{c.propriedade}</p>
                    </TableCell>
                    <TableCell className="py-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground uppercase"><MapPin className="w-3 h-3" /> {c.municipio}</div>
                    </TableCell>
                    <TableCell className="py-4 text-sm">
                      <div className="flex items-center gap-1 font-medium text-slate-600"><Calendar className="w-3 h-3" /> {new Date(c.data).toLocaleDateString("pt-BR")}</div>
                    </TableCell>
                    <TableCell className="text-right px-6 py-4">
                      <Button size="sm" className="text-[11px] h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold" onClick={() => setSelectedReport(c)}>
                        <FileText className="w-3 h-3 mr-2" /> VER RELATÓRIO
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* =======================================================
          MODAL: RELATÓRIO DO CHECK-IN (COMPLETO)
          ======================================================= */}
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
                
                {/* Cabeçalho do Relatório de PDF */}
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

                {/* BLOCO C */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">C. Rebanho e Lotes para Abate</h3>
                  
                  <div className="mb-6">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">Efetivo Total (Propriedade)</p>
                    <p className="font-bold text-blue-700 text-lg tabular-nums">{selectedReport.numAnimais || "Não informado"} cabeças</p>
                  </div>

                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Previsão de Abate (Lotes)</h4>
                  <div className="space-y-2">
                    {selectedReport.disp30Dias && (
                      <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded border border-slate-100 items-center">
                        <span className="font-bold text-sm text-slate-800">30 Dias</span>
                        <span className="text-xs text-slate-600 font-medium">{selectedReport.qtd30Dias || 0} cabeças</span>
                        <span className="text-xs text-slate-600 font-medium uppercase">{selectedReport.sexo30Dias}</span>
                        <span className={`text-xs font-bold uppercase text-right ${selectedReport.status30Dias === 'VENDIDO' ? 'text-amber-600' : 'text-primary'}`}>{selectedReport.status30Dias}</span>
                      </div>
                    )}
                    {selectedReport.disp60Dias && (
                      <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded border border-slate-100 items-center">
                        <span className="font-bold text-sm text-slate-800">60 Dias</span>
                        <span className="text-xs text-slate-600 font-medium">{selectedReport.qtd60Dias || 0} cabeças</span>
                        <span className="text-xs text-slate-600 font-medium uppercase">{selectedReport.sexo60Dias}</span>
                        <span className={`text-xs font-bold uppercase text-right ${selectedReport.status60Dias === 'VENDIDO' ? 'text-amber-600' : 'text-primary'}`}>{selectedReport.status60Dias}</span>
                      </div>
                    )}
                    {selectedReport.disp90Dias && (
                      <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded border border-slate-100 items-center">
                        <span className="font-bold text-sm text-slate-800">90 Dias</span>
                        <span className="text-xs text-slate-600 font-medium">{selectedReport.qtd90Dias || 0} cabeças</span>
                        <span className="text-xs text-slate-600 font-medium uppercase">{selectedReport.sexo90Dias}</span>
                        <span className={`text-xs font-bold uppercase text-right ${selectedReport.status90Dias === 'VENDIDO' ? 'text-amber-600' : 'text-primary'}`}>{selectedReport.status90Dias}</span>
                      </div>
                    )}
                    {!selectedReport.disp30Dias && !selectedReport.disp60Dias && !selectedReport.disp90Dias && (
                      <p className="text-xs text-slate-400 italic">Nenhum lote com previsão de abate a curto prazo.</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 mt-10">
                    <div className="border-t border-slate-300 pt-2 text-center">
                      <p className="font-bold text-sm text-slate-800 uppercase">{selectedReport.visitante}</p>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">Comprador (Visitante)</p>
                    </div>
                    <div className="border-t border-slate-300 pt-2 text-center">
                      <p className="font-bold text-sm text-slate-800 font-serif italic uppercase">{selectedReport.produtorAssinatura || "Assinatura Digital Ausente"}</p>
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