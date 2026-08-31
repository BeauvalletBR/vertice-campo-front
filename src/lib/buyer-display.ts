import type { ApiUsuario } from "@/services/api";
import type { EscalaLinha } from "@/types/escala";
import { toNumber } from "@/lib/escala-planning";

export type BuyerDirectory = Map<number, string>;

const normalizeBuyerText = (value: unknown) => String(value ?? "").trim();

const isNumericBuyerText = (value: string) => /^\d+$/.test(value);

const resolveSnapshotBuyerText = (
  value: unknown,
  buyerDirectory: BuyerDirectory,
) => {
  const text = normalizeBuyerText(value);
  if (!text) return "";

  if (isNumericBuyerText(text)) {
    const mapped = getBuyerNameById(buyerDirectory, Number(text));
    return mapped || "";
  }

  return text;
};

export const getBuyerDisplayName = (user: ApiUsuario) =>
  normalizeBuyerText(
    user.NOME ||
      user.NOMEUSUARIO ||
      user.NOME_USUARIO ||
      user.USUARIO_NOME ||
      user.DESCRICAO ||
      user.DESCUSUARIO ||
      user.CODUSUARIO,
  );

export const buildBuyerDirectory = (users: ApiUsuario[]): BuyerDirectory => {
  const directory: BuyerDirectory = new Map();

  for (const user of users) {
    const id = Number(user.SEQUSUARIO);
    const name = getBuyerDisplayName(user);

    if (Number.isFinite(id) && id > 0 && name) {
      directory.set(id, name);
    }
  }

  return directory;
};

export const getBuyerNameById = (
  buyerDirectory: BuyerDirectory,
  id: unknown,
) => {
  const parsed = Number(id);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return buyerDirectory.get(parsed) || "";
};

export const findBuyerUserBySearch = (
  users: ApiUsuario[],
  search: string,
) => {
  const normalized = normalizeBuyerText(search).toUpperCase();
  if (!normalized) return null;

  return (
    users.find((user) => {
      const code = normalizeBuyerText(user.CODUSUARIO).toUpperCase();
      const displayName = getBuyerDisplayName(user).toUpperCase();
      return (
        code === normalized ||
        displayName === normalized ||
        String(user.SEQUSUARIO) === normalized
      );
    }) || null
  );
};

export const resolvePlanningBuyerName = (
  row: EscalaLinha,
  buyerDirectory: BuyerDirectory,
) => {
  const erpBuyerId = toNumber(row.SEQCOMPRADOR_ERP);
  const scaleBuyerId = toNumber(row.ID_COMPRADOR_ESCALA);

  const buyerFromErpId =
    erpBuyerId > 1 ? getBuyerNameById(buyerDirectory, erpBuyerId) : "";
  const buyerFromScaleId =
    scaleBuyerId > 0 ? getBuyerNameById(buyerDirectory, scaleBuyerId) : "";

  const buyerFromErpText = resolveSnapshotBuyerText(
    row.COMPRADOR_ERP,
    buyerDirectory,
  );
  const buyerFromScaleText = resolveSnapshotBuyerText(
    row.COMPRADOR_ESCALA,
    buyerDirectory,
  );
  const buyerFromDisplayText = resolveSnapshotBuyerText(
    row.COMPRADOR_EXIBICAO,
    buyerDirectory,
  );
  const buyerFromGenericText = resolveSnapshotBuyerText(
    row.COMPRADOR,
    buyerDirectory,
  );

  if (row.ORIGEM_REGISTRO === "ERP") {
    if (erpBuyerId > 1) {
      return (
        buyerFromErpId ||
        buyerFromErpText ||
        buyerFromScaleId ||
        buyerFromScaleText ||
        buyerFromDisplayText ||
        buyerFromGenericText
      );
    }

    return (
      buyerFromScaleId ||
      buyerFromScaleText ||
      buyerFromDisplayText ||
      buyerFromErpText ||
      buyerFromGenericText
    );
  }

  return (
    buyerFromScaleId ||
    buyerFromScaleText ||
    buyerFromDisplayText ||
    buyerFromErpId ||
    buyerFromErpText ||
    buyerFromGenericText
  );
};

export const shouldWarnMissingPlanningBuyer = (
  row: EscalaLinha,
  _buyerDirectory: BuyerDirectory,
) =>
  row.ORIGEM_REGISTRO === "ERP" &&
  toNumber(row.SEQCOMPRADOR_ERP) <= 1 &&
  toNumber(row.ID_COMPRADOR_ESCALA) <= 0 &&
  !normalizeBuyerText(row.COMPRADOR_ESCALA);
