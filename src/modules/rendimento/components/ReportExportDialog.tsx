import { FileDown, FileSpreadsheet } from "lucide-react";
import type { Product, YieldTest } from "../types/domain";
import { exportFinalizedTestReport } from "../utils/testReport";
import { exportTraceabilityExcel } from "../utils/traceabilityReport";
import { Button, Modal } from "./ui";

export function ReportExportDialog({
  open,
  test,
  products,
  onClose,
}: {
  open: boolean;
  test?: YieldTest;
  products: Product[];
  onClose: () => void;
}) {
  if (!test) return null;
  const runExport = async (format: "pdf" | "excel") => {
    if (format === "pdf") await exportFinalizedTestReport(test, products);
    else await exportTraceabilityExcel(test, products);
    onClose();
  };

  return <Modal
    open={open}
    title="Exportar relatório"
    subtitle={`Teste ${test.number} · escolha o formato do arquivo.`}
    onClose={onClose}
    footer={<Button variant="ghost" onClick={onClose}>Cancelar</Button>}
  >
    <div className="report-format-options">
      <button type="button" onClick={() => void runExport("pdf")}>
        <span><FileDown size={24} /></span>
        <div><strong>Relatório em PDF</strong><small>Documento pronto para visualizar, imprimir ou compartilhar.</small></div>
        <b>PDF</b>
      </button>
      <button type="button" disabled={test.executionMode !== "traceable"} onClick={() => void runExport("excel")}>
        <span><FileSpreadsheet size={24} /></span>
        <div><strong>Relatório em Excel</strong><small>{test.executionMode === "traceable" ? "Matriz por peça com produtos, ramificações e descartes." : "Disponível para testes rastreáveis por peça."}</small></div>
        <b>XLSX</b>
      </button>
    </div>
  </Modal>;
}
