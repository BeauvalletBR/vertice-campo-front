import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  consultarConfiguracaoProjecaoPecas,
  salvarConfiguracaoProjecaoPecas,
  type ProjecaoPecasClasse,
  type ProjecaoPecasConfiguracao,
  type ProjecaoPecasGrupoConfig,
  type ProjecaoPecasSelecaoConfig,
} from "@/services/projecao-pecas";

const CLASSES: ProjecaoPecasClasse[] = ["AUSENTE", "ESCASSO", "MEDIANO", "UNIFORME", "EXCESSIVO"];
const vazioPercentuais = () => Object.fromEntries(CLASSES.map((classe) => [classe, 0])) as Record<ProjecaoPecasClasse, number>;

const novaSelecao = (ordem: number): ProjecaoPecasSelecaoConfig => ({
  NOME: `NOVA SELEÇÃO ${ordem}`,
  ORDEM: ordem,
  PECAS_POR_QUARTEIO: 1,
  SEQPRODUTOS: [],
  PERCENTUAIS: vazioPercentuais(),
});

const novoGrupo = (ordem: number): ProjecaoPecasGrupoConfig => ({
  NOME: `NOVO GRUPO ${ordem}`,
  QUARTEIO: "TRASEIRO",
  ORDEM: ordem,
  SELECOES: [novaSelecao(1)],
});

