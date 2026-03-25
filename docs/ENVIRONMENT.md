# ENVIRONMENT.md

# Configurações e Deploy

## 1. Visão geral

O projeto é uma aplicação frontend Vite que depende de variáveis de ambiente para descobrir seus endpoints de backend. No código analisado, todas as variáveis inferidas estão concentradas em `src/services/api.ts`.

Importante: **não encontrei nenhuma variável de ambiente ligada a mapas**. O app usa serviços públicos diretamente:
- OpenStreetMap (tiles)
- Nominatim (reverse geocoding)
- OSRM (rota)

Ou seja, **nenhuma chave de mapa é exigida pelo código atual**.

## 2. Variáveis de ambiente necessárias

Abaixo estão todas as variáveis inferidas do código, com exemplos de valor.

```env
# Cabeçalho de autenticação entre frontend e n8n
VITE_N8N_HEADER_KEY=x-origem-auth

# Segredo/token enviado no header definido acima
VITE_N8N_SECRET_TOKEN=seu-token-super-seguro-aqui

# Endpoints de leitura
VITE_N8N_WEBHOOK_URL_PECUARISTAS=https://n8n.seudominio.com/webhook/pecuaristas
VITE_N8N_WEBHOOK_URL_AGENDAMENTO_CONSULTA=https://n8n.seudominio.com/webhook/agendamento-consulta
VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA=https://n8n.seudominio.com/webhook/visitas-consulta
VITE_N8N_WEBHOOK_URL_USUARIOS=https://n8n.seudominio.com/webhook/usuarios

# Endpoints de escrita
VITE_N8N_WEBHOOK_URL_AGENDAMENTO=https://n8n.seudominio.com/webhook/agendamento
VITE_N8N_WEBHOOK_URL_VISITAS=https://n8n.seudominio.com/webhook/visitas

# Endpoint de autenticação
VITE_N8N_WEBHOOK_URL_LOGIN=https://n8n.seudominio.com/webhook/login
```

## 3. Onde cada variável é usada

| Variável | Uso no sistema |
|---|---|
| `VITE_N8N_HEADER_KEY` | Nome do header customizado enviado em todas as chamadas |
| `VITE_N8N_SECRET_TOKEN` | Valor do token enviado no header customizado |
| `VITE_N8N_WEBHOOK_URL_PECUARISTAS` | Consulta de pecuaristas na tela de agendamento |
| `VITE_N8N_WEBHOOK_URL_AGENDAMENTO_CONSULTA` | Consulta de agendamentos pendentes |
| `VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA` | Consulta do histórico/relatório de visitas |
| `VITE_N8N_WEBHOOK_URL_USUARIOS` | Consulta de usuários/compradores |
| `VITE_N8N_WEBHOOK_URL_AGENDAMENTO` | Gravação de agendamentos |
| `VITE_N8N_WEBHOOK_URL_VISITAS` | Gravação da visita de campo |
| `VITE_N8N_WEBHOOK_URL_LOGIN` | Login/autenticação |

## 4. Exemplo de `.env.local`

```env
VITE_N8N_HEADER_KEY=x-origem-auth
VITE_N8N_SECRET_TOKEN=token-local-dev

VITE_N8N_WEBHOOK_URL_PECUARISTAS=https://dev-n8n.exemplo.com/webhook/pecuaristas
VITE_N8N_WEBHOOK_URL_AGENDAMENTO_CONSULTA=https://dev-n8n.exemplo.com/webhook/agendamento-consulta
VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA=https://dev-n8n.exemplo.com/webhook/visitas-consulta
VITE_N8N_WEBHOOK_URL_USUARIOS=https://dev-n8n.exemplo.com/webhook/usuarios
VITE_N8N_WEBHOOK_URL_AGENDAMENTO=https://dev-n8n.exemplo.com/webhook/agendamento
VITE_N8N_WEBHOOK_URL_VISITAS=https://dev-n8n.exemplo.com/webhook/visitas
VITE_N8N_WEBHOOK_URL_LOGIN=https://dev-n8n.exemplo.com/webhook/login
```

