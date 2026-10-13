"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, GripVertical, PackagePlus, SquarePen, Trash2, Weight, X } from "lucide-react";
import { InputWeightFields, type WeightEntryMode } from "../components/InputWeightFields";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { Button, Field } from "../components/ui";
import { testService } from "../services/testService";
import { useRendimentoData } from "../context/RendimentoDataContext";
import type { NavigationTarget } from "../types/navigation";
import { calculateAverageWeight } from "../utils/calculations";
import { formatWeight, handleWeightInputKeyDown, parseDecimal, sanitizeWeightInput, toInputDecimal } from "../utils/format";

interface FlowDraft { id: string; rootProductId: string; productIds: string[]; firstWeight: string }

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
  const choicesFor = (rootId: string) => {
    const result: Array<{ product: (typeof products)[number]; depth: number }> = [];
    const visited = new Set<string>();
    const walk = (id: string, depth: number) => {
      if (visited.has(id)) return;
      const product = products.find((item) => item.id === id && item.type === "PRODUTO" && item.active);
      if (!product) return;
      visited.add(id);
      result.push({ product, depth });
      products
        .filter((item) => item.type === "PRODUTO" && item.active && (item.originProductIds.includes(id) || item.parentId === id))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "pt-BR"))
        .forEach((child) => walk(child.id, depth + 1));
    };
    if (rootId) walk(rootId, 0);
    return result;
  };
  const draftCounter = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const newFlow = (): FlowDraft => ({ id: `draft-${++draftCounter.current}`, rootProductId: "", productIds: [], firstWeight: "" });
  const [currentTestId, setCurrentTestId] = useState(existing?.id || "");
  const currentTestIdRef = useRef(existing?.id || "");
  const [name, setName] = useState(existing?.name || "");
  const [date, setDate] = useState(existing?.date || "");
  const [inputProductId, setInputProductId] = useState(existing?.inputProductId || "");
  const [quantity, setQuantity] = useState(String(existing?.inputQuantity || ""));
  const [weight, setWeight] = useState(existing?.inputTotalWeightKg ? toInputDecimal(existing.inputTotalWeightKg) : existing?.inputWeightKg ? toInputDecimal(existing.inputWeightKg) : "");
  const [pieceWeights, setPieceWeights] = useState<string[]>(() => (existing?.inputPieceWeightsKg || []).map((value) => toInputDecimal(value)));
  const [weightMode, setWeightMode] = useState<WeightEntryMode>(existing?.inputWeightMode || "total");
  const [flows, setFlows] = useState<FlowDraft[]>(() => existing?.flows.length ? existing.flows.map((flow) => ({ id: flow.id, rootProductId: flow.rootProductId, productIds: flow.productIds, firstWeight: toInputDecimal(flow.steps[0]?.initialWeightKg || 0) })) : [{ id: "draft-0", rootProductId: "", productIds: [], firstWeight: "" }]);
  const [draggedProduct, setDraggedProduct] = useState<{ flowId: string; productId: string } | null>(null);
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
    flows: draftFlows.filter((flow) => flow.rootProductId && flow.productIds.length).map((flow) => ({ id: flow.id.startsWith("draft-") ? undefined : flow.id, rootProductId: flow.rootProductId, productIds: flow.productIds, firstStepWeightKg: parseDecimal(flow.firstWeight) })),
    status,
  });
  const autoSave = (draftFlows: FlowDraft[]) => {
    if (!currentTestIdRef.current) return;
    const payload = setupPayload(draftFlows, editingStatus);
    if (!payload.flows.length) return;
    setAutoSaveState("saving");
    saveQueue.current = saveQueue.current.then(async () => {
      const saved = await testService.saveSetup({ ...payload, id: currentTestIdRef.current || undefined });
      currentTestIdRef.current = saved.id;
      setCurrentTestId(saved.id);
      setFlows(saved.flows.map((flow) => ({ id: flow.id, rootProductId: flow.rootProductId, productIds: flow.productIds, firstWeight: toInputDecimal(flow.steps[0]?.initialWeightKg || 0) })));
      await refreshTests();
      setError(""); setAutoSaveState("saved");
    }).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o teste.");
      setAutoSaveState("idle");
    });
  };
  const applyRootChange = (flowId: string, rootProductId: string) => {
    const next = flows.map((flow) => flow.id === flowId ? { ...flow, rootProductId, productIds: rootProductId ? [rootProductId] : [] } : flow);
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
  const toggleProduct = (flowId: string, productId: string) => {
    const flow = flows.find((item) => item.id === flowId); if (!flow) return;
    if (!flow.rootProductId || productId === flow.rootProductId || !choicesFor(flow.rootProductId).some((item) => item.product.id === productId)) return;
    const productIds = flow.productIds.includes(productId) ? flow.productIds.filter((id) => id !== productId) : [...flow.productIds, productId];
    const next = flows.map((item) => item.id === flowId ? { ...item, productIds } : item);
    setFlows(next); autoSave(next);
  };
  const moveProduct = (flowId: string, targetProductId: string) => {
    if (!draggedProduct || draggedProduct.flowId !== flowId || draggedProduct.productId === targetProductId) return;
    const flow = flows.find((item) => item.id === flowId); if (!flow) return;
    if (draggedProduct.productId === flow.rootProductId || targetProductId === flow.rootProductId) return;
    const productIds = [...flow.productIds];
    const from = productIds.indexOf(draggedProduct.productId);
    const to = productIds.indexOf(targetProductId);
    if (from < 0 || to < 0) return;
    const [moved] = productIds.splice(from, 1);
    productIds.splice(to, 0, moved);
    const next = flows.map((item) => item.id === flowId ? { ...item, productIds } : item);
    setFlows(next); setDraggedProduct(null); autoSave(next);
  };
  const removeFlow = (flowId: string) => { const next = flows.filter((flow) => flow.id !== flowId); setFlows(next); autoSave(next); };
  const addFlow = () => {
    const next = [...flows, newFlow()]; setFlows(next); autoSave(next);
  };
  const persist = async () => {
    const numericWeight = activeWeight;
    if (!flows.some((flow) => flow.rootProductId && flow.productIds.length)) { setError("Adicione ao menos um produto e selecione sua sequência."); return; }
    if (flows.some((flow) => flow.productIds.length < 2)) { setError("Cada fluxo precisa ter um produto inicial e um produto final antes de deixar o teste aberto."); return; }
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

  return <>
    <button className="back-link" onClick={() => onNavigate({ route: "tests" })}><ArrowLeft size={16} /> Voltar para testes</button>
    <PageHeader eyebrow={existing ? `Teste ${existing.number}` : "Novo registro"} title={existing ? "Editar Teste de Rendimento" : "Novo Teste de Rendimento"} description="Monte os produtos e a sequência livremente. Quantidade e peso serão exigidos somente quando o teste for executado." />
    <div className="form-layout">
      <section className="form-card optional-input-card">
        <header><span><FileText size={19} /></span><div><h2>Dados de entrada <i>Opcional na criação</i></h2><p>Você pode montar o teste agora e completar quantidade e peso antes da execução.</p></div></header>
        <div className="optional-data-note"><CheckCircle2 size={16} /><span>Use o peso total diretamente ou informe o peso individual de cada peça para somar automaticamente.</span></div>
        <div className="form-grid form-grid--3">
          <div className="form-grid__wide"><Field label="Nome do teste" hint="editável"><input value={name} maxLength={150} placeholder="Ex.: Contra Filé — lote manhã" onChange={(event) => setName(event.target.value)} onBlur={() => currentTestId && autoSave(flows)} /></Field></div>
          <Field label="Data" hint="opcional"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} onBlur={() => currentTestId && autoSave(flows)} /></Field>
          <Field label="Matéria-prima" hint="opcional"><select value={inputProductId} onChange={(event) => setInputProductId(event.target.value)} onBlur={() => currentTestId && autoSave(flows)}><option value="">Não informada</option>{inputEntries.length > 0 && <optgroup label="Matérias-primas cadastradas">{inputEntries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}{inputCuts.length > 0 && <optgroup label="Produtos / cortes (inclusive cortes pai)">{inputCuts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}</select></Field>
          <InputWeightFields quantity={quantity} weight={weight} pieceWeights={pieceWeights} mode={weightMode} onQuantityChange={setQuantity} onWeightChange={setWeight} onPieceWeightsChange={setPieceWeights} onModeChange={setWeightMode} onBlur={() => currentTestId && autoSave(flows)} />
          <Field label="Peso médio" hint="calculado" calculated><div className="calculated-value"><Weight size={16} />{formatWeight(average)}</div></Field>
        </div>
      </section>

      <section className="form-card product-flows-card">
        <header><span><PackagePlus size={19} /></span><div><h2>Produtos vinculados</h2><p>{currentTestId ? "As alterações são salvas automaticamente." : "Monte os produtos e deixe o teste aberto para salvar."}</p></div><div className={`autosave-state ${autoSaveState}`}><CheckCircle2 size={14} />{!currentTestId ? "Ainda não salvo" : autoSaveState === "saving" ? "Salvando..." : autoSaveState === "saved" ? "Salvo automaticamente" : "Salvamento automático"}</div></header>
        <div className="flow-editor-list">{flows.map((flow, flowIndex) => {
          const compatibleProducts = choicesFor(flow.rootProductId);
          return <article className="flow-editor" key={flow.id}>
            <header><div><span>Produto {flowIndex + 1}</span><strong>{products.find((item) => item.id === flow.rootProductId)?.name || "Selecione o produto principal"}</strong></div>{flows.length > 1 && <button className="icon-button icon-button--danger" onClick={() => removeFlow(flow.id)} aria-label="Remover produto"><Trash2 size={16} /></button>}</header>
            <div className="route-settings-row">
              <Field label="Produto principal" hint="define o tipo desta rota"><select aria-label={`Produto principal ${flowIndex + 1}`} value={flow.rootProductId} onChange={(event) => requestRootChange(flow.id, event.target.value)}><option value="">Selecione um produto</option>{startProducts.map((item) => <option key={item.id} value={item.id} disabled={flows.some((other) => other.id !== flow.id && other.rootProductId === item.id)}>{"— ".repeat(Math.min(item.level, 3))}{item.name}</option>)}</select></Field>
              <Field label="Peso inicial deste produto" hint="opcional agora"><input inputMode="decimal" placeholder="Pode preencher na execução" value={flow.firstWeight} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => handleWeightInputKeyDown(event, flow.firstWeight || "0,000", (value) => setFlows((current) => current.map((item) => item.id === flow.id ? { ...item, firstWeight: value } : item)))} onChange={(event) => setFlows((current) => current.map((item) => item.id === flow.id ? { ...item, firstWeight: sanitizeWeightInput(event.target.value) } : item))} onBlur={() => autoSave(flows)} /></Field>
            </div>
            <div className="route-builder"><header><div><span>Sequência definida</span><small>Clique para incluir e arraste os cards selecionados para reordenar ou pular etapas.</small></div><strong>{flow.productIds.length} selecionados</strong></header>
              {flow.productIds.length ? <div className="route-track">{flow.productIds.map((productId, index) => { const item = products.find((product) => product.id === productId); return <div className={`route-node ${index === 0 ? "start locked" : ""} ${index === flow.productIds.length - 1 && index > 0 ? "finish" : ""}`} draggable={index > 0} key={productId} onDragStart={() => index > 0 && setDraggedProduct({ flowId: flow.id, productId })} onDragOver={(event) => event.preventDefault()} onDrop={() => moveProduct(flow.id, productId)}><GripVertical size={15} /><div><small>{index === 0 ? "Início fixo" : index === flow.productIds.length - 1 ? "Fim" : `Etapa ${index + 1}`}</small><strong>{item?.name}</strong><span>Nível {item?.level}</span></div>{index > 0 && <button type="button" aria-label={`Remover ${item?.name}`} onClick={() => toggleProduct(flow.id, productId)}><X size={14} /></button>}{index < flow.productIds.length - 1 && <i><ArrowRight size={15} /></i>}</div>; })}</div> : <div className="route-empty">Selecione primeiro o produto principal acima.</div>}
              {flow.rootProductId && <div className="route-palette"><span>Produtos compatíveis com {products.find((item) => item.id === flow.rootProductId)?.name}</span>{compatibleProducts.length > 1 ? <div>{compatibleProducts.slice(1).map(({ product: item, depth }) => { const selected = flow.productIds.includes(item.id); const previousId = flow.productIds.at(-1) || flow.rootProductId; const canFollow = item.originProductIds.includes(previousId) || item.parentId === previousId; return <button type="button" key={item.id} className={`${selected ? "selected" : ""} ${canFollow && !selected ? "suggested" : ""}`} onClick={() => toggleProduct(flow.id, item.id)}><i>{selected ? <Check size={13} /> : depth}</i><span><strong>{item.name}</strong><small>{selected ? "Na sequência" : canFollow ? "Próximo sugerido" : `Mesmo tipo · nível ${item.level}`}</small></span></button>; })}</div> : <p className="route-palette-empty">Nenhum produto derivado cadastrado para este tipo.</p>}</div>}
            </div>
            <div className="flow-save-row"><span>{flow.productIds.length} produtos · {Math.max(0, flow.productIds.length - 1)} {flow.productIds.length === 2 ? "etapa de transformação" : "etapas de transformação"}</span><strong><CheckCircle2 size={14} /> {currentTestId ? "Salvamento automático" : "Será salvo como aberto"}</strong></div>
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
