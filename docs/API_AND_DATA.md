# API_AND_DATA.md

# Integração de Dados

## 1. Visão geral

A camada de dados do Bovino Pro está concentrada em `src/services/api.ts`, com apoio de `src/services/pecuaristas.ts` para regras de priorização.

O padrão atual é simples e direto:
- leitura das configurações por `import.meta.env`;
- chamadas HTTP com `fetch`;
- payloads JSON;
- retorno tipado com interfaces TypeScript;
- tratamento de erro local em cada função.

![[Inserir Diagrama aqui: Fluxo de requisição da API até a renderização na tela]](docs/images/api-to-ui-flow.png)

## 2. Arquivos principais

## 2.1. `src/services/api.ts`
Responsável por:
- contratos de dados;
- chamadas HTTP para login, leitura e gravação;
- objeto `api` consumido pela UI.

## 2.2. `src/services/pecuaristas.ts`
Responsável por:
- score de volume;
- score de prospecção;
- score logístico.

Ele não faz chamadas HTTP, mas complementa a camada de dados com regra de negócio derivada.

## 3. Interfaces e tipagens principais

## 3.1. `ApiRancher`

Contrato para pecuaristas/produtores:

```ts
export interface ApiRancher {
  COD_PRODUTOR: number;
  NOME_PRODUTOR: string;
  NOME_FAZENDA: string;
  MUNICIPIO: string;
  UF_FAZENDA: string;
  INSCRICAO: string;
  NUMERO1: string | null;
  POSSUI_CAR: "S" | "N";
  DISTANCIA_CADASTRADA: number;
  QTD_COMPRADA_12M_CHINA: number;
  QTD_COMPRADA_12M_NAO_CHINA: number;
  JA_VENDEU: "S" | "N";
  DATA_ULTIMA_VISITA?: string | null; 
}
```

### Onde é usada
- `Agendamento.tsx`
- `FieldVisit.tsx`
- funções de score em `pecuaristas.ts`

## 3.2. `ApiAgendamento`

```ts
export interface ApiAgendamento {
  ID_AGENDAMENTO?: number;
  ID_COMPRADOR?: number;
  DATA_AGENDADA?: string;
  STATUS_AGENDAMENTO?: string;
  COD_PRODUTOR?: number;
  NOME_PRODUTOR?: string;
  NOME_FAZENDA?: string;
  MUNICIPIO?: string;
  UF_FAZENDA?: string;
  INSCRICAO?: string;
  NUMERO1?: string | null;
  POSSUI_CAR?: "S" | "N";
  DISTANCIA_CADASTRADA?: number;
  QTD_COMPRADA_12M_CHINA?: number;
  QTD_COMPRADA_12M_NAO_CHINA?: number;
  JA_VENDEU?: "S" | "N";
}
```

### Onde é usada
- listagem de agendamentos pendentes em `FieldVisit.tsx`
- fluxo de agendamento em `Agendamento.tsx`

## 3.3. `ApiVisita`

É o contrato mais rico, refletindo a visita registrada no backend:

```ts
export interface ApiVisita {
  ID_VISITA: number;
  ID_AGENDAMENTO: number | null;
  ID_COMPRADOR: number;
  DATA_REGISTRO_VISITA: string;
  COD_PRODUTOR: number | null;
  INSCRICAO: string | null;
  NOME_PRODUTOR: string | null;
  NOME_FAZENDA: string | null;
  MUNICIPIO: string | null;
  REGIAO: string | null;
  TELEFONE: string | null;
  POSSUI_CAR: string | null;
  GPS_LATITUDE: number | null;
  GPS_LONGITUDE: number | null;
  DISTANCIA_PERCORRIDA_REAL: number | null;
  ...
}
```

### Onde é usada
- `Dashboard.tsx`
- `Visitas.tsx`

## 3.4. `ApiUsuario`

```ts
export interface ApiUsuario {
  SEQUSUARIO: number;
  CODUSUARIO: string;
}
```

