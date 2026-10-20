import type { DiscardType, Product, WeightBand } from "../types/domain";
import { rendimentoApi } from "./rendimentoApi";

export const catalogService = {
  async listProducts() {
    const { products } = await rendimentoApi.catalogs();
    return products.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  },
  async listDiscardTypes() {
    const { discardTypes } = await rendimentoApi.catalogs();
    return discardTypes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  },
  async saveProduct(input: Partial<Product> & Pick<Product, "name" | "type">) {
    await rendimentoApi.saveProduct(input);
  },
  async deleteInactiveProducts() {
    return rendimentoApi.deleteInactiveProducts();
  },
  async searchErpProducts(search = "") {
    return rendimentoApi.searchErpProducts(search);
  },
  async saveDiscard(input: Partial<DiscardType> & Pick<DiscardType, "name">) {
    await rendimentoApi.saveDiscard(input);
  },
  async toggleDiscard(item: DiscardType) {
    await rendimentoApi.saveDiscard({ ...item, active: !item.active });
  },
  async deleteInactiveDiscards() {
    return rendimentoApi.deleteInactiveDiscards();
  },
  async saveWeightBand(input: Partial<WeightBand> & Pick<WeightBand, "name" | "productReferenceId">) {
    await rendimentoApi.saveWeightBand(input);
  },
};
