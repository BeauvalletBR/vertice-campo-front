"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Check, CheckCircle2, FileText, GitBranch, PackagePlus, Plus, SquarePen, Trash2, Weight, X } from "lucide-react";
import { InputWeightFields, type WeightEntryMode } from "../components/InputWeightFields";
import { ProductHierarchySelect } from "../components/ProductHierarchySelect";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { Button, Field } from "../components/ui";
import { testService } from "../services/testService";
import { useRendimentoData } from "../context/RendimentoDataContext";
import type { NavigationTarget } from "../types/navigation";
import { calculateAverageWeight } from "../utils/calculations";
import { formatWeight, parseDecimal, sanitizeWeightInput, toInputDecimal } from "../utils/format";

interface FlowNodeDraft { id: string; productId: string; parentNodeId: string | null; branchOrder: number }
interface FlowDraft { id: string; rootProductId: string; productIds: string[]; nodes: FlowNodeDraft[]; firstWeight: string }

const newNodeId = () => `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nodesFromFlow = (flow: { steps: Array<{ id: string; productId: string; parentStepId: string | null; branchOrder: number }> }) =>
  flow.steps.map((step, index) => ({
    id: step.id,
    productId: step.productId,
    parentNodeId: step.parentStepId ?? (index > 0 ? flow.steps[index - 1].id : null),
    branchOrder: step.branchOrder || 1,
  }));

export function NewTestPage({ testId, onNavigate }: { testId?: string; onNavigate: (target: NavigationTarget) => void }) {
  const { products, tests, refreshTests } = useRendimentoData();
  const existing = testId ? tests.find((item) => item.id === testId) : undefined;
  const inputProducts = products.filter((item) => item.active).sort((a, b) => {
    const typeOrder = (a.type === "ENTRADA" ? 0 : 1) - (b.type === "ENTRADA" ? 0 : 1);
    return typeOrder || a.name.localeCompare(b.name, "pt-BR");
  });
  const inputEntries = inputProducts.filter((item) => item.type === "ENTRADA");
  const inputCuts = inputProducts.filter((item) => item.type === "PRODUTO");
  const startProducts = products.filter((item) => item.type === "PRODUTO" && item.active).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "pt-BR"));
  const draftCounter = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const newFlow = (): FlowDraft => ({ id: `draft-${++draftCounter.current}`, rootProductId: "", productIds: [], nodes: [], firstWeight: "" });
  const [currentTestId, setCurrentTestId] = useState(existing?.id || "");
  const currentTestIdRef = useRef(existing?.id || "");
  const [name, setName] = useState(existing?.name || "");
  const [date, setDate] = useState(existing?.date || "");
  const [inputProductId, setInputProductId] = useState(existing?.inputProductId || "");
  const [quantity, setQuantity] = useState(String(existing?.inputQuantity || ""));
  const [weight, setWeight] = useState(existing?.inputTotalWeightKg ? toInputDecimal(existing.inputTotalWeightKg) : existing?.inputWeightKg ? toInputDecimal(existing.inputWeightKg) : "");
  const [pieceWeights, setPieceWeights] = useState<string[]>(() => (existing?.inputPieceWeightsKg || []).map((value) => toInputDecimal(value)));
  const [weightMode] = useState<WeightEntryMode>("pieces");
  const executionMode = "traceable" as const;
  const [flows, setFlows] = useState<FlowDraft[]>(() => existing?.flows.length ? existing.flows.map((flow) => ({ id: flow.id, rootProductId: flow.rootProductId, productIds: flow.productIds, nodes: nodesFromFlow(flow), firstWeight: toInputDecimal(flow.steps[0]?.initialWeightKg || 0) })) : [{ id: "draft-0", rootProductId: "", productIds: [], nodes: [], firstWeight: "" }]);
  const [pendingRootChange, setPendingRootChange] = useState<{ flowId: string; rootProductId: string } | null>(null);
  const [error, setError] = useState("");
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saving, setSaving] = useState(false);
  const pieceWeightTotal = pieceWeights.reduce((sum, value) => sum + parseDecimal(value), 0);
  const activeWeight = weightMode === "pieces" ? pieceWeightTotal : parseDecimal(weight);
  const average = calculateAverageWeight(activeWeight, Number(quantity));

  const editingStatus = existing?.status === "EM_EXECUCAO" ? "EM_EXECUCAO" : "ABERTO";
  const setupPayload = (draftFlows: FlowDraft[], status: "ABERTO" | "EM_EXECUCAO") => ({
    id: currentTestIdRef.current || undefined,
    name,
    date,
    inputProductId,
    inputQuantity: Number(quantity) || 0,
    inputWeightKg: activeWeight,
    inputTotalWeightKg: parseDecimal(weight),
    inputWeightMode: weightMode,
    inputPieceWeightsKg: pieceWeights.map(parseDecimal).slice(0, Number(quantity) || 0),
    executionMode,
    flows: draftFlows.filter((flow) => flow.rootProductId && flow.nodes.length).map((flow) => ({ id: flow.id.startsWith("draft-") ? undefined : flow.id, rootProductId: flow.rootProductId, productIds: flow.nodes.map((node) => node.productId), nodes: flow.nodes, firstStepWeightKg: parseDecimal(flow.firstWeight) })),
    status,
  });
  const autoSave = (draftFlows: FlowDraft[]) => {
    if (!currentTestIdRef.current) return;
    const payload = setupPayload(draftFlows, editingStatus);
    if (!payload.flows.length) return;
    const submittedDraftIds = new Set(
      draftFlows
        .filter((flow) => flow.id.startsWith("draft-") && flow.rootProductId && flow.productIds.length)
        .map((flow) => flow.id),
    );
    setAutoSaveState("saving");
    saveQueue.current = saveQueue.current.then(async () => {
      const saved = await testService.saveSetup({ ...payload, id: currentTestIdRef.current || undefined });
      currentTestIdRef.current = saved.id;
      setCurrentTestId(saved.id);
      setFlows((current) => {
        const savedFlows = saved.flows.map((flow) => ({ id: flow.id, rootProductId: flow.rootProductId, productIds: flow.productIds, nodes: nodesFromFlow(flow), firstWeight: toInputDecimal(flow.steps[0]?.initialWeightKg || 0) }));
        const pendingDrafts = current.filter(
          (flow) => flow.id.startsWith("draft-") && !submittedDraftIds.has(flow.id),
        );
        return [...savedFlows, ...pendingDrafts];
      });
      await refreshTests();
      setError(""); setAutoSaveState("saved");
    }).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o teste.");
      setAutoSaveState("idle");
    });
  };
  const applyRootChange = (flowId: string, rootProductId: string) => {
    const rootNode = rootProductId ? { id: newNodeId(), productId: rootProductId, parentNodeId: null, branchOrder: 1 } : null;
    const next = flows.map((flow) => flow.id === flowId ? { ...flow, rootProductId, productIds: rootProductId ? [rootProductId] : [], nodes: rootNode ? [rootNode] : [] } : flow);
    setFlows(next); autoSave(next);
  };
  const requestRootChange = (flowId: string, rootProductId: string) => {
    const flow = flows.find((item) => item.id === flowId);
    if (!flow || flow.rootProductId === rootProductId) return;
    if (flow.productIds.length > 1) {
      setPendingRootChange({ flowId, rootProductId });
      return;
    }
    applyRootChange(flowId, rootProductId);
  };
  const addBranch = (flowId: string, parentNodeId: string, productId: string) => {
    if (!productId) return;
    const flow = flows.find((item) => item.id === flowId); if (!flow) return;
    const siblings = flow.nodes.filter((node) => node.parentNodeId === parentNodeId);
    if (siblings.some((node) => node.productId === productId)) return;
    const nodes = [...flow.nodes, { id: newNodeId(), productId, parentNodeId, branchOrder: siblings.length + 1 }];
    const next = flows.map((item) => item.id === flowId ? { ...item, nodes, productIds: nodes.map((node) => node.productId) } : item);
    setFlows(next); autoSave(next);
  };
  const addAllBranches = (flowId: string, parentNodeId: string, productIds: string[]) => {
    const flow = flows.find((item) => item.id === flowId); if (!flow) return;
    const siblings = flow.nodes.filter((node) => node.parentNodeId === parentNodeId);
    const existingIds = new Set(siblings.map((node) => node.productId));
    const additions = productIds.filter((productId) => productId && !existingIds.has(productId));
    if (!additions.length) return;
    const nodes = [
      ...flow.nodes,
      ...additions.map((productId, index) => ({
        id: newNodeId(),
        productId,
        parentNodeId,
        branchOrder: siblings.length + index + 1,
      })),
    ];
    const next = flows.map((item) => item.id === flowId
      ? { ...item, nodes, productIds: nodes.map((node) => node.productId) }
      : item);
    setFlows(next); autoSave(next);
  };
  const removeBranch = (flowId: string, nodeId: string) => {
    const flow = flows.find((item) => item.id === flowId); if (!flow) return;
    const removed = new Set([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      flow.nodes.forEach((node) => { if (node.parentNodeId && removed.has(node.parentNodeId) && !removed.has(node.id)) { removed.add(node.id); changed = true; } });
    }
    const nodes = flow.nodes.filter((node) => !removed.has(node.id));
    const next = flows.map((item) => item.id === flowId ? { ...item, nodes, productIds: nodes.map((node) => node.productId) } : item);
    setFlows(next); autoSave(next);
  };
  const removeFlow = (flowId: string) => { const next = flows.filter((flow) => flow.id !== flowId); setFlows(next); autoSave(next); };
  const addFlow = () => {
    setFlows((current) => [...current, newFlow()]);
  };
  const persist = async () => {
    const numericWeight = activeWeight;
    if (!flows.some((flow) => flow.rootProductId && flow.productIds.length)) { setError("Adicione ao menos um produto e selecione sua sequência."); return; }
    if (flows.some((flow) => flow.nodes.length < 2)) { setError("Cada fluxo precisa ter um produto inicial e ao menos uma saída final antes de deixar o teste aberto."); return; }
    if (flows.some((flow) => numericWeight > 0 && parseDecimal(flow.firstWeight) > numericWeight)) { setError("O peso inicial de um produto não pode superar o peso de entrada informado."); return; }
    setSaving(true);
    try {
      await saveQueue.current;
      const saved = await testService.saveSetup({ ...setupPayload(flows, editingStatus), id: currentTestIdRef.current || undefined });
      currentTestIdRef.current = saved.id;
      setCurrentTestId(saved.id);
      await refreshTests();
      setError(""); onNavigate(editingStatus === "EM_EXECUCAO" ? { route: "execute", id: saved.id } : { route: "tests" });
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o teste."); }
    finally { setSaving(false); }
  };

  const renderBranchTree = (flow: FlowDraft, parentNodeId: string | null = null): ReactNode => {
    const siblings = flow.nodes.filter((node) => node.parentNodeId === parentNodeId).sort((a, b) => a.branchOrder - b.branchOrder);
    if (!siblings.length) return null;
    return <div className={`yield-tree-level ${parentNodeId ? "yield-tree-level--children" : ""}`}>{siblings.map((node) => {
      const product = products.find((item) => item.id === node.productId);
      const children = flow.nodes.filter((candidate) => candidate.parentNodeId === node.id);
      const availableChildren = products
        .filter((item) => item.active && item.type === "PRODUTO" && (item.originProductIds.includes(node.productId) || item.parentId === node.productId))
        .filter((item) => !children.some((child) => child.productId === item.id))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return <div className="yield-tree-branch" key={node.id}>
        <div className={`yield-tree-node ${children.length ? "has-children" : "is-leaf"}`}>
          <span className="yield-tree-node__icon"><GitBranch size={16} /></span>
          <div><small>{parentNodeId ? children.length ? "Transformação" : "Produto final" : "Produto inicial"}</small><strong>{product?.name || "Produto"}</strong></div>
          {parentNodeId && <button type="button" aria-label={`Remover ${product?.name || "produto"}`} onClick={() => removeBranch(flow.id, node.id)}><X size={14} /></button>}
        </div>
        {availableChildren.length > 0 && <div className="yield-tree-add-actions"><label className="yield-tree-add"><Plus size={14} /><select aria-label={`Adicionar saída de ${product?.name || "produto"}`} value="" onChange={(event) => addBranch(flow.id, node.id, event.target.value)}><option value="">Adicionar saída...</option>{availableChildren.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{availableChildren.length > 1 && <button type="button" className="yield-tree-add-all" onClick={() => addAllBranches(flow.id, node.id, availableChildren.map((item) => item.id))}><GitBranch size={14} /> Adicionar todas as {availableChildren.length} saídas</button>}</div>}
        {renderBranchTree(flow, node.id)}
      </div>;
    })}</div>;
  };

  return <>
    <button className="back-link" onClick={() => onNavigate({ route: "tests" })}><ArrowLeft size={16} /> Voltar para testes</button>
    <PageHeader eyebrow={existing ? `Teste ${existing.number}` : "Novo registro"} title={existing ? "Editar Teste de Rendimento" : "Novo Teste de Rendimento"} description="Monte os produtos e a sequência livremente. Quantidade e peso serão exigidos somente quando o teste for executado." />
    <div className="form-layout">
      <section className="form-card optional-input-card">
        <header><span><FileText size={19} /></span><div><h2>Dados de entrada <i>Opcional na criação</i></h2><p>Você pode montar o teste agora e completar quantidade e peso antes da execução.</p></div></header>
        <div className="optional-data-note"><CheckCircle2 size={16} /><span>Use o peso total diretamente ou informe o peso individual de cada peça para somar automaticamente.</span></div>
        <div className="execution-mode-picker execution-mode-picker--fixed">
          <span>Forma de execução</span>
          <p><Check size={14} /> Rastreável por peça: cada peso de entrada será acompanhado até os produtos finais.</p>
        </div>
        <div className="form-grid form-grid--3">
          <div className="form-grid__wide"><Field label="Nome do teste" hint="editável"><input value={name} maxLength={150} placeholder="Ex.: Contra Filé — lote manhã" onChange={(event) => setName(event.target.value)} onBlur={() => currentTestId && autoSave(flows)} /></Field></div>
          <Field label="Data" hint="opcional"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} onBlur={() => currentTestId && autoSave(flows)} /></Field>
          <Field label="Matéria-prima" hint="opcional"><select value={inputProductId} onChange={(event) => setInputProductId(event.target.value)} onBlur={() => currentTestId && autoSave(flows)}><option value="">Não informada</option>{inputEntries.length > 0 && <optgroup label="Matérias-primas cadastradas">{inputEntries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}{inputCuts.length > 0 && <optgroup label="Produtos / cortes (inclusive cortes pai)">{inputCuts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}</select></Field>
          <InputWeightFields quantity={quantity} weight={weight} pieceWeights={pieceWeights} mode={weightMode} onQuantityChange={setQuantity} onWeightChange={setWeight} onPieceWeightsChange={setPieceWeights} onModeChange={() => undefined} onBlur={() => currentTestId && autoSave(flows)} lockPieceMode />
          <Field label="Peso médio" hint="calculado" calculated><div className="calculated-value"><Weight size={16} />{formatWeight(average)}</div></Field>
        </div>
      </section>

      <section className="form-card product-flows-card">
        <header><span><PackagePlus size={19} /></span><div><h2>Produtos vinculados</h2><p>{currentTestId ? "As alterações são salvas automaticamente." : "Monte os produtos e deixe o teste aberto para salvar."}</p></div><div className={`autosave-state ${autoSaveState}`}><CheckCircle2 size={14} />{!currentTestId ? "Ainda não salvo" : autoSaveState === "saving" ? "Salvando..." : autoSaveState === "saved" ? "Salvo automaticamente" : "Salvamento automático"}</div></header>
        <div className="flow-editor-list">{flows.map((flow, flowIndex) => {
          return <article className="flow-editor" key={flow.id}>
            <header><div><span>Produto {flowIndex + 1}</span><strong>{products.find((item) => item.id === flow.rootProductId)?.name || "Selecione o produto principal"}</strong></div>{flows.length > 1 && <button className="icon-button icon-button--danger" onClick={() => removeFlow(flow.id)} aria-label="Remover produto"><Trash2 size={16} /></button>}</header>
            <div className="route-settings-row">
              <Field label="Produto inicial / grupo" hint="pode iniciar com várias ramificações"><ProductHierarchySelect products={startProducts} value={flow.rootProductId} ariaLabel={`Produto principal ${flowIndex + 1}`} disabledIds={new Set(flows.filter((other) => other.id !== flow.id).map((other) => other.rootProductId).filter(Boolean))} onChange={(productId) => requestRootChange(flow.id, productId)} /></Field>
              <Field label="Peso inicial deste produto" hint="opcional agora"><input inputMode="decimal" placeholder="0,000" value={flow.firstWeight} onChange={(event) => setFlows((current) => current.map((item) => item.id === flow.id ? { ...item, firstWeight: sanitizeWeightInput(event.target.value) } : item))} onBlur={() => autoSave(flows)} /></Field>
            </div>
            <div className="route-builder route-builder--tree"><header><div><span>Fluxo de transformação</span><small>Adicione uma ou mais saídas em qualquer produto. Cada caminho pode continuar ou terminar separadamente.</small></div><strong>{flow.nodes.length} produtos</strong></header>
              {flow.nodes.length ? <div className="yield-tree-canvas">{renderBranchTree(flow)}</div> : <div className="route-empty">Selecione primeiro o produto principal acima.</div>}
            </div>
            <div className="flow-save-row"><span>{flow.nodes.length} produtos · {flow.nodes.filter((node) => !flow.nodes.some((candidate) => candidate.parentNodeId === node.id)).length} saídas finais</span><strong><CheckCircle2 size={14} /> {currentTestId ? "Salvamento automático" : "Será salvo como aberto"}</strong></div>
          </article>;
        })}</div>
        <button className="add-flow-button" onClick={addFlow}><PackagePlus size={17} /> Adicionar outro produto ao teste</button>
      </section>
      {error && <div className="form-error">{error}</div>}
      <footer className="form-actions"><Button variant="ghost" onClick={() => onNavigate({ route: "tests" })}>Cancelar</Button><div><Button onClick={() => void persist()}>{existing ? <SquarePen size={16} /> : <FileText size={16} />} {saving ? "Salvando..." : existing ? "Salvar alterações" : "Deixar aberto"}</Button></div></footer>
    </div>
    <ConfirmDialog open={pendingRootChange !== null} title="Trocar o produto principal?" description="A sequência atual será limpa para evitar misturar produtos de tipos diferentes. O peso inicial informado será preservado." confirmLabel="Trocar produto" onCancel={() => setPendingRootChange(null)} onConfirm={() => { if (pendingRootChange) applyRootChange(pendingRootChange.flowId, pendingRootChange.rootProductId); setPendingRootChange(null); }} />
  </>;
}
