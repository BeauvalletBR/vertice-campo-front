import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { 
  CalendarClock, 
  MapPin, 
  Search, 
  FilterX, 
  Loader2, 
  Trash2, 
  Edit, 
  User,
  AlertCircle,
  X,
  Save,
  Building2
} from "lucide-react";
import { toast } from "sonner";
import { 
  api, 
  fetchAgendamentosPendentes, 
  inativarAgendamento, 
  fetchPecuaristasAgendamento,
  type ApiAgendamento, 
  type ApiUsuario,
  type ApiRancher
} from "@/services/api";

export default function AgendamentoGerenciador() {
  const { user } = useAuth();
  const podeExcluir = user && (user as any).nivel > 3;

  const [isLoading, setIsLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<ApiAgendamento[]>([]);
  const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]);
  const [pecuaristasData, setPecuaristasData] = useState<ApiRancher[]>([]);
  
  // 👇 Filtros Tela Principal 👇
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [filtroComprador, setFiltroComprador] = useState<number | "">(""); // 👈 NOVO ESTADO DE FILTRO

  // Estados Modal Inativar
  const [isInativando, setIsInativando] = useState<number | null>(null);
  const [agendamentoParaInativar, setAgendamentoParaInativar] = useState<number | null>(null);

  // Estados Modal Edição
  const [isEditando, setIsEditando] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<ApiAgendamento | null>(null);
  const [editDataAgendada, setEditDataAgendada] = useState("");
  const [editCompradorId, setEditCompradorId] = useState<number | "">("");
  
  // Edição: Busca de Produtor
  const [buscaProdutor, setBuscaProdutor] = useState("");
  const [produtorSelecionado, setProdutorSelecionado] = useState<ApiRancher | null>(null);

  // Carregar dados da API
  useEffect(() => {
    const carregarDados = async () => {
      setIsLoading(true);
      try {
        const [agendamentosData, usuarios, pecuaristas] = await Promise.all([
          fetchAgendamentosPendentes(),
          api.getUsuarios(),
          fetchPecuaristasAgendamento()
        ]);
        setAgendamentos(agendamentosData);
        setUsuariosData(usuarios);
        setPecuaristasData(pecuaristas);
      } catch (error) {
        toast.error("Erro ao carregar os dados.");
      } finally {
        setIsLoading(false);
      }
    };
    
    carregarDados();
  }, []);

  // 👇 LÓGICA DO FILTRO ATUALIZADA 👇
  const agendamentosFiltrados = useMemo(() => {
    return agendamentos.filter(ag => {
      const matchNome = ag.NOME_PRODUTOR?.toLowerCase().includes(filtroNome.toLowerCase()) || 
                        ag.NOME_FAZENDA?.toLowerCase().includes(filtroNome.toLowerCase());
      
      const dataFormatada = ag.DATA_AGENDADA ? ag.DATA_AGENDADA.split('T')[0] : "";
      const matchData = filtroData === "" || dataFormatada === filtroData;
      
      // Checa se tem filtro de comprador selecionado, se tiver compara com o ID do agendamento
      const matchComprador = filtroComprador === "" || ag.ID_COMPRADOR === Number(filtroComprador);
      
      return matchNome && matchData && matchComprador;
    });
  }, [agendamentos, filtroNome, filtroData, filtroComprador]);

  const produtoresParaEditar = useMemo(() => {
    if (!buscaProdutor || produtorSelecionado) return [];
    return pecuaristasData
      .filter(p => p.NOME_PRODUTOR?.toLowerCase().includes(buscaProdutor.toLowerCase()) || 
                   p.NOME_FAZENDA?.toLowerCase().includes(buscaProdutor.toLowerCase()))
      .slice(0, 5);
  }, [buscaProdutor, pecuaristasData, produtorSelecionado]);

  const getNomeComprador = (id?: number) => {
    if (!id) return "NÃO ATRIBUÍDO";
    const usuario = usuariosData.find(u => Number(u.SEQUSUARIO) === Number(id));
    return usuario ? usuario.CODUSUARIO : `ID: ${id}`;
  };

  const handleAbrirEdicao = (ag: ApiAgendamento) => {
    setAgendamentoEditando(ag);
    setEditDataAgendada(ag.DATA_AGENDADA ? ag.DATA_AGENDADA.split('T')[0] : "");
    setEditCompradorId(ag.ID_COMPRADOR || "");
    
    const prodAtual = pecuaristasData.find(p => p.COD_PRODUTOR === ag.COD_PRODUTOR);
    if (prodAtual) {
      setProdutorSelecionado(prodAtual);
      setBuscaProdutor(prodAtual.NOME_PRODUTOR);
    } else {
      setProdutorSelecionado(null);
      setBuscaProdutor(ag.NOME_PRODUTOR || "");
    }
  };

  const handleSalvarEdicao = async () => {
    if (!agendamentoEditando || !editDataAgendada || !editCompradorId || !produtorSelecionado) {
      toast.warning("Preencha todos os campos da edição.");
      return;
    }

    setIsEditando(true);
    try {
      const payload = {
        id_agendamento: agendamentoEditando.ID_AGENDAMENTO,
        data_agendada: editDataAgendada,
        id_comprador: Number(editCompradorId),
        cod_produtor: produtorSelecionado.COD_PRODUTOR,
        inscricao: produtorSelecionado.INSCRICAO
      };

      const result = await api.editarAgendamento(payload);

      if (result.success) {
        toast.success("Agendamento atualizado com sucesso!");
        
        setAgendamentos(prev => prev.map(ag => {
          if (ag.ID_AGENDAMENTO === agendamentoEditando.ID_AGENDAMENTO) {
            return { 
              ...ag, 
              DATA_AGENDADA: editDataAgendada + "T00:00:00",
              ID_COMPRADOR: Number(editCompradorId),
              COD_PRODUTOR: produtorSelecionado.COD_PRODUTOR,
              NOME_PRODUTOR: produtorSelecionado.NOME_PRODUTOR,
              NOME_FAZENDA: produtorSelecionado.NOME_FAZENDA,
              MUNICIPIO: produtorSelecionado.MUNICIPIO,
              INSCRICAO: produtorSelecionado.INSCRICAO
            };
          }
          return ag;
        }));
        
        setAgendamentoEditando(null);
      } else {
        toast.error(result.message || "Erro ao editar.");
      }
    } catch (error) {
      toast.error("Erro de comunicação com o servidor.");
    } finally {
      setIsEditando(false);
    }
  };

  const confirmInativarAgendamento = async () => {
    if (!agendamentoParaInativar) return;
    setIsInativando(agendamentoParaInativar);
    try {
      const result = await inativarAgendamento(agendamentoParaInativar);
      if (result.success) {
        toast.success("Agendamento inativado com sucesso!");
        setAgendamentos(prev => prev.filter(ag => ag.ID_AGENDAMENTO !== agendamentoParaInativar));
        setAgendamentoParaInativar(null); 
      } else {
        toast.error(result.message || "Erro ao inativar agendamento.");
      }
    } catch (error) {
      toast.error("Falha de comunicação com o servidor.");
    } finally {
      setIsInativando(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Carregando Agendamentos...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6 animate-fade-in pb-24">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        <header className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-slate-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <CalendarClock className="w-7 h-7 text-primary" /> Gestão de Agendamentos
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              Visualize, edite ou cancele agendamentos pendentes da equipe.
            </p>
          </div>
        </header>

        {/* 👇 FILTROS COM O NOVO SELECT DE COMPRADOR 👇 */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pesquisar Produtor</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Nome ou fazenda..." 
                    className="pl-9 h-9 bg-slate-50 border-slate-200 uppercase text-xs font-bold text-slate-700" 
                    value={filtroNome} 
                    onChange={(e) => setFiltroNome(e.target.value)} 
                  />
                </div>
              </div>
              
              {/* NOVO CAMPO: FILTRO POR COMPRADOR */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comprador</Label>
                <select 
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  value={filtroComprador}
                  onChange={(e) => setFiltroComprador(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">TODOS</option>
                  {usuariosData.map(u => (
                    <option key={`filtro-${u.SEQUSUARIO}`} value={u.SEQUSUARIO}>{u.CODUSUARIO}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Agendada</Label>
                <Input 
                  type="date" 
                  className="h-9 bg-slate-50 border-slate-200 text-xs font-bold text-slate-700" 
                  value={filtroData} 
                  onChange={(e) => setFiltroData(e.target.value)} 
                />
              </div>

              <Button 
                variant="outline" 
                className="h-9 text-xs text-slate-600 font-bold border-slate-200 hover:bg-slate-100" 
                onClick={() => { setFiltroNome(""); setFiltroData(""); setFiltroComprador(""); }}
              >
                <FilterX className="w-3.5 h-3.5 mr-2 text-slate-400" /> LIMPAR
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* LISTAGEM EM CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agendamentosFiltrados.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-lg font-bold text-slate-500">Nenhum agendamento encontrado.</p>
            </div>
          ) : (
            agendamentosFiltrados.map((ag) => {
              const dataAgendamento = ag.DATA_AGENDADA ? new Date(ag.DATA_AGENDADA.split('T')[0] + "T12:00:00").toLocaleDateString("pt-BR") : 'Sem data';
              const isAtrasado = ag.DATA_AGENDADA && ag.DATA_AGENDADA.split('T')[0] < new Date().toISOString().split('T')[0];

              return (
                <Card key={ag.ID_AGENDAMENTO} className={`bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${isAtrasado ? 'border-red-200' : ''}`}>
                  <div className={`h-1.5 w-full ${isAtrasado ? 'bg-red-500' : 'bg-primary'}`} />
                  
                  <CardContent className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col pr-2">
                        <span className="font-black text-lg text-slate-800 uppercase line-clamp-1" title={ag.NOME_FAZENDA}>
                          {ag.NOME_FAZENDA || "FAZENDA NÃO INFORMADA"}
                        </span>
                        <span className="text-xs font-bold text-slate-500 uppercase mt-0.5 line-clamp-1">
                          {ag.NOME_PRODUTOR}
                        </span>
                      </div>
                      {isAtrasado && (
                        <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0">
                          Atrasado
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mt-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="uppercase truncate">{ag.MUNICIPIO || "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-bold">{dataAgendamento}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="uppercase font-semibold text-slate-800 truncate" title={getNomeComprador(ag.ID_COMPRADOR)}>
                          {getNomeComprador(ag.ID_COMPRADOR)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 flex items-center justify-end gap-2 border-t border-slate-100 mt-4">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-[11px] h-8 text-slate-600 font-bold border-slate-200 hover:bg-slate-100 shadow-sm"
                        onClick={() => handleAbrirEdicao(ag)}
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" /> EDITA
                      </Button>

                      {podeExcluir && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0 border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all rounded-lg shadow-sm"
                          onClick={() => ag.ID_AGENDAMENTO && setAgendamentoParaInativar(ag.ID_AGENDAMENTO)}
                          disabled={isInativando === ag.ID_AGENDAMENTO}
                          title="Cancelar Agendamento"
                        >
                          {isInativando === ag.ID_AGENDAMENTO ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* MODAL DE EDIÇÃO */}
        {agendamentoEditando && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-lg shadow-2xl overflow-hidden border-none rounded-2xl flex flex-col max-h-[90vh]">
              <div className="h-2 w-full bg-primary shrink-0" />
              <CardHeader className="border-b bg-white pb-4 shrink-0 flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
                    <Edit className="w-5 h-5 text-primary" /> Editar Agendamento
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Altere a data, o comprador ou o produtor selecionado.</p>
                </div>
                <button onClick={() => setAgendamentoEditando(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              
              <CardContent className="p-6 bg-slate-50 space-y-5 overflow-y-auto custom-scrollbar">
                
                <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <Label className="text-xs font-bold text-slate-700 uppercase">1. Pecuarista / Fazenda</Label>
                  
                  {produtorSelecionado ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-emerald-800 uppercase">{produtorSelecionado.NOME_PRODUTOR}</span>
                        <span className="text-xs font-bold text-emerald-600 uppercase">{produtorSelecionado.NOME_FAZENDA} - {produtorSelecionado.MUNICIPIO}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-emerald-700 hover:bg-emerald-100" onClick={() => { setProdutorSelecionado(null); setBuscaProdutor(""); }}>
                        TROCAR
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <Input 
                        placeholder="Digite o nome do produtor ou fazenda..." 
                        className="pl-9 bg-slate-50 border-slate-200 uppercase text-sm font-bold text-slate-700" 
                        value={buscaProdutor} 
                        onChange={(e) => setBuscaProdutor(e.target.value)} 
                        autoFocus
                      />
                      {produtoresParaEditar.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                          {produtoresParaEditar.map(p => (
                            <div 
                              key={`${p.COD_PRODUTOR}-${p.INSCRICAO}`}
                              className="p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                              onClick={() => { setProdutorSelecionado(p); setBuscaProdutor(p.NOME_PRODUTOR); }}
                            >
                              <div className="font-bold text-sm text-slate-800 uppercase">{p.NOME_PRODUTOR}</div>
                              <div className="text-xs text-slate-500 uppercase flex items-center gap-1 mt-1">
                                <Building2 className="w-3 h-3" /> {p.NOME_FAZENDA} - {p.MUNICIPIO}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 uppercase">2. Nova Data</Label>
                    <Input 
                      type="date" 
                      className="h-11 bg-white border-slate-200 text-sm font-bold text-slate-700 focus-visible:ring-primary shadow-sm" 
                      value={editDataAgendada} 
                      onChange={(e) => setEditDataAgendada(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 uppercase">3. Comprador</Label>
                    <select 
                      className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                      value={editCompradorId}
                      onChange={(e) => setEditCompradorId(Number(e.target.value))}
                    >
                      <option value="" disabled>Selecione...</option>
                      {usuariosData.map(u => (
                        <option key={`edit-${u.SEQUSUARIO}`} value={u.SEQUSUARIO}>{u.CODUSUARIO}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t border-slate-200 mt-6">
                  <Button variant="outline" className="flex-1 font-bold h-11 border-slate-200 text-slate-600 hover:bg-slate-100" onClick={() => setAgendamentoEditando(null)} disabled={isEditando}>
                    CANCELAR
                  </Button>
                  <Button className="flex-1 font-bold h-11 bg-primary hover:bg-primary/90 text-white shadow-md" onClick={handleSalvarEdicao} disabled={isEditando}>
                    {isEditando ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} SALVAR ALTERAÇÕES
                  </Button>
                </div>

              </CardContent>
            </Card>
          </div>
        )}

        {/* MODAL DE INATIVAÇÃO */}
        {agendamentoParaInativar && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden border-none rounded-2xl">
              <div className="h-2 w-full bg-red-600" />
              <CardHeader className="text-center pt-8 pb-2">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-red-50 border border-red-100 text-red-500">
                  <Trash2 className="w-8 h-8" />
                </div>
                <CardTitle className="text-2xl font-black text-slate-800">Inativar Agendamento?</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-8 px-8">
                <p className="text-slate-500 font-medium leading-relaxed mb-8">
                  Tem certeza que deseja inativar este agendamento? Ele será removido da lista de pendentes.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 font-bold h-12 border-slate-200 text-slate-600 hover:bg-slate-50" 
                    onClick={() => setAgendamentoParaInativar(null)}
                    disabled={isInativando !== null}
                  >
                    CANCELAR
                  </Button>
                  <Button 
                    className="flex-1 font-bold h-12 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20" 
                    onClick={confirmInativarAgendamento}
                    disabled={isInativando !== null}
                  >
                    {isInativando ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "SIM, INATIVAR"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}