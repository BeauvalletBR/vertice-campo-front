import React, { useState, useRef, useMemo, useEffect } from "react";
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
  ImageIcon,
  Plus,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  ClipboardCheck,
  Pencil // 👇 ÍCONE ADICIONADO AQUI
} from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { api, fetchPecuaristasAgendamento, type ApiRancher, type ApiUsuario, type ApiAuditoria } from "@/services/api";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import SignatureCanvas from 'react-signature-canvas';

type Step = "idle" | "routing" | "form";

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
  nropedido?: string | null; 
  distanciaerp?: number | null; 
  statusAuditoria?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const formatarDataBruta = (dataString: string | null | undefined) => {
  if (!dataString) return "-";
  const dataApenas = dataString.split('T')[0]; 
  const partes = dataApenas.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataString; 
};

export default function Pecuaristas() {
  const { user } = useAuth();
  
  const podeExcluir = user && (user as any).nivel > 3;

  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [selectedReport, setSelectedReport] = useState<CheckinReport | null>(null);
  
  // 👇 ESTADOS PARA A AUDITORIA E RELATÓRIO PDF 👇
  const [openReportMenuId, setOpenReportMenuId] = useState<string | null>(null);
  const [selectedAuditVisit, setSelectedAuditVisit] = useState<CheckinReport | null>(null);
  const [auditAnswers, setAuditAnswers] = useState<ApiAuditoria[]>([]);
  const [isFetchingAudit, setIsFetchingAudit] = useState(false);
  const [isGeneratingAuditPDF, setIsGeneratingAuditPDF] = useState(false);
  
  // Refs para as duas partes da auditoria (para gerar duas páginas em Paisagem)
  const auditPart1Ref = useRef<HTMLDivElement>(null);
  const auditPart2Ref = useRef<HTMLDivElement>(null);

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
  const [filterGerouCompra, setFilterGerouCompra] = useState("Todos"); 
  const [filterComprador, setFilterComprador] = useState(""); 
  
  const [filterStatusFrete, setFilterStatusFrete] = useState<"Todos" | "Economia" | "Desvio">("Todos");

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [visitToLink, setVisitToLink] = useState<CheckinReport | null>(null);
  const [searchRancher, setSearchRancher] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  
  const [isInativando, setIsInativando] = useState<string | null>(null);
  const [visitaParaInativar, setVisitaParaInativar] = useState<string | null>(null);

  const [isPedidoModalOpen, setIsPedidoModalOpen] = useState(false);
  const [visitToLinkPedido, setVisitToLinkPedido] = useState<CheckinReport | null>(null);
  const [pedidoInput, setPedidoInput] = useState("");
  const [pedidosList, setPedidosList] = useState<string[]>([]);
  const [isSavingPedidos, setIsSavingPedidos] = useState(false);

  // 👇 ESTADOS ADICIONADOS PARA GERENCIAR O FORMULÁRIO DE EDIÇÃO PANELS 👇
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [visitToEdit, setVisitToEdit] = useState<CheckinReport | null>(null);
  const [editNumAnimais, setEditNumAnimais] = useState("");
  const [editNaturezaVisita, setEditNaturezaVisita] = useState("");
  const [editNomeRecebedor, setEditNomeRecebedor] = useState("");
  const [editCargoRecebedor, setEditCargoRecebedor] = useState("");
  const [editDistanciaReal, setEditDistanciaReal] = useState("");
  const [editLatitude, setEditLatitude] = useState("");   
  const [editLongitude, setEditLongitude] = useState("");
  const [editDisp30, setEditDisp30] = useState(false);
  const [editQtd30, setEditQtd30] = useState("");
  const [editSexo30, setEditSexo30] = useState("BOI");
  const [editStatus30, setEditStatus30] = useState("DISPONIVEL");
  const [editDisp60, setEditDisp60] = useState(false);
  const [editQtd60, setEditQtd60] = useState("");
  const [editSexo60, setEditSexo60] = useState("BOI");
  const [editStatus60, setEditStatus60] = useState("DISPONIVEL");
  const [editDisp90, setEditDisp90] = useState(false);
  const [editQtd90, setEditQtd90] = useState("");
  const [editSexo90, setEditSexo90] = useState("BOI");
  const [editStatus90, setEditStatus90] = useState("DISPONIVEL");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error";
    onCloseAction?: () => void;
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

        // 👇 TRAVA FILTRO: Só mapeia se tiver ID_VISITA e não for "AUDITORIA AVULSA" 👇
        const mappedData: CheckinReport[] = data
          .filter((v: any) => v.ID_VISITA !== null && v.ID_VISITA !== undefined && String(v.ID_VISITA).trim() !== "" && String(v.ID_VISITA) !== "null" && v.NATUREZA_VISITA !== "AUDITORIA AVULSA")
          .map((v: any) => ({
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
            data: v.DATA_REGISTRO_VISITA || "", 
            id_comprador: v.ID_COMPRADOR,
            visitor: getNomeComprador(v.ID_COMPRADOR), visitante: getNomeComprador(v.ID_COMPRADOR), produtorAssinatura: v.ASSINATURA_DIGITAL || "",
            distancia: v.DISTANCIA_PERCORRIDA_REAL ? `${(v.DISTANCIA_PERCORRIDA_REAL).toFixed(1)} km` : "N/A", 
            
            distanciaRealRaw: v.DISTANCIA_PERCORRIDA_REAL !== null && v.DISTANCIA_PERCORRIDA_REAL !== undefined ? Number(v.DISTANCIA_PERCORRIDA_REAL) : null,
            distanciaerp: v.DISTANCIAERP !== null && v.DISTANCIAERP !== undefined ? Number(v.DISTANCIAERP) : null,
            statusAuditoria: v.STATUS_AUDITORIA || null,
            
            statusDatavale: v.COD_PRODUTOR ? "cadastrado" : "pendente",
            imagem: v.IMAGEM || null,
            observacoes: v.OBSERVACOES || null,
            nropedido: v.NROPEDIDO || v.nropedido || null,
            latitude: v.GPS_LATITUDE !== null && v.GPS_LATITUDE !== undefined ? Number(v.GPS_LATITUDE) : null,   
            longitude: v.GPS_LONGITUDE !== null && v.GPS_LONGITUDE !== undefined ? Number(v.GPS_LONGITUDE) : null 

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
  const uniqueCompradores = useMemo(() => {
    const comp = allData.map(v => v.visitante).filter(Boolean);
    return Array.from(new Set(comp)).sort();
  }, [allData]);

  const filteredBaseData = useMemo(() => {
    return allData.filter(v => {
      const matchProdutor = v.nome.toLowerCase().includes(filterProdutor.toLowerCase());
      const matchFazenda = v.propriedade.toLowerCase().includes(filterFazenda.toLowerCase());
      const matchCidade = filterCidade === "" || v.municipio === filterCidade;
      const matchData = filterData === "" || (v.data && v.data.startsWith(filterData)); 
      const matchComprador = filterComprador === "" || v.visitante === filterComprador;
      const matchGerouCompra = filterGerouCompra === "Todos" ||
          (filterGerouCompra === "S" && !!v.nropedido) ||
          (filterGerouCompra === "N" && !v.nropedido);

      return matchProdutor && matchFazenda && matchCidade && matchData && matchGerouCompra && matchComprador;
    });
  }, [filterProdutor, filterFazenda, filterCidade, filterData, filterGerouCompra, filterComprador, allData]);

  const filteredPendentes = useMemo(() => filteredBaseData.filter(v => v.statusDatavale === "pendente"), [filteredBaseData]);

  const historicoBaseParaCalculo = useMemo(() => filteredBaseData.filter(v => v.statusDatavale === "cadastrado"), [filteredBaseData]);

  const freteStats = useMemo(() => {
    let kmEconomizado = 0;
    let kmExcedente = 0;

    historicoBaseParaCalculo.forEach(v => {
      if (v.distanciaRealRaw !== null && v.distanciaerp !== null) {
        const erpKm = Number(v.distanciaerp);
        const gpsKmIdaVolta = v.distanciaRealRaw ;
        const diferenca = erpKm - gpsKmIdaVolta;

        if (diferenca >= 1) kmEconomizado += diferenca;
        if (diferenca <= -1) kmExcedente += Math.abs(diferenca);
      }
    });

    return { kmEconomizado, kmExcedente };
  }, [historicoBaseParaCalculo]);

  const filteredHistorico = useMemo(() => {
    let result = historicoBaseParaCalculo;

    if (filterStatusFrete !== "Todos") {
      result = result.filter(v => {
        if (v.distanciaRealRaw === null || v.distanciaerp === null) return false;
        const diferenca = Number(v.distanciaerp) - (v.distanciaRealRaw);
        
        if (filterStatusFrete === "Economia") return diferenca >= 1;
        if (filterStatusFrete === "Desvio") return diferenca <= -1;
        return true;
      });
    }

    return result.sort((a, b) => Number(b.id) - Number(a.id));
  }, [historicoBaseParaCalculo, filterStatusFrete]);

  // 👇 AGRUPAMENTO DA AUDITORIA PARA 2 PÁGINAS 👇
  const auditParts = useMemo(() => {
    const part1: Record<string, ApiAuditoria[]> = {};
    const part2: Record<string, ApiAuditoria[]> = {};

    auditAnswers.forEach(ans => {
      const firstChar = ans.REQUISITO.trim().charAt(0);
      if (['4', '5', '6', '7'].includes(firstChar)) {
        if (!part2[ans.REQUISITO]) part2[ans.REQUISITO] = [];
        part2[ans.REQUISITO].push(ans);
      } else {
        if (!part1[ans.REQUISITO]) part1[ans.REQUISITO] = [];
        part1[ans.REQUISITO].push(ans);
      }
    });

    return { part1, part2 };
  }, [auditAnswers]);

  const totalFiltrados = filteredPendentes.length + filteredHistorico.length;

  const handleClearFilters = () => {
    setFilterProdutor(""); 
    setFilterFazenda(""); 
    setFilterCidade(""); 
    setFilterData(""); 
    setFilterGerouCompra("Todos"); 
    setFilterComprador("");
    setFilterStatusFrete("Todos");
  };

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

  const handleAddPedido = () => {
    const limpo = pedidoInput.trim();
    if (!limpo) return;
    if (!pedidosList.includes(limpo)) {
       setPedidosList([...pedidosList, limpo]);
    } else {
       toast.error("Este pedido já está na lista para ser salvo.");
    }
    setPedidoInput("");
  };

  const handleRemovePedido = (p: string) => {
    setPedidosList(pedidosList.filter(item => item !== p));
  };

  const handleSavePedidos = async () => {
    if (!visitToLinkPedido) return;
    if (pedidosList.length === 0) {
      toast.error("Adicione pelo menos um pedido.");
      return;
    }
    
    setIsSavingPedidos(true);
    try {
      let salvos = 0;
      for (const num of pedidosList) {
        const res = await api.savePedidoVisita(visitToLinkPedido.id, num);
        if (res.success) salvos++;
      }
      
      if (salvos > 0) {
        toast.success(`${salvos} pedido(s) vinculado(s) com sucesso!`);
        
        setAllData(prev => prev.map(v => {
          if (v.id === visitToLinkPedido.id) {
             const existing = v.nropedido ? v.nropedido.split(', ') : [];
             const updated = Array.from(new Set([...existing, ...pedidosList])).join(', ');
             return { ...v, nropedido: updated };
          }
          return v;
        }));
        
        setIsPedidoModalOpen(false);
      } else {
        toast.error("Nenhum pedido foi salvo. Verifique a conexão.");
      }
    } catch (e) {
      toast.error("Erro Crítico ao salvar os pedidos.");
    } finally {
      setIsSavingPedidos(false);
    }
  };

  // 👇 FUNÇÃO PARA SALVAR A EDIÇÃO DO RELATÓRIO VIA API 👇
  const handleSaveEdit = async () => {
    if (!visitToEdit) return;
    setIsSavingEdit(true);
    try {
      const payload = {
        id_visita: Number(visitToEdit.id),
        tipoVisita: editNaturezaVisita,
        nomeRecebedor: editNomeRecebedor,
        cargoRecebedor: editCargoRecebedor,
        numAnimais: editNumAnimais ? Number(editNumAnimais) : null,
        gps_latitude: editLatitude ? Number(editLatitude) : null, 
        gps_longitude: editLongitude ? Number(editLongitude) : null,
        distancia_percorrida_real: editDistanciaReal ? Number(editDistanciaReal) : null,
        disp30Dias: editDisp30,
        qtd30Dias: editQtd30 ? Number(editQtd30) : 0,
        sexo30Dias: editSexo30,
        status30Dias: editStatus30,
        disp60Dias: editDisp60,
        qtd60Dias: editQtd60 ? Number(editQtd60) : 0,
        sexo60Dias: editSexo60,
        status60Dias: editStatus60,
        disp90Dias: editDisp90,
        qtd90Dias: editQtd90 ? Number(editQtd90) : 0,
        sexo90Dias: editSexo90,
        status90Dias: editStatus90
      };

      const res = await api.editarVisita(payload);
      if (res.success) {
        toast.success("Relatório atualizado com sucesso!");
        setAllData(prev => prev.map(item => {
          if (item.id === visitToEdit.id) {
            return {
              ...item,
              tipoVisita: editNaturezaVisita,
              nomeRecebedor: editNomeRecebedor,
              cargoRecebedor: editCargoRecebedor,
              numAnimais: editNumAnimais,
              latitude: editLatitude ? Number(editLatitude) : null,   
              longitude: editLongitude ? Number(editLongitude) : null, 
              distanciaRealRaw: editDistanciaReal ? Number(editDistanciaReal) : item.distanciaRealRaw,
              distancia: editDistanciaReal ? `${(Number(editDistanciaReal)).toFixed(1)} km` : item.distancia,
              disp30Dias: editDisp30, qtd30Dias: editQtd30, sexo30Dias: editSexo30, status30Dias: editStatus30,
              disp60Dias: editDisp60, qtd60Dias: editQtd60, sexo60Dias: editSexo60, status60Dias: editStatus60,
              disp90Dias: editDisp90, qtd90Dias: editQtd90, sexo90Dias: editSexo90, status90Dias: editStatus90,
            };
          }
          return item;
        }));
        setIsEditModalOpen(false);
      } else {
        toast.error(res.message || "Erro ao editar relatório.");
      }
    } catch (e) {
      toast.error("Erro de comunicação com o servidor.");
    } finally {
      setIsSavingEdit(false);
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

  const handleOpenAudit = async (v: CheckinReport) => {
    setIsFetchingAudit(true);
    setSelectedAuditVisit(v); 
    try {
      const res = await api.fetchAuditoriaVisita(v.id);
      setAuditAnswers(res);
    } catch (e) {
      toast.error("Erro ao buscar dados da auditoria.");
    } finally {
      setIsFetchingAudit(false);
    }
  };

  // 👇 FUNÇÃO DE DOWNLOAD ATUALIZADA PARA HORIZONTAL (PAISAGEM) COM CORREÇÃO DE LOGO E 2 PÁGINAS 👇
  const handleDownloadAuditPDF = async () => {
    if (!auditPart1Ref.current || !auditPart2Ref.current || !selectedAuditVisit) return;
    try {
      setIsGeneratingAuditPDF(true);
      
      const pdf = new jsPDF("l", "mm", "a4"); 
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // Captura Parte 1
      const canvas1 = await html2canvas(auditPart1Ref.current, { scale: 2, useCORS: true, logging: false });
      const imgData1 = canvas1.toDataURL("image/png");
      const imgHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
      pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, imgHeight1);

      // Adiciona Página para Parte 2 (Tipo de Trato oferecido em diante)
      pdf.addPage();
      const canvas2 = await html2canvas(auditPart2Ref.current, { scale: 2, useCORS: true, logging: false });
      const imgData2 = canvas2.toDataURL("image/png");
      const imgHeight2 = (canvas2.height * pdfWidth) / canvas2.width;
      pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, imgHeight2);

      pdf.save(`Auditoria_${selectedAuditVisit.nome.replace(/\s+/g, '_')}_${formatarDataBruta(selectedAuditVisit.data).replace(/\//g, '-')}.pdf`);
      toast.success("PDF da Auditoria gerado com sucesso!");
    } catch (error) {
      console.error("Erro PDF:", error);
      toast.error("Erro ao gerar o PDF da Auditoria.");
    } finally {
      setIsGeneratingAuditPDF(false);
    }
  };

  const renderLogisticaRow = (v: CheckinReport) => {
    let erpAtualKm: number | null = null;
    if (v.cod_produtor) {
      const pec = pecuaristas.find(p => String(p.COD_PRODUTOR) === v.cod_produtor);
      if (pec && pec.DISTANCIA_CADASTRADA) erpAtualKm = Number(pec.DISTANCIA_CADASTRADA);
    }

    const gpsKmIdaVolta = v.distanciaRealRaw !== null ? v.distanciaRealRaw : null;
    const erpVisitaKm = v.distanciaerp !== null && v.distanciaerp !== undefined ? Number(v.distanciaerp) : null;

    let isRed = false;
    let desvioKm = 0;
    let economiaKm = 0;
    
    if (erpAtualKm !== null && erpVisitaKm !== null && gpsKmIdaVolta !== null) {
      if (erpAtualKm !== erpVisitaKm) {
        const diferenca = erpVisitaKm - gpsKmIdaVolta;
        if (diferenca > 0) {
          economiaKm = diferenca;
        } else if (diferenca < 0) {
          desvioKm = Math.abs(diferenca);
        }
      }
    }

    const hasTag = economiaKm > 0 || desvioKm > 0;

    if (!hasTag && erpAtualKm !== null && gpsKmIdaVolta !== null) {
      if (erpAtualKm > gpsKmIdaVolta) {
        isRed = true;
      }
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
          <span className={`font-black ${isRed ? 'text-red-600' : 'text-slate-800'}`}>{gpsKmIdaVolta !== null ? `${gpsKmIdaVolta.toFixed(1)} km` : '--'}</span>
        </TableCell>
        
        <TableCell className="py-4 text-sm text-center">
          <div className="flex flex-col items-center gap-1">
            {isRed ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 font-bold text-[11px] whitespace-nowrap mx-auto shadow-sm" title="ERP possui KM maior que o GPS">
                <AlertTriangle className="w-3.5 h-3.5" />
                {erpAtualKm !== null ? `${erpAtualKm.toFixed(1)} km` : '--'}
              </div>
            ) : (
              <span className="text-slate-800 font-semibold">
                {erpAtualKm !== null ? `${erpAtualKm.toFixed(1)} km` : '--'}
              </span>
            )}
            
            {economiaKm > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded uppercase shadow-sm mt-1" title="KM Poupado em relação ao ERP no dia da visita">
                Economizou {economiaKm.toFixed(1)} km
              </span>
            )}

            {desvioKm > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded uppercase shadow-sm mt-1" title="Desvio de rota em relação ao ERP no dia da visita">
                Desviou {desvioKm.toFixed(1)} km
              </span>
            )}
          </div>
        </TableCell>
        
        <TableCell className="text-right px-4 py-4 align-middle">
          <div className="inline-flex flex-col items-stretch gap-2 min-w-[200px]">
            
            <div className="flex items-center justify-end gap-2 w-full">
              {v.statusDatavale === "cadastrado" && (
                 <Button
                   size="sm"
                   variant="outline"
                   className="h-8 w-10 sm:w-auto px-0 sm:px-3 text-[11px] font-bold shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50 transition-all rounded-lg flex justify-center shrink-0"
                   onClick={() => {
                     setVisitToLinkPedido(v);
                     setPedidosList([]); 
                     setPedidoInput("");
                     setIsPedidoModalOpen(true);
                   }}
                   title="Adicionar Pedido"
                 >
                   <ShoppingCart className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">ADD PEDIDO</span>
                 </Button>
              )}

              {/* BOTÃO DE RELATÓRIO COM MENU SUSPENSO */}
              <div className="relative">
                {v.statusAuditoria ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className={`h-8 px-3 text-[11px] font-bold shadow-sm transition-all rounded-lg flex justify-center shrink-0 ${openReportMenuId === v.id ? 'bg-slate-100 border-slate-300 text-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                    onClick={() => setOpenReportMenuId(openReportMenuId === v.id ? null : v.id)}
                    title="Ver Relatórios"
                  >
                    <FileText className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">RELATÓRIO ▾</span>
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 w-10 sm:w-auto px-0 sm:px-3 text-[11px] font-bold shadow-sm border-slate-200 text-slate-600 hover:bg-slate-100 transition-all rounded-lg flex justify-center shrink-0" 
                    onClick={() => setSelectedReport(v)}
                    title="Ver Relatório"
                  >
                    <FileText className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">RELATÓRIO</span>
                  </Button>
                )}

                {openReportMenuId === v.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenReportMenuId(null)} />
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 z-50 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                      <Button variant="ghost" size="sm" className="justify-start text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => { setSelectedReport(v); setOpenReportMenuId(null); }}>
                        📄 Ficha de Visita
                      </Button>
                      <Button variant="ghost" size="sm" className="justify-start text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => { handleOpenAudit(v); setOpenReportMenuId(null); }}>
                        📋 Checklist
                      </Button>
                    </div>
                  </>
                )}
              </div>
              
              {/* 👇 BOTÃO DE EDITAR ADICIONADO PERFEITAMENTE À ESQUERDA DA LIXEIRA 👇 */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-10 p-0 border-slate-200 text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-all rounded-lg shadow-sm shrink-0 flex items-center justify-center"
                onClick={() => {
                  setVisitToEdit(v);
                  setEditNaturezaVisita(v.tipoVisita || "");
                  setEditNomeRecebedor(v.nomeRecebedor || "");
                  setEditCargoRecebedor(v.cargoRecebedor || "");
                  setEditNumAnimais(v.numAnimais || "");
                  setEditDistanciaReal(v.distanciaRealRaw ? String(v.distanciaRealRaw) : "");
                  setEditLatitude(v.latitude !== null && v.latitude !== undefined ? String(v.latitude) : "");  
                  setEditLongitude(v.longitude !== null && v.longitude !== undefined ? String(v.longitude) : ""); 
                  setEditDisp30(v.disp30Dias || false);
                  setEditQtd30(v.qtd30Dias || "");
                  setEditSexo30(v.sexo30Dias || "BOI");
                  setEditStatus30(v.status30Dias || "DISPONIVEL");

                  setEditDisp60(v.disp60Dias || false);
                  setEditQtd60(v.qtd60Dias || "");
                  setEditSexo60(v.sexo60Dias || "BOI");
                  setEditStatus60(v.status60Dias || "DISPONIVEL");

                  setEditDisp90(v.disp90Dias || false);
                  setEditQtd90(v.qtd90Dias || "");
                  setEditSexo90(v.sexo90Dias || "BOI");
                  setEditStatus90(v.status90Dias || "DISPONIVEL");
                  
                  setIsEditModalOpen(true);
                }}
                title="Editar Relatório"
              >
                <Pencil className="w-4 h-4" />
              </Button>

              {podeExcluir && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-10 p-0 border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all rounded-lg shadow-sm shrink-0 flex items-center justify-center" 
                  onClick={() => setVisitaParaInativar(v.id)}
                  disabled={isInativando === v.id}
                  title="Inativar Visita"
                >
                  {isInativando === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              )}
            </div>

            {v.nropedido && (
              <div 
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-200 text-white rounded-lg shadow-sm h-8 w-full shrink-0" 
                title={`Pedidos: ${v.nropedido}`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase whitespace-nowrap">Gerou Compra</span>
              </div>
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

  const mostrarCardsFrete = freteStats.kmEconomizado > 0 || freteStats.kmExcedente > 0 || filterStatusFrete !== "Todos";

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

        {mostrarCardsFrete && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card 
              className={`bg-emerald-50 border-emerald-200 shadow-sm cursor-pointer hover:bg-emerald-100/50 transition-colors ${filterStatusFrete === "Economia" ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
              onClick={() => filterStatusFrete === "Economia" ? setFilterStatusFrete("Todos") : setFilterStatusFrete("Economia")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Economia de Frete (KMs Salvos)</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{freteStats.kmEconomizado.toFixed(1)} km</p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <TrendingDown className="w-5 h-5" /> 
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`bg-amber-50 border-amber-200 shadow-sm cursor-pointer hover:bg-amber-100/50 transition-colors ${filterStatusFrete === "Desvio" ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}
              onClick={() => filterStatusFrete === "Desvio" ? setFilterStatusFrete("Todos") : setFilterStatusFrete("Desvio")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Desvio / Excesso de Rota</p>
                  <p className="text-2xl font-black text-amber-700 mt-1">+{freteStats.kmExcedente.toFixed(1)} km</p>
                </div>
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                  <TrendingUp className="w-5 h-5" /> 
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
              <Filter className="w-4 h-4 text-primary" /> Filtros de Pesquisa
              <span className="ml-2 flex items-center justify-center bg-blue-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm transition-all duration-300">
                {totalFiltrados} VISITAS
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 items-end">
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
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comprador</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  value={filterComprador}
                  onChange={(e) => setFilterComprador(e.target.value)}
                >
                  <option value="">TODOS</option>
                  {uniqueCompradores.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data da Visita</Label>
                <Input type="date" className="h-10 bg-slate-50 border-slate-200 text-xs font-bold text-slate-700" value={filterData} onChange={(e) => setFilterData(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gerou Compra?</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  value={filterGerouCompra}
                  onChange={(e) => setFilterGerouCompra(e.target.value)}
                >
                  <option value="Todos">TODAS</option>
                  <option value="S">SIM</option>
                  <option value="N">NÃO</option>
                </select>
              </div>
              <Button variant="outline" size="sm" className="h-10 text-slate-600 font-bold border-slate-200 hover:bg-slate-100" onClick={handleClearFilters}>
                <FilterX className="w-4 h-4 mr-2 text-slate-400" /> LIMPAR 
              </Button>
            </div>
          </CardContent>
        </Card>

        {filteredPendentes.length > 0 && (
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
                    {filteredPendentes.map((p) => (
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
                              <LinkIcon className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">VINCULAR AO ERP</span>
                            </Button>

                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-[11px] h-8 text-slate-600 border-slate-200 hover:bg-slate-100 font-bold transition-all shadow-sm rounded-lg w-10 sm:w-auto px-0 sm:px-3 flex justify-center shrink-0" 
                              onClick={() => setSelectedReport(p)}
                            >
                              <FileText className="w-3.5 h-3.5 sm:mr-1.5 text-slate-400" /> <span className="hidden sm:inline">RELATÓRIO</span>
                            </Button>

                            {podeExcluir && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 w-8 p-0 border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all rounded-lg shadow-sm shrink-0 flex items-center justify-center" 
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
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        )}

        <Card className="border border-slate-200 shadow-sm overflow-hidden rounded-xl bg-white">
          <CardHeader className="bg-slate-50 pb-5 border-b border-slate-100">
            <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-800 tracking-tight">
              <CheckCircle2 className="w-6 h-6 text-primary" /> Histórico & Auditoria Logística
            </CardTitle>
            <CardDescription className="font-medium text-slate-500 mt-1">Acompanhamento das visitas vinculadas, inserção de pedidos e validação do desvio de rota.</CardDescription>
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

        {isPedidoModalOpen && visitToLinkPedido && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden border-none rounded-2xl">
              <div className="h-2 w-full bg-blue-600" />
              <CardHeader className="bg-slate-50 border-b pb-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-800">
                    <ShoppingCart className="w-5 h-5 text-blue-600" /> Vincular Pedidos
                  </CardTitle>
                  <button onClick={() => setIsPedidoModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <CardDescription className="font-medium text-xs mt-1">
                  Vincule os números dos pedidos gerados na visita a <b>{visitToLinkPedido.propriedade}</b>.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 bg-white space-y-4">
                {visitToLinkPedido.nropedido && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-500 uppercase">Pedidos já vinculados no sistema:</p>
                    <p className="text-sm font-black text-blue-800 mt-1">{visitToLinkPedido.nropedido}</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Número do Pedido</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number"
                      placeholder="Ex: 10254" 
                      className="h-11 bg-slate-50 border-slate-200 font-bold text-slate-700" 
                      value={pedidoInput} 
                      onChange={(e) => setPedidoInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddPedido(); }}
                    />
                    <Button type="button" onClick={handleAddPedido} className="h-11 bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 shadow-sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {pedidosList.length > 0 && (
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Pedidos na fila para salvar:</p>
                    <div className="flex flex-wrap gap-2">
                      {pedidosList.map(p => (
                        <div key={p} className="flex items-center gap-1 bg-white border border-slate-300 px-2.5 py-1 rounded-md shadow-sm">
                          <span className="text-xs font-black text-slate-700">{p}</span>
                          <button onClick={() => handleRemovePedido(p)} className="text-red-500 hover:text-red-700 ml-1 bg-red-50 rounded-full p-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black mt-4 shadow-lg shadow-blue-600/20" 
                  onClick={handleSavePedidos}
                  disabled={isSavingPedidos || pedidosList.length === 0}
                >
                  {isSavingPedidos ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-2" />}
                  SALVAR PEDIDOS
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

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
                  <button onClick={() => setIsLinkModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
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

        {/* 👇 MODAL DO RELATÓRIO DE FICHA DE VISITA (NORMAL) 👇 */}
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
                  
                  <div className="border-b-2 border-primary pb-4 mb-6 flex justify-between items-end">
                    <div className="flex items-center gap-4">
                      <img 
                        src="/logo.png" 
                        alt="Logo Empresa" 
                        className="h-14 object-contain" 
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

                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                      <div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-primary" /> Rota Calculada
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Distância (Ida e Volta)</p>
                        <p className="font-black text-slate-800 text-xl tabular-nums">{selectedReport.distancia}</p>
                      </div>
                      
                      <div className="flex flex-col items-end justify-center">
                        {selectedReport.imagem ? (
                          <div className="border border-slate-200 bg-white rounded-xl p-1 shadow-sm overflow-hidden h-24 w-auto max-w-[200px]">
                             <img src={selectedReport.imagem} alt="Foto Capturada" className="h-full w-full object-cover rounded-lg" crossOrigin="anonymous" />
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

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">A. Dados da Propriedade e Contato</h3>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-6">
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pecuarista (Nome)</p><p className="font-black text-slate-800 uppercase">{selectedReport.nome}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Natureza da Visita</p><p className="font-black text-primary uppercase">{selectedReport.tipoVisita}</p></div>
                      
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Inscrição Estadual (I.E.)</p><p className="font-bold text-slate-600 font-mono uppercase">{selectedReport.ie || "Não informada"}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Possui CAR?</p><p className="font-bold text-slate-600 uppercase">{selectedReport.car}</p></div>

                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Propriedade</p><p className="font-bold text-slate-800 uppercase">{selectedReport.proprietario}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Município</p><p className="font-bold text-slate-800 uppercase">{selectedReport.municipio}</p></div>
                      
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Telefone</p><p className="font-bold text-slate-800 uppercase">{selectedReport.telefone || "N/A"}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Melhor dia de contato</p><p className="font-bold text-slate-800 uppercase">{selectedReport.melhorDiaContato || "N/A"}</p></div>
                      
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Contato no Local (Nome)</p><p className="font-bold text-slate-800 uppercase">{selectedReport.nomeRecebedor || selectedReport.proprietario}</p></div>
                      <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cargo (Contato)</p><p className="font-bold text-slate-800 uppercase">{selectedReport.cargoRecebedor || "Proprietário"}</p></div>
                    </div>
                  </div>

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

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">D. Observações da Negociação</h3>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                      {(!selectedReport.observacoes || selectedReport.observacoes === "undefined" || selectedReport.observacoes === "null" || selectedReport.observacoes.trim() === "") ? (
                        <p className="text-xs font-medium text-slate-400 italic uppercase">
                          SEM OBSERVAÇÕES
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-slate-700 leading-relaxed uppercase whitespace-pre-wrap">
                          {selectedReport.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                  
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

        {/* 👇 MODAL DO RELATÓRIO DE AUDITORIA (HORIZONTAL EM 2 PÁGINAS) 👇 */}
        {selectedAuditVisit && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl border-none rounded-2xl overflow-hidden">
              <div className="h-2 w-full bg-emerald-600" />
              <CardHeader className="border-b bg-white pb-4 shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
                    <ClipboardCheck className="w-6 h-6 text-emerald-600" /> Relatório de Auditoria (BEA) - Paisagem
                  </CardTitle>
                  <button onClick={() => { setSelectedAuditVisit(null); setAuditAnswers([]); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              
              <CardContent className="overflow-y-auto p-0 bg-slate-50/50 custom-scrollbar">
                {isFetchingAudit ? (
                  <div className="flex flex-col items-center justify-center py-32">
                    <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Buscando respostas no ERP...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 gap-8">
                    
                    {/* PAGINA 1: TÓPICOS 1 A 3 */}
                    <div ref={auditPart1Ref} className="bg-white text-black shadow-sm border border-slate-200 w-[1080px] p-6 pb-10 flex flex-col">
                      <div className="flex items-stretch border-2 border-black divide-x-2 divide-black mb-4 shrink-0">
                        <div className="p-3 flex items-center justify-center w-[220px]">
                          <img src="/logo.png" alt="Logo Empresa" className="max-h-14 object-contain" />
                        </div>
                        <div className="p-3 flex-1 flex items-center justify-center text-center">
                          <h2 className="text-base font-black uppercase tracking-tight leading-snug">
                            Check List de Visita técnica/Auditorias em Fazendas<br/>Aquisições de Matéria Prima (GADO)
                          </h2>
                        </div>
                        <div className="p-1.5 w-[200px] flex flex-col justify-center text-[9px] font-bold uppercase divide-y divide-black">
                          <div className="py-1">IDENTIFICADOR:<br/>PLAN-2872-BEA-007</div>
                          <div className="py-1">DATA DE EMISSÃO: 09/2020</div>
                          <div className="py-1">REVISÃO: 15 / 10-02-2024</div>
                        </div>
                      </div>

                      <div className="border-2 border-black mb-4 text-[10px] font-bold uppercase shrink-0">
                        <div className="flex border-b border-black divide-x divide-black">
                          <div className="p-2 flex-1 truncate">PROPRIEDADE: {selectedAuditVisit.propriedade}</div>
                          <div className="p-2 w-1/4 truncate">DATA VISITA: {formatarDataBruta(selectedAuditVisit.data)}</div>
                        </div>
                        <div className="flex border-b border-black divide-x divide-black">
                          <div className="p-2 flex-1 truncate">PROPRIETÁRIO: {selectedAuditVisit.nome}</div>
                          <div className="p-2 w-1/4 truncate">DATA AUDITORIA: {auditAnswers.length > 0 ? formatarDataBruta(auditAnswers[0].DATA_AUDITORIA) : formatarDataBruta(selectedAuditVisit.data)}</div>
                        </div>
                        <div className="flex border-b border-black divide-x divide-black">
                          <div className="p-2 flex-1 truncate">MUNICÍPIO/UF: {selectedAuditVisit.municipio}</div>
                          <div className="p-2 w-1/4 truncate">TELEFONE: {selectedAuditVisit.telefone || 'N/A'}</div>
                        </div>
                        <div className="flex border-b border-black divide-x divide-black">
                          <div className="p-2 flex-1 truncate">SISTEMA DE CRIAÇÃO: {selectedAuditVisit.terminacao}</div>
                          <div className="p-2 w-1/4 truncate">TIPO DE CRIAÇÃO: {selectedAuditVisit.atividade}</div>
                        </div>
                        <div className="p-2 truncate">NATUREZA DA VISITA: {selectedAuditVisit.tipoVisita}</div>
                      </div>

                      <div className="flex-1 pb-4">
                        <table className="w-full border-collapse border-2 border-black text-[10px] mb-4">
                          <thead>
                            <tr className="bg-slate-200 border-b-2 border-black font-black uppercase">
                              <th className="p-2 border-r-2 border-black text-left">Conceito / Requisito</th>
                              <th className="p-2 w-[80px] border-r-2 border-black text-center">C/NC/NA</th>
                              <th className="p-2 w-[400px] text-center">Observações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(auditParts.part1).map(([req, answers]) => (
                              <React.Fragment key={req}>
                                <tr className="bg-slate-100 border-b-2 border-black">
                                  <td colSpan={3} className="p-1.5 font-black uppercase text-[11px]">{req}</td>
                                </tr>
                                {answers.map((ans, idx) => (
                                  <tr key={ans.ID_RESPOSTA} className={`border-black ${idx === answers.length - 1 ? 'border-b-2' : 'border-b'}`}>
                                    <td className="p-1.5 border-r-2 border-black font-semibold leading-tight">{ans.PERGUNTA}</td>
                                    <td className="p-1.5 border-r-2 border-black text-center font-black text-xs">{ans.RESPOSTA}</td>
                                    <td className="p-1.5 text-left font-medium text-[10px] leading-tight break-words italic">{(ans as any).OBSERVACOES || ""}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* PAGINA 2: TÓPICO 4 EM DIANTE + ASSINATURAS */}
                    <div ref={auditPart2Ref} className="bg-white text-black shadow-sm border border-slate-200 w-[1123px] h-[794px] p-8 pb-10 flex flex-col box-border">
                      <div className="flex-1 pb-2">
                        <table className="w-full border-collapse border-2 border-black text-[10px]">
                          <thead>
                            <tr className="bg-slate-200 border-b-2 border-black font-black uppercase">
                              <th className="p-2 border-r-2 border-black text-left">Conceito / Requisito</th>
                              <th className="p-2 w-[80px] border-r-2 border-black text-center">C/NC/NA</th>
                              <th className="p-2 w-[350px] text-center">Observações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(auditParts.part2).map(([req, answers]) => (
                              <React.Fragment key={req}>
                                <tr className="bg-slate-100 border-b-2 border-black">
                                  <td colSpan={3} className="p-1.5 font-black uppercase text-[11px]">{req}</td>
                                </tr>
                                {answers.map((ans, idx) => (
                                  <tr key={ans.ID_RESPOSTA} className={`border-black ${idx === answers.length - 1 ? 'border-b-2' : 'border-b'}`}>
                                    <td className="p-1.5 border-r-2 border-black font-semibold leading-tight">{ans.PERGUNTA}</td>
                                    <td className="p-1.5 border-r-2 border-black text-center font-black text-xs">{ans.RESPOSTA}</td>
                                    <td className="p-1.5 text-left font-medium text-[10px] leading-tight break-words italic">{(ans as any).OBSERVACOES || ""}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="border-2 border-black mb-4 mt-4 shrink-0">
                        <div className="p-1.5 border-b border-black font-black text-[10px] uppercase bg-slate-100">COMENTÁRIO GERAL DA VISITA:</div>
                        <div className="p-2 text-[10px] font-medium leading-relaxed uppercase min-h-[40px]">
                          {(!selectedAuditVisit.observacoes || selectedAuditVisit.observacoes === "undefined" || selectedAuditVisit.observacoes === "null" || selectedAuditVisit.observacoes.trim() === "") 
                            ? "SEM OBSERVAÇÕES" 
                            : selectedAuditVisit.observacoes}
                        </div>
                      </div>

                      <div className="text-[9px] font-bold text-slate-500 uppercase text-center mb-4 shrink-0">
                        C = Conforme | NC = Não Conforme | NA = Não Aplicável <br/>
                        Frequência: A cada cadastro de novas propriedades e revalidação a cada 03 anos.
                      </div>
                      
                      <div className="border-2 border-black shrink-0">
                        <div className="p-2 border-b-2 border-black flex justify-center gap-12 font-black text-[11px] uppercase tracking-wider">
                          <div>AVALIAÇÃO:</div>
                          <div>FAZENDA APROVADA ({selectedAuditVisit.statusAuditoria === 'APROVADA' ? ' X ' : '   '})</div>
                          <div>FAZENDA REPROVADA ({selectedAuditVisit.statusAuditoria === 'REPROVADA' ? ' X ' : '   '})</div>
                        </div>
                        <div className="grid grid-cols-2 divide-x-2 divide-black">
                          <div className="p-3 flex flex-col items-center justify-end min-h-[90px]">
                            {selectedAuditVisit.produtorAssinatura && selectedAuditVisit.produtorAssinatura.startsWith("data:image") ? (
                              <img src={selectedAuditVisit.produtorAssinatura} alt="Assinatura" className="h-12 object-contain mb-1 mix-blend-multiply" />
                            ) : (
                              <div className="h-12 mb-1 border-b border-black w-3/4"></div>
                            )}
                            <p className="text-[9px] font-bold uppercase tracking-wider">Responsável pela Propriedade</p>
                          </div>
                          <div className="p-3 flex flex-col items-center justify-end min-h-[90px]">
                             <p className="font-bold text-[11px] text-black uppercase mb-2 text-center">{selectedAuditVisit.visitante}</p>
                             <p className="text-[9px] font-bold uppercase tracking-wider border-t border-black pt-1 w-3/4 text-center">Responsável pela Auditoria</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-[7px] font-bold text-slate-400 text-center uppercase pt-2 shrink-0">
                        "Registro Confidencial Beauvallet Brasil, não podendo ser copiado ou distribuído, ou ter qualquer coisa descrita sem o consentimento da Garantia da Qualidade."
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              
              <div className="border-t bg-white p-5 flex justify-between items-center">
                <Button variant="outline" className="font-bold text-emerald-700 border-emerald-600 hover:bg-emerald-50 bg-white shadow-sm h-11" onClick={handleDownloadAuditPDF} disabled={isGeneratingAuditPDF || isFetchingAudit}>
                  {isGeneratingAuditPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} BAIXAR PDF HORIZONTAL
                </Button>
                <Button onClick={() => { setSelectedAuditVisit(null); setAuditAnswers([]); }} className="font-bold h-11 bg-slate-800 text-white hover:bg-slate-700">FECHAR RELATÓRIO</Button>
              </div>
            </Card>
          </div>
        )}

        {/* 👇 MODAL / PAINEL SUSPENSO PARA EDICAO DOS DADOS MAIS BÁSICOS (NOME DO PECUARISTA FICA APENAS COMO TEXTO DE LEITURA) 👇 */}
        {isEditModalOpen && visitToEdit && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-xl shadow-2xl overflow-hidden border-none rounded-2xl max-h-[90vh] flex flex-col">
              <div className="h-2 w-full bg-amber-500" />
              <CardHeader className="bg-slate-50 border-b pb-4 shrink-0">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-800">
                    <Pencil className="w-5 h-5 text-amber-500" /> Editar Registro
                  </CardTitle>
                  <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <CardDescription className="font-medium text-xs mt-1">
                  Atualize o efetivo, lotes e dados logísticos da propriedade <b>{visitToEdit.propriedade}</b>.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 bg-white space-y-4 overflow-y-auto custom-scrollbar flex-1">
                
               {/* IDENTIFICAÇÃO APENAS LEITURA (ESTILO TRAVADO/NÃO CLICÁVEL) */}
                <div className="bg-slate-100/80 p-3 rounded-lg border border-slate-200 cursor-not-allowed select-none">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Pecuarista Associado (Bloqueado):</p>
                  <p className="text-sm font-semibold text-slate-400 uppercase mt-0.5 italic tracking-wide">
                    {visitToEdit.nome}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Efetivo Total (Cabeças)</Label>
                    <Input type="number" value={editNumAnimais} onChange={(e) => setEditNumAnimais(e.target.value)} className="h-10 bg-slate-50 font-bold text-slate-700" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">KM Coletado (Distância Ida)</Label>
                    <Input type="number" step="any" value={editDistanciaReal} onChange={(e) => setEditDistanciaReal(e.target.value)} className="h-10 bg-slate-50 font-bold text-slate-700" />
                  </div>
                </div>

                {/* Cole este bloco de Grid exatamente acima da div de Natureza Visita/Nome Recebedor */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Latitude GPS</Label>
                    <Input type="number" step="any" value={editLatitude} onChange={(e) => setEditLatitude(e.target.value)} placeholder="Ex: -16.3419" className="h-10 bg-slate-50 font-bold text-slate-700" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Longitude GPS</Label>
                    <Input type="number" step="any" value={editLongitude} onChange={(e) => setEditLongitude(e.target.value)} placeholder="Ex: -49.4708" className="h-10 bg-slate-50 font-bold text-slate-700" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Natureza Visita</Label>
                    <Input value={editNaturezaVisita} onChange={(e) => setEditNaturezaVisita(e.target.value)} className="h-10 bg-slate-50 font-bold text-slate-700 uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome Recebedor</Label>
                    <Input value={editNomeRecebedor} onChange={(e) => setEditNomeRecebedor(e.target.value)} className="h-10 bg-slate-50 font-bold text-slate-700 uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cargo Recebedor</Label>
                    <Input value={editCargoRecebedor} onChange={(e) => setEditCargoRecebedor(e.target.value)} className="h-10 bg-slate-50 font-bold text-slate-700 uppercase" />
                  </div>
                </div>

                {/* PAINEL DE DISPONIBILIDADE DE LOTES */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <Label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Previsão e Disponibilidade de Lotes</Label>
                  
                  {/* LOTE 30 */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="editDisp30" checked={editDisp30} onChange={(e) => setEditDisp30(e.target.checked)} className="rounded text-primary focus:ring-primary w-4 h-4 shadow-sm" />
                      <Label htmlFor="editDisp30" className="text-xs font-bold text-slate-700">Lote 30 Dias</Label>
                    </div>
                    {editDisp30 && (
                      <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-150">
                        <Input type="number" placeholder="Qtd Cabeças" value={editQtd30} onChange={(e) => setEditQtd30(e.target.value)} className="h-9 bg-white font-bold" />
                        <select value={editSexo30} onChange={(e) => setEditSexo30(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase"><option value="BOI">BOI</option><option value="VACA">VACA</option><option value="AMBOS">MISTO</option></select>
                        <select value={editStatus30} onChange={(e) => setEditStatus30(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase"><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select>
                      </div>
                    )}
                  </div>

                  {/* LOTE 60 */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="editDisp60" checked={editDisp60} onChange={(e) => setEditDisp60(e.target.checked)} className="rounded text-primary focus:ring-primary w-4 h-4 shadow-sm" />
                      <Label htmlFor="editDisp60" className="text-xs font-bold text-slate-700">Lote 60 Dias</Label>
                    </div>
                    {editDisp60 && (
                      <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-150">
                        <Input type="number" placeholder="Qtd Cabeças" value={editQtd60} onChange={(e) => setEditQtd60(e.target.value)} className="h-9 bg-white font-bold" />
                        <select value={editSexo60} onChange={(e) => setEditSexo60(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase"><option value="BOI">BOI</option><option value="VACA">VACA</option><option value="AMBOS">MISTO</option></select>
                        <select value={editStatus60} onChange={(e) => setEditStatus60(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase"><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select>
                      </div>
                    )}
                  </div>

                  {/* LOTE 90 */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="editDisp90" checked={editDisp90} onChange={(e) => setEditDisp90(e.target.checked)} className="rounded text-primary focus:ring-primary w-4 h-4 shadow-sm" />
                      <Label htmlFor="editDisp90" className="text-xs font-bold text-slate-700">Lote 90 Dias</Label>
                    </div>
                    {editDisp90 && (
                      <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-150">
                        <Input type="number" placeholder="Qtd Cabeças" value={editQtd90} onChange={(e) => setEditQtd90(e.target.value)} className="h-9 bg-white font-bold" />
                        <select value={editSexo90} onChange={(e) => setEditSexo90(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase"><option value="BOI">BOI</option><option value="VACA">VACA</option><option value="AMBOS">MISTO</option></select>
                        <select value={editStatus90} onChange={(e) => setEditStatus90(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold uppercase"><option value="DISPONIVEL">DISPONÍVEL</option><option value="NEGOCIANDO">NEGOCIANDO</option><option value="VENDIDO">VENDIDO</option></select>
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-black mt-4 shadow-lg shadow-amber-500/20" 
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-2" />}
                  SALVAR ALTERAÇÕES
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