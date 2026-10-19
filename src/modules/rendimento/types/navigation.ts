export type AppRoute = "dashboard" | "tests" | "new-test" | "execute" | "detail" | "products" | "discards" | "weight-bands";

export interface NavigationTarget {
  route: AppRoute;
  id?: string;
}