## 5. Estratégia de ambientes

Uma estrutura recomendada seria:

- `.env.local` → desenvolvimento local
- `.env.staging` → homologação
- `.env.production` → produção

### Exemplo conceitual

```text
.env.local
.env.staging
.env.production
```

Como o projeto usa Vite, somente variáveis prefixadas com `VITE_` ficarão disponíveis no frontend.

## 6. Considerações de segurança

Como o token é injetado no frontend, é importante registrar que:

- variáveis `VITE_*` ficam acessíveis no bundle cliente;
- portanto, esse “segredo” deve ser tratado mais como um **token de integração controlada**, não como segredo absoluto;
- idealmente, o backend deve ter validações complementares:
  - rate limiting;
  - checagem de origem;
  - autenticação real do usuário;
  - logs.

### Recomendação
Se a criticidade do sistema aumentar, considere intermediar essas chamadas por uma camada backend própria em vez de expor diretamente todos os webhooks ao navegador.

## 7. Comandos de build

O `package.json` fornece os seguintes comandos relevantes:

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
npm run lint
npm run test
npm run test:watch
```

## 7.1. Build de produção

```bash
npm run build
```

Gera os arquivos estáticos em:

```text
dist/
```

## 7.2. Build em modo development

```bash
npm run build:dev
```

Útil para validar comportamento com uma configuração específica de ambiente sem subir o servidor de desenvolvimento.

## 7.3. Preview local da build

```bash
npm run preview
```

Serve a pasta gerada pelo build para uma validação próxima do ambiente final.

## 8. Pipeline de deploy recomendada

![[Inserir Diagrama aqui: Pipeline de build e deploy do frontend]](docs/images/deploy-pipeline.png)

## 8.1. Passos sugeridos
1. instalar dependências;
2. injetar variáveis do ambiente correto;
3. rodar lint;
4. rodar testes;
5. gerar build;
6. publicar a pasta `dist/` em hosting estático.

## 8.2. Plataformas compatíveis
Como é um app Vite SPA, ele pode ser publicado facilmente em:
- Vercel
- Netlify
- Cloudflare Pages
- Nginx/Apache
- bucket estático com CDN

## 9. Atenção com SPA routing

Como a aplicação usa `react-router-dom` no cliente, o hosting precisa suportar fallback para `index.html` em rotas como:

- `/dashboard`
- `/campo`
- `/visitas`
- `/agendamento`

Sem isso, ao atualizar a página em uma rota interna, o servidor pode retornar 404.

### Exemplo de regra necessária
- toda rota desconhecida do servidor deve apontar para `index.html`.

## 10. Dependências externas não configuradas por `.env`

Além dos webhooks do n8n, o app depende de serviços públicos em runtime:

### Tiles de mapa
```text
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### Reverse geocoding
```text
https://nominatim.openstreetmap.org/reverse
```

### Roteamento
```text
https://router.project-osrm.org/route/v1/driving
```

### Implicações
- disponibilidade desses serviços influencia a UX;
- em produção, pode ser desejável migrar para provedores com SLA;
- vale adicionar monitoramento e fallback mais explícito.

## 11. Checklist de deploy

Antes de publicar, validar:

- todas as variáveis `VITE_*` estão preenchidas;
- endpoints do n8n respondem com CORS habilitado;
- token/header estão alinhados com o n8n;
- fallback de SPA está configurado;
- build foi gerado sem erros;
- toasts e erros de rede foram testados;
- login e rotas protegidas foram validados.

## 12. Observações finais

No estado atual, a configuração é simples e eficiente para um projeto operacional. O maior ponto de atenção não é o build em si, mas a confiabilidade dos endpoints externos e a governança de credenciais expostas no cliente.
