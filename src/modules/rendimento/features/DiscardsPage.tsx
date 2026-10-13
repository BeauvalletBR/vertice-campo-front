"use client";

import { useState } from "react";
import { CirclePlus, Pencil, Power, PowerOff } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button, Field, Modal } from "../components/ui";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { catalogService } from "../services/catalogService";
import type { DiscardType } from "../types/domain";

type DiscardForm = Pick<DiscardType, "name" | "description" | "order" | "active"> & { id?: string; version?: number };
const blank: DiscardForm = { name: "", description: "", order: 1, active: true };

export function DiscardsPage() {
  const { discardTypes: items, refreshCatalogs } = useRendimentoData();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DiscardForm>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingToggle, setPendingToggle] = useState<DiscardType | null>(null);

  const openEdit = (item?: DiscardType) => {
    setError("");
    setForm(item
      ? { id: item.id, version: item.version, name: item.name, description: item.description, order: item.order, active: item.active }
      : { ...blank, order: items.length + 1 });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await catalogService.saveDiscard(form);
      await refreshCatalogs();
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o tipo de descarte.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: DiscardType) => {
    setError("");
    try {
      await catalogService.toggleDiscard(item);
      await refreshCatalogs();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível alterar o tipo de descarte.");
    }
  };
  const requestToggle = (item: DiscardType) => {
    if (item.active) setPendingToggle(item);
    else void toggle(item);
  };

  return <>
    <PageHeader eyebrow="Cadastros" title="Tipos de Descarte" description="Mantenha os tipos de retirada disponíveis nas etapas dos testes." actions={<Button onClick={() => openEdit()}><CirclePlus size={17} /> Novo tipo de descarte</Button>} />
    {error && <div className="inline-message">{error}</div>}
    <section className="table-panel">
      <header className="table-title"><div><span>Tipos cadastrados</span><small>{items.length} registros · {items.filter((item) => item.active).length} ativos</small></div></header>
      <div className="responsive-table"><table><thead><tr><th>Ordem</th><th>ID</th><th>Nome</th><th>Descrição</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.id}><td><span className="order-chip">{String(item.order).padStart(2, "0")}</span></td><td><strong>{item.id}</strong></td><td><strong>{item.name}</strong></td><td>{item.description || "—"}</td><td><span className={`simple-status ${item.active ? "active" : ""}`}>{item.active ? "Ativo" : "Inativo"}</span></td><td><div className="row-actions"><button className="icon-button" title="Editar" onClick={() => openEdit(item)}><Pencil size={16} /></button><button className="icon-button" title={item.active ? "Desativar" : "Ativar"} onClick={() => requestToggle(item)}>{item.active ? <PowerOff size={16} /> : <Power size={16} />}</button></div></td></tr>)}
      </tbody></table></div>
    </section>
    <Modal open={modalOpen} title={form.id ? "Editar tipo de descarte" : "Novo tipo de descarte"} subtitle="O tipo ficará disponível para associação aos produtos." onClose={() => !saving && setModalOpen(false)} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={() => void save()}>{saving ? "Salvando..." : "Salvar tipo"}</Button></>}>
      <div className="form-grid form-grid--2"><Field label="Nome"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Apara" /></Field><Field label="Ordem"><input type="number" min="1" value={form.order} onChange={(event) => setForm({ ...form, order: Number(event.target.value) })} /></Field></div>
      <Field label="Descrição"><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Descreva quando este descarte é utilizado." /></Field>
      <label className="switch-field"><input aria-label="Tipo de descarte ativo" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span /><div><strong>Tipo ativo</strong><small>Disponível para uso nos produtos</small></div></label>
    </Modal>
    <ConfirmDialog open={pendingToggle !== null} title="Inativar tipo de descarte?" description={pendingToggle ? `${pendingToggle.name} deixará de aparecer para novos lançamentos, sem alterar testes já registrados.` : ""} confirmLabel="Inativar descarte" danger onCancel={() => setPendingToggle(null)} onConfirm={async () => { if (pendingToggle) await toggle(pendingToggle); setPendingToggle(null); }} />
  </>;
}
