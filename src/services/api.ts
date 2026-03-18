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

export interface Rancher {
  id: string;
  nome: string;
  ie: string;
  propriedade: string;
  car: "sim" | "nao";
  municipio: string;
  telefone: string;
  melhorDiaContato: string;
  proprietario: string;
  tipoAtividade: string;
  tipoTerminacao: string;
  numAnimais: number;
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

const mockRanchers: Rancher[] = [
  { id: "r1", nome: "João Silva", ie: "101.234.567", propriedade: "Fazenda Boa Vista", car: "sim", municipio: "Rio Verde", telefone: "(62) 99901-1234", melhorDiaContato: "Segunda-feira", proprietario: "João Silva", tipoAtividade: "cria", tipoTerminacao: "pasto", numAnimais: 350 },
  { id: "r2", nome: "Maria Oliveira", ie: "202.345.678", propriedade: "Estrela do Sul", car: "sim", municipio: "Jataí", telefone: "(62) 99902-5678", melhorDiaContato: "Terça-feira", proprietario: "Maria Oliveira", tipoAtividade: "recria", tipoTerminacao: "semi-conf.", numAnimais: 520 },
  { id: "r3", nome: "Carlos Mendes", ie: "303.456.789", propriedade: "Recanto Verde", car: "nao", municipio: "Goianésia", telefone: "(62) 99903-9012", melhorDiaContato: "Quarta-feira", proprietario: "Carlos Mendes", tipoAtividade: "engorda", tipoTerminacao: "confinado", numAnimais: 800 },
  { id: "r4", nome: "Ana Souza", ie: "404.567.890", propriedade: "São Jorge", car: "sim", municipio: "Uruaçu", telefone: "(62) 99904-3456", melhorDiaContato: "Quinta-feira", proprietario: "Ana Souza", tipoAtividade: "cria", tipoTerminacao: "pasto", numAnimais: 200 },
  { id: "r5", nome: "Pedro Costa", ie: "505.678.901", propriedade: "Fazenda Primavera", car: "sim", municipio: "Porangatu", telefone: "(62) 99905-7890", melhorDiaContato: "Sexta-feira", proprietario: "Pedro Costa", tipoAtividade: "recria", tipoTerminacao: "semi-conf.", numAnimais: 450 },
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
  searchRanchers: async (query: string): Promise<Rancher[]> => {
    await delay(400);
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return mockRanchers.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.propriedade.toLowerCase().includes(q) ||
        r.municipio.toLowerCase().includes(q)
    );
  },
  getRanchers: async (): Promise<Rancher[]> => {
    await delay(400);
    return mockRanchers;
  },
};
