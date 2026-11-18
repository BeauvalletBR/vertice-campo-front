import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, Loader2, PackageSearch, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  consultarDatasDisponiveisProjecaoPecas,
  gerarProjecaoMateriasPrimas,
  type ProjecaoPecasDataDisponivel,
  type ProjecaoPecasProjecaoResponse,
} from "@/services/projecao-pecas";

type Quarteio = "" | "DIANTEIRO" | "TRASEIRO" | "PONTA DE AGULHA";

const PROJECAO_STORAGE_KEY = "vertice:projecao-pecas:projecao";

interface ProjecaoPersistida {
  dataAbate: string;
  quarteio: Quarteio;
  padraoCorte: string;
  projecao: ProjecaoPecasProjecaoResponse | null;
}

const carregarProjecaoPersistida = (): ProjecaoPersistida => {
  const estadoPadrao: ProjecaoPersistida = {
    dataAbate: "",
    quarteio: "",
    padraoCorte: "ELEGIVEIS",
    projecao: null,
  };
  try {
    const estadoSalvo = sessionStorage.getItem(PROJECAO_STORAGE_KEY);
    return estadoSalvo ? { ...estadoPadrao, ...JSON.parse(estadoSalvo) } : estadoPadrao;
  } catch {
    return estadoPadrao;
  }
};

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

const formatarData = (valor?: string | null) => {
  if (!valor) return "-";
  const partes = valor.slice(0, 10).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : valor;
};

