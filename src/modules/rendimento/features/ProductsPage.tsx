"use client";

import { useState } from "react";
import { Boxes, ChevronDown, ChevronRight, CirclePlus, Pencil, Power, PowerOff } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button, Field, Modal } from "../components/ui";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { catalogService } from "../services/catalogService";
import type { Product, ProductType } from "../types/domain";

interface ProductForm { id?: string; version?: number; name: string; type: ProductType; originProductIds: string[]; active: boolean; applicableDiscardIds: string[] }
const blankForm: ProductForm = { name: "", type: "PRODUTO", originProductIds: [], active: true, applicableDiscardIds: [] };

export function ProductsPage() {
  const { products: catalogProducts, discardTypes: catalogDiscards, refreshCatalogs } = useRendimentoData();
  const [typeFilter, setTypeFilter] = useState<"TODOS" | ProductType>("TODOS");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingToggle, setPendingToggle] = useState<Product | null>(null);
  const products = [...catalogProducts].sort((a, b) => {
    const typeOrder = (a.type === "ENTRADA" ? 0 : 1) - (b.type === "ENTRADA" ? 0 : 1);
    return typeOrder || a.name.localeCompare(b.name, "pt-BR");
  });
  const discardTypes = catalogDiscards.filter((item) => item.active);

  const openEdit = (product?: Product) => {
    setError("");
    setForm(product
      ? { id: product.id, version: product.version, name: product.name, type: product.type, originProductIds: product.originProductIds, active: product.active, applicableDiscardIds: product.applicableDiscardIds }
      : { ...blankForm });
    setModalOpen(true);
  };
  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true); setError("");
    try {
      await catalogService.saveProduct({ ...form, parentId: form.type === "ENTRADA" ? null : form.originProductIds[0] || null, originProductIds: form.type === "ENTRADA" ? [] : form.originProductIds });
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
  const descendantIds = (id?: string) => {
    const result = new Set<string>();
    const visit = (parentId: string) => products.filter((item) => item.originProductIds.includes(parentId) || item.parentId === parentId).forEach((item) => { if (result.has(item.id)) return; result.add(item.id); visit(item.id); });
    if (id) visit(id);
    return result;
  };
  const selectedOriginLevel = products.find((item) => item.id === form.originProductIds[0])?.level;
  const originCandidates = products.filter((item) => item.id !== form.id && item.type === "PRODUTO" && item.active && !descendantIds(form.id).has(item.id));

  const renderNode = (product: Product) => {
    const children = products.filter((item) => item.parentId === product.id);
    const isOpen = expanded.has(product.id);
    return <div className="tree-node" key={product.id}><div className={`tree-row ${!product.active ? "inactive" : ""}`}>
      <button className="tree-toggle" disabled={!children.length} onClick={() => toggle(product.id)}>{children.length ? isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} /> : <span />}</button>
      <span className="tree-icon"><Boxes size={17} /></span><div className="tree-name"><strong>{product.name}</strong><small>ID {product.id} · {product.type === "ENTRADA" ? "Matéria-prima" : `Nível ${product.level}`}</small></div>
      <div className="tree-discards">
        {product.originProductIds.length > 0 ? product.originProductIds.slice(0, 2).map((id) => <span key={`origin-${id}`}>Sai de: {products.find((item) => item.id === id)?.name}</span>) : <span>Produto raiz</span>}
        {product.originProductIds.length > 2 && <span>+{product.originProductIds.length - 2} origens</span>}
        {product.applicableDiscardIds.map((id) => <span className="discard" key={`discard-${id}`}>{catalogDiscards.find((item) => item.id === id)?.name}</span>)}
      </div>
      <span className={`simple-status ${product.active ? "active" : ""}`}>{product.active ? "Ativo" : "Inativo"}</span>
      <div className="row-actions"><button className="icon-button" title="Editar" onClick={() => openEdit(product)}><Pencil size={16} /></button><button className="icon-button" title={product.active ? "Desativar" : "Ativar"} onClick={() => requestActiveChange(product)}>{product.active ? <PowerOff size={16} /> : <Power size={16} />}</button></div>
    </div>{isOpen && children.length > 0 && <div className="tree-children">{children.map(renderNode)}</div>}</div>;
  };

  return <>
    <PageHeader eyebrow="Cadastros" title="Produtos / Cortes" description="Organize os produtos, suas possíveis origens e os descartes aplicáveis." actions={<Button onClick={() => openEdit()}><CirclePlus size={17} /> Novo produto</Button>} />
    {error && <div className="inline-message">{error}</div>}
    <section className="tree-panel"><header><div><span>Hierarquia de produtos</span><small>{products.length} itens cadastrados · matérias-primas primeiro · produtos irmãos podem ocupar o mesmo nível</small></div><div className="tree-tools"><div className="catalog-type-filters" aria-label="Filtrar cadastro por tipo"><button className={typeFilter === "TODOS" ? "active" : ""} onClick={() => setTypeFilter("TODOS")}>Todos <span>{products.length}</span></button><button className={typeFilter === "ENTRADA" ? "active" : ""} onClick={() => setTypeFilter("ENTRADA")}>Matérias-primas <span>{products.filter((item) => item.type === "ENTRADA").length}</span></button><button className={typeFilter === "PRODUTO" ? "active" : ""} onClick={() => setTypeFilter("PRODUTO")}>Produtos / Cortes <span>{products.filter((item) => item.type === "PRODUTO").length}</span></button></div><div className="tree-legend"><span><i className="active" /> Ativo</span><span><i /> Inativo</span></div></div></header><div className="product-tree">{products.filter((item) => item.parentId === null && (typeFilter === "TODOS" || item.type === typeFilter)).map(renderNode)}</div></section>
    <Modal open={modalOpen} title={form.id ? "Editar produto / corte" : "Novo produto / corte"} subtitle="Defina uma ou mais origens do mesmo nível e os descartes mais comuns." onClose={() => !saving && setModalOpen(false)} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={() => void save()}>{saving ? "Salvando..." : "Salvar produto"}</Button></>}>
      <div className="form-grid form-grid--2"><Field label="Nome"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="CONTRA FILÉ MI" /></Field><Field label="Tipo"><select value={form.type} onChange={(event) => { const type = event.target.value as ProductType; setForm({ ...form, type, originProductIds: type === "ENTRADA" ? [] : form.originProductIds }); }}><option value="PRODUTO">Produto / Corte</option><option value="ENTRADA">Matéria-prima</option></select></Field></div>
      {form.type === "PRODUTO" && <div className="checkbox-section product-origins"><span>Pode sair de <small>Marque uma ou mais origens do mesmo nível. Sem marcação, será um produto raiz.</small></span><div className="checkbox-grid">{originCandidates.map((item) => { const incompatibleLevel = selectedOriginLevel !== undefined && item.level !== selectedOriginLevel && !form.originProductIds.includes(item.id); return <label className={incompatibleLevel ? "disabled" : ""} key={item.id}><input aria-label={`Origem ${item.name}`} type="checkbox" disabled={incompatibleLevel} checked={form.originProductIds.includes(item.id)} onChange={() => toggleOrigin(item.id)} /><span><strong>{item.name}</strong><small>Nível {item.level} · ID {item.id}</small></span></label>; })}</div></div>}
      <div className="checkbox-section"><span>Descartes aplicáveis</span><div className="checkbox-grid">{discardTypes.map((item) => <label key={item.id}><input aria-label={`Aplicar ${item.name}`} type="checkbox" checked={form.applicableDiscardIds.includes(item.id)} onChange={() => toggleDiscard(item.id)} /><span><strong>{item.name}</strong><small>ID {item.id}</small></span></label>)}</div></div>
      <label className="switch-field"><input aria-label="Produto ativo" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span /><div><strong>Produto ativo</strong><small>Disponível para novos testes</small></div></label>
    </Modal>
    <ConfirmDialog open={pendingToggle !== null} title="Inativar produto / corte?" description={pendingToggle ? `${pendingToggle.name} deixará de aparecer em novos testes, mas os testes já registrados serão preservados.` : ""} confirmLabel="Inativar produto" danger onCancel={() => setPendingToggle(null)} onConfirm={async () => { if (pendingToggle) await setActive(pendingToggle); setPendingToggle(null); }} />
  </>;
}
