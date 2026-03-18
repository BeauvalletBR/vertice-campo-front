export interface Visit {
  id: string;
  date: string;
  ranchName: string;
  owner: string;
  city: string;
  status: "completed" | "pending";
}

export interface DashboardStats {
  region: string;
  ranchers: number;
  cities: number;
}

const mockStats: DashboardStats[] = [
  { region: "Norte", ranchers: 142, cities: 28 },
  { region: "Sul", ranchers: 385, cities: 42 },
  { region: "Leste", ranchers: 98, cities: 15 },
  { region: "Oeste", ranchers: 210, cities: 31 },
];

const mockVisits: Visit[] = [
  { id: "1", date: "2024-10-24", ranchName: "Fazenda Boa Vista", owner: "João Silva", city: "Rio Verde", status: "completed" },
  { id: "2", date: "2024-10-24", ranchName: "Estrela do Sul", owner: "Maria Oliveira", city: "Jataí", status: "completed" },
  { id: "3", date: "2024-10-23", ranchName: "Recanto Verde", owner: "Carlos Mendes", city: "Goianésia", status: "pending" },
  { id: "4", date: "2024-10-23", ranchName: "São Jorge", owner: "Ana Souza", city: "Uruaçu", status: "completed" },
  { id: "5", date: "2024-10-22", ranchName: "Fazenda Primavera", owner: "Pedro Costa", city: "Porangatu", status: "completed" },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
  getStats: async (): Promise<DashboardStats[]> => {
    await delay(800);
    return mockStats;
  },
  getRecentVisits: async (): Promise<Visit[]> => {
    await delay(600);
    return mockVisits;
  },
  saveVisit: async (data: Record<string, unknown>): Promise<{ success: boolean }> => {
    console.log("Syncing with Corporate ERP...", data);
    await delay(1500);
    return { success: true };
  },
};
