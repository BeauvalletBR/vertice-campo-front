"use client";

import { useState } from "react";
import { CirclePlus, Pencil, Power, PowerOff, Ruler, Search } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { Button, Field, Modal } from "../components/ui";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { catalogService } from "../services/catalogService";
import type { WeightBand } from "../types/domain";
import { formatWeight, parseDecimal, toInputDecimal } from "../utils/format";

type BandForm = {
  id?: string;
  version?: number;
  productReferenceId: string;
  name: string;
  minWeight: string;
  maxWeight: string;
  color: string;
  order: number;
  active: boolean;
};

const blank: BandForm = { productReferenceId: "", name: "", minWeight: "0,000", maxWeight: "", color: "#173D6E", order: 1, active: true };

export function WeightBandsPage() {
  const { products, weightBands, refreshWeightBands } = useRendimentoData();
  const [form, setForm] = useState<BandForm>(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pendingToggle, setPendingToggle] = useState<WeightBand | null>(null);
  const referenceProducts = products.filter((product) => product.active);
  const normalizedSearch = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
  const filteredBands = weightBands.filter((band) => !normalizedSearch || `${band.name} ${band.productReferenceName}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR").includes(normalizedSearch));

  const edit = (band?: WeightBand) => {
    setError("");
    setForm(band ? {
      id: band.id,
      version: band.version,
      productReferenceId: band.productReferenceId,
      name: band.name,
      minWeight: toInputDecimal(band.minWeightKg),
      maxWeight: band.maxWeightKg == null ? "" : toInputDecimal(band.maxWeightKg),
      color: band.color,
      order: band.order,
      active: band.active,
    } : { ...blank, productReferenceId: referenceProducts[0]?.id || "", order: weightBands.length + 1 });
    setOpen(true);
  };

  const save = async (override?: WeightBand) => {
    const source = override ? {
      id: override.id, version: override.version, productReferenceId: override.productReferenceId,
      name: override.name, minWeight: String(override.minWeightKg), maxWeight: override.maxWeightKg == null ? "" : String(override.maxWeightKg),
      color: override.color, order: override.order, active: !override.active,
    } : form;
    if (!source.productReferenceId || !source.name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await catalogService.saveWeightBand({
        id: source.id,
        version: source.version,
        productReferenceId: source.productReferenceId,
        name: source.name.trim(),
        minWeightKg: parseDecimal(source.minWeight),
        maxWeightKg: source.maxWeight.trim() ? parseDecimal(source.maxWeight) : null,
        color: source.color,
        order: source.order,
        active: source.active,
      });
      await refreshWeightBands();
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a faixa de peso.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <PageHeader eyebrow="Cadastros" title="Faixas de Peso" description="Classifique automaticamente os testes pelo peso médio de cada peça da entrada ou do primeiro produto." actions={<Button onClick={() => edit()}><CirclePlus size={17} /> Nova faixa</Button>} />
    {error && <div className="inline-message">{error}</div>}
    <section className="weight-band-guide"><Ruler size={21} /><div><strong>Como a classificação funciona</strong><p>O peso total de referência é dividido pela quantidade de peças. Faixas do mesmo produto não podem se sobrepor; deixe o peso máximo vazio na última faixa.</p></div></section>
    <section className="table-panel">
      <header className="table-title weight-band-table-header"><div><span>Faixas configuradas</span><small>{filteredBands.length} de {weightBands.length} registros · {weightBands.filter((item) => item.active).length} ativos</small></div><label className="weight-band-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por faixa ou produto..." /></label></header>
      <div className="responsive-table"><table><thead><tr><th>Produto de referência</th><th>Faixa</th><th>Intervalo por peça</th><th>Ordem</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {filteredBands.map((band) => <tr key={band.id}><td><strong>{band.productReferenceName}</strong></td><td><span className="weight-band-name"><i style={{ background: band.color }} />{band.name}</span></td><td><strong>{formatWeight(band.minWeightKg)}</strong> até <strong>{band.maxWeightKg == null ? "sem limite" : formatWeight(band.maxWeightKg)}</strong></td><td><span className="order-chip">{String(band.order).padStart(2, "0")}</span></td><td><span className={`simple-status ${band.active ? "active" : ""}`}>{band.active ? "Ativa" : "Inativa"}</span></td><td><div className="row-actions"><button className="icon-button" title="Editar faixa" onClick={() => edit(band)}><Pencil size={16} /></button><button className="icon-button" title={band.active ? "Inativar faixa" : "Ativar faixa"} onClick={() => band.active ? setPendingToggle(band) : void save(band)}>{band.active ? <PowerOff size={16} /> : <Power size={16} />}</button></div></td></tr>)}
        {filteredBands.length === 0 && <tr><td colSpan={6}><div className="table-empty-search">Nenhuma faixa encontrada para “{search}”.</div></td></tr>}
      </tbody></table></div>
    </section>
    <Modal open={open} title={form.id ? "Editar faixa de peso" : "Nova faixa de peso"} subtitle="Os limites são avaliados pelo peso médio por peça." onClose={() => !saving && setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void save()}>{saving ? "Salvando..." : "Salvar faixa"}</Button></>}>
      <div className="form-grid form-grid--2"><Field label="Produto de referência"><select value={form.productReferenceId} onChange={(event) => setForm({ ...form, productReferenceId: event.target.value })}><option value="">Selecione</option>{referenceProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field><Field label="Nome da faixa"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Dianteiro leve" /></Field><Field label="Peso mínimo" hint="kg por peça"><input inputMode="decimal" value={form.minWeight} onChange={(event) => setForm({ ...form, minWeight: event.target.value })} /></Field><Field label="Peso máximo" hint="vazio = sem limite"><input inputMode="decimal" value={form.maxWeight} onChange={(event) => setForm({ ...form, maxWeight: event.target.value })} placeholder="Sem limite" /></Field><Field label="Cor"><input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value.toUpperCase() })} /></Field><Field label="Ordem"><input type="number" min="1" value={form.order} onChange={(event) => setForm({ ...form, order: Number(event.target.value) || 1 })} /></Field></div>
      <label className="switch-field"><input aria-label="Faixa ativa" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span /><div><strong>Faixa ativa</strong><small>Disponível para classificar novos testes</small></div></label>
    </Modal>
    <ConfirmDialog open={pendingToggle !== null} title="Inativar faixa de peso?" description={pendingToggle ? `${pendingToggle.name} deixará de classificar novos testes. O histórico já gravado será preservado.` : ""} confirmLabel="Inativar faixa" danger onCancel={() => setPendingToggle(null)} onConfirm={async () => { if (pendingToggle) await save(pendingToggle); setPendingToggle(null); }} />
  </>;
}
