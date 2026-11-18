import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Boxes, CalendarDays, Loader2, PackageCheck, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  consultarRealizadoProjecaoPecas,
  type ProjecaoPecasRealizadoFiltro,
  type ProjecaoPecasRealizadoResponse,
} from "@/services/projecao-pecas";

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const hojeLocal = () => {
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  return agora.toISOString().slice(0, 10);
};

const formatarData = (valor?: string | null) => {
  if (!valor) return "-";
  const data = valor.slice(0, 10).split("-");
  return data.length === 3 ? `${data[2]}/${data[1]}/${data[0]}` : valor;
};

const vazioParaIndefinido = (valor: string) => valor || undefined;
const numeroOuIndefinido = (valor: string) => valor ? Number(valor) : undefined;

const REALIZADO_STORAGE_KEY = "vertice:projecao-pecas:realizado";

interface RealizadoPersistido {
  dataAbate: string;
  rendimentoInicio: string;
  rendimentoFim: string;
  ordem: string;
  produto: string;
  produtoExcluir: string;
  quarteio: ProjecaoPecasRealizadoFiltro["quarteio"];
  resultado: ProjecaoPecasRealizadoResponse | null;
}

const carregarRealizadoPersistido = (): RealizadoPersistido => {
  const estadoPadrao: RealizadoPersistido = {
    dataAbate: hojeLocal(),
    rendimentoInicio: "",
    rendimentoFim: "",
    ordem: "",
    produto: "",
    produtoExcluir: "",
    quarteio: "",
    resultado: null,
  };
  try {
    const estadoSalvo = sessionStorage.getItem(REALIZADO_STORAGE_KEY);
    return estadoSalvo ? { ...estadoPadrao, ...JSON.parse(estadoSalvo) } : estadoPadrao;
  } catch {
    return estadoPadrao;
  }
};