### Onde é usada
- associação entre comprador e agendamento;
- exibição do nome do comprador no dashboard.

## 4. Estrutura das chamadas HTTP

## 4.1. Padrão adotado

As funções seguem um padrão como este:

```ts
const url = import.meta.env.VITE_N8N_WEBHOOK_URL_USUARIOS;
const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;

const response = await fetch(url, { headers: { [headerKey]: token } });
const data = await response.json();
return Array.isArray(data) ? data : [];
```

## 4.2. Leitura (GET-like via webhook)

Funções principais de leitura:
- `fetchPecuaristasAgendamento`
- `fetchAgendamentosPendentes`
- `fetchRelatorioVisitas`
- `fetchUsuarios`

### Exemplo

```ts
export const fetchRelatorioVisitas = async (): Promise<ApiVisita[]> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA;
  const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;

  if (!url) return [];

  try {
    const response = await fetch(url, { headers: { [headerKey]: token } });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Falha API Consulta Relatório de Visitas:", error);
    return [];
  }
};
```

## 4.3. Escrita (POST)

Funções principais de gravação:
- `saveAgendamento`
- `saveVisitaCampo`
- `realizarLogin`

### Exemplo

```ts
export const saveAgendamento = async (dados: any): Promise<{ success: boolean }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_AGENDAMENTO; 
  const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", [headerKey]: token },
      body: JSON.stringify(dados)
    });
    return { success: response.ok };
  } catch (error) { return { success: false }; }
};
```

## 4.4. Axios ou Fetch?
No estado atual do código, **a aplicação usa somente `fetch`**.

Não há configuração de Axios, interceptors ou instância HTTP centralizada.

### Implicações
- simplicidade;
- menor dependência;
- menos boilerplate inicial.

### Limitações
- sem interceptors globais;
- sem retry centralizado;
- sem transformação uniforme de erros;
- headers repetidos em várias funções.

## 5. Cache e reuso de dados

## 5.1. Cache manual em `fetchPecuaristasAgendamento`

Há um mecanismo manual de cache:

```ts
let cachedPecuaristas: ApiRancher[] | null = null;
let fetchPromise: Promise<ApiRancher[]> | null = null;
```

```ts
if (cachedPecuaristas && !forceRefresh) return cachedPecuaristas;
if (fetchPromise && !forceRefresh) return fetchPromise;
```

### O que isso resolve
- evita buscas repetidas durante a sessão;
- evita requisições paralelas duplicadas.

### O que ainda falta
- invalidação por tempo;
- refetch por foco;
- chaves padronizadas;
- sincronização unificada com a UI.

Isso reforça que React Query seria uma evolução natural.

## 6. Como os dados chegam à UI

## 6.1. Dashboard
Busca visitas + usuários em paralelo:

```tsx
const [dadosVisitas, dadosUsuarios] = await Promise.all([
  api.getVisitasConsulta(),
  api.getUsuarios()
]);
```

Depois transforma esses dados em:
- KPIs;
- agregação por cidade;
- últimas visitas.

## 6.2. Visitas
Busca histórico e mapeia o contrato do backend para um modelo de tela:

```tsx
const mappedData: CheckinReport[] = data.map((v) => ({
  id: String(v.ID_VISITA),
  nome: v.NOME_PRODUTOR || "N/A",
  ...
  statusDatavale: v.COD_PRODUTOR ? "cadastrado" : "pendente"
}));
```

### Observação importante
A UI aplica interpretação de negócio no frontend:
- visita com `COD_PRODUTOR` preenchido = `cadastrado`;
- sem `COD_PRODUTOR` = `pendente`.

## 6.3. Agendamento
Carrega pecuaristas + usuários e remove duplicidades manualmente:

```tsx
const uniqueDataMap = new Map();
dataPecuaristas.forEach(item => {
  const uid = getUniqueId(item);
  if (!uniqueDataMap.has(uid)) {
    uniqueDataMap.set(uid, item);
  }
});
setApiData(Array.from(uniqueDataMap.values()));
```

