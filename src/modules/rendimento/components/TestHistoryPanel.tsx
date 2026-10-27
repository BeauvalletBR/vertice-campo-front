import { useEffect, useState } from "react";
import { CalendarDays, Filter, History, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { testService } from "../services/testService";
import type { TestHistoryAction, TestHistoryEntry } from "../types/domain";
import { formatDateTime } from "../utils/format";
import { EmptyState } from "./ui";

const actionLabels: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Edição",
  STATUS: "Mudança de status",
  DELETE: "Exclusão",
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

const testNumber = (entry: TestHistoryEntry) => {
  const match = entry.change.match(/Teste(?: inativo)?\s+(\d+)/i);
  return match?.[1] || entry.testId;
};

export function TestHistoryPanel() {
  const [entries, setEntries] = useState<TestHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<TestHistoryAction | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await testService.history(500));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredEntries = entries.filter((entry) => {
    if (action && entry.action !== action) return false;
    const entryDate = entry.occurredAt.slice(0, 10);
    if (startDate && entryDate < startDate) return false;
    if (endDate && entryDate > endDate) return false;
    const term = normalize(search.trim());
    if (!term) return true;
    return normalize([entry.change, entry.detail, entry.userName, entry.userId, entry.testId, testNumber(entry), actionLabels[entry.action] || entry.action].join(" ")).includes(term);
  });

  return <section className="table-panel test-history-panel">
    <header className="test-history-heading">
      <div><span><History size={18} /></span><div><strong>Histórico dos testes de rendimento</strong><small>Registro de criações, edições, alterações de status e exclusões.</small></div></div>
      <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Atualizar</button>
    </header>
    <div className="test-history-filters">
      <label className="search-box"><Search size={17} /><input aria-label="Pesquisar histórico" placeholder="Buscar motivo, alteração, teste ou usuário..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="select-filter"><Filter size={15} /><select aria-label="Filtrar motivo da alteração" value={action} onChange={(event) => setAction(event.target.value)}><option value="">Todos os motivos</option><option value="INSERT">Criação</option><option value="UPDATE">Edição</option><option value="STATUS">Mudança de status</option><option value="DELETE">Exclusão</option></select></label>
      <label className="history-date-filter"><CalendarDays size={15} /><span>De</span><input aria-label="Histórico a partir de" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label className="history-date-filter"><span>Até</span><input aria-label="Histórico até" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
    </div>
    {error && <div className="inline-message">{error}</div>}
    {loading ? <div className="history-loading"><RefreshCw size={20} className="spin" /> Buscando histórico...</div> : !filteredEntries.length ? <EmptyState title="Nenhuma alteração encontrada" description="Ajuste os filtros ou aguarde novas movimentações nos testes." /> : <div className="responsive-table"><table className="history-table"><thead><tr><th>Data e hora</th><th>Motivo</th><th>Teste</th><th>Usuário</th><th>Alteração registrada</th></tr></thead><tbody>{filteredEntries.map((entry) => <tr className={entry.action === "DELETE" ? "history-row--delete" : ""} key={entry.id}><td><strong>{formatDateTime(entry.occurredAt)}</strong><small>Empresa {entry.company}</small></td><td><span className={`history-action history-action--${entry.action.toLowerCase()}`}>{actionLabels[entry.action] || entry.action}</span></td><td><strong>Teste {testNumber(entry)}</strong><small>ID {entry.testId}</small></td><td><strong>{entry.userName}</strong><small>{entry.userId ? `Usuário ${entry.userId}` : "ID não informado"}</small></td><td className="history-change"><ShieldCheck size={16} /><span>{entry.change || entry.detail || "Alteração sem descrição."}</span></td></tr>)}</tbody></table></div>}
  </section>;
}
