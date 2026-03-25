# ARCHITECTURE.md

# Arquitetura e Decisões Técnicas

## 1. Visão arquitetural

O Bovino Pro segue uma arquitetura típica de SPA em React:

- **camada de apresentação**: páginas e componentes;
- **camada de contexto**: autenticação e sessão;
- **camada de integração**: `src/services/api.ts`;
- **camada de utilidades de negócio**: `src/services/pecuaristas.ts`;
- **infraestrutura visual**: shadcn/ui, Tailwind e Sonner.

![[Inserir Diagrama aqui: Fluxo de Autenticação e Rotas]](docs/images/auth-routing-flow.png)

## 2. Composição da aplicação

A árvore de bootstrap atual é a seguinte:

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

### Responsabilidade de cada provider

- **`QueryClientProvider`**: prepara o projeto para cache e queries assíncronas.
- **`TooltipProvider`**: habilita tooltips do shadcn/Radix.
- **`Sonner`**: provê notificações globais toast.
- **`BrowserRouter`**: gerencia navegação cliente.
- **`AuthProvider`**: centraliza usuário autenticado e regras de login/logout.

## 3. Fluxo de autenticação

## 3.1. AuthContext

O `AuthContext.tsx` é responsável por:

- manter o estado do usuário autenticado;
- restaurar sessão via `localStorage`;
- executar login;
- executar logout;
- expor `isAuthenticated`.

Trecho-chave:

```tsx
useEffect(() => {
  const storedUser = localStorage.getItem('@OriginaGoias:user');
  if (storedUser) {
    setUser(JSON.parse(storedUser));
  }
}, []);
```

O login é feito via camada de serviço:

```tsx
const response = await api.realizarLogin(loginInput, senhaInput);

if (response.success && response.user) {
  const loggedUser: User = {
    id: response.user.id,
    name: response.user.name || response.user.login,
    login: response.user.login,
    role: response.user.role || "COMPRADOR"
  };

  setUser(loggedUser);
  localStorage.setItem('@OriginaGoias:user', JSON.stringify(loggedUser));
  toast.success(`Bem-vindo(a), ${loggedUser.name}!`);
  return true;
}
```

### Decisão técnica
A sessão é persistida no `localStorage`, o que simplifica a continuidade do login entre reloads, mas também exige cuidado com:

- expiração de sessão;
- invalidação de token;
- estratégia futura de refresh token.

No estado atual, o frontend confia no retorno do webhook de login para receber `id`, `login`, `name` e `role`.

## 3.2. ProtectedLayout

O `ProtectedLayout` faz a primeira barreira de proteção:

```tsx
function ProtectedLayout() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      ...
    </SidebarProvider>
  );
}
```

Se não houver usuário em memória, o app redireciona imediatamente para `/login`.

## 3.3. ProtectedRoute

A segunda barreira é o `ProtectedRoute.tsx`, focado em **autorização por perfil**:

```tsx
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    toast.error("Acesso Negado: Você não tem permissão para acessar esta área.");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
```

### Como o fluxo funciona, na prática

1. Usuário faz login em `LoginPage.tsx`.
2. `AuthContext.login()` chama `api.realizarLogin()`.
3. Se o backend retornar sucesso, o usuário é salvo no estado + `localStorage`.
4. `AppContent` redireciona para `/dashboard`.
5. `ProtectedLayout` impede acesso se não houver usuário.
6. `ProtectedRoute` valida se o perfil do usuário está em `allowedRoles`.
7. `AppSidebar` também esconde menus não permitidos para o papel atual.

## 3.4. Autorização também na navegação

Além da proteção por rota, o menu lateral esconde itens administrativos:

```tsx
const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Agendamentos", url: "/agendamento", icon: CalendarPlus, adminOnly: true },
  { title: "Campo", url: "/campo", icon: MapPin },
  { title: "Visitas", url: "/visitas", icon: Users },
];
```

E filtra com base no `user.role`:

```tsx
const filteredItems = items.filter((item) => {
  if (item.adminOnly && user?.role !== "ADMIN") {
    return false; 
  }
  return true; 
});
```

### Decisão técnica
Há uma boa combinação entre:
- **ocultação visual** do item de menu;
- **proteção efetiva** na rota.

Isso evita tanto exposição desnecessária da opção quanto acesso direto via URL.

## 4. Gerenciamento de estado

## 4.1. Estado local

O projeto hoje usa majoritariamente:

- `useState`
- `useEffect`
- `useMemo`

Esse padrão aparece com força em:

- `Agendamento.tsx`
- `FieldVisit.tsx`
- `Dashboard.tsx`
- `Visitas.tsx`

### Exemplo em `Agendamento.tsx`

```tsx
const [apiData, setApiData] = useState<ApiRancher[]>([]);
const [usuariosData, setUsuariosData] = useState<ApiUsuario[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const loadData = async () => {
    setIsLoading(true);

    const [dataPecuaristas, dataUsuarios] = await Promise.all([
      fetchPecuaristasAgendamento(),
      api.getUsuarios()
    ]);

    ...
    setApiData(Array.from(uniqueDataMap.values()));
    setUsuariosData(dataUsuarios);
    setIsLoading(false);
  };
  loadData();
}, []);
```

## 4.2. TanStack Query (React Query)

O projeto já está preparado para React Query:

```tsx
const queryClient = new QueryClient();
```

e:

```tsx
<QueryClientProvider client={queryClient}>
  ...
</QueryClientProvider>
```

### Situação atual
Apesar dessa infraestrutura estar pronta, **não há uso de `useQuery` ou `useMutation` nas telas analisadas**.

### O que isso significa
Hoje o gerenciamento de dados assíncronos, loading e cache está sendo feito “na mão”, com:

- estados locais;
- `useEffect`;
- tratamento manual de loading;
- recomputação manual.

### Oportunidade de melhoria
Migrar telas como `Agendamento`, `Dashboard`, `Visitas` e `FieldVisit` para React Query traria:

- cache por chave;
- refetch automático;
- invalidação controlada;
- retry configurável;
- menor acoplamento entre UI e lifecycle de rede.

### Exemplo de targets naturais para Query
- `fetchPecuaristasAgendamento`
- `fetchAgendamentosPendentes`
- `fetchRelatorioVisitas`
- `fetchUsuarios`
- `saveAgendamento`
- `saveVisitaCampo`

## 5. Camada de integração

Toda a integração central está concentrada em `src/services/api.ts`.

### Padrão adotado
- leitura das URLs via `import.meta.env`;
- uso de `fetch`;
- cabeçalho dinâmico com token;
- serialização/deserialização JSON;
- retorno padronizado simples.

Exemplo:

```ts
const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS;
const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", [headerKey]: token },
  body: JSON.stringify(dados)
});
```

### Decisão técnica
A opção por webhooks do n8n reduz a necessidade de SDKs complexos no frontend e permite evoluir os fluxos de backend de forma desacoplada, mas também traz desafios:

- contratos precisam ser muito bem versionados;
- erros HTTP ainda são tratados de forma simples;
- não há camada unificada de interceptação/retry/logging como seria comum com Axios + interceptors.

## 6. Geração de PDFs

A geração de PDF está implementada em `src/pages/Visitas.tsx`.

### Fluxo técnico
1. o detalhe da visita é renderizado na tela;
2. a referência visual é capturada via `reportRef`;
3. `html2canvas` transforma o conteúdo em imagem;
4. `jsPDF` insere essa imagem em uma página A4;
5. o arquivo é salvo localmente.

Trecho real:

```tsx
const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
const imgData = canvas.toDataURL("image/png");
const pdf = new jsPDF("p", "mm", "a4");
const pdfWidth = pdf.internal.pageSize.getWidth();
const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
pdf.save(`Checkin_${selectedReport.nome.replace(/\s+/g, '_')}_${selectedReport.data}.pdf`);
```

### Decisão técnica
Essa abordagem é rápida e prática para relatórios baseados em layout visual já existente. Em contrapartida:

- o PDF depende da fidelidade do DOM renderizado;
- tabelas longas ou múltiplas páginas podem exigir paginação manual;
- relatórios muito complexos podem renderizar melhor com composição nativa do jsPDF.

![[Inserir Diagrama aqui: Pipeline de geração de PDF a partir da tela]](docs/images/pdf-pipeline.png)

## 7. Mapas

O projeto usa **Leaflet** por meio de `react-leaflet` em dois contextos principais:

- **Dashboard**: mapa analítico com marcadores agregados por cidade;
- **FieldVisit**: mapa operacional com sede, posição atual e rota.

### Dashboard
No dashboard, as visitas são agregadas por cidade e renderizadas em `CircleMarker`:

