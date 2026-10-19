"use client";

import { useState } from "react";
import { Clock3, Eye, FileDown, Filter, Layers3, Package, PackageCheck, Play, Plus, PowerOff, RotateCcw, Search, Scale, SquarePen, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ReportExportDialog } from "../components/ReportExportDialog";
import { StatusBadge } from "../components/StatusBadge";
import { Button, EmptyState } from "../components/ui";
import { testService } from "../services/testService";
import { useRendimentoData } from "../context/RendimentoDataContext";
import type { NavigationTarget } from "../types/navigation";
import type { TestStatus } from "../types/domain";
import { formatDate, formatDateTime, formatWeight } from "../utils/format";
import { isBranchedFlow } from "../utils/flowTree";

type TestTab = "pending" | "finished" | "inactive";
interface PendingConfirmation { title: string; description: string; label: string; danger?: boolean; action: () => Promise<void> }

export function TestsPage({ onNavigate }: { onNavigate: (target: NavigationTarget) => void }) {
  const [tab, setTab] = useState<TestTab>("pending");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TestStatus | "">("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [reportTestId, setReportTestId] = useState<string | null>(null);
  const { products, tests, refreshTests } = useRendimentoData();

  const nameOf = (id?: string) => products.find((item) => item.id === id)?.name || "—";
  const flowNames = (test: (typeof tests)[number]) => test.flows.map((flow) => nameOf(flow.rootProductId)).join(" + ") || "Sem produto vinculado";
  const rows = tests
    .filter((test) => tab === "finished" ? test.status === "FINALIZADO" : tab === "inactive" ? test.status === "CANCELADO" : ["RASCUNHO", "ABERTO", "EM_EXECUCAO"].includes(test.status))
    .filter((test) => !status || test.status === status)
    .filter((test) => {
      const term = search.trim().toLowerCase();
      return !term || test.name.toLowerCase().includes(term) || String(test.number).includes(term) || test.date.includes(term) || flowNames(test).toLowerCase().includes(term) || nameOf(test.inputProductId).toLowerCase().includes(term) || test.status.toLowerCase().includes(term);
    });

  const selectTab = (next: TestTab) => { setTab(next); setStatus(""); };
  const continueTest = async (id: string, currentStatus: TestStatus) => {
    setError("");
    try {
      if (currentStatus === "ABERTO") await testService.start(id);
      onNavigate({ route: currentStatus === "RASCUNHO" ? "new-test" : "execute", id });
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Não foi possível abrir o teste."); }
  };
  const deletePending = (id: string, number: number) => {
    setConfirmation({ title: `Apagar teste ${number}?`, description: "O teste pendente, seus pesos, etapas, descartes e produtos vinculados serão removidos definitivamente.", label: "Apagar teste", danger: true, action: async () => {
      try { if (await testService.remove(id)) await refreshTests(); }
      catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Não foi possível excluir o teste."); }
    } });
  };
  const inactivateFinished = (id: string, number: number) => {
    setConfirmation({ title: `Inativar teste ${number}?`, description: "O teste será preservado na aba de inativos e poderá ser reativado posteriormente.", label: "Inativar teste", danger: true, action: async () => {
      try { await testService.inactivate(id); await refreshTests(); }
      catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Não foi possível inativar o teste."); }
    } });
  };
  const restoreInactive = async (id: string) => {
    try { await testService.restore(id); await refreshTests(); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Não foi possível restaurar o teste."); }
  };
  const reopenFinished = (id: string, number: number) => {
    setConfirmation({ title: `Reabrir teste ${number}?`, description: "O teste voltará para execução e o relatório poderá ser gerado novamente após a nova finalização.", label: "Reabrir teste", action: async () => {
      try { const reopened = await testService.reopen(id); if (reopened) onNavigate({ route: "execute", id }); }
      catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Não foi possível reabrir o teste."); }
    } });
  };

  return <>
    <PageHeader eyebrow="Operação" title="Testes de Rendimento" description="Crie, continue e consulte todos os testes." actions={<Button onClick={() => onNavigate({ route: "new-test" })}><Plus size={17} /> Novo teste</Button>} />
    {error && <div className="inline-message">{error}</div>}
    <div className="tabs">
      <button className={tab === "pending" ? "active" : ""} onClick={() => selectTab("pending")}>Pendentes <span>{tests.filter((item) => ["RASCUNHO", "ABERTO", "EM_EXECUCAO"].includes(item.status)).length}</span></button>
      <button className={tab === "finished" ? "active" : ""} onClick={() => selectTab("finished")}>Finalizados <span>{tests.filter((item) => item.status === "FINALIZADO").length}</span></button>
      <button className={tab === "inactive" ? "active" : ""} onClick={() => selectTab("inactive")}>Inativos <span>{tests.filter((item) => item.status === "CANCELADO").length}</span></button>
    </div>
    <section className="table-panel tests-panel">
      <header className="table-toolbar"><label className="search-box"><Search size={17} /><input placeholder="Buscar por data, número, produto, corte ou status..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="select-filter"><Filter size={15} /><select value={status} onChange={(event) => setStatus(event.target.value as TestStatus | "")}><option value="">Todos os status</option>{tab === "pending" ? <><option value="RASCUNHO">Rascunho</option><option value="ABERTO">Aberto</option><option value="EM_EXECUCAO">Em andamento</option></> : tab === "finished" ? <option value="FINALIZADO">Finalizado</option> : <option value="CANCELADO">Inativo</option>}</select></label></header>
      {!rows.length ? <EmptyState title="Nenhum teste encontrado" description="Ajuste a busca ou os filtros para visualizar outros resultados." /> : tab === "pending" ? <>
        <div className="pending-cards-heading"><div><span className="pending-heading-icon"><Clock3 size={19} /></span><div><h2>Testes pendentes</h2><p>Escolha um card para continuar de onde parou.</p></div><strong>{rows.length} {rows.length === 1 ? "pendente" : "pendentes"}</strong></div></div>
        <div className="pending-card-rail">{rows.map((test) => {
          const currentFlow = test.flows.find((flow) => flow.status !== "FINALIZADO") || test.flows[0];
          const current = currentFlow?.steps[currentFlow.currentStepIndex] || currentFlow?.steps[0];
          const confirmedCount = test.flows.flatMap((flow) => isBranchedFlow(flow.steps) ? flow.steps : flow.steps.slice(0, -1)).filter((step) => step.confirmed).length;
          const totalSteps = test.flows.reduce((total, flow) => total + Math.max(0, flow.steps.length - (isBranchedFlow(flow.steps) ? 0 : 1)), 0);
          const progress = totalSteps ? Math.round((confirmedCount / totalSteps) * 100) : 0;
          const actionLabel = test.status === "RASCUNHO" ? "Continuar preenchimento" : test.status === "ABERTO" ? "Iniciar teste" : "Continuar teste";
          return <div className={`pending-test-card pending-test-card--${test.status.toLowerCase()}`} key={test.id} role="button" tabIndex={0} onClick={() => continueTest(test.id, test.status)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) continueTest(test.id, test.status); }}>
            <i className="pending-card-accent" />
            <header><div><span>{test.date ? formatDate(test.date) : "Data opcional"}</span><small>Teste {test.number}</small></div><StatusBadge status={test.status} /></header>
            <div className="pending-card-main"><div className="pending-card-title"><h3>{test.name || `Teste ${test.number}`}</h3>{["RASCUNHO", "ABERTO"].includes(test.status) && <button title="Editar teste inteiro" onClick={(event) => { event.stopPropagation(); onNavigate({ route: "new-test", id: test.id }); }}><SquarePen size={19} /><span>Editar</span></button>}</div><p>{flowNames(test)}</p></div>
            <div className="pending-card-chips"><span><PackageCheck size={14} />Matéria-prima: {test.inputProductId ? nameOf(test.inputProductId) : "não informada"}</span><span><Scale size={14} />{test.inputWeightKg ? formatWeight(test.inputWeightKg) : "Peso pendente"}</span><span><Package size={14} />{test.flows.length} {test.flows.length === 1 ? "produto" : "produtos"}</span></div>
            <div className="pending-card-products"><span>Produtos vinculados</span><div>{test.flows.map((flow) => <i key={flow.id}>{nameOf(flow.rootProductId)}</i>)}</div></div>
            <div className="pending-card-progress"><header><span><Layers3 size={14} /> Progresso das etapas</span><strong>{confirmedCount} de {totalSteps}</strong></header><div><i style={{ width: `${progress}%` }} /></div><p><span>Etapa atual</span><strong>{nameOf(current?.productId)}</strong></p></div>
            <footer><small>Atualizado {formatDateTime(test.updatedAt)}</small><div><button className="icon-button icon-button--danger" title="Apagar teste pendente" onClick={(event) => { event.stopPropagation(); deletePending(test.id, test.number); }}><Trash2 size={17} /></button>{["RASCUNHO", "ABERTO"].includes(test.status) && <button className="icon-button" title="Editar teste inteiro" onClick={(event) => { event.stopPropagation(); onNavigate({ route: "new-test", id: test.id }); }}><SquarePen size={17} /></button>}<button className="icon-button" title="Visualizar detalhes" onClick={(event) => { event.stopPropagation(); onNavigate({ route: "detail", id: test.id }); }}><Eye size={17} /></button><Button onClick={(event) => { event.stopPropagation(); continueTest(test.id, test.status); }}>{test.status === "RASCUNHO" ? <SquarePen size={15} /> : <Play size={15} />}{actionLabel}</Button></div></footer>
          </div>;
        })}</div>
      </> : <div className="responsive-table"><table><thead><tr><th>Data / teste</th><th>Nome / produtos</th><th>Peso de entrada</th><th>Quantidade de produtos</th><th>Etapas</th><th>Finalizado por</th><th>{tab === "finished" ? "Finalizado em" : "Atualizado em"}</th><th>Ações</th></tr></thead><tbody>{rows.map((test) => {
        const confirmedCount = test.flows.flatMap((flow) => isBranchedFlow(flow.steps) ? flow.steps : flow.steps.slice(0, -1)).filter((step) => step.confirmed).length;
        return <tr key={test.id}><td><strong className="date-primary">{test.date ? formatDate(test.date) : "Data não informada"}</strong><small>Teste {test.number}</small></td><td><strong>{test.name || `Teste ${test.number}`}</strong><small>{flowNames(test)}</small></td><td>{test.inputWeightKg ? formatWeight(test.inputWeightKg) : "SEM ENTRADA"}</td><td><strong>{test.flows.length}</strong><small>{test.flows.length === 1 ? "produto" : "produtos"}</small></td><td>{confirmedCount}</td><td><strong>{test.finalizedBy || "Não informado"}</strong></td><td>{formatDateTime(tab === "finished" ? test.finalizedAt : test.updatedAt)}</td><td><div className="row-actions"><button className="icon-button" title="Visualizar" onClick={() => onNavigate({ route: "detail", id: test.id })}><Eye size={17} /></button>{tab === "finished" ? <><button className="table-action-button" title="Reabrir e editar todos os valores" onClick={() => reopenFinished(test.id, test.number)}><SquarePen size={15} /> Editar valores</button><button className="table-action-button" title="Escolher formato do relatório" onClick={() => setReportTestId(test.id)}><FileDown size={15} /> Relatório</button><button className="table-action-button table-action-button--danger" title="Inativar teste" onClick={() => inactivateFinished(test.id, test.number)}><PowerOff size={15} /> Inativar</button></> : <button className="table-action-button" title="Reativar teste" onClick={() => restoreInactive(test.id)}><RotateCcw size={15} /> Reativar</button>}</div></td></tr>;
      })}</tbody></table></div>}
    </section>
    <ConfirmDialog open={confirmation !== null} title={confirmation?.title || "Confirmar ação"} description={confirmation?.description || ""} confirmLabel={confirmation?.label} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={async () => { const action = confirmation?.action; setConfirmation(null); await action?.(); }} />
    <ReportExportDialog open={reportTestId !== null} test={tests.find((item) => item.id === reportTestId)} products={products} onClose={() => setReportTestId(null)} />
  </>;
}