export default function ProjecaoPecasConfiguracao() {
  const [configuracao, setConfiguracao] = useState<ProjecaoPecasConfiguracao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    consultarConfiguracaoProjecaoPecas()
      .then(setConfiguracao)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível carregar a configuração."))
      .finally(() => setCarregando(false));
  }, []);

  const alterarGrupo = (indice: number, alteracao: Partial<ProjecaoPecasGrupoConfig>) => {
    setConfiguracao((atual) => atual && ({ ...atual, GRUPOS: atual.GRUPOS.map((grupo, posicao) => posicao === indice ? { ...grupo, ...alteracao } : grupo) }));
  };

  const alterarSelecao = (indiceGrupo: number, indiceSelecao: number, alteracao: Partial<ProjecaoPecasSelecaoConfig>) => {
    if (!configuracao) return;
    const grupo = configuracao.GRUPOS[indiceGrupo];
    alterarGrupo(indiceGrupo, {
      SELECOES: grupo.SELECOES.map((selecao, posicao) => posicao === indiceSelecao ? { ...selecao, ...alteracao } : selecao),
    });
  };

  const salvar = async () => {
    if (!configuracao) return;
    setSalvando(true);
    try {
      setConfiguracao(await salvarConfiguracaoProjecaoPecas(configuracao));
      toast.success("Matriz de projeção salva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a configuração.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <div className="flex min-h-[60vh] items-center justify-center bg-[#F4F7FA]"><Loader2 className="h-8 w-8 animate-spin text-[#174A78]" /></div>;
  }

  return (
    <div className="min-h-full bg-[#F4F7FA] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#C9D8E6] bg-white text-[#174A78] shadow-sm"><Settings2 className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#607A96]">PCP · Projeção de peças</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#102F53] sm:text-3xl">Configuração da matriz</h1>
              <p className="mt-1 text-sm font-medium text-[#667B90]">Distribua cada classificação entre as seleções comerciais. Cada coluna deve fechar exatamente 100%.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfiguracao((atual) => atual && ({ ...atual, GRUPOS: [...atual.GRUPOS, novoGrupo(atual.GRUPOS.length + 1)] }))}><Plus className="mr-2 h-4 w-4" />Novo grupo</Button>
            <Button className="bg-[#174A78] font-black hover:bg-[#123B61]" disabled={!configuracao || salvando} onClick={salvar}>{salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar matriz</Button>
          </div>
        </header>

        {!configuracao ? <Card><CardContent className="p-8 text-center font-bold text-[#8A3A2B]">A estrutura de configuração ainda não está disponível no banco.</CardContent></Card> : configuracao.GRUPOS.map((grupo, indiceGrupo) => {
          const totais = Object.fromEntries(CLASSES.map((classe) => [classe, grupo.SELECOES.reduce((soma, item) => soma + Number(item.PERCENTUAIS[classe] || 0), 0)])) as Record<ProjecaoPecasClasse, number>;
          return (
            <Card key={grupo.ID_GRUPO ?? `grupo-${indiceGrupo}`} className="overflow-hidden border-[#C8D7E4] bg-white shadow-sm">
              <div className="flex flex-wrap items-end gap-3 border-b border-[#D7E1E9] bg-[#F8FAFC] p-4">
                <label className="min-w-[240px] flex-1 space-y-1"><span className="text-[10px] font-black uppercase text-[#567089]">Grupo de produto</span><Input value={grupo.NOME} onChange={(event) => alterarGrupo(indiceGrupo, { NOME: event.target.value.toUpperCase() })} /></label>
                <label className="min-w-[180px] space-y-1"><span className="text-[10px] font-black uppercase text-[#567089]">Origem / quarteio</span><select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm font-bold text-[#173D6E]" value={grupo.QUARTEIO} onChange={(event) => alterarGrupo(indiceGrupo, { QUARTEIO: event.target.value as ProjecaoPecasGrupoConfig["QUARTEIO"] })}><option>TRASEIRO</option><option>DIANTEIRO</option><option>PONTA DE AGULHA</option></select></label>
                <Button variant="outline" onClick={() => alterarGrupo(indiceGrupo, { SELECOES: [...grupo.SELECOES, novaSelecao(grupo.SELECOES.length + 1)] })}><Plus className="mr-2 h-4 w-4" />Adicionar seleção</Button>
                <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={configuracao.GRUPOS.length === 1} onClick={() => setConfiguracao({ ...configuracao, GRUPOS: configuracao.GRUPOS.filter((_, posicao) => posicao !== indiceGrupo) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1260px] text-left text-xs">
                  <thead className="bg-[#EAF1F6] text-[#36546F]"><tr><th className="px-3 py-3">Seleção</th><th className="px-3 py-3">SEQPRODUTOS vinculados</th><th className="px-3 py-3 text-center">Peças/quarteio</th>{CLASSES.map((classe) => <th key={classe} className="px-3 py-3 text-center">{classe}</th>)}<th className="w-12" /></tr></thead>
                  <tbody>{grupo.SELECOES.map((selecao, indiceSelecao) => <tr key={selecao.ID_SELECAO ?? `selecao-${indiceSelecao}`} className="border-t border-[#D9E3EA]">
                    <td className="p-2"><Input className="min-w-[220px] font-bold" value={selecao.NOME} onChange={(event) => alterarSelecao(indiceGrupo, indiceSelecao, { NOME: event.target.value.toUpperCase() })} /></td>
                    <td className="p-2"><Input key={`${selecao.ID_SELECAO ?? indiceSelecao}-${selecao.SEQPRODUTOS.join("-")}`} className="min-w-[240px]" placeholder="Ex.: 1234, 5678" defaultValue={selecao.SEQPRODUTOS.join(", ")} onBlur={(event) => alterarSelecao(indiceGrupo, indiceSelecao, { SEQPRODUTOS: event.target.value.split(/[,;\s]+/).map(Number).filter((item) => Number.isInteger(item) && item > 0) })} /></td>
                    <td className="p-2"><Input type="number" min="0.001" step="0.001" className="w-28 text-center font-bold" value={selecao.PECAS_POR_QUARTEIO} onChange={(event) => alterarSelecao(indiceGrupo, indiceSelecao, { PECAS_POR_QUARTEIO: Number(event.target.value) })} /></td>
                    {CLASSES.map((classe) => <td key={classe} className="p-2"><div className="relative mx-auto w-24"><Input type="number" min="0" max="100" step="0.01" className="pr-7 text-right font-bold" value={selecao.PERCENTUAIS[classe]} onChange={(event) => alterarSelecao(indiceGrupo, indiceSelecao, { PERCENTUAIS: { ...selecao.PERCENTUAIS, [classe]: Number(event.target.value) } })} /><span className="absolute right-2 top-2.5 text-[#71869A]">%</span></div></td>)}
                    <td className="p-2"><Button variant="ghost" size="icon" className="text-red-600" disabled={grupo.SELECOES.length === 1} onClick={() => alterarGrupo(indiceGrupo, { SELECOES: grupo.SELECOES.filter((_, posicao) => posicao !== indiceSelecao) })}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>)}</tbody>
                  <tfoot className="border-t-2 border-[#B8CBD9] bg-[#F2F7FA]"><tr><td colSpan={3} className="px-3 py-3 text-right font-black uppercase text-[#36546F]">Total da distribuição</td>{CLASSES.map((classe) => { const correto = Math.abs(totais[classe] - 100) <= 0.01; return <td key={classe} className={`px-3 py-3 text-center text-sm font-black ${correto ? "text-emerald-700" : "text-red-600"}`}>{totais[classe].toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td>; })}<td /></tr></tfoot>
                </table>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
