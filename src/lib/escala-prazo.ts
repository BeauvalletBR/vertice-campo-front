import type {
  EscalaLinha,
  EscalaPedidoErp,
  PrazoPagamento,
} from "@/types/escala";

type PaymentTermSource = Pick<
  EscalaLinha | EscalaPedidoErp,
  "CODCONDPAGTO"
> &
  Partial<Pick<EscalaLinha, "ORIGEM_REGISTRO" | "PRAZO_DIAS">>;

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const createPaymentTermMap = (
  paymentTerms: PrazoPagamento[],
): Map<number, PrazoPagamento> => {
  const map = new Map<number, PrazoPagamento>();

  for (const item of paymentTerms) {
    const code = toFiniteNumberOrNull(item.CODCONDPAGTO);
    const prazo = toFiniteNumberOrNull(item.PRAZO);
    if (code === null || prazo === null) continue;

    map.set(code, {
      ...item,
      CODCONDPAGTO: code,
      PRAZO: prazo,
    });
  }

  return map;
};

export const getMappedPaymentTerm = (
  source: PaymentTermSource,
  paymentTermsByCode: ReadonlyMap<number, PrazoPagamento>,
): PrazoPagamento | null => {
  const code = toFiniteNumberOrNull(source.CODCONDPAGTO);
  return code === null ? null : paymentTermsByCode.get(code) ?? null;
};

export const getEffectivePaymentTermDays = (
  source: PaymentTermSource,
  paymentTermsByCode: ReadonlyMap<number, PrazoPagamento>,
): number | null => {
  if (source.ORIGEM_REGISTRO === "MANUAL") {
    return toFiniteNumberOrNull(source.PRAZO_DIAS);
  }

  const mappedPrazo = getMappedPaymentTerm(source, paymentTermsByCode)?.PRAZO;
  if (mappedPrazo !== null && mappedPrazo !== undefined) {
    return Number(mappedPrazo);
  }

  return toFiniteNumberOrNull(source.PRAZO_DIAS);
};
