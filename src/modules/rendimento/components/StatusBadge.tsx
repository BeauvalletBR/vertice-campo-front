import type { TestStatus } from "../types/domain";

const labels: Record<TestStatus, string> = { RASCUNHO: "Rascunho", ABERTO: "Aberto", EM_EXECUCAO: "Em andamento", FINALIZADO: "Finalizado", CANCELADO: "Cancelado" };

export function StatusBadge({ status }: { status: TestStatus }) {
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}><i />{labels[status]}</span>;
}
