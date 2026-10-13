export type AppRoute = "tests" | "new-test" | "execute" | "detail" | "products" | "discards";

export interface NavigationTarget {
  route: AppRoute;
  id?: string;
}