export default function ProjecaoPecasProjecao() {
  const [estadoInicial] = useState(carregarProjecaoPersistida);
  const [dataAbate, setDataAbate] = useState(estadoInicial.dataAbate);
  const [quarteio, setQuarteio] = useState<Quarteio>(estadoInicial.quarteio);
  const [padraoCorte, setPadraoCorte] = useState(estadoInicial.padraoCorte);
  const [projecao, setProjecao] = useState<ProjecaoPecasProjecaoResponse | null>(estadoInicial.projecao);
  const [carregando, setCarregando] = useState(false);
  const [datasDisponiveis, setDatasDisponiveis] = useState<ProjecaoPecasDataDisponivel[]>([]);
  const [carregandoDatas, setCarregandoDatas] = useState(true);

  useEffect(() => {
    sessionStorage.setItem(
      PROJECAO_STORAGE_KEY,
      JSON.stringify({ dataAbate, quarteio, padraoCorte, projecao }),
    );
  }, [dataAbate, quarteio, padraoCorte, projecao]);

  useEffect(() => {
    let ativo = true;
    consultarDatasDisponiveisProjecaoPecas()
      .then((datas) => {
        if (ativo) setDatasDisponiveis(datas);
      })
      .catch((error) => {
        if (ativo) toast.error(error instanceof Error ? error.message : "Não foi possível consultar as datas disponíveis.");
      })
      .finally(() => {
        if (ativo) setCarregandoDatas(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const gerar = async () => {
    if (!dataAbate) {
      toast.warning("Selecione a data de abate.");
      return;
    }
    setCarregando(true);
    try {
      setProjecao(await gerarProjecaoMateriasPrimas(dataAbate, quarteio, padraoCorte));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a projeção.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F4F7FA] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1600px]">
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.8fr)] xl:items-start">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#C9D8E6] bg-white text-[#174A78] shadow-sm"><Sparkles className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#607A96]">PCP · Classificação</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#102F53] sm:text-3xl">Projeção por data de abate</h1>
              <p className="mt-1 text-sm font-medium text-[#667B90]">Consulte a matéria-prima disponível e projete a classificação dos cortes.</p>
            </div>
          </div>
          <DatasDisponiveis
            datas={datasDisponiveis}
            carregando={carregandoDatas}
            onSelecionar={(item) => {
              setDataAbate(item.DTAABATE.slice(0, 10));
              setQuarteio(item.QUARTEIO === "OUTROS" ? "" : item.QUARTEIO as Quarteio);
            }}
          />
        </header>

        <Card className="mt-5 border-[#CBD8E3] bg-white shadow-sm">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(190px,0.8fr)_minmax(190px,0.8fr)_minmax(260px,1.15fr)_auto] xl:items-end">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#526A80]">Data de abate</span>
              <Input type="date" value={dataAbate} onChange={(event) => setDataAbate(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#526A80]">Quarteio</span>
              <select value={quarteio} onChange={(event) => setQuarteio(event.target.value as Quarteio)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-bold text-[#173D6E] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Todos os cortes</option>
                <option value="DIANTEIRO">Dianteiro</option>
                <option value="TRASEIRO">Traseiro</option>
                <option value="PONTA DE AGULHA">Ponta de agulha</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#526A80]">Padrão de corte</span>
              <select value={padraoCorte} onChange={(event) => setPadraoCorte(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-bold text-[#173D6E] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="ELEGIVEIS">Produtivos (sem TFRIO e CONSERVA)</option>
                <option value="TODOS">Todos</option>
              </select>
            </label>
            <Button onClick={gerar} disabled={carregando} className="h-10 min-w-48 bg-[#174A78] font-black hover:bg-[#123B61]">
              {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageSearch className="mr-2 h-4 w-4" />}
              {carregando ? "Consultando..." : "Gerar projeção"}
            </Button>
          </CardContent>
        </Card>

        {projecao ? <ResultadoProjecao projecao={projecao} /> : (
          <Card className="mt-4 border-[#CBD8E3] bg-white shadow-sm"><CardContent className="flex min-h-56 flex-col items-center justify-center text-center text-[#6B7F92]"><CalendarDays className="h-9 w-9 text-[#9BB0C2]" /><p className="mt-3 font-bold">Selecione a data de abate para consultar os cortes disponíveis.</p></CardContent></Card>
        )}
      </div>
    </div>
  );
}

function DatasDisponiveis({
  datas,
  carregando,
  onSelecionar,
}: {
  datas: ProjecaoPecasDataDisponivel[];
  carregando: boolean;
  onSelecionar: (item: ProjecaoPecasDataDisponivel) => void;
}) {
  return (
    <Card className="overflow-hidden border-[#CBD8E3] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#D5E0E9] px-4 py-2.5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#607A96]">Estoque por abate</p>
          <h2 className="text-sm font-black text-[#173D6E]">Datas com peças disponíveis</h2>
        </div>
        <CalendarDays className="h-5 w-5 text-[#174A78]" />
      </div>
      <div className="max-h-40 overflow-auto">
        <table className="w-full min-w-[480px] text-left text-[11px]">
          <thead className="sticky top-0 bg-[#EAF1F6] text-[#36546F]">
            <tr>
              <th className="px-3 py-2 font-black uppercase">Data</th>
              <th className="px-3 py-2 font-black uppercase">Partição</th>
              <th className="px-3 py-2 text-right font-black uppercase">Peças</th>
              <th className="px-3 py-2 text-right font-black uppercase">Cortes</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={4} className="px-3 py-5 text-center font-bold text-[#607A96]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Buscando estoque...</td></tr>
            ) : datas.length ? datas.map((item, indice) => (
              <tr
                key={`${item.DTAABATE}-${item.QUARTEIO}-${indice}`}
                className="cursor-pointer border-t border-[#DFE7ED] hover:bg-[#F0F6FA]"
                onClick={() => onSelecionar(item)}
                title="Usar esta data e partição na projeção"
              >
                <td className="whitespace-nowrap px-3 py-2 font-black text-[#173D6E]">{formatarData(item.DTAABATE)}</td>
                <td className="px-3 py-2 font-bold text-[#526A80]">{item.QUARTEIO}</td>
                <td className="px-3 py-2 text-right text-sm font-black text-[#08734F]">{numero.format(item.QUANTIDADE_DISPONIVEL)}</td>
                <td className="px-3 py-2 text-right font-bold text-[#526A80]">{numero.format(item.TIPOS_PRODUTO)}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="px-3 py-5 text-center font-bold text-[#607A96]">Nenhuma data com estoque encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ResultadoProjecao({ projecao }: { projecao: ProjecaoPecasProjecaoResponse }) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const sequenciasConsultadas = projecao.SEQUENCIAS_CONSULTADAS || [];
  const sequenciasSemClassificacao = projecao.SEQUENCIAS_SEM_CLASSIFICACAO || [];
  const totalSequencias = sequenciasConsultadas.length;
  const totalClassificadas = Math.max(0, totalSequencias - sequenciasSemClassificacao.length);
  const cobertura = totalSequencias > 0 ? (totalClassificadas / totalSequencias) * 100 : 0;
  const estiloCobertura = cobertura >= 99.999
    ? "border-[#7AC7A7] bg-[#E8F6EF] text-[#08734F]"
    : cobertura >= 50
      ? "border-[#F0B35A] bg-[#FFF8EA] text-[#A05200]"
      : "border-[#E8A4A4] bg-[#FDECEC] text-[#B42318]";
  return (
    <section className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Data de abate", formatarData(projecao.DTAABATE)],
          ["Quarteio", projecao.QUARTEIO === "TODOS" ? "Todos" : projecao.QUARTEIO],
          ["Padrão de corte", projecao.PADRAO_CORTE === "ELEGIVEIS" ? "Sem TFRIO / CONSERVA" : projecao.PADRAO_CORTE],
          ["Quantidade disponível", numero.format(projecao.QUANTIDADE_DISPONIVEL)],
          ["Peso líquido", `${numero.format(projecao.PESO_LIQUIDO_DISPONIVEL)} kg`],
        ].map(([rotulo, valor]) => <Card key={rotulo} className="min-w-0 border-[#CBD8E3] bg-white shadow-sm"><CardContent className="min-w-0 p-4"><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#607A96]">{rotulo}</p><p className={`mt-1 font-black text-[#102F53] ${rotulo === "Padrão de corte" ? "break-words text-base leading-tight" : "whitespace-nowrap text-xl"}`}>{valor}</p></CardContent></Card>)}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setDetalhesAbertos(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setDetalhesAbertos(true);
            }
          }}
          className={`cursor-pointer shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${estiloCobertura}`}
        >
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.1em]">Classificação de gordura</p>
            <p className="mt-1 whitespace-nowrap text-xl font-black">{formatarPercentualCobertura(cobertura)}</p>
            <p className="mt-1 text-[10px] font-bold opacity-80">{totalClassificadas} de {totalSequencias} sequências · ver detalhes</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={detalhesAbertos} onOpenChange={setDetalhesAbertos}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Classificação do acabamento de gordura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${estiloCobertura}`}>
              <p className="text-3xl font-black">{formatarPercentualCobertura(cobertura)}</p>
              <p className="mt-1 text-sm font-bold">{totalClassificadas} de {totalSequencias} sequências possuem classificação.</p>
            </div>
            {sequenciasSemClassificacao.length > 0 ? (
              <div>
                <p className="flex items-center gap-2 font-black text-[#8A4300]"><AlertTriangle className="h-4 w-4" />Sequências sem classificação</p>
                <div className="mt-3 flex max-h-52 flex-wrap gap-2 overflow-auto">
                  {sequenciasSemClassificacao.map((sequencia) => <span key={sequencia} className="rounded-md border border-[#F0B35A] bg-[#FFF8EA] px-2.5 py-1 text-xs font-black text-[#8A4300]">{sequencia}</span>)}
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-[#E8F6EF] p-3 text-sm font-black text-[#08734F]">Todas as sequências consultadas possuem classificação.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden border-[#BFD4C8] bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#D5E0E9] px-5 py-4">
          <div><h2 className="font-black text-[#173D6E]">Peças projetadas por seleção</h2><p className="text-xs text-[#6B7F92]">Resultado da classificação aplicado à matriz configurada, preservando quantidades inteiras.</p></div>
          <span className="rounded-full bg-[#E8F6EF] px-3 py-1 text-xs font-black text-[#08734F]">{numero.format(projecao.PROJECOES_PRODUTOS.reduce((soma, grupo) => soma + grupo.QUANTIDADE_BASE, 0))} unidades-base</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-[#173D6E] text-white"><tr><th className="px-4 py-3">Grupo / seleção</th><th className="px-4 py-3">SEQPRODUTOS</th>{["AUSENTE", "ESCASSO", "MEDIANO", "UNIFORME", "EXCESSIVO"].map((classe) => <th key={classe} className="px-4 py-3 text-center">{classe}</th>)}<th className="px-4 py-3 text-right">Total projetado</th></tr></thead>
            <tbody>{projecao.PROJECOES_PRODUTOS.flatMap((grupo) => [
              <tr key={`grupo-${grupo.ID_GRUPO}`} className="border-t border-[#C7D7E3] bg-[#EAF1F6]"><td className="px-4 py-3 font-black text-[#173D6E]">{grupo.GRUPO}<span className="ml-2 text-[10px] text-[#607A96]">{grupo.QUANTIDADE_BASE} {grupo.QUARTEIO.toLowerCase()}(s)</span></td><td className="px-4 py-3 text-[#607A96]">Base da família</td>{["AUSENTE", "ESCASSO", "MEDIANO", "UNIFORME", "EXCESSIVO"].map((classe) => <td key={classe} className="px-4 py-3 text-center font-black text-[#36546F]">{numero.format(grupo.CLASSIFICACOES_BASE[classe as keyof typeof grupo.CLASSIFICACOES_BASE] || 0)}</td>)}<td className="px-4 py-3 text-right font-black text-[#173D6E]">{numero.format(grupo.QUANTIDADE_BASE)}</td></tr>,
              ...grupo.SELECOES.map((selecao) => <tr key={`selecao-${selecao.ID_SELECAO}`} className="border-t border-[#DFE7ED] hover:bg-[#F6F9FB]"><td className="px-4 py-3 font-bold text-[#173D6E]">{selecao.NOME}</td><td className="px-4 py-3 text-[#607A96]">{selecao.SEQPRODUTOS.length ? selecao.SEQPRODUTOS.join(", ") : "Não vinculado"}</td>{["AUSENTE", "ESCASSO", "MEDIANO", "UNIFORME", "EXCESSIVO"].map((classe) => <td key={classe} className="px-4 py-3 text-center font-bold text-[#526A80]">{numero.format(selecao.POR_CLASSIFICACAO[classe as keyof typeof selecao.POR_CLASSIFICACAO] || 0)}</td>)}<td className="px-4 py-3 text-right text-base font-black text-[#08734F]">{numero.format(selecao.QUANTIDADE_PROJETADA)}</td></tr>),
            ])}</tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)]">
        <Card className="overflow-hidden border-[#CBD8E3] bg-white shadow-sm">
          <div className="border-b border-[#D5E0E9] px-5 py-4"><h2 className="font-black text-[#173D6E]">Matéria-prima disponível por corte</h2><p className="text-xs text-[#6B7F92]">Dados agrupados diretamente da VCGV_MATPRIMA_DISPONIVEL.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-[#EAF1F6] text-[#36546F]"><tr>{["SEQ produto", "Produto", "Quarteio", "Quantidade disponível", "Peso líquido"].map((item) => <th key={item} className="px-4 py-3 font-black uppercase">{item}</th>)}</tr></thead>
              <tbody>{projecao.ITENS.map((item) => <tr key={`${item.SEQPRODUTO}-${item.QUARTEIO}`} className="border-t border-[#D9E3EA] hover:bg-[#F4F8FB]"><td className="px-4 py-3 font-black text-[#174A78]">{item.SEQPRODUTO}</td><td className="px-4 py-3 font-bold text-[#173D6E]">{item.PRODUTO}</td><td className="px-4 py-3 font-black text-[#0F766E]">{item.QUARTEIO}</td><td className="px-4 py-3 text-base font-black text-[#173D6E]">{numero.format(item.QUANTIDADE_DISPONIVEL)}</td><td className="px-4 py-3 font-black text-[#173D6E]">{numero.format(item.PESO_LIQUIDO_DISPONIVEL)} kg</td></tr>)}</tbody>
            </table>
          </div>
        </Card>

        <Card className="border-[#CBD8E3] bg-white shadow-sm">
          <div className="border-b border-[#D5E0E9] px-5 py-4"><h2 className="flex items-center gap-2 font-black text-[#173D6E]"><BarChart3 className="h-5 w-5" />Classificação projetada</h2><p className="text-xs text-[#6B7F92]">{numero.format(projecao.TOTAL_ANIMAIS_CLASSIFICADOS)} de {numero.format(sequenciasConsultadas.length)} sequências encontradas na API Beef Quality para a data.</p></div>
          <CardContent className="space-y-4 p-5">
            {projecao.CLASSIFICACOES.map((classe) => <div key={classe.CLASSE}><div className="mb-1.5 flex items-end justify-between gap-3"><div><p className="font-black text-[#173D6E]">{classe.CLASSE}</p><p className="text-[11px] text-[#6B7F92]">{classe.QUANTIDADE_HISTORICA} animais na base</p></div><div className="text-right"><p className="text-lg font-black text-[#0F766E]">{numero.format(classe.PERCENTUAL_MEDIO)}%</p><p className="text-[11px] font-bold text-[#526A80]">proj. {numero.format(classe.QUANTIDADE_PROJETADA)} cortes</p></div></div><div className="h-2.5 overflow-hidden rounded-full bg-[#E5EDF3]"><div className="h-full rounded-full bg-[#1D6A8D]" style={{ width: `${Math.min(100, classe.PERCENTUAL_MEDIO)}%` }} /></div></div>)}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function formatarPercentualCobertura(valor: number) {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valor)}%`;
}
