export const LOCAL_USER = { id: "USUARIO_LOCAL", name: "Usuário Local" } as const;

export type ProductType = "ENTRADA" | "PRODUTO";
export type TestStatus = "RASCUNHO" | "ABERTO" | "EM_EXECUCAO" | "FINALIZADO" | "CANCELADO";
export type FlowStatus = "PENDENTE" | "EM_EXECUCAO" | "FINALIZADO";
export type AuditAction = "INSERT" | "UPDATE" | "DELETE" | "FINALIZACAO" | "CANCELAMENTO" | "REABERTURA";

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

export interface TestDiscard {
  id: string;
  discardTypeId: string | null;
  name: string;
  weightKg: number;
  manual: boolean;
}

export interface TestStep {
  id: string;
  productId: string;
  initialWeightKg: number;
  discards: TestDiscard[];
  cleanWeightKg: number;
  yieldPercent: number;
  inputYieldPercent: number;
  outputInputYieldPercent: number;
  confirmed: boolean;
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
}

export interface TestFlowSetupInput {
  id?: string;
  rootProductId: string;
  productIds: string[];
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
  flows: TestFlowSetupInput[];
  status: "RASCUNHO" | "ABERTO" | "EM_EXECUCAO";
}
