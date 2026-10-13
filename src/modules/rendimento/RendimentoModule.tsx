import { useLocation, useNavigate } from "react-router-dom";

import { DiscardsPage } from "./features/DiscardsPage";
import { ExecutionPage } from "./features/ExecutionPage";
import { NewTestPage } from "./features/NewTestPage";
import { ProductsPage } from "./features/ProductsPage";
import { TestDetailPage } from "./features/TestDetailPage";
import { TestsPage } from "./features/TestsPage";
import { RendimentoDataProvider, useRendimentoData } from "./context/RendimentoDataContext";
import type { NavigationTarget } from "./types/navigation";
import "./rendimento.css";

const BASE_PATH = "/rendimento";

const pathForTarget = (target: NavigationTarget) => {
  const id = target.id ? encodeURIComponent(target.id) : "";

  switch (target.route) {
    case "new-test":
      return id ? `${BASE_PATH}/testes/${id}/editar` : `${BASE_PATH}/testes/novo`;
    case "execute":
      return `${BASE_PATH}/testes/${id}/executar`;
    case "detail":
      return `${BASE_PATH}/testes/${id}`;
    case "products":
      return `${BASE_PATH}/cadastros/produtos`;
    case "discards":
      return `${BASE_PATH}/cadastros/descartes`;
    default:
      return `${BASE_PATH}/testes`;
  }
};

const targetFromPath = (pathname: string): NavigationTarget => {
  if (pathname === `${BASE_PATH}/cadastros/produtos`) return { route: "products" };
  if (pathname === `${BASE_PATH}/cadastros/descartes`) return { route: "discards" };
  if (pathname === `${BASE_PATH}/testes/novo`) return { route: "new-test" };

  const editMatch = pathname.match(/^\/rendimento\/testes\/([^/]+)\/editar$/);
  if (editMatch) return { route: "new-test", id: decodeURIComponent(editMatch[1]) };

  const executeMatch = pathname.match(/^\/rendimento\/testes\/([^/]+)\/executar$/);
  if (executeMatch) return { route: "execute", id: decodeURIComponent(executeMatch[1]) };

  const detailMatch = pathname.match(/^\/rendimento\/testes\/([^/]+)$/);
  if (detailMatch) return { route: "detail", id: decodeURIComponent(detailMatch[1]) };

  return { route: "tests" };
};

function RendimentoContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const target = targetFromPath(location.pathname);
  const navigateInsideModule = (next: NavigationTarget) => navigate(pathForTarget(next));
  const { loading, error, refreshAll } = useRendimentoData();

  if (loading) return <section className="yield-module"><div className="app-content"><div className="empty-state"><strong>Buscando dados do Teste rendimento...</strong></div></div></section>;
  if (error) return <section className="yield-module"><div className="app-content"><div className="empty-state"><strong>Não foi possível carregar o módulo</strong><p>{error}</p><button className="primary-button" onClick={() => void refreshAll()}>Tentar novamente</button></div></div></section>;

  const content = target.route === "new-test"
    ? <NewTestPage testId={target.id} onNavigate={navigateInsideModule} />
    : target.route === "execute"
      ? <ExecutionPage testId={target.id} onNavigate={navigateInsideModule} />
      : target.route === "detail"
        ? <TestDetailPage testId={target.id} onNavigate={navigateInsideModule} />
        : target.route === "products"
          ? <ProductsPage />
          : target.route === "discards"
            ? <DiscardsPage />
            : <TestsPage onNavigate={navigateInsideModule} />;

  return (
    <section className="yield-module">
      <div className="app-content">{content}</div>
    </section>
  );
}

export default function RendimentoModule() {
  return <RendimentoDataProvider><RendimentoContent /></RendimentoDataProvider>;
}