```tsx
<MapContainer center={[-15.933, -50.14]} zoom={6} className="h-full w-full">
  <MapController selectedCity={selectedCity} />
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {mapData.map((city, idx) => (
    <CircleMarker 
      key={idx}
      center={[city.lat, city.lng]}
      radius={Math.min(25, 8 + (city.ranchersCount * 2))}
      fillColor="#1d4ed8"
      color="#1e3a8a"
      fillOpacity={0.6}
      eventHandlers={{ click: () => setSelectedCity(city) }}
    >
      <Tooltip>{city.city}: {city.ranchersCount} pecuarista(s)</Tooltip>
    </CircleMarker>
  ))}
</MapContainer>
```

### FieldVisit
Na visita de campo, o mapa tem papel operacional:

- mostra a sede da empresa;
- tenta capturar GPS do dispositivo;
- traça rota até o ponto capturado;
- usa fallback quando a geolocalização falha.

O app consulta:

- **Nominatim** para reverse geocoding;
- **OSRM** para rota de direção;
- **OpenStreetMap** para tiles.

Trechos reais:

```tsx
const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
```

```tsx
const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${EMPRESA_COORDS[1]},${EMPRESA_COORDS[0]};${longitude},${latitude}?overview=full&geometries=geojson`);
```

```tsx
<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
```

### Decisão técnica
O uso de serviços públicos reduz dependência de chaves de API, mas exige atenção a:

- limites de uso;
- políticas de rate limit;
- disponibilidade externa;
- latência de serviços públicos.

![[Inserir Imagem aqui: Exemplo do mapa operacional da tela Campo]](docs/images/field-map.png)

## 8. Lógica de negócio embarcada no frontend

Há lógica importante no frontend que merece destaque arquitetural:

### 8.1. Mapeamento de cidades para região
Implementado em `Agendamento.tsx` e `FieldVisit.tsx` com grandes dicionários `cityToRegionMap`.

### 8.2. Scores de pecuaristas
Em `src/services/pecuaristas.ts` existem três funções principais:

- `calculateScoreVolume`
- `calculateScoreProspeccao`
- `calculateScoreLogistica`

Exemplo:

```ts
export const calculateScoreVolume = (r: ApiRancher, filterHab: string): number => {
  let score = 0;
  const volume = getVolumeBaseadoNoFiltro(r, filterHab);
  const distancia = Number(r.DISTANCIA_CADASTRADA) || 0;

  score += volume * 0.5; 
  score -= distancia * 0.2;

  if (r.POSSUI_CAR === "S") score += 50; 
  if (r.JA_VENDEU === "S") score += 30; 

  if (!r.DATA_ULTIMA_VISITA) {
    score += 15; 
  }

  return score;
};
```

### Impacto arquitetural
Essas regras são centrais para o produto, então no médio prazo vale considerar movê-las para:

- uma camada de domínio dedicada;
- testes específicos;
- possível compartilhamento com backend.

## 9. Riscos e melhorias arquiteturais

## 9.1. Componentes muito grandes
`FieldVisit.tsx` concentra UI, validação, geolocalização, integração e montagem de payload. O mesmo vale, em menor grau, para `Agendamento.tsx`.

### Recomendações
Extrair:
- hooks de dados;
- hooks de geolocalização;
- componentes de formulário;
- builders de payload;
- schemas de validação.

## 9.2. Contratos distribuídos
As interfaces de API estão em `src/services/api.ts`. Isso funciona, mas pode ficar difícil de escalar.

### Recomendações
Criar algo como:

```text
src/types/
  api.ts
  auth.ts
  visitas.ts
  pecuaristas.ts
```

## 9.3. Cache e sincronização
Sem React Query em uso real, o projeto depende de recarregamentos manuais e estados isolados.

### Recomendações
Padronizar:
- `useQuery` para leitura;
- `useMutation` para escrita;
- invalidação por chave após salvar;
- centralização de loading/error state.

## 10. Resumo executivo

A arquitetura atual é sólida para uma aplicação operacional de médio porte:
- providers bem organizados;
- autenticação funcional;
- camadas de serviço claras;
- boas escolhas de bibliotecas.

O principal próximo salto técnico é transformar a base já instalada em padrão de projeto:
- React Query de fato nas telas;
- formulários padronizados;
- validação por schema;
- separação maior entre UI, domínio e integração.