## 6.4. Campo
O fluxo de visita compõe um payload grande e envia tudo ao backend:

```ts
const payload = {
  id_agendamento: form.id_agendamento,
  cod_produtor: form.cod_produtor,
  tipo_registro: form.cod_produtor ? "CADASTRADO" : "S_CADASTRO",
  nome: formatToUpper(form.nome),
  propriedade: formatToUpper(form.propriedade),
  municipio: formatToUpper(form.municipio),
  regiao: formatToUpper(mapCityToRegion(form.municipio)),
  ...
  gps_latitude: userLocation ? userLocation[0] : null,
  gps_longitude: userLocation ? userLocation[1] : null,
  distancia_percorrida_real: distance ? parseFloat(distance.replace(" km", "")) : 0,
  id_comprador: (user as any)?.id || 1,
  lotes
};
```

## 7. Tratamento de erros

## 7.1. Na camada de serviço
O padrão predominante é:
- `try/catch`;
- retorno vazio em leituras (`[]`);
- retorno `{ success: false }` em escritas.

### Exemplo
```ts
try {
  const response = await fetch(url, { headers: { [headerKey]: token } });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
} catch (error) {
  return [];
}
```

### Vantagem
A UI raramente quebra por exceção não tratada.

### Limitação
Falhas diferentes acabam ficando “achatadas” no mesmo retorno. Exemplo:
- erro de rede;
- 401;
- 500;
- JSON inválido;
- timeout.

Tudo tende a virar `[]` ou `success: false`.

## 7.2. Na camada de apresentação
A interface usa **Sonner** para feedback imediato.

### Exemplos reais
```tsx
toast.error("Erro ao carregar o relatório de visitas.");
toast.success("PDF gerado com sucesso!");
toast.error("Ocorreu um erro crítico durante a gravação.");
toast.info("Você saiu do sistema.");
```

## 7.3. Soluções globais de notificação
Há duas abordagens no repositório:

- **Sonner** (`src/components/ui/sonner.tsx`) → é a que está em uso real no app.
- **hook `use-toast` + Radix Toast** → infraestrutura existente, aparentemente secundária/não adotada nas telas atuais.

### Recomendação
Escolher uma única abordagem oficial para reduzir duplicidade. Pelo estado atual, **Sonner** é a escolha natural.

## 8. Regras de priorização de pecuaristas

`src/services/pecuaristas.ts` encapsula regras que enriquecem os dados vindos da API.

### Exemplo: score de prospecção

```ts
export const calculateScoreProspeccao = (r: ApiRancher): number => {
  let score = 0;
  const distancia = Number(r.DISTANCIA_CADASTRADA) || 0;

  if (r.JA_VENDEU === "N") {
    score += 200; 
  } else {
    score -= 50; 
  }

  score -= distancia * 0.5;
  if (r.POSSUI_CAR === "S") score += 50; 

  return score;
};
```

### Interpretação
A lógica atual valoriza, por exemplo:
- produtores que ainda não venderam;
- presença de CAR;
- volumes maiores;
- distâncias menores.

## 9. Melhorias recomendadas na camada de dados

## 9.1. Criar um client HTTP central
Exemplo de benefícios:
- função única para montar headers;
- tratamento de erro uniforme;
- logs padronizados.

## 9.2. Padronizar tipos
Evitar `any` em funções como:
- `saveAgendamento`
- `saveVisitaCampo`

## 9.3. Adotar React Query de ponta a ponta
Especialmente para:
- leitura de listas;
- sincronização pós-gravação;
- loading/error states;
- cache.

## 9.4. Criar mapeadores explícitos
Transformações como a de `ApiVisita` → `CheckinReport` poderiam viver em funções utilitárias dedicadas.

## 10. Resumo

A integração de dados está bem centralizada e funcional, com boa tipagem inicial e contratos claros. O próximo passo de maturidade é evoluir de uma camada “funcional e direta” para uma camada “padronizada, observável e escalável”.
