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
import { useAuth } from "@/contexts/AuthContext";
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
  CheckCircle2,
  AlertTriangle,
  User,
  Link as LinkIcon,
  Search,
  Check,
  Filter,
  Trash2,
  AlertCircle,
  ImageIcon 
} from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { api, fetchPecuaristasAgendamento, type ApiRancher, type ApiUsuario } from "@/services/api";

interface CheckinReport {
  id: string;
  cod_produtor: string | null;
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
  disp30Dias: boolean; qtd30Dias: string; sexo30Dias: string; status30Dias: string;
  disp60Dias: boolean; qtd60Dias: string; sexo60Dias: string; status60Dias: string;
  disp90Dias: boolean; qtd90Dias: string; sexo90Dias: string; status90Dias: string;
  numAnimais: string; 
  data: string; 
  id_comprador: number;
  visitante: string;
  produtorAssinatura: string;
  distancia: string;
  distanciaRealRaw: number | null;
  statusDatavale: "pendente" | "cadastrado";
  imagem?: string | null;
  observacoes?: string | null;
}

// 👇 FUNÇÃO DEFINITIVA PARA DATA: Pega só a parte da data e ignora o resto
const formatarDataBruta = (dataString: string | null | undefined) => {
  if (!dataString) return "-";
  
  // Pega só o que tem antes do "T" (ex: "2026-05-05")
  const dataApenas = dataString.split('T')[0]; 
  
  // Divide o "2026-05-05" nos hífens
  const partes = dataApenas.split('-');
  
  if (partes.length === 3) {
    // Retorna formatado "05/05/2026"
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  
  return dataString; // Fallback caso venha num formato muito louco
};

export default function Pecuaristas() {
  const { user } = useAuth();
  
  // 👇 VERIFICAÇÃO DE NÍVEL PARA EXIBIR A LIXEIRINHA 👇
  const podeExcluir = user && (user as any).nivel > 3;

  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [selectedReport, setSelectedReport] = useState<CheckinReport | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [allData, setAllData] = useState<CheckinReport[]>([]);
  const [pecuaristas, setPecuaristas] = useState<ApiRancher[]>([]);
  const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]);

  const [filterProdutor, setFilterProdutor] = useState("");
  const [filterFazenda, setFilterFazenda] = useState("");
  const [filterCidade, setFilterCidade] = useState("");
  const [filterData, setFilterData] = useState("");

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [visitToLink, setVisitToLink] = useState<CheckinReport | null>(null);
  const [searchRancher, setSearchRancher] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  
  const [isInativando, setIsInativando] = useState<string | null>(null);
  const [visitaParaInativar, setVisitaParaInativar] = useState<string | null>(null);

  // 👇 VARIÁVEL RESTAURADA PARA O MODAL DE ERRO 👇
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    const carregarVisitas = async () => {
      setIsLoading(true);
      try {
        const [data, dadosPecuaristas, dadosUsuarios] = await Promise.all([
          api.getVisitasConsulta(),
          fetchPecuaristasAgendamento(),
          api.getUsuarios()
        ]);
        
        setPecuaristas(dadosPecuaristas);
        setUsuariosData(dadosUsuarios);

        const getNomeComprador = (id: number) => {
          if (!id) return "COMPRADOR";
          const usuario = dadosUsuarios.find(u => Number(u.SEQUSUARIO) === Number(id));
          return usuario ? usuario.CODUSUARIO : `ID: ${id}`;
        };

        const mappedData: CheckinReport[] = data.map((v: any) => ({
          id: String(v.ID_VISITA),
          cod_produtor: v.COD_PRODUTOR ? String(v.COD_PRODUTOR) : null,
          nome: v.NOME_PRODUTOR || "N/A", ie: v.INSCRICAO || "", propriedade: v.NOME_FAZENDA || "N/A",
          car: v.POSSUI_CAR || "N/A", municipio: v.MUNICIPIO || "N/A", telefone: v.TELEFONE || "",
          melhorDiaContato: v.MELHOR_DIA_CONTATO || "", proprietario: v.NOME_PRODUTOR || "N/A",
          tipoVisita: v.NATUREZA_VISITA || "", nomeRecebedor: v.NOME_RECEBEDOR || "", cargoRecebedor: v.CARGO_RECEBEDOR || "",
          frigorificoCostume: v.FRIGORIFICO_COSTUME || "", cabecasAbatidasAno: v.CABECAS_ABATIDAS_ANO ? String(v.CABECAS_ABATIDAS_ANO) : "",
          tipoVenda: v.TIPO_VENDA || "", atividade: v.TIPO_ATIVIDADE || "", habilitacao: v.HABILITACAO || "", terminacao: v.TIPO_TERMINACAO || "",
          disp30Dias: v.QTD_30DIAS !== null, qtd30Dias: v.QTD_30DIAS ? String(v.QTD_30DIAS) : "", sexo30Dias: v.SEXO_30DIAS || "", status30Dias: v.STATUS_30DIAS || "",
          disp60Dias: v.QTD_60DIAS !== null, qtd60Dias: v.QTD_60DIAS ? String(v.QTD_60DIAS) : "", sexo60Dias: v.SEXO_60DIAS || "", status60Dias: v.STATUS_60DIAS || "",
          disp90Dias: v.QTD_90DIAS !== null, qtd90Dias: v.QTD_90DIAS ? String(v.QTD_90DIAS) : "", sexo90Dias: v.SEXO_90DIAS || "", status90Dias: v.STATUS_90DIAS || "",
          numAnimais: v.EFETIVO_TOTAL_ANIMAIS ? String(v.EFETIVO_TOTAL_ANIMAIS) : "",
          data: v.DATA_REGISTRO_VISITA || "", // Grava no estado o dado sujo exatamente como veio do banco
          id_comprador: v.ID_COMPRADOR,
          visitante: getNomeComprador(v.ID_COMPRADOR), produtorAssinatura: v.ASSINATURA_DIGITAL || "",
          distancia: v.DISTANCIA_PERCORRIDA_REAL ? `${(v.DISTANCIA_PERCORRIDA_REAL * 2).toFixed(1)} km` : "N/A", 
          distanciaRealRaw: v.DISTANCIA_PERCORRIDA_REAL,
          statusDatavale: v.COD_PRODUTOR ? "cadastrado" : "pendente",
          imagem: v.IMAGEM || null,
          observacoes: v.OBSERVACOES || null
        }));

        setAllData(mappedData);
      } catch (error) {
        toast.error("Erro ao carregar o relatório de visitas.");
      } finally {
        setIsLoading(false);
      }
    };
    
    carregarVisitas();
  }, []);

  const uniqueCities = useMemo(() => Array.from(new Set(allData.map(v => v.municipio))).sort(), [allData]);

  const applyFilters = (data: CheckinReport[]) => {
    return data.filter(v => {
      const matchProdutor = v.nome.toLowerCase().includes(filterProdutor.toLowerCase());
      const matchFazenda = v.propriedade.toLowerCase().includes(filterFazenda.toLowerCase());
      const matchCidade = filterCidade === "" || v.municipio === filterCidade;
      
      const matchData = filterData === "" || (v.data && v.data.startsWith(filterData)); 

      return matchProdutor && matchFazenda && matchCidade && matchData;
    });
  };

  const filteredPendentes = useMemo(() => applyFilters(allData.filter(v => v.statusDatavale === "pendente")), [filterProdutor, filterFazenda, filterCidade, filterData, allData]);

  const filteredHistorico = useMemo(() => {
    const historico = applyFilters(allData.filter(v => v.statusDatavale === "cadastrado"));
    return historico.sort((a, b) => Number(b.id) - Number(a.id));
  }, [filterProdutor, filterFazenda, filterCidade, filterData, allData]);

  const handleVincularPecuarista = async (rancher: ApiRancher) => {
    if (!visitToLink) return;
    setIsLinking(true);

    try {
      const result = await api.vincularVisita({
        id_visita: visitToLink.id,
        cod_produtor: rancher.COD_PRODUTOR,
        nome_produtor: rancher.NOME_PRODUTOR,
        nome_fazenda: rancher.NOME_FAZENDA,
        municipio: rancher.MUNICIPIO,
        inscricao: rancher.INSCRICAO,
        possui_car: rancher.POSSUI_CAR
      });

      if (result.success === false) throw new Error(result.message);

      setAllData(prev => prev.map(v => {
        if (v.id === visitToLink.id) {
          return {
            ...v,
            cod_produtor: String(rancher.COD_PRODUTOR),
            nome: rancher.NOME_PRODUTOR,
            propriedade: rancher.NOME_FAZENDA,
            municipio: rancher.MUNICIPIO,
            ie: rancher.INSCRICAO,
            car: rancher.POSSUI_CAR,
            statusDatavale: "cadastrado"
          };
        }
        return v;
      }));

      toast.success(`Visita vinculada a ${rancher.NOME_PRODUTOR}!`);
      setIsLinkModalOpen(false);
      setVisitToLink(null);

    } catch (error) {
      toast.error("Falha ao vincular pecuarista.");
    } finally {
      setIsLinking(false);
    }
  };

  const confirmInativarVisita = async () => {
    if (!visitaParaInativar) return;
    
    setIsInativando(visitaParaInativar);
    try {
      const result = await api.inativarVisita(visitaParaInativar);
      if (result.success) {
        toast.success("Visita inativada com sucesso!");
        setAllData(prev => prev.filter(v => v.id !== visitaParaInativar)); 
        setVisitaParaInativar(null); 
      } else {
        toast.error(result.message || "Erro ao inativar visita.");
      }
    } catch (error) {
      toast.error("Erro de comunicação com o servidor.");
    } finally {
      setIsInativando(null);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !selectedReport) return;
    try {
      setIsGeneratingPDF(true);
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      let imgWidth = pdfWidth;
      let imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight > pdfHeight) {
        const ratio = pdfHeight / imgHeight;
        imgHeight = pdfHeight;
        imgWidth = imgWidth * ratio;
      }

      const xOffset = (pdfWidth - imgWidth) / 2;

      pdf.addImage(imgData, "PNG", xOffset, 0, imgWidth, imgHeight);
      pdf.save(`Checkin_${selectedReport.nome.replace(/\s+/g, '_')}_${formatarDataBruta(selectedReport.data).replace(/\//g, '-')}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar o PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const renderLogisticaRow = (v: CheckinReport) => {
    let erpKm: number | null = null;
    let gpsKmBase: number | null = v.distanciaRealRaw;
    let gpsKmIdaVolta: number | null = null;
    let isRed = false;

    if (gpsKmBase !== null) {
      gpsKmIdaVolta = gpsKmBase * 2;
    }

    if (v.cod_produtor) {
      const pec = pecuaristas.find(p => String(p.COD_PRODUTOR) === v.cod_produtor);
      if (pec && pec.DISTANCIA_CADASTRADA) erpKm = Number(pec.DISTANCIA_CADASTRADA);
    }

    if (erpKm !== null && gpsKmIdaVolta !== null) {
      const diferenca = Math.abs(erpKm - gpsKmIdaVolta);
      const porcentagemErro = (diferenca / erpKm) * 100;
      if (porcentagemErro > 10) isRed = true;
    }

    return (
      <TableRow key={`ult-${v.id}`} className="transition-colors hover:bg-slate-50">
        <TableCell className="py-4 text-sm font-medium text-slate-600 whitespace-nowrap">
           {formatarDataBruta(v.data)} 
        </TableCell>
        <TableCell className="px-4 py-4">
          <p className="font-bold text-sm text-slate-800 uppercase">{v.nome}</p>
          <p className="text-xs font-medium text-slate-500 mt-0.5 uppercase">{v.propriedade}</p>
        </TableCell>
        <TableCell className="py-4 text-sm whitespace-nowrap">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md w-fit uppercase">
            <User className="w-3 h-3 text-slate-400" /> {v.visitante}
          </div>
        </TableCell>
        
        <TableCell className="py-4 text-sm text-center">
          <span className="text-blue-700 font-black">{gpsKmIdaVolta !== null ? `${gpsKmIdaVolta.toFixed(1)} km` : '--'}</span>
        </TableCell>
        
        <TableCell className="py-4 text-sm text-center">
          {isRed ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 font-bold text-[11px] whitespace-nowrap mx-auto shadow-sm" title="Divergência superior a 10% entre ERP e GPS (Ida e Volta)">
              <AlertTriangle className="w-3.5 h-3.5" />
              {erpKm !== null ? `${erpKm.toFixed(1)} km` : '--'}
            </div>
          ) : (
            <span className="text-slate-500 font-semibold">
              {erpKm !== null ? `${erpKm.toFixed(1)} km` : '--'}
            </span>
          )}
        </TableCell>
        
        <TableCell className="text-right px-4 py-4">
          <div className="flex items-center justify-end gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-[11px] h-8 font-bold shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100 transition-all rounded-lg" 
              onClick={() => setSelectedReport(v)}
            >
              <FileText className="w-3.5 h-3.5 mr-2" /> RELATÓRIO
            </Button>
            
            {podeExcluir && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 w-8 p-0 border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all rounded-lg shadow-sm" 
                onClick={() => setVisitaParaInativar(v.id)}
                disabled={isInativando === v.id}
                title="Inativar Visita"
              >
                {isInativando === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Carregando Histórico de Visitas...</h2>
      </div>
    );
  }

  const searchTerm = searchRancher.trim().toLowerCase();
  const filteredModalRanchers = pecuaristas.filter(p => {
    if (searchTerm === "") return true;
    return p.NOME_PRODUTOR.toLowerCase().includes(searchTerm) || 
           p.NOME_FAZENDA.toLowerCase().includes(searchTerm);
  }).slice(0, 30); 

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 animate-fade-in relative pb-24">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        <header className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-slate-200 pb-6 gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" /> Gestão de Visitas
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Análise de Check-ins e Auditoria Operacional</p>
          </div>
        </header>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
              <Filter className="w-4 h-4 text-primary" /> Filtros de Pesquisa
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome Produtor</Label>
                <Input placeholder="Escreva o nome..." className="h-10 bg-slate-50 border-slate-200 uppercase font-bold text-slate-700" value={filterProdutor} onChange={(e) => setFilterProdutor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome Fazenda</Label>
                <Input placeholder="Propriedade..." className="h-10 bg-slate-50 border-slate-200 uppercase font-bold text-slate-700" value={filterFazenda} onChange={(e) => setFilterFazenda(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cidade</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  value={filterCidade}
                  onChange={(e) => setFilterCidade(e.target.value)}
                >
                  <option value="">TODAS AS CIDADES</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data da Visita</Label>
                <Input type="date" className="h-10 bg-slate-50 border-slate-200 text-xs font-bold text-slate-700" value={filterData} onChange={(e) => setFilterData(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" className="h-10 text-slate-600 font-bold border-slate-200 hover:bg-slate-100" onClick={() => {setFilterProdutor(""); setFilterFazenda(""); setFilterCidade(""); setFilterData("");}}>
                <FilterX className="w-4 h-4 mr-2 text-slate-400" /> LIMPAR FILTROS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 1. SEÇÃO: PENDENTES DE CADASTRO */}
        <Card className="border border-amber-200 shadow-sm overflow-hidden transition-all duration-300 rounded-xl bg-white">
          <div 
            onClick={() => setIsPendingOpen(!isPendingOpen)}
            className={`flex items-center justify-between p-5 cursor-pointer select-none transition-colors hover:bg-amber-50/50 ${isPendingOpen ? 'bg-amber-50/30 border-b border-amber-100' : 'bg-white'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Pendentes de Vínculo</h2>
                <p className="text-xs font-medium text-slate-500">Visitas aguardando ligação com cadastro no ERP</p>
              </div>
              <span className="ml-2 flex items-center justify-center bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                {filteredPendentes.length} Pendentes
              </span>
            </div>
            <div className="text-slate-400 bg-slate-50 border border-slate-200 p-2 rounded-lg">
              {isPendingOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>

          {isPendingOpen && (
            <CardContent className="p-0 animate-in slide-in-from-top-2 duration-200 overflow-x-auto bg-white">
              <Table>
                <TableHeader className="bg-amber-50/30">
                  <TableRow>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 px-6">Informado na Visita</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500">Localização</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500">Data</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-500 px-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPendentes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-slate-400 font-medium">
                        Nenhum registro pendente encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPendentes.map((p) => (
                      <TableRow key={`pend-${p.id}`} className="hover:bg-amber-50/20 transition-colors">
                        <TableCell className="px-6 py-4">
                          <p className="font-black text-sm text-slate-800 uppercase line-clamp-1">{p.nome}</p>
                          <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase line-clamp-1">{p.propriedade}</p>
                        </TableCell>
                        <TableCell className="py-4 text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600 font-bold uppercase"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {p.municipio}</div>
                        </TableCell>
                        <TableCell className="py-4 text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-bold text-slate-600"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatarDataBruta(p.data)}</div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                          <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
                            
                            <Button 
                              size="sm" 
                              className="text-[11px] h-8 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm rounded-lg"
                              onClick={() => {
                                setVisitToLink(p);
                                setIsLinkModalOpen(true);
                                setSearchRancher("");
                              }}
                            >
                              <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> VINCULAR AO ERP
                            </Button>

                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-[11px] h-8 text-slate-600 border-slate-200 hover:bg-slate-100 font-bold transition-all shadow-sm rounded-lg" 
                              onClick={() => setSelectedReport(p)}
                            >
                              <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> RELATÓRIO
                            </Button>

                            {/* 👇 TRAVA DE NÍVEL APLICADA NA LIXEIRINHA DE PENDENTES 👇 */}
                            {podeExcluir && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 w-8 p-0 border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all rounded-lg shadow-sm" 
                                onClick={() => setVisitaParaInativar(p.id)}
                                disabled={isInativando === p.id}
                                title="Inativar Visita"
                              >
                                {isInativando === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </Button>
                            )}

                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>

        {/* 2. SEÇÃO: ARQUIVO GERAL (COM AUDITORIA) */}
        <Card className="border border-slate-200 shadow-sm overflow-hidden rounded-xl bg-white">
          <CardHeader className="bg-slate-50 pb-5 border-b border-slate-100">
            <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-800 tracking-tight">
              <CheckCircle2 className="w-6 h-6 text-primary" /> Histórico & Auditoria Logística
            </CardTitle>
            <CardDescription className="font-medium text-slate-500 mt-1">Acompanhamento das visitas vinculadas e validação do desvio de rota do GPS.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto bg-white">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 px-4">Data</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 px-4 min-w-[200px]">Pecuarista / Fazenda</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500">Comprador</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center whitespace-nowrap">KM Visita (Ida e Volta)</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center whitespace-nowrap">KM Sistema (ERP)</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-500 px-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistorico.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400 font-medium">
                      Nenhum registro histórico encontrado com esses filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistorico.map((c) => renderLogisticaRow(c))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* =======================================================
            MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (NOVO E CUSTOMIZADO)
            ======================================================= */}
        {visitaParaInativar && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden border-none rounded-2xl">
              <div className="h-2 w-full bg-red-600" />
              <CardHeader className="text-center pt-8 pb-2">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-red-50 border border-red-100 text-red-500">
                  <Trash2 className="w-8 h-8" />
                </div>
                <CardTitle className="text-2xl font-black text-slate-800">Inativar Visita?</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8 px-8">
                <p className="text-slate-500 font-medium leading-relaxed mb-8">
                  Tem certeza que deseja inativar esta visita? Ela não aparecerá mais nos relatórios do sistema.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 font-bold h-12 border-slate-200 text-slate-600 hover:bg-slate-50" 
                    onClick={() => setVisitaParaInativar(null)}
                    disabled={isInativando !== null}
                  >
                    CANCELAR
                  </Button>
                  <Button 
                    className="flex-1 font-bold h-12 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20" 
                    onClick={confirmInativarVisita}
                    disabled={isInativando !== null}
                  >
                    {isInativando ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "SIM, INATIVAR"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* =======================================================
            MODAL: VINCULAR PECUARISTA
            ======================================================= */}
        {isLinkModalOpen && visitToLink && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl flex flex-col shadow-2xl border-none rounded-2xl overflow-hidden max-h-[85vh]">
              <div className="h-2 w-full bg-amber-500" />
              <CardHeader className="border-b bg-white pb-4 shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
                      <LinkIcon className="w-5 h-5 text-amber-500" /> Vincular Pecuarista ao ERP
                    </CardTitle>
                    <CardDescription className="mt-2 font-medium">
                      Encontre o cadastro oficial para a visita feita em <b className="text-slate-700">{visitToLink.propriedade}</b> ({visitToLink.nome}).
                    </CardDescription>
                  </div>
                  <button onClick={() => setIsLinkModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex flex-col gap-4 overflow-hidden bg-slate-50">
                
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    className="pl-11 h-12 uppercase font-bold text-slate-700 shadow-sm border-slate-200" 
                    placeholder="Pesquise por Nome ou Fazenda..." 
                    value={searchRancher}
                    onChange={(e) => setSearchRancher(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-sm min-h-[300px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10">
                      <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500">Dados do ERP</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredModalRanchers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-12 text-slate-400 font-medium">Nenhum pecuarista encontrado na base.</TableCell>
                        </TableRow>
                      ) : (
                        filteredModalRanchers.map((r, index) => (
                          <TableRow key={`${r.COD_PRODUTOR}-${r.INSCRICAO}-${index}`} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="py-4">
                              <p className="font-black text-sm text-slate-800 uppercase">{r.NOME_PRODUTOR}</p>
                              <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase">{r.NOME_FAZENDA} - {r.MUNICIPIO}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">CÓD: {r.COD_PRODUTOR} | IE: {r.INSCRICAO}</p>
                            </TableCell>
                            <TableCell className="text-right align-middle py-4">
                              <Button 
                                size="sm" 
                                className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-lg h-9"
                                onClick={() => handleVincularPecuarista(r)}
                                disabled={isLinking}
                              >
                                {isLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                                CONFIRMAR
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
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
                  className={`w-full h-14 text-base tracking-wide font-black shadow-lg ${alertModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'}`}
                  onClick={() => setAlertModal(null)}
                >
                  OK, ENTENDIDO
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MODAL: RELATÓRIO DO CHECK-IN (LEITURA) */}
        {selectedReport && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border-none rounded-2xl overflow-hidden">
              <div className="h-2 w-full bg-primary" />
              <CardHeader className="border-b bg-white pb-4 shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
                    <FileText className="w-6 h-6 text-primary" /> Relatório de Check-in (Visita)
                  </CardTitle>
                  <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              
              <CardContent className="overflow-y-auto p-0 bg-slate-50/50 custom-scrollbar">
                <div ref={reportRef} className="p-8 space-y-6 bg-white">
                  
                  {/* CABEÇALHO DO RELATÓRIO DE PDF */}
                  <div className="border-b-2 border-primary pb-4 mb-6 flex justify-between items-end">
                    <div className="flex items-center gap-4">
                      <img 
                        src="/logo.png" 
                        alt="Logo Empresa" 
                        className="h-14 object-contain" 
                        crossOrigin="anonymous" 
                      />
                      <div>
                        <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Ficha de Visita</h2>
                        <p className="text-sm font-bold text-slate-500 mt-1">Originação de Gado - Beauvallet</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data da Visita</p>
                      <p className="text-sm font-black text-slate-800">
                        {selectedReport.data && selectedReport.data !== "-" ? new Date(selectedReport.data).toLocaleDateString("pt-BR") : "-"}
                      </p>
                    </div>
                  </div>

                  {/* 👇 ROTA E IMAGEM DO CURRAL (LADO A LADO) 👇 */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                      {/* Rota */}
                      <div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-primary" /> Rota Calculada
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Distância (Ida e Volta)</p>
                        <p className="font-black text-slate-800 text-xl tabular-nums">{selectedReport.distancia}</p>
                      </div>
                      
                      {/* Imagem (Se houver) */}
                      <div className="flex flex-col items-end justify-center">
                        {selectedReport.imagem ? (
                          <div className="border border-slate-200 bg-white rounded-xl p-1 shadow-sm overflow-hidden h-24 w-auto max-w-[200px]">
                             <img src={selectedReport.imagem} alt="Foto Capturada" className="h-full w-full object-cover rounded-lg" />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300">
                             <ImageIcon className="w-6 h-6 mb-1 opacity-20" />
                             <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Sem Imagem</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BLOCO A */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">A. Dados da Propriedade e Contato</h3>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-6">
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pecuarista (Nome)</p><p className="font-black text-slate-800 uppercase">{selectedReport.nome}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Natureza da Visita</p><p className="font-black text-primary uppercase">{selectedReport.tipoVisita}</p></div>
                      
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Inscrição Estadual (I.E.)</p><p className="font-bold text-slate-600 font-mono uppercase">{selectedReport.ie || "Não informada"}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Possui CAR?</p><p className="font-bold text-slate-600 uppercase">{selectedReport.car}</p></div>

                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Propriedade</p><p className="font-bold text-slate-800 uppercase">{selectedReport.propriedade}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Município</p><p className="font-bold text-slate-800 uppercase">{selectedReport.municipio}</p></div>
                      
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Telefone</p><p className="font-bold text-slate-800 uppercase">{selectedReport.telefone || "N/A"}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Melhor dia de contato</p><p className="font-bold text-slate-800 uppercase">{selectedReport.melhorDiaContato || "N/A"}</p></div>
                      
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Contato no Local (Nome)</p><p className="font-bold text-slate-800 uppercase">{selectedReport.nomeRecebedor || selectedReport.proprietario}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cargo (Contato)</p><p className="font-bold text-slate-800 uppercase">{selectedReport.cargoRecebedor || "Proprietário"}</p></div>
                    </div>
                  </div>

                  {/* BLOCO B */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">B. Detalhes Comerciais e Atividade</h3>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Frigorífico Costumaz</p><p className="font-bold text-slate-800 uppercase">{selectedReport.frigorificoCostume || "Não informado"}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Abates (Último Ano)</p><p className="font-bold text-slate-800 tabular-nums">{selectedReport.cabecasAbatidasAno || "Não informado"}</p></div>
                      
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tipo de Venda</p><p className="font-bold text-slate-800 uppercase">{selectedReport.tipoVenda}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Habilitação</p><p className="font-bold text-slate-800 uppercase">{selectedReport.habilitacao}</p></div>

                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tipo de Atividade</p><p className="font-bold text-primary uppercase">{selectedReport.atividade}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tipo de Terminação</p><p className="font-bold text-primary uppercase">{selectedReport.terminacao}</p></div>
                    </div>
                  </div>

                  {/* BLOCO C */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">C. Rebanho e Lotes para Abate</h3>
                    
                    <div className="mb-6">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Efetivo Total (Propriedade)</p>
                      <p className="font-black text-blue-700 text-xl tabular-nums mt-1">{selectedReport.numAnimais || "Não informado"} cabeças</p>
                    </div>

                    <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-wider">Previsão de Abate (Lotes)</h4>
                    <div className="space-y-3">
                      {selectedReport.disp30Dias && (
                        <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 items-center">
                          <span className="font-black text-sm text-slate-800">30 Dias</span>
                          <span className="text-xs text-slate-700 font-bold">{selectedReport.qtd30Dias || 0} cab.</span>
                          <span className="text-[11px] text-slate-500 font-bold uppercase">{selectedReport.sexo30Dias}</span>
                          <span className={`text-[11px] font-black uppercase text-right ${selectedReport.status30Dias === 'VENDIDO' ? 'text-amber-600' : 'text-primary'}`}>{selectedReport.status30Dias}</span>
                        </div>
                      )}
                      {selectedReport.disp60Dias && (
                        <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 items-center">
                          <span className="font-black text-sm text-slate-800">60 Dias</span>
                          <span className="text-xs text-slate-700 font-bold">{selectedReport.qtd60Dias || 0} cab.</span>
                          <span className="text-[11px] text-slate-500 font-bold uppercase">{selectedReport.sexo60Dias}</span>
                          <span className={`text-[11px] font-black uppercase text-right ${selectedReport.status60Dias === 'VENDIDO' ? 'text-amber-600' : 'text-primary'}`}>{selectedReport.status60Dias}</span>
                        </div>
                      )}
                      {selectedReport.disp90Dias && (
                        <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 items-center">
                          <span className="font-black text-sm text-slate-800">90 Dias</span>
                          <span className="text-xs text-slate-700 font-bold">{selectedReport.qtd90Dias || 0} cab.</span>
                          <span className="text-[11px] text-slate-500 font-bold uppercase">{selectedReport.sexo90Dias}</span>
                          <span className={`text-[11px] font-black uppercase text-right ${selectedReport.status90Dias === 'VENDIDO' ? 'text-amber-600' : 'text-primary'}`}>{selectedReport.status90Dias}</span>
                        </div>
                      )}
                      {!selectedReport.disp30Dias && !selectedReport.disp60Dias && !selectedReport.disp90Dias && (
                        <p className="text-xs text-slate-400 font-medium italic">Nenhum lote com previsão de abate a curto prazo.</p>
                      )}
                    </div>
                  </div>

                  {/* 👇 BLOCO D (OBSERVAÇÕES) SÓ APARECE SE TIVER TEXTO 👇 */}
                  {selectedReport.observacoes && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">D. Observações da Negociação</h3>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <p className="text-xs font-medium text-slate-700 leading-relaxed uppercase whitespace-pre-wrap">
                          {selectedReport.observacoes}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* ASSINATURAS */}
                  <div className="grid grid-cols-2 gap-8 mt-10">
                    <div className="border-t border-slate-200 pt-3 text-center">
                      <p className="font-black text-sm text-slate-800 uppercase">{selectedReport.visitante}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Comprador (Visitante)</p>
                    </div>

                    <div className="border-t border-slate-200 pt-3 text-center flex flex-col items-center">
                      {selectedReport.produtorAssinatura && selectedReport.produtorAssinatura.startsWith("data:image") ? (
                        <img 
                          src={selectedReport.produtorAssinatura} 
                          alt="Assinatura" 
                          className="h-16 object-contain mb-1 mix-blend-multiply" 
                        />
                      ) : (
                        <p className="font-bold text-sm text-slate-400 font-serif italic uppercase h-16 flex items-center justify-center">
                          {selectedReport.produtorAssinatura || "Assinatura Ausente"}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-auto">Produtor</p>
                    </div>
                  </div>

                </div>
              </CardContent>
              
              <div className="border-t bg-white p-5 flex justify-between items-center">
                <Button variant="outline" className="font-bold text-primary border-primary hover:bg-primary/10 bg-white shadow-sm h-11" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
                  {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} BAIXAR PDF
                </Button>
                <Button onClick={() => setSelectedReport(null)} className="font-bold h-11 bg-slate-800 text-white hover:bg-slate-700">FECHAR RELATÓRIO</Button>
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}