export const LOCAL_USER = {
  id: "USUARIO_LOCAL",
  name: "Usuário Local",
} as const;

export type ProductType = "ENTRADA" | "PRODUTO";
export type TestStatus =
  "RASCUNHO" | "ABERTO" | "EM_EXECUCAO" | "FINALIZADO" | "CANCELADO";
export type FlowStatus = "PENDENTE" | "EM_EXECUCAO" | "FINALIZADO";
export type ExecutionMode = "consolidated" | "traceable";
export type AuditAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "FINALIZACAO"
  | "CANCELAMENTO"
  | "REABERTURA";

export interface AuditFields {
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Product extends AuditFields {
  id: string;
  version: number;
  code: string;
  name: string;
  type: ProductType;
  parentId: string | null;
  originProductIds: string[];
  level: number;
  applicableDiscardIds: string[];
  active: boolean;
  erpProductSeq?: number | null;
  erpProductDescription?: string;
  erpYieldTarget?: number | null;
}

export interface ErpProduct {
  seqProduct: number;
  description: string;
  yieldTarget: number | null;
}

export interface DiscardType extends AuditFields {
  id: string;
  version: number;
  code: string;
  name: string;
  description: string;
  order: number;
  active: boolean;
}

export interface WeightBand extends AuditFields {
  id: string;
  version: number;
  productReferenceId: string;
  productReferenceName: string;
  name: string;
  minWeightKg: number;
  maxWeightKg: number | null;
  color: string;
  order: number;
  active: boolean;
}

export interface TestDiscard {
  id: string;
  discardTypeId: string | null;
  name: string;
  weightKg: number;
  pieceWeightsKg?: number[];
  manual: boolean;
}

export interface TraceableStepItem {
  inputPieceId: string;
  inputPieceOrder: number;
  initialWeightKg: number;
  discards: TestDiscard[];
  cleanWeightKg: number;
  confirmed: boolean;
}

export interface TestStep {
  id: string;
  parentStepId: string | null;
  branchOrder: number;
  productId: string;
  initialWeightKg: number;
  pieceWeightsKg?: number[];
  discards: TestDiscard[];
  cleanWeightKg: number;
  yieldPercent: number;
  inputYieldPercent: number;
  outputInputYieldPercent: number;
  confirmed: boolean;
  traceItems?: TraceableStepItem[];
}

export interface TestInputPiece {
  id: string;
  order: number;
  weightKg: number;
}

export interface TestFlow {
  id: string;
  rootProductId: string;
  productIds: string[];
  steps: TestStep[];
  currentStepIndex: number;
  status: FlowStatus;
  updatedAt: string;
}

export interface YieldTest extends AuditFields {
  id: string;
  version: number;
  number: number;
  name: string;
  date: string;
  inputProductId: string;
  inputQuantity: number;
  inputWeightKg: number;
  inputTotalWeightKg: number;
  inputWeightMode: "total" | "pieces";
  inputPieceWeightsKg?: number[];
  inputPieces?: TestInputPiece[];
  executionMode?: ExecutionMode;
  averageWeightKg: number;
  groupProductId: string;
  status: TestStatus;
  flows: TestFlow[];
  steps: TestStep[];
  currentStepIndex: number;
  startedBy?: string;
  startedAt?: string;
  finalizedBy?: string;
  finalizedAt?: string;
  reopenedAt?: string;
  weightBandId?: string;
  weightBandName?: string;
  bandReferenceWeightKg?: number;
  bandReferenceOrigin?: "ENTRADA" | "PRIMEIRO_PRODUTO";
}

export interface TestFlowSetupInput {
  id?: string;
  rootProductId: string;
  productIds: string[];
  nodes?: Array<{
    id: string;
    productId: string;
    parentNodeId: string | null;
    branchOrder: number;
  }>;
  firstStepWeightKg: number;
}

export interface AuditEvent {
  id: string;
  table: string;
  recordId: string;
  action: AuditAction;
  dataBefore: unknown;
  dataAfter: unknown;
  userId: string;
  date: string;
}

export interface DatabaseState {
  version: number;
  products: Product[];
  discardTypes: DiscardType[];
  tests: YieldTest[];
  auditEvents: AuditEvent[];
}

export interface TestSetupInput {
  id?: string;
  name: string;
  date: string;
  inputProductId: string;
  inputQuantity: number;
  inputWeightKg: number;
  inputTotalWeightKg: number;
  inputWeightMode: "total" | "pieces";
  inputPieceWeightsKg?: number[];
  executionMode?: ExecutionMode;
  flows: TestFlowSetupInput[];
  status: "RASCUNHO" | "ABERTO" | "EM_EXECUCAO";
}
