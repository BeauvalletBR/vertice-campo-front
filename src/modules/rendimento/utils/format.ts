export const formatWeight = (value: number) =>
  `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value || 0)} kg`;

export const formatPercent = (value: number) =>
  `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0)}%`;

export const formatDate = (value?: string) => {
  if (!value) return "—";
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
};

export const formatDateTime = (value?: string) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
};

export const parseDecimal = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const sanitizeWeightInput = (value: string) => {
  const clean = value.replace(/[^\d.,]/g, "");
  const separator = Math.max(clean.lastIndexOf(","), clean.lastIndexOf("."));
  if (separator < 0) return clean.replace(/\D/g, "");
  const integer = clean.slice(0, separator).replace(/\D/g, "") || "0";
  const decimals = clean.slice(separator + 1).replace(/\D/g, "").slice(0, 3);
  return `${integer},${decimals}`;
};

export const toInputDecimal = (value: number, showZero = false) => {
  if (!Number.isFinite(value) || (!showZero && value === 0)) return "";
  return value.toFixed(3).replace(".", ",");
};