export default function ProjecaoPecas() {
  const [estadoInicial] = useState(carregarRealizadoPersistido);
  const [dataAbate, setDataAbate] = useState(estadoInicial.dataAbate);
  const [rendimentoInicio, setRendimentoInicio] = useState(estadoInicial.rendimentoInicio);
  const [rendimentoFim, setRendimentoFim] = useState(estadoInicial.rendimentoFim);
  const [ordem, setOrdem] = useState(estadoInicial.ordem);
  const [produto, setProduto] = useState(estadoInicial.produto);
  const [produtoExcluir, setProdutoExcluir] = useState(estadoInicial.produtoExcluir);
  const [quarteio, setQuarteio] = useState<ProjecaoPecasRealizadoFiltro["quarteio"]>(estadoInicial.quarteio);
  const [resultado, setResultado] = useState<ProjecaoPecasRealizadoResponse | null>(estadoInicial.resultado);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(REALIZADO_STORAGE_KEY, JSON.stringify({
      dataAbate,
      rendimentoInicio,
      rendimentoFim,
      ordem,
      produto,
      produtoExcluir,
      quarteio,
      resultado,
    }));
  }, [dataAbate, rendimentoInicio, rendimentoFim, ordem, produto, produtoExcluir, quarteio, resultado]);

  const consultar = async () => {
    const filtro: ProjecaoPecasRealizadoFiltro = {
      data_abate: vazioParaIndefinido(dataAbate),
      data_rendimento_inicio: vazioParaIndefinido(rendimentoInicio),
      data_rendimento_fim: vazioParaIndefinido(rendimentoFim),
      nroordem: numeroOuIndefinido(ordem),
      seqproduto: numeroOuIndefinido(produto),
      seqproduto_excluir: numeroOuIndefinido(produtoExcluir),
      quarteio,
    };
    if (!Object.values(filtro).some((valor) => valor !== undefined && valor !== "")) {
      toast.warning("Informe pelo menos um filtro para consultar o realizado.");
      return;
    }
    setCarregando(true);
    try {
      const dados = await consultarRealizadoProjecaoPecas(filtro);
      setResultado(dados);
      if (dados.AVISOS.length) {
        toast.warning("O realizado foi carregado, mas ocorreu um erro na API Beef Quality.");
      } else {
        toast.success(`${dados.TOTAL_REGISTROS} peça(s) realizada(s) encontrada(s).`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o realizado.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F4F7FA] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1680px]">
        <header className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#C9D8E6] bg-white text-[#174A78] shadow-sm"><PackageCheck className="h-5 w-5" /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#607A96]">PCP · Produção realizada</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#102F53] sm:text-3xl">Realizado de peças</h1>
            <p className="mt-1 text-sm font-medium text-[#667B90]">Cruze as entradas das ordens com a classificação dos animais pela sequência do dia.</p>
          </div>
        </header>

        <Card className="mt-5 border-[#CBD8E3] bg-white shadow-sm">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 xl:items-end sm:p-5">
            <FiltroData label="Data de abate" value={dataAbate} onChange={setDataAbate} />
            <FiltroData label="Rendimento inicial" value={rendimentoInicio} onChange={setRendimentoInicio} />
            <FiltroData label="Rendimento final" value={rendimentoFim} onChange={setRendimentoFim} />
            <FiltroNumero label="Nº ordem" value={ordem} onChange={setOrdem} />
            <FiltroNumero label="SEQ produto de entrada" value={produto} onChange={setProduto} />
            <FiltroNumero label="Excluir SEQ entrada" value={produtoExcluir} onChange={setProdutoExcluir} />
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#526A80]">Partição</span>
              <select value={quarteio} onChange={(event) => setQuarteio(event.target.value as typeof quarteio)} className="h-10 w-full rounded-md border border-[#C9D8E6] bg-white px-3 text-xs font-bold text-[#173D6E]">
                <option value="">Todas</option>
                <option value="DIANTEIRO">Dianteiro</option>
                <option value="TRASEIRO">Traseiro</option>
                <option value="PONTA DE AGULHA">Ponta de agulha</option>
              </select>
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-8 xl:justify-end">
              <Button variant="outline" onClick={() => { setDataAbate(""); setRendimentoInicio(""); setRendimentoFim(""); setOrdem(""); setProduto(""); setProdutoExcluir(""); setQuarteio(""); setResultado(null); }} className="font-bold">Limpar</Button>
              <Button onClick={consultar} disabled={carregando} className="min-w-44 bg-[#174A78] font-black hover:bg-[#123B61]">
                {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {carregando ? "Consultando..." : "Consultar realizado"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {resultado ? <ResultadoRealizado resultado={resultado} /> : <EstadoInicial />}
      </div>
    </div>
  );
}

function FiltroData({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#526A80]">{label}</span><Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 border-[#C9D8E6] text-xs font-bold text-[#173D6E]" /></label>;
}

function FiltroNumero({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#526A80]">{label}</span><Input inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} placeholder="Todos" className="h-10 border-[#C9D8E6] text-xs font-bold text-[#173D6E]" /></label>;
}

function EstadoInicial() {
  return <Card className="mt-4 border-[#CBD8E3] bg-white shadow-sm"><CardContent className="flex min-h-60 flex-col items-center justify-center text-center"><CalendarDays className="h-10 w-10 text-[#9BB0C2]" /><p className="mt-3 font-black text-[#173D6E]">Consulte o realizado por data, ordem ou produto</p><p className="mt-1 text-sm text-[#6B7F92]">Os dados da produção serão exibidos mesmo quando a API de classificação estiver em manutenção.</p></CardContent></Card>;
}

function ResultadoRealizado({ resultado }: { resultado: ProjecaoPecasRealizadoResponse }) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const resumos = resultado.RESUMO_DATAS || [];
  const totalSequencias = resumos.reduce((soma, item) => soma + item.QUANTIDADE_ANIMAIS, 0);
  const totalClassificadas = resumos.reduce((soma, item) => soma + item.TOTAL_CLASSIFICADOS, 0);
  const cobertura = totalSequencias > 0 ? Math.min(100, (totalClassificadas / totalSequencias) * 100) : 0;
  const estiloCobertura = cobertura >= 99.999
    ? "border-[#7AC7A7] bg-[#E8F6EF] text-[#08734F]"
    : cobertura >= 50
      ? "border-[#F0B35A] bg-[#FFF8EA] text-[#A05200]"
      : "border-[#E8A4A4] bg-[#FDECEC] text-[#B42318]";
  const indicadores = [
    ["Peças realizadas", numero.format(resultado.TOTAL_REGISTROS)],
    ["Peso líquido", `${numero.format(resultado.PESO_TOTAL)} kg`],
    ["Ordens", numero.format(resultado.TOTAL_ORDENS)],
    ["Datas analisadas", numero.format(resumos.length)],
  ];
  return (
    <section className="mt-4 space-y-4">
      {resultado.AVISOS.length > 0 && <Card className="border-[#F0B35A] bg-[#FFF8EA]"><CardContent className="flex gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B85C00]" /><div><p className="font-black text-[#8A4300]">Erro na API Beef Quality</p>{resultado.AVISOS.map((aviso) => <p key={aviso} className="mt-1 text-xs font-medium text-[#8A5A24]">{aviso}</p>)}</div></CardContent></Card>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {indicadores.map(([rotulo, valor]) => <Card key={rotulo} className="border-[#CBD8E3] bg-white shadow-sm"><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#607A96]">{rotulo}</p><p className="mt-1 whitespace-nowrap text-xl font-black text-[#102F53]">{valor}</p></CardContent></Card>)}
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
            <p className="text-[10px] font-black uppercase tracking-[0.08em]">Classificação de gordura</p>
            <p className="mt-1 whitespace-nowrap text-xl font-black">{formatarPercentualCobertura(cobertura)}</p>
            <p className="mt-1 text-[10px] font-bold opacity-80">{totalClassificadas} de {totalSequencias} sequências · ver detalhes</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={detalhesAbertos} onOpenChange={setDetalhesAbertos}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Classificação do acabamento de gordura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${estiloCobertura}`}>
              <p className="text-3xl font-black">{formatarPercentualCobertura(cobertura)}</p>
              <p className="mt-1 text-sm font-bold">{totalClassificadas} de {totalSequencias} sequências possuem classificação.</p>
            </div>
            <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
              {resumos.filter((item) => item.TOTAL_SEM_CLASSIFICACAO > 0 || item.REGISTROS_SEM_SEQUENCIA > 0).map((item) => (
                <div key={item.DATA_ABATE || "sem-data"} className="rounded-lg border border-[#E3C07A] bg-[#FFF8EA] p-3">
                  <p className="font-black text-[#8A4300]">Abate de {formatarData(item.DATA_ABATE)}</p>
                  {item.SEQUENCIAS_SEM_CLASSIFICACAO.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{item.SEQUENCIAS_SEM_CLASSIFICACAO.map((sequencia) => <span key={sequencia} className="rounded border border-[#F0B35A] bg-white px-2 py-1 text-xs font-black text-[#8A4300]">{sequencia}</span>)}</div>}
                  {item.REGISTROS_SEM_SEQUENCIA > 0 && <p className="mt-2 text-xs font-bold text-[#B54708]">{item.REGISTROS_SEM_SEQUENCIA} entrada(s) sem número de sequência.</p>}
                </div>
              ))}
              {resumos.every((item) => item.TOTAL_SEM_CLASSIFICACAO === 0 && item.REGISTROS_SEM_SEQUENCIA === 0) && <p className="rounded-lg bg-[#E8F6EF] p-3 text-sm font-black text-[#08734F]">Todas as sequências consultadas possuem classificação.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="border-[#CBD8E3] bg-white shadow-sm">
          <div className="border-b border-[#D5E0E9] px-4 py-3"><h2 className="flex items-center gap-2 font-black text-[#173D6E]"><BarChart3 className="h-4 w-4" />Classificação realizada</h2></div>
          <CardContent className="space-y-3 p-4">
            {resultado.CLASSIFICACOES.map((item) => <div key={item.CLASSE}><div className="mb-1 flex justify-between text-xs"><span className="font-black text-[#36546F]">{item.CLASSE}</span><span className="font-black text-[#173D6E]">{item.QUANTIDADE} · {percentual.format(item.PERCENTUAL)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#E5EDF3]"><div className="h-full rounded-full bg-[#1D6A8D]" style={{ width: `${Math.min(100, item.PERCENTUAL)}%` }} /></div></div>)}
          </CardContent>
        </Card>

        <RealizadoPorData resultado={resultado} onAbrirDetalhes={() => setDetalhesAbertos(true)} />
      </div>

      <ProjecaoSobreRealizado resultado={resultado} />
    </section>
  );
}

function formatarPercentualCobertura(valor: number) {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valor)}%`;
}

function RealizadoPorData({ resultado, onAbrirDetalhes }: { resultado: ProjecaoPecasRealizadoResponse; onAbrirDetalhes: () => void }) {
  const resumos = resultado.RESUMO_DATAS || [];
  return (
    <Card className="overflow-hidden border-[#CBD8E3] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-[#D5E0E9] px-4 py-3">
        <div><h2 className="font-black text-[#173D6E]">Realizado por data de abate</h2><p className="text-xs text-[#6B7F92]">Entradas efetivamente processadas por dia.</p></div>
        <span className="rounded-full bg-[#EAF2F8] px-3 py-1 text-xs font-black text-[#174A78]">{resumos.length} data(s)</span>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#EAF1F6] text-[#36546F]"><tr><th className="px-3 py-2">Abate</th><th className="px-3 py-2 text-right">Animais</th><th className="px-3 py-2">Produtos de entrada</th><th className="px-3 py-2 text-right">Peso</th><th className="px-3 py-2 text-center">Classificação</th></tr></thead>
          <tbody>
            {resumos.map((resumo) => {
              const cobertura = resumo.QUANTIDADE_ANIMAIS > 0 ? Math.min(100, (resumo.TOTAL_CLASSIFICADOS / resumo.QUANTIDADE_ANIMAIS) * 100) : 0;
              const cor = cobertura >= 99.999 ? "bg-[#E8F6EF] text-[#08734F]" : cobertura >= 50 ? "bg-[#FFE7C2] text-[#A05200]" : "bg-[#FDECEC] text-[#B42318]";
              return <tr key={resumo.DATA_ABATE || "sem-data"} className="border-t border-[#DCE5EC] align-top hover:bg-[#F6F9FB]">
                <td className="whitespace-nowrap px-3 py-2.5 font-black text-[#173D6E]">{formatarData(resumo.DATA_ABATE)}</td>
                <td className="px-3 py-2.5 text-right text-sm font-black text-[#173D6E]">{numero.format(resumo.QUANTIDADE_ANIMAIS)}</td>
                <td className="px-3 py-2.5"><div className="flex max-w-[340px] flex-wrap gap-1">{resumo.SEQPRODUTOS_ENTRADA.map((produto) => <span key={produto.SEQPRODUTO} title={produto.PRODUTO} className="rounded bg-[#F0F5F9] px-1.5 py-0.5 font-bold text-[#174A78]">{produto.SEQPRODUTO} · {produto.QUANTIDADE}</span>)}</div></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-[#173D6E]">{numero.format(resumo.PESO_TOTAL)} kg</td>
                <td className="px-3 py-2.5 text-center"><button type="button" onClick={onAbrirDetalhes} className={`rounded-full px-2.5 py-1 font-black ${cor}`}>{formatarPercentualCobertura(cobertura)}</button></td>
              </tr>;
            })}
            {!resumos.length && <tr><td colSpan={5} className="px-4 py-8 text-center font-bold text-[#6B7F92]">Nenhuma data encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ProjecaoSobreRealizado({ resultado }: { resultado: ProjecaoPecasRealizadoResponse }) {
  const comparativo = resultado.COMPARATIVO_RENDIMENTO || [];
  const produzidosPorSelecao = new Map<number, { quantidade: number; codigos: Set<number>; produtos: Set<string> }>();
  const avulsosPorGrupo = new Map<number, Map<string, { quantidade: number; codigos: Set<number>; produtos: Set<string> }>>();

  comparativo.forEach((linha) => {
    if (linha.TIPO_VINCULO === "DIRETO" && linha.ID_SELECAO != null) {
      const atual = produzidosPorSelecao.get(linha.ID_SELECAO) || { quantidade: 0, codigos: new Set<number>(), produtos: new Set<string>() };
      atual.quantidade += linha.QUANTIDADE_REALIZADA;
      linha.SEQPRODUTOS.forEach((codigo) => atual.codigos.add(codigo));
      linha.PRODUTOS.forEach((produto) => atual.produtos.add(produto));
      produzidosPorSelecao.set(linha.ID_SELECAO, atual);
    } else if (linha.TIPO_VINCULO === "SUBGRUPO" && linha.ID_GRUPO != null) {
      const porProduto = avulsosPorGrupo.get(linha.ID_GRUPO) || new Map<string, { quantidade: number; codigos: Set<number>; produtos: Set<string> }>();
      const chave = linha.SEQPRODUTOS.slice().sort((a, b) => a - b).join(",") || linha.PRODUTOS.join("|");
      const atual = porProduto.get(chave) || { quantidade: 0, codigos: new Set<number>(), produtos: new Set<string>() };
      atual.quantidade += linha.QUANTIDADE_REALIZADA;
      linha.SEQPRODUTOS.forEach((codigo) => atual.codigos.add(codigo));
      linha.PRODUTOS.forEach((produto) => atual.produtos.add(produto));
      porProduto.set(chave, atual);
      avulsosPorGrupo.set(linha.ID_GRUPO, porProduto);
    }
  });

  return (
    <Card className="overflow-hidden border-[#B8CAD9] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D5E0E9] px-4 py-3">
        <div><h2 className="flex items-center gap-2 text-base font-black text-[#173D6E]"><Boxes className="h-5 w-5" />Projeção de peças sobre o realizado</h2><p className="mt-0.5 text-xs text-[#6B7F92]">Compara a projeção com a soma produzida dos códigos vinculados. Produtos reconhecidos apenas pelo subgrupo aparecem por último.</p></div>
        <span className="rounded-full bg-[#EAF2F8] px-3 py-1 text-[11px] font-black text-[#174A78]">{resultado.PROJECOES_PRODUTOS.length} grupo(s)</span>
      </div>
      {resultado.AVISO_COMPARATIVO && <div className="flex items-start gap-2 border-b border-[#F0B35A] bg-[#FFF8EA] px-4 py-3 text-xs font-bold text-[#8A5A24]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{resultado.AVISO_COMPARATIVO}</span></div>}
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full min-w-[940px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#173D6E] text-white"><tr><th className="px-4 py-3">Grupo / seleção</th><th className="px-4 py-3">Códigos produzidos</th><th className="px-4 py-3 text-right">Base</th><th className="px-4 py-3 text-right">Projetado</th><th className="px-4 py-3 text-right">Produzido</th><th className="px-4 py-3 text-right">Diferença</th></tr></thead>
          <tbody>
            {resultado.PROJECOES_PRODUTOS.flatMap((grupo) => {
              const avulsos = Array.from(avulsosPorGrupo.get(grupo.ID_GRUPO)?.values() || []).sort((a, b) => Array.from(a.produtos).join().localeCompare(Array.from(b.produtos).join(), "pt-BR"));
              const totalProjetado = grupo.SELECOES.reduce((soma, selecao) => soma + selecao.QUANTIDADE_PROJETADA, 0);
              const totalProduzidoDireto = grupo.SELECOES.reduce((soma, selecao) => soma + (produzidosPorSelecao.get(selecao.ID_SELECAO)?.quantidade || 0), 0);
              const totalProduzido = totalProduzidoDireto + avulsos.reduce((soma, item) => soma + item.quantidade, 0);
              return [
                <tr key={`grupo-${grupo.ID_GRUPO}`} className="border-t-2 border-[#AFC5D6] bg-[#EAF1F6]"><td colSpan={6} className="px-4 py-2.5"><span className="font-black text-[#173D6E]">{grupo.GRUPO}</span><span className="ml-2 text-[10px] font-bold text-[#607A96]">{grupo.QUARTEIO}</span></td></tr>,
                ...grupo.SELECOES.map((selecao) => {
                  const realizado = produzidosPorSelecao.get(selecao.ID_SELECAO);
                  const produzido = realizado?.quantidade || 0;
                  const diferenca = produzido - selecao.QUANTIDADE_PROJETADA;
                  return <tr key={`selecao-${selecao.ID_SELECAO}`} className="border-t border-[#DFE7ED] hover:bg-[#F6F9FB]"><td className="px-4 py-3 font-black text-[#173D6E]">{selecao.NOME}</td><td className="px-4 py-3"><p className="font-bold text-[#526A80]">{realizado?.codigos.size ? Array.from(realizado.codigos).sort((a, b) => a - b).join(", ") : "-"}</p>{realizado?.produtos.size ? <p className="mt-0.5 text-[10px] text-[#6B7F92]">{Array.from(realizado.produtos).join(" · ")}</p> : null}</td><td className="px-4 py-3 text-right font-bold text-[#526A80]">{numero.format(grupo.QUANTIDADE_BASE)}</td><td className="px-4 py-3 text-right font-black text-[#36546F]">{numero.format(selecao.QUANTIDADE_PROJETADA)}</td><td className="px-4 py-3 text-right text-sm font-black text-[#08734F]">{numero.format(produzido)}</td><td className={`px-4 py-3 text-right font-black ${diferenca < 0 ? "text-[#B42318]" : diferenca > 0 ? "text-[#08734F]" : "text-[#526A80]"}`}>{diferenca > 0 ? "+" : ""}{numero.format(diferenca)}</td></tr>;
                }),
                ...avulsos.map((item, indice) => <tr key={`avulso-${grupo.ID_GRUPO}-${indice}`} className="border-t border-[#F0D4A5] bg-[#FFF9EF]"><td className="px-4 py-3"><p className="font-black text-[#8A5A24]">{Array.from(item.produtos).join(" · ") || "Produto sem seleção"}</p><p className="mt-0.5 text-[10px] font-bold text-[#A05200]">Vinculado somente pelo SUBGRUPO_GER_REND</p></td><td className="px-4 py-3 font-bold text-[#8A5A24]">{Array.from(item.codigos).sort((a, b) => a - b).join(", ") || "-"}</td><td className="px-4 py-3 text-right text-[#8A5A24]">-</td><td className="px-4 py-3 text-right text-[#8A5A24]">-</td><td className="px-4 py-3 text-right text-sm font-black text-[#A05200]">{numero.format(item.quantidade)}</td><td className="px-4 py-3 text-right text-[#8A5A24]">-</td></tr>),
                <tr key={`total-${grupo.ID_GRUPO}`} className="border-y-2 border-[#AFC5D6] bg-[#DDE9F1]"><td className="px-4 py-3 font-black uppercase text-[#102F53]">Total do grupo {grupo.GRUPO}</td><td className="px-4 py-3 text-[10px] font-bold text-[#607A96]">Inclui códigos vinculados e produtos reconhecidos pelo subgrupo</td><td className="px-4 py-3 text-right font-black text-[#173D6E]">{numero.format(grupo.QUANTIDADE_BASE)}</td><td className="px-4 py-3 text-right font-black text-[#173D6E]">{numero.format(totalProjetado)}</td><td className="px-4 py-3 text-right text-sm font-black text-[#08734F]">{numero.format(totalProduzido)}</td><td className={`px-4 py-3 text-right font-black ${totalProduzido - totalProjetado < 0 ? "text-[#B42318]" : "text-[#08734F]"}`}>{totalProduzido - totalProjetado > 0 ? "+" : ""}{numero.format(totalProduzido - totalProjetado)}</td></tr>,
              ];
            })}
            {!resultado.PROJECOES_PRODUTOS.length && <tr><td colSpan={6} className="px-4 py-10 text-center font-bold text-[#6B7F92]">Nenhuma projeção calculada para a consulta.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
