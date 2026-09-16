import { describe, expect, it } from "vitest";

import type { User } from "@/contexts/AuthContext";
import {
  choosePostLoginRoute,
  normalizeAuthenticatedRoute,
} from "@/lib/auth-navigation";

const adminUser: User = {
  id: 1,
  name: "Administrador",
  login: "admin",
  role: "ADMIN",
  modulos: ["ADMIN"],
  nivel: 3,
};

const fieldUser: User = {
  id: 2,
  name: "Campo",
  login: "campo",
  role: "COMPRADOR",
  modulos: ["OPERACIONAL"],
  nivel: 1,
};

describe("navegação após o login", () => {
  it("prioriza a rota originalmente solicitada e preserva seus parâmetros", () => {
    expect(
      choosePostLoginRoute(adminUser, {
        requestedRoute: "/escala?week=2026-W37#pedido-10",
        lastRoute: "/dashboard",
        isDesktop: true,
      }),
    ).toBe("/escala?week=2026-W37#pedido-10");
  });

  it("restaura a última tela autorizada no desktop", () => {
    expect(
      choosePostLoginRoute(adminUser, {
        lastRoute: "/escala/analise-mensal",
        isDesktop: true,
      }),
    ).toBe("/escala/analise-mensal");
  });

  it("abre a tela de escolha quando não existe destino anterior", () => {
    expect(
      choosePostLoginRoute(adminUser, {
        isDesktop: true,
      }),
    ).toBe("/inicio");
  });

  it("não restaura uma rota sem permissão para o usuário", () => {
    expect(
      choosePostLoginRoute(fieldUser, {
        requestedRoute: "/escala",
        lastRoute: "/dashboard",
        isDesktop: true,
      }),
    ).toBe("/inicio");
  });

  it("ignora a última tela do computador em uma tela móvel", () => {
    expect(
      choosePostLoginRoute(adminUser, {
        lastRoute: "/escala/dashboard",
        isDesktop: false,
      }),
    ).toBe("/inicio");
  });

  it("rejeita destinos externos e páginas desconhecidas", () => {
    expect(normalizeAuthenticatedRoute("https://example.com/escala")).toBeNull();
    expect(normalizeAuthenticatedRoute("//example.com/escala")).toBeNull();
    expect(normalizeAuthenticatedRoute("/pagina-inexistente")).toBeNull();
  });
});
