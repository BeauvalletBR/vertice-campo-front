import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { rendimentoApi } from "../services/rendimentoApi";
import type { DiscardType, Product, YieldTest } from "../types/domain";

interface RendimentoDataValue {
  products: Product[];
  discardTypes: DiscardType[];
  tests: YieldTest[];
  loading: boolean;
  error: string;
  refreshCatalogs: () => Promise<void>;
  refreshTests: () => Promise<void>;
  refreshAll: () => Promise<void>;
  updateTest: (test: YieldTest) => void;
}

const RendimentoDataContext = createContext<RendimentoDataValue | null>(null);

const messageOf = (error: unknown) => error instanceof Error ? error.message : "Não foi possível carregar os dados do Teste rendimento.";

export function RendimentoDataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [discardTypes, setDiscardTypes] = useState<DiscardType[]>([]);
  const [tests, setTests] = useState<YieldTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshCatalogs = async () => {
    const catalogs = await rendimentoApi.catalogs();
    setProducts(catalogs.products.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "pt-BR")));
    setDiscardTypes(catalogs.discardTypes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR")));
  };

  const refreshTests = async () => {
    setTests(await rendimentoApi.listTests());
  };

  const updateTest = (test: YieldTest) => {
    setTests((current) => current.some((item) => item.id === test.id)
      ? current.map((item) => item.id === test.id ? test : item)
      : [test, ...current]);
  };

  const refreshAll = async () => {
    setError("");
    try {
      await Promise.all([refreshCatalogs(), refreshTests()]);
    } catch (loadError) {
      setError(messageOf(loadError));
      throw loadError;
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [catalogs, loadedTests] = await Promise.all([rendimentoApi.catalogs(), rendimentoApi.listTests()]);
        if (!active) return;
        setProducts(catalogs.products.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "pt-BR")));
        setDiscardTypes(catalogs.discardTypes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR")));
        setTests(loadedTests);
      } catch (loadError) {
        if (active) setError(messageOf(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  return <RendimentoDataContext.Provider value={{ products, discardTypes, tests, loading, error, refreshCatalogs, refreshTests, refreshAll, updateTest }}>
    {children}
  </RendimentoDataContext.Provider>;
}

export function useRendimentoData() {
  const context = useContext(RendimentoDataContext);
  if (!context) throw new Error("useRendimentoData deve ser usado dentro de RendimentoDataProvider.");
  return context;
}
