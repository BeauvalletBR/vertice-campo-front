import { Box, Layers3, Package, Percent, Settings2, Target, Trash2, Weight } from "lucide-react";
import type { ReactNode } from "react";

import type { Product, TestFlow } from "../types/domain";
import { calculateTotalDiscard } from "../utils/calculations";
import { formatPercent, formatWeight } from "../utils/format";

interface ResultFlowTreeProps {
  flow: TestFlow;
  flowIndex: number;
  products: Product[];
}

export function ResultFlowTree({ flow, flowIndex, products }: ResultFlowTreeProps) {
  const productName = (id?: string) =>
    products.find((product) => product.id === id)?.name || "Produto";
  const hasTreeRelations = flow.steps.some((step) => Boolean(step.parentStepId));
  const steps = hasTreeRelations
    ? flow.steps
    : flow.steps.map((step, index) => ({
        ...step,
        parentStepId: index > 0 ? flow.steps[index - 1].id : null,
      }));
  const childrenOf = (parentId: string | null) => steps
    .filter((step) => step.parentStepId === parentId)
    .sort((a, b) => a.branchOrder - b.branchOrder);
  const leaves = steps.filter((step) => childrenOf(step.id).length === 0).length;

  const renderLevel = (parentId: string | null): ReactNode => {
    const siblings = childrenOf(parentId);
    if (!siblings.length) return null;
    return <div className={`result-tree-level ${parentId ? "result-tree-level--children" : ""}`}>
      {siblings.map((step) => {
        const children = childrenOf(step.id);
        const finalProduct = children.length === 0;
        const initialProduct = !step.parentStepId;
        const discards = step.discards.filter((discard) => discard.weightKg > 0);
        const totalDiscard = calculateTotalDiscard(discards);
        return <div className="result-tree-branch" key={step.id}>
          <article className={`result-tree-node ${finalProduct ? "is-leaf" : ""}`}>
            <div className="result-tree-node__main">
              <header>
                <span className="result-tree-node__icon">{finalProduct ? <Box size={22} /> : initialProduct ? <Package size={22} /> : <Settings2 size={22} />}</span>
                <div>
                  <small>{initialProduct ? "Produto inicial" : finalProduct ? "Produto final" : "Transformação"}</small>
                  <strong>{productName(step.productId)}</strong>
                </div>
              </header>
              <div className="result-tree-metrics">
                <div><Weight size={18} /><p><span>Peso inicial</span><strong>{formatWeight(step.initialWeightKg)}</strong></p></div>
                <div><Weight size={18} /><p><span>Peso líquido</span><strong>{formatWeight(step.cleanWeightKg)}</strong></p></div>
                <div><Percent size={18} /><p><span>Rend. etapa</span><strong>{formatPercent(step.yieldPercent)}</strong></p></div>
                <div><Target size={18} /><p><span>Sobre entrada</span><strong>{formatPercent(step.outputInputYieldPercent)}</strong></p></div>
              </div>
            </div>
            {discards.length > 0 && <div className="result-tree-discards">
              <Trash2 size={17} />
              <div>{discards.map((discard) => <span key={discard.id}>{discard.name}<b>− {formatWeight(discard.weightKg)}</b></span>)}</div>
              <span className="total">Total retirado<b>− {formatWeight(totalDiscard)}</b></span>
            </div>}
          </article>
          {renderLevel(step.id)}
        </div>;
      })}
    </div>;
  };

  return <article className="result-flow-tree">
    <header>
      <div><span>Fluxo {flowIndex + 1}</span><h3>{productName(flow.rootProductId)}</h3></div>
      <strong><Layers3 size={15} />{steps.length} produtos · {leaves} {leaves === 1 ? "saída final" : "saídas finais"}</strong>
    </header>
    <div className="result-tree-scroll"><div className="result-tree-canvas">{renderLevel(null)}</div></div>
  </article>;
}
