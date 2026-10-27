"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { Boxes, ChevronDown, ChevronRight, CirclePlus, Pencil, Power, PowerOff, Search, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button, Field, Modal } from "../components/ui";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { catalogService } from "../services/catalogService";
import type { ErpProduct, Product, ProductType } from "../types/domain";

interface ProductForm { id?: string; version?: number; name: string; type: ProductType; hierarchyRole: "PAI" | "FILHO"; originProductIds: string[]; active: boolean; applicableDiscardIds: string[]; erpProductSeq: number | null }
const blankForm: ProductForm = { name: "", type: "PRODUTO", hierarchyRole: "PAI", originProductIds: [], active: true, applicableDiscardIds: [], erpProductSeq: null };

export function ProductsPage() {
  const { products: catalogProducts, discardTypes: catalogDiscards, refreshCatalogs } = useRendimentoData();
  const [typeFilter, setTypeFilter] = useState<"TODOS" | ProductType>("TODOS");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingToggle, setPendingToggle] = useState<Product | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [erpSearch, setErpSearch] = useState("");
  const [originSearch, setOriginSearch] = useState("");
  const [erpOptions, setErpOptions] = useState<ErpProduct[]>([]);
  const [loadingErp, setLoadingErp] = useState(false);
  const deferredErpSearch = useDeferredValue(erpSearch);
  const products = [...catalogProducts].sort((a, b) => {
    const typeOrder = (a.type === "ENTRADA" ? 0 : 1) - (b.type === "ENTRADA" ? 0 : 1);
    return typeOrder || a.name.localeCompare(b.name, "pt-BR");
  });
  const discardTypes = catalogDiscards.filter((item) => item.active);

  const openEdit = (product?: Product) => {
    setError("");
    setOriginSearch("");
    setErpSearch(product?.erpProductSeq ? `${product.erpProductSeq} - ${product.erpProductDescription || "Produto ERP"}` : "");
    setForm(product
      ? { id: product.id, version: product.version, name: product.name, type: product.type, hierarchyRole: product.originProductIds.length ? "FILHO" : "PAI", originProductIds: product.originProductIds, active: product.active, applicableDiscardIds: product.applicableDiscardIds, erpProductSeq: product.erpProductSeq ?? null }
      : { ...blankForm });
    setModalOpen(true);
  };
  useEffect(() => {
    if (!modalOpen) return;
    let active = true;
    setLoadingErp(true);
    const timer = window.setTimeout(() => {
      void catalogService.searchErpProducts(deferredErpSearch).then((items) => {
        if (active) setErpOptions(items);
      }).catch(() => {
        if (active) setErpOptions([]);
      }).finally(() => {
        if (active) setLoadingErp(false);
      });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [deferredErpSearch, modalOpen]);
  const save = async () => {
    if (!form.name.trim() || saving) return;
    if (form.type === "PRODUTO" && form.hierarchyRole === "FILHO" && !form.originProductIds.length) {
      setError("Selecione ao menos um produto de origem para cadastrar um produto filho.");
      return;
    }
    setSaving(true); setError("");
    try {
      const { hierarchyRole: _hierarchyRole, ...productData } = form;
      const originProductIds = form.type === "PRODUTO" && form.hierarchyRole === "FILHO" ? form.originProductIds : [];
      await catalogService.saveProduct({ ...productData, parentId: originProductIds[0] || null, originProductIds });
      await refreshCatalogs();
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleDiscard = (id: string) => setForm((current) => ({ ...current, applicableDiscardIds: current.applicableDiscardIds.includes(id) ? current.applicableDiscardIds.filter((item) => item !== id) : [...current.applicableDiscardIds, id] }));
  const toggleOrigin = (id: string) => setForm((current) => ({ ...current, originProductIds: current.originProductIds.includes(id) ? current.originProductIds.filter((item) => item !== id) : [...current.originProductIds, id] }));
  const setActive = async (product: Product) => {
    setError("");
    try { await catalogService.saveProduct({ ...product, active: !product.active }); await refreshCatalogs(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Não foi possível alterar o produto."); }
  };
  const requestActiveChange = (product: Product) => {
    if (product.active) setPendingToggle(product);
    else void setActive(product);
  };
  const clearInactive = async () => {
    setError("");
    try {
      const result = await catalogService.deleteInactiveProducts();
      await refreshCatalogs();
      setNotice(`${result.EXCLUIDOS} ${result.EXCLUIDOS === 1 ? "produto apagado" : "produtos apagados"}.${result.BLOQUEADOS ? ` ${result.BLOQUEADOS} permaneceram por estarem vinculados a testes, faixas ou outros produtos.` : ""}`);
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : "Não foi possível limpar os produtos inativos.");
    }
  };
  const descendantIds = (id?: string) => {
    const result = new Set<string>();
    const visit = (parentId: string) => products.filter((item) => item.originProductIds.includes(parentId) || item.parentId === parentId).forEach((item) => { if (result.has(item.id)) return; result.add(item.id); visit(item.id); });
    if (id) visit(id);
    return result;
  };
  const originCandidates = products.filter((item) => item.id !== form.id && item.type === "PRODUTO" && item.active && !descendantIds(form.id).has(item.id));
  const normalizedOriginSearch = originSearch.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const visibleOriginCandidates = normalizedOriginSearch
    ? originCandidates.filter((item) => item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(normalizedOriginSearch))
    : originCandidates;
  const rootGroupsFor = (productId: string, visited = new Set<string>()): Set<string> => {
    if (visited.has(productId)) return new Set();
    const product = products.find((item) => item.id === productId);
    if (!product) return new Set();
    const nextVisited = new Set(visited).add(productId);
    const parentIds = product.originProductIds.length
      ? product.originProductIds
      : product.parentId
        ? [product.parentId]
        : [];
    if (!parentIds.length) return new Set([product.id]);
    return parentIds.reduce((groups, parentId) => {
      rootGroupsFor(parentId, nextVisited).forEach((id) => groups.add(id));
      return groups;
    }, new Set<string>());
  };
  const selectedRootGroups = form.originProductIds.reduce<Set<string> | null>(
    (commonGroups, originId) => {
      const originGroups = rootGroupsFor(originId);
      if (commonGroups === null) return originGroups;
      return new Set([...commonGroups].filter((id) => originGroups.has(id)));
    },
    null,
  );

  const renderNode = (product: Product) => {
    const children = products.filter((item) => item.parentId === product.id);
    const isOpen = expanded.has(product.id);
    return <div className="tree-node" key={product.id}><div className={`tree-row ${!product.active ? "inactive" : ""}`}>
      <button className="tree-toggle" disabled={!children.length} onClick={() => toggle(product.id)}>{children.length ? isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} /> : <span />}</button>
      <span className="tree-icon"><Boxes size={17} /></span><div className="tree-name"><strong>{product.name}</strong><small>ID {product.id} · {product.type === "ENTRADA" ? "Matéria-prima" : `Nível ${product.level}`}</small></div>
      <div className="tree-discards">
        {product.erpProductSeq && <span className="erp-link-tag">ERP {product.erpProductSeq}{product.erpYieldTarget != null && product.erpYieldTarget > 0 ? ` · Meta ${(Math.abs(product.erpYieldTarget) <= 1 ? product.erpYieldTarget * 100 : product.erpYieldTarget).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : ""}</span>}
        {product.originProductIds.length > 0 ? product.originProductIds.slice(0, 2).map((id) => <span key={`origin-${id}`}>Sai de: {products.find((item) => item.id === id)?.name}</span>) : <span>Produto raiz</span>}
        {product.originProductIds.length > 2 && <span>+{product.originProductIds.length - 2} origens</span>}
        {product.applicableDiscardIds.map((id) => <span className="discard" key={`discard-${id}`}>{catalogDiscards.find((item) => item.id === id)?.name}</span>)}
      </div>
      <span className={`simple-status ${product.active ? "active" : ""}`}>{product.active ? "Ativo" : "Inativo"}</span>
      <div className="row-actions"><button className="icon-button" title="Editar" onClick={() => openEdit(product)}><Pencil size={16} /></button><button className="icon-button" title={product.active ? "Desativar" : "Ativar"} onClick={() => requestActiveChange(product)}>{product.active ? <PowerOff size={16} /> : <Power size={16} />}</button></div>
    </div>{isOpen && children.length > 0 && <div className="tree-children">{children.map(renderNode)}</div>}</div>;
  };

  return <>
    <PageHeader eyebrow="Cadastros" title="Produtos / Cortes" description="Organize os produtos, suas possíveis origens e os descartes aplicáveis." actions={<div className="page-action-group">{products.some((item) => !item.active) && <Button variant="secondary" onClick={() => setConfirmCleanup(true)}><Trash2 size={17} /> Limpar inativos</Button>}<Button onClick={() => openEdit()}><CirclePlus size={17} /> Novo produto</Button></div>} />
    {error && <div className="inline-message">{error}</div>}
    {notice && <div className="inline-message inline-message--success">{notice}</div>}
    <section className="tree-panel"><header><div><span>Hierarquia de produtos</span><small>{products.length} itens cadastrados · matérias-primas primeiro · produtos irmãos podem ocupar o mesmo nível</small></div><div className="tree-tools"><div className="catalog-type-filters" aria-label="Filtrar cadastro por tipo"><button className={typeFilter === "TODOS" ? "active" : ""} onClick={() => setTypeFilter("TODOS")}>Todos <span>{products.length}</span></button><button className={typeFilter === "ENTRADA" ? "active" : ""} onClick={() => setTypeFilter("ENTRADA")}>Matérias-primas <span>{products.filter((item) => item.type === "ENTRADA").length}</span></button><button className={typeFilter === "PRODUTO" ? "active" : ""} onClick={() => setTypeFilter("PRODUTO")}>Produtos / Cortes <span>{products.filter((item) => item.type === "PRODUTO").length}</span></button></div><div className="tree-legend"><span><i className="active" /> Ativo</span><span><i /> Inativo</span></div></div></header><div className="product-tree">{products.filter((item) => item.parentId === null && (typeFilter === "TODOS" || item.type === typeFilter)).map(renderNode)}</div></section>
    <Modal open={modalOpen} title={form.id ? "Editar produto / corte" : "Novo produto / corte"} subtitle="Defina uma ou mais origens do mesmo grupo principal e os descartes mais comuns." onClose={() => !saving && setModalOpen(false)} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={() => void save()}>{saving ? "Salvando..." : "Salvar produto"}</Button></>}>
      <div className="form-grid form-grid--2"><Field label="Nome"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="CONTRA FILÉ MI" /></Field><Field label="Tipo"><select value={form.type} onChange={(event) => { const type = event.target.value as ProductType; setForm({ ...form, type, hierarchyRole: type === "ENTRADA" ? "PAI" : form.hierarchyRole, originProductIds: type === "ENTRADA" ? [] : form.originProductIds }); }}><option value="PRODUTO">Produto / Corte</option><option value="ENTRADA">Matéria-prima</option></select></Field></div>
      {form.type === "PRODUTO" && <div className="form-grid form-grid--2"><Field label="Posição no grupo de produto"><select value={form.hierarchyRole} onChange={(event) => { const hierarchyRole = event.target.value as ProductForm["hierarchyRole"]; setForm((current) => ({ ...current, hierarchyRole, originProductIds: hierarchyRole === "PAI" ? [] : current.originProductIds })); }}><option value="PAI">Produto pai (inicia o grupo)</option><option value="FILHO">Produto filho (sai de outro produto)</option></select></Field><Field label="Classificação"><div className="calculated-value">{form.hierarchyRole === "PAI" ? "Grupo principal / nível 0" : "Ramificação do grupo"}</div></Field></div>}
      <div className="erp-product-link-field">
        <Field label="Produto vinculado no ERP (opcional)">
          <input value={erpSearch} onChange={(event) => { setErpSearch(event.target.value); setForm((current) => ({ ...current, erpProductSeq: null })); }} placeholder="Pesquise pelo SEQPRODUTO ou descrição" />
        </Field>
        {form.erpProductSeq && <div className="erp-product-selected"><strong>SEQPRODUTO {form.erpProductSeq}</strong><span>{erpSearch.split(" - ").slice(1).join(" - ")}</span><button type="button" onClick={() => { setForm((current) => ({ ...current, erpProductSeq: null })); setErpSearch(""); }}>Remover vínculo</button></div>}
        {!form.erpProductSeq && (loadingErp || erpSearch.trim()) && <div className="erp-product-results">{loadingErp ? <small>Buscando produtos...</small> : erpOptions.slice(0, 8).map((item) => <button type="button" key={item.seqProduct} onClick={() => { setForm((current) => ({ ...current, erpProductSeq: item.seqProduct })); setErpSearch(`${item.seqProduct} - ${item.description}`); }}><span><strong>{item.seqProduct}</strong>{item.description}</span><small>{item.yieldTarget == null || item.yieldTarget <= 0 ? "Sem meta cadastrada" : `Meta: ${(Math.abs(item.yieldTarget) <= 1 ? item.yieldTarget * 100 : item.yieldTarget).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</small></button>)}</div>}
      </div>
      {form.type === "PRODUTO" && form.hierarchyRole === "FILHO" && <div className="checkbox-section product-origins"><span>Pode sair de <small>Marque uma ou mais origens dentro do mesmo grupo principal.</small></span><label className="product-origin-search"><Search size={16} /><input aria-label="Filtrar produto de origem" value={originSearch} onChange={(event) => setOriginSearch(event.target.value)} placeholder="Filtrar pelo nome do produto" /></label><div className="checkbox-grid">{visibleOriginCandidates.map((item) => { const itemRootGroups = rootGroupsFor(item.id); const incompatibleGroup = Boolean(form.originProductIds.length && !form.originProductIds.includes(item.id) && selectedRootGroups && ![...selectedRootGroups].some((id) => itemRootGroups.has(id))); return <label className={incompatibleGroup ? "disabled" : ""} key={item.id}><input aria-label={`Origem ${item.name}`} type="checkbox" disabled={incompatibleGroup} checked={form.originProductIds.includes(item.id)} onChange={() => toggleOrigin(item.id)} /><span><strong>{item.name}</strong><small>Grupo principal · nível {item.level} · ID {item.id}</small></span></label>; })}</div>{visibleOriginCandidates.length === 0 && <div className="product-origin-empty">Nenhum produto encontrado para “{originSearch.trim()}”.</div>}</div>}
      <div className="checkbox-section"><span>Descartes aplicáveis</span><div className="checkbox-grid">{discardTypes.map((item) => <label key={item.id}><input aria-label={`Aplicar ${item.name}`} type="checkbox" checked={form.applicableDiscardIds.includes(item.id)} onChange={() => toggleDiscard(item.id)} /><span><strong>{item.name}</strong><small>ID {item.id}</small></span></label>)}</div></div>
      <label className="switch-field"><input aria-label="Produto ativo" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span /><div><strong>Produto ativo</strong><small>Disponível para novos testes</small></div></label>
    </Modal>
    <ConfirmDialog open={pendingToggle !== null} title="Inativar produto / corte?" description={pendingToggle ? `${pendingToggle.name} deixará de aparecer em novos testes, mas os testes já registrados serão preservados.` : ""} confirmLabel="Inativar produto" danger onCancel={() => setPendingToggle(null)} onConfirm={async () => { if (pendingToggle) await setActive(pendingToggle); setPendingToggle(null); }} />
    <ConfirmDialog open={confirmCleanup} title="Limpar produtos e cortes inativos?" description="Os cadastros inativos sem uso serão apagados definitivamente. Produtos vinculados a testes, faixas de peso ou outros produtos serão preservados por segurança." confirmLabel="Apagar inativos" danger onCancel={() => setConfirmCleanup(false)} onConfirm={async () => { setConfirmCleanup(false); await clearInactive(); }} />
  </>;
}
