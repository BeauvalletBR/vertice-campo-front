# Vertice Campo

Aplicação web em **React + TypeScript** para apoiar a operação de **originação/comercial**, com foco em três jornadas principais do negócio:

- **Compra de gado / prospecção**: identificação e priorização de pecuaristas.
- **Agendamentos**: seleção de produtores e geração de agendas para compradores.
- **Visitas de campo**: registro estruturado da visita, geolocalização, lotes previstos e histórico.

![[Inserir Imagem aqui: Print da Tela Inicial (Dashboard)]](docs/images/dashboard-home.png)

## 1. Visão geral

O projeto foi construído com **Vite**, **Tailwind CSS**, componentes **shadcn/ui**, **React Router**, integração com webhooks do **n8n**, mapas com **Leaflet** e geração de relatórios PDF com **jsPDF + html2canvas**.

Pelo código atual, o fluxo funcional mais importante está distribuído assim:

- **Login**: autenticação via webhook, persistindo o usuário no `localStorage`.
- **Dashboard**: consolida visitas já registradas e plota densidade geográfica por cidade.
- **Agendamento**: carrega pecuaristas + usuários, aplica filtros/ranking e salva agendamentos.
- **Campo**: permite iniciar visita agendada ou manual, capturar GPS/rota e enviar o payload ao backend.
- **Visitas**: exibe histórico e exporta o detalhe de uma visita para PDF.

## 2. Objetivos de negócio atendidos

### Compra de gado / prospecção
A tela de **Agendamentos** cruza dados de produtores com critérios de volume, distância, CAR e histórico de venda, inclusive com modos de priorização por score em `src/services/pecuaristas.ts`.

### Visitas de campo
A tela **Campo** registra dados comerciais e operacionais da visita, incluindo:

- produtor e fazenda;
- município e região;
- dados de contato;
- tipo de visita;
- habilitação, atividade e terminação;
- disponibilidade de lotes em 30/60/90 dias;
- geolocalização e distância percorrida.

### Agendamentos
A tela **Agendamentos** permite selecionar vários produtores, definir data e comprador responsável, enviando tudo para o backend via webhook.

## 3. Stack técnica

- **Frontend**: React 18 + TypeScript
- **Bundler**: Vite
- **Roteamento**: React Router DOM
- **Estilo**: Tailwind CSS + tokens CSS customizados
- **UI kit**: shadcn/ui + Radix UI
- **Estado assíncrono disponível**: TanStack Query
- **Formulários disponíveis**: React Hook Form + Zod
- **Mapas**: Leaflet + React Leaflet
- **PDF**: jsPDF + html2canvas
- **Notificações**: Sonner
- **Testes**: Vitest + Testing Library + jsdom

> Observação importante: embora `@tanstack/react-query`, `react-hook-form` e `zod` estejam no projeto, as telas atuais usam principalmente `useState`/`useEffect` e formulários controlados manualmente. A base existe, mas a adoção ainda é parcial.

## 4. Pré-requisitos

Como o repositório enviado não inclui arquivo `.nvmrc` nem campo `engines` no `package.json`, a recomendação prática é usar:

- **Node.js 20 LTS** (recomendado)
- **npm 10+**

Também será necessário configurar um `.env` com as URLs dos webhooks do n8n e o cabeçalho/token usados nas chamadas da API.

## 5. Passo a passo para rodar localmente

## 5.1. Instalar dependências

```bash
npm install
```

## 5.2. Criar o arquivo de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_N8N_WEBHOOK_URL_PECUARISTAS=https://seu-n8n.exemplo/webhook/pecuaristas
VITE_N8N_WEBHOOK_URL_AGENDAMENTO_CONSULTA=https://seu-n8n.exemplo/webhook/agendamento-consulta
VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA=https://seu-n8n.exemplo/webhook/visitas-consulta
VITE_N8N_WEBHOOK_URL_USUARIOS=https://seu-n8n.exemplo/webhook/usuarios
VITE_N8N_WEBHOOK_URL_AGENDAMENTO=https://seu-n8n.exemplo/webhook/agendamento
VITE_N8N_WEBHOOK_URL_VISITAS=https://seu-n8n.exemplo/webhook/visitas
VITE_N8N_WEBHOOK_URL_LOGIN=https://seu-n8n.exemplo/webhook/login
VITE_N8N_SECRET_TOKEN=seu-token-aqui
VITE_N8N_HEADER_KEY=x-origem-auth
```

## 5.3. Iniciar em desenvolvimento

```bash
npm run dev
```

O Vite irá expor a aplicação localmente, normalmente em:

```text
http://localhost:5173
```

## 5.4. Build de produção

```bash
npm run build
```

## 5.5. Preview da build

```bash
npm run preview
```

## 5.6. Rodar lint

```bash
npm run lint
```

## 5.7. Rodar testes

Execução única:

```bash
npm run test
```

Modo watch:

```bash
npm run test:watch
```

### Estado atual dos testes

O projeto já está preparado para testes com Vitest, mas hoje possui apenas um teste de exemplo:

```ts
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

Isso significa que a infraestrutura de testes existe, porém a suíte ainda precisa ser expandida para cobrir:

- autenticação;
- proteção de rotas;
- rendering do dashboard;
- fluxos de agendamento;
- submissão da visita de campo.

## 6. Estrutura de pastas

```text
src/
├── components/
│   ├── ui/                # componentes-base do shadcn/ui e Radix
│   ├── AppSidebar.tsx     # navegação lateral principal
│   ├── Dashboard.tsx      # dashboard e mapa analítico
│   ├── FieldVisit.tsx     # fluxo principal de visita de campo
│   ├── NavLink.tsx        # wrapper compatível para NavLink do router
│   └── ProtectedRoute.tsx # guardião por autenticação/perfil
├── contexts/
│   └── AuthContext.tsx    # autenticação, sessão e persistência em localStorage
├── hooks/
│   ├── use-mobile.tsx     # helper responsivo
│   └── use-toast.ts       # infraestrutura alternativa de toast
├── lib/
│   └── utils.ts           # helper cn() para merge de classes
├── pages/
│   ├── Agendamento.tsx    # agenda de visitas
│   ├── FieldPage.tsx      # página wrapper do fluxo de campo
│   ├── Index.tsx          # entrada do dashboard
│   ├── LoginPage.tsx      # login
│   ├── NotFound.tsx       # fallback de rota
│   └── Visitas.tsx        # histórico e exportação de visitas
├── services/
│   ├── api.ts             # camada de integração com webhooks/backend
│   └── pecuaristas.ts     # regras de score/priorização
├── test/
│   ├── example.test.ts    # teste smoke inicial
│   └── setup.ts           # setup global do ambiente de teste
├── App.tsx                # providers globais e rotas
├── main.tsx               # bootstrap do React
└── index.css              # tokens visuais e tema base
```

## 7. Fluxo funcional resumido

![[Inserir Diagrama aqui: Jornada do usuário do login até o registro de visita]](docs/images/fluxo-geral.png)

1. O usuário acessa `/login`.
2. O `AuthContext` chama `api.realizarLogin()`.
3. Após login bem-sucedido, o usuário é salvo no `localStorage`.
4. O `ProtectedLayout` libera a navegação principal.
5. Conforme o perfil:
   - **ADMIN** acessa também `/agendamento`;
   - **COMPRADOR** acessa dashboard, campo e visitas.
6. As telas consomem os webhooks configurados no `.env`.
7. O histórico de visitas pode ser exportado em PDF.

## 8. Exemplos reais do projeto

### Providers e composição global

```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
```

### Rota restrita para ADMIN

```tsx
<Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
  <Route path="/agendamento" element={<Agendamento />} />
</Route>
```

### Filtro do menu lateral por papel do usuário

```tsx
const filteredItems = items.filter((item) => {
  if (item.adminOnly && user?.role !== "ADMIN") {
    return false; 
  }
  return true; 
});
```

## 9. Observações importantes para onboarding

- O backend esperado hoje é orientado a **webhooks**.
- O projeto depende bastante de **dados normalizados pelo n8n/backend**.
- Há lógica de negócio relevante embutida no frontend, especialmente:
  - mapeamento de cidades para região;
  - scores de priorização de pecuaristas;
  - interpretação de “cadastrado” vs “pendente” em visitas.
- A base de componentes UI é boa e reaproveitável, mas alguns fluxos ainda estão concentrados em componentes grandes, principalmente `FieldVisit.tsx` e `Agendamento.tsx`.

## 10. Próximos passos recomendados

1. Padronizar todas as chamadas assíncronas com `useQuery`/`useMutation`.
2. Migrar formulários manuais para `react-hook-form + zod`.
3. Criar um `src/types/` para centralizar contratos.
4. Extrair hooks como `useAuth`, `useAgendamentos`, `useVisitas`, `usePecuaristas`.
5. Cobrir os fluxos críticos com testes unitários e de integração.
