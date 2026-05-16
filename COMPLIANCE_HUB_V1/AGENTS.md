# ComplianceHub — Agent Guide

> Documento para agentes de código. Língua principal dos comentários e docs: **português (PT-BR)**. Identificadores de código: **inglês**.
> Última atualização: 2026-05-03.

---

## 1. Visão Geral do Projeto

O **ComplianceHub** é uma plataforma SaaS B2B de análise de antecedentes e *due diligence* para compliance trabalhista e criminal em empresas brasileiras. O sistema automatiza a coleta de dados em múltiplas fontes externas (Judit, Escavador, FonteData, BigDataCorp, DJEN), aplica IA (OpenAI GPT) para triagem de homônimos e síntese, e entrega um relatório HTML estruturado ao analista e, opcionalmente, ao cliente.

### Arquitetura de Alto Nível

```
Usuário / Cliente
    │
    ├──► Vercel (React 19 + Vite 7) ─ SPA
    │        ├── Portal Ops    (/ops/*)   → analistas, supervisores, admins, owners
    │        ├── Portal Client (/client/*) → clientes finais
    │        └── Relatório Público (/r/:token) → acesso sem login
    │
    └──► Firebase (southamerica-east1)
             ├── Cloud Functions Gen2 (Node 22) — 22+ endpoints
             ├── Firestore — banco NoSQL documental
             └── Firebase Auth — autenticação com custom claims
```

### Fluxo de Enriquecimento Principal

```
Criação do Caso
    ▼
Judit — Dados cadastrais (gate) → Processos → Mandados
    ▼
Escavador — Cross-validação (condicional)
    ▼
FonteData — Financeiro / Dívida (condicional)
    ▼
BigDataCorp — KYC / Processos / Profissão (condicional)
    ▼
DJEN — Comunicações processuais (condicional)
    ▼
IA — Triagem de Homônimos → Estruturação Semântica
    ▼
Analista conclui → concludeCaseByAnalyst
    ▼
Trigger publishResultOnCaseDone → publicResult/latest
    ▼
Relatório disponível (frontend + backend reportBuilder)
```

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | React | 19.2 |
| **Router** | React Router DOM | 7.13 |
| **Build** | Vite | 7.3 |
| **Backend** | Firebase Cloud Functions Gen2 | Node 22 |
| **Admin SDK** | firebase-admin | 13.7 |
| **Functions SDK** | firebase-functions | 7.2 |
| **Database** | Firestore (NoSQL) | — |
| **Auth** | Firebase Auth + custom claims | — |
| **PDF/Print** | Puppeteer-core + @sparticuz/chromium | 24.4 / 148 |
| **Testes Frontend** | Vitest + jsdom + @testing-library/react | 4.0 |
| **Testes Backend** | Vitest | 2.0 |
| **E2E** | Playwright | 1.58 |
| **Lint** | ESLint 9 (flat config) | — |
| **Hospedagem** | Vercel (frontend), Firebase (backend) | — |

### APIs Externas Integradas

| Provedor | Dados | Adapter |
|----------|-------|---------|
| **Judit** | Processos, mandados, execução criminal, entity data lake | `functions/adapters/judit.js` |
| **Escavador** | Processos por CPF/nome | `functions/adapters/escavador.js` |
| **FonteData** | Receita Federal, financeiro, identidade, processos, mandados | `functions/adapters/fontedata.js` |
| **BigDataCorp** | KYC, processos, profissão | `functions/adapters/bigdatacorp.js` |
| **DJEN** | Comunicações processuais | `functions/adapters/djen.js` |
| **OpenAI GPT** | Análise estruturada, triagem homônimos, síntese executiva | chamadas inline em `functions/index.js` |

---

## 3. Estrutura de Diretórios

```
COMPLIANCE_HUB_V1/
├── src/                          # Frontend React (ES modules)
│   ├── App.jsx                   # Router principal, lazy loading, auth guards, demo routes
│   ├── main.jsx                  # Entry point (StrictMode)
│   ├── index.css                 # Design system global (~718 linhas, tokens CSS)
│   ├── core/                     # Lógica de negócio
│   │   ├── auth/                 # AuthContext, useAuth, authProfile
│   │   ├── contexts/             # TenantContext, tenantUtils, useTenant
│   │   ├── copy/                 # Vocabulário centralizado (labels, status, risk, navigation, messages)
│   │   ├── firebase/             # Config Firebase, firestoreService
│   │   ├── notifications/        # NotificationProvider, notificationService, notificationSoundService, tipos
│   │   ├── rbac/                 # permissions.js — 8 roles, 10 permissões
│   │   ├── reportBuilder.js      # Geração de relatório HTML (frontend)
│   │   ├── clientPortal.js       # PUBLIC_RESULT_FIELDS, helpers cliente
│   │   ├── validators.js         # Validações de formulário
│   │   ├── caseSla.js            # Lógica de SLA e deadlines
│   │   ├── caseUtils.js          # Utilitários de caso
│   │   ├── enrichmentStatus.js   # Mapeamento de status de enriquecimento
│   │   ├── errorUtils.js         # Tratamento e classificação de erros
│   │   ├── formatDate.js         # Formatação de datas
│   │   └── portalPaths.js        # Resolução de rotas por portal
│   ├── hooks/                    # useCases, useCandidates, useAuditLogs, useTenantAuditLogs, useTheme, useMediaQuery
│   ├── data/                     # Dados mock para demo mode (mockCasesTenant1, mockCasesTenant2, mockData)
│   ├── demo/                     # DemoProviders.jsx — auth/tenant simulados
│   ├── pages/                    # Páginas públicas (LoginPage, PerfilPage, PublicReportPage)
│   ├── portals/
│   │   ├── client/               # 9 páginas do portal do cliente
│   │   └── ops/                  # 11 páginas do portal interno
│   ├── ui/
│   │   ├── components/           # Componentes reutilizáveis (16+)
│   │   ├── layouts/              # AppLayout, PageShell, Sidebar, Topbar
│   │   └── styles/               # shared-tables.css
│   └── test/
│       └── setupTests.js         # Mock localStorage, cleanup Vitest
│
├── functions/                    # Backend Firebase Functions (CommonJS + ESM misto)
│   ├── index.js                  # Entry principal (~10.900 linhas): endpoints, triggers, pipeline
│   ├── reportBuilder.cjs         # Mirror server-side do reportBuilder (CommonJS)
│   ├── adapters/                 # Clientes HTTP para APIs externas (6 adapters)
│   ├── normalizers/              # Mapeamento resposta externa → schema interno
│   ├── helpers/                  # circuitBreaker, aiHomonym, tribunalMap, pdfHtml, pdfRenderer, textNormalize
│   └── audit/                    # auditCatalog.js, writeAuditEvent.js
│
├── scripts/                      # Utilitários Node.js one-off (.cjs) — 27 scripts
├── docs/                         # Documentação (audits, specs, plans)
│   ├── audits/
│   └── superpowers/
│       ├── specs/
│       └── plans/
├── results/                      # Artefatos de teste/auditoria
├── public/                       # Assets estáticos
└── dist/                         # Build output (Vite)
```

---

## 4. Comandos de Build, Teste e Deploy

### Frontend (raiz do projeto)

```bash
npm run dev       # Servidor de desenvolvimento Vite
npm run build     # Build de produção → dist/
npm run preview   # Preview do build local
npm run lint      # ESLint (flat config)
npm test          # Vitest — 43 arquivos, 579 testes
```

### Backend (`functions/`)

```bash
cd functions
npm test          # Vitest — 12 arquivos, 330 testes
npm run test:watch
npm run lint      # ESLint
```

### Deploy

```bash
# Deploy completo
firebase deploy --only functions && npm run build && vercel --prod --yes

# Apenas backend
firebase deploy --only functions

# Apenas frontend
npm run build && vercel --prod --yes
```

### Pré-condições de Deploy Seguro

1. `npm test` — todos os 579 testes passando
2. `cd functions && npm test` — todos os 330 testes passando
3. `npm run build` — zero erros de compilação
4. Variáveis de ambiente validadas (`JUDIT_API_KEY`, `ESCAVADOR_API_KEY`, `OPENAI_API_KEY`)
5. `RESULT_ONLY_FIELDS` (backend) e `PUBLIC_RESULT_FIELDS` (frontend) em sincronia

---

## 5. Convenções de Código

### Idioma

- **Código (variáveis, funções, classes):** inglês
- **UI copy, comentários, documentação:** português (PT-BR)
- **Commits:** português, prefixo convencional (`feat:`, `fix:`, `docs:`, `refactor:`)

### Estilo

- **ESLint:** flat config (`eslint.config.js`), regras recomendadas + react-hooks + react-refresh
- **Variáveis não utilizadas:** erro, exceto quando começam com maiúscula (`varsIgnorePattern: '^[A-Z_]'`)
- **Frontend:** ES modules (`"type": "module"` no package.json)
- **Backend:** misto — `index.js` e a maioria dos adapters/helpers usam `require()` (CommonJS), mas testes usam ESM

### Nomenclatura de Arquivos

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Componentes React | PascalCase | `PageHeader.jsx`, `CasoPage.jsx` |
| Utilitários | camelCase | `firestoreService.js`, `caseSla.js` |
| Testes | `.test.{js,jsx}` | `caseSla.test.js`, `CasoPage.test.jsx` |
| CSS de componente | mesmo nome | `PageHeader.css` |
| Scripts one-off | camelCase + `.cjs` | `backfill-client-cases.cjs` |

### CSS

- **Metodologia:** BEM-like (ex: `.page-header__title`, `.fila-page__kpis`)
- **Design tokens:** CSS custom properties em `:root` (`--bg-app`, `--text-primary`, `--border-default`)
- **Dark mode:** via `@media (prefers-color-scheme: dark)` + toggle manual (`data-theme`)
- **Tabela de tokens semânticos:** definida em `src/index.css`

### Componentes

- Export default como função nomeada
- CSS co-localizado (arquivo `.css` no mesmo diretório)
- Props documentadas via JSDoc quando necessário
- `PageHeader` exige prop `title` (erro em dev se ausente)

---

## 6. Arquitetura e Padrões Importantes

### Dual-Portal

- **`/ops/*`** — analistas, supervisores, admins, owners
- **`/client/*`** — clientes finais (viewer, operator, manager)
- **`/demo/client/*` e `/demo/ops/*`** — prévia não autenticada (dados mock)
- **`/r/:token`** — relatório público (sem login, com TTL)
- **`/demo/r/:caseId`** — demo de relatório público

### RBAC

8 roles, 10 permissions. Claims customizadas no Firebase Auth (`role`, `tenantId`).

```js
// src/core/rbac/permissions.js
ROLES = {
  LEGACY_CLIENT: 'CLIENT',
  CLIENT_VIEWER: 'client_viewer',
  CLIENT_OPERATOR: 'client_operator',
  CLIENT_MANAGER: 'client_manager',
  ANALYST: 'analyst',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
  OWNER: 'owner',
}
```

### Segurança Firestore

- **Todas as escritas** passam por Cloud Functions. Cliente tem acesso **somente leitura** aos dados do seu tenant.
- Regras em `firestore.rules` (~206 linhas) — verificam `tenantId`, `role`, e permissões.
- Coleções principais: `cases`, `clientCases`, `candidates`, `auditLogs`, `tenantAuditLogs`, `tenantSettings`, `exports`, `publicReports`, `systemHealth`, `tenantUsage`, `notifications`.

### Circuit Breaker

- Implementado em `functions/helpers/circuitBreaker.js`
- Persiste estado em `systemHealth/{providerId}`
- Thresholds: Judit/Escavador/FonteData (5 falhas, 10min), OpenAI (3 falhas, 5min)

### Report Builder Duplicado

- `src/core/reportBuilder.js` (frontend) e `functions/reportBuilder.cjs` (backend) **devem ser mantidos em sincronia**.

### Lazy Loading com Retry

```js
// App.jsx — lazyRetry() recarrega a página até 2x em caso de chunk stale
```

### Demo Mode

- Quando não há usuário Firebase autenticado, usa `MOCK_CASES` de `src/data/`
- Rotas `/demo/*` usam `DemoProviders` que simulam auth e tenant

---

## 7. Testes

### Frontend e Regras Firestore (`src/` + raiz)

30+ arquivos de teste em `src/` cobrindo:
- Lógica de negócio: `caseSla`, `clientPortal`, `enrichmentStatus`, `errorUtils`, `portalPaths`, `validators`
- Contextos: `AuthContext`, `TenantContext`
- Serviços: `firestoreService`
- Permissões: `permissions`
- Componentes: `QuotaBar`, `Sidebar`, `Topbar`, `NovaSolicitacaoPage`, `CasoPage`, páginas diversas
- Hooks: `useAuditLogs`, `useCases`

Mais `firestore.rules.test.js` na raiz (5 testes de contrato de segurança).

### Backend (`functions/`)

12 arquivos de teste:
- Adapters: `djen.test.js`, `judit.test.js`
- Audit: `auditCatalog.test.js`, `writeAuditEvent.test.js`
- Helpers: `aiCalibration.test.js`, `aiHomonym.test.js`, `deterministicPrefill.test.js`, `sanitizeAiOutput.test.js`
- Normalizers: `bigdatacorp.test.js`, `djen.test.js`
- Limits: `enforceTenantSubmissionLimits.test.js`, `getClientQuotaStatus.test.js`

### Configuração de Teste

- **Frontend:** `vite.config.js` → `test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setupTests.js' }`
- **Backend:** `functions/package.json` → Vitest 2 com detecção automática
- **Setup:** mock de `localStorage`, cleanup automático, mocks do Firebase

### Estado Atual dos Testes

- **Raiz:** 43 arquivos de teste, 579 testes passando
- **Functions:** 12 arquivos de teste, 330 testes passando
- Duração total raiz: ~10s

---

## 8. Variáveis de Ambiente

### Frontend (`.env.local` / `.env.example`)

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Backend (`functions/.env` / `functions/.env.example`)

```bash
FONTEDATA_API_KEY=
BIGDATACORP_ACCESS_TOKEN=
BIGDATACORP_TOKEN_ID=
# Outras chaves (Judit, Escavador, OpenAI) via Firebase Secrets / env
```

### Scripts de Provisioning (`.env.example` na raiz)

```bash
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
ADMIN_EMAIL=
ADMIN_PASSWORD=
MADERO_UID=
```

---

## 9. Configurações Importantes

### `vite.config.js`

- Manual chunks para separar Firebase (auth, firestore, functions) e React (core, dom)
- Sourcemaps desabilitados em produção

### `firebase.json`

- Firestore rules e indexes deployados juntos
- Emuladores: auth (9099), functions (5001), firestore (8080)
- `singleProjectMode: true`

### `vercel.json`

- SPA rewrite: tudo para `index.html`
- Headers de segurança: CSP, HSTS, X-Frame-Options, Permissions-Policy, etc.
- Cache agressivo para `/assets/*` (1 ano), `no-cache` para `index.html`

### `firestore.indexes.json`

14 índices compostos para queries por `tenantId + createdAt`, `tenantId + category`, `recipientUid + read`, etc.

---

## 10. Considerações de Segurança

- **CSP restritivo** em `vercel.json` — `connect-src` limitado a domínios Firebase
- **Todos os writes** via Cloud Functions — nunca direto do cliente
- **Relatórios públicos** com TTL de 14 dias (`TTL_DAYS = 14`)
- **Campos derivados** (`processHighlights`, `warrantFindings`, `keyFindings`, `executiveSummary`) computados **no servidor** em `concludeCaseByAnalyst` — nunca aceitos do cliente
- **Sanitização de HTML** em relatórios públicos antes de persistir
- **Circuit breaker** protege contra cascata de falhas em APIs externas
- **Regras Firestore** bloqueiam auto-promoção de role e cross-tenant access
- **Secrets** sensíveis (API keys, tokens) via `defineSecret` do Firebase Functions

---

## 11. Estado Atual do Projeto (2026-05-03)

- **Layout Standardization:** ~90% concluído. `PageShell` + `PageHeader` implementados e integrados nos 20 portais.
- **Testes:** 55 arquivos de teste no total (43 raiz + 12 functions), todos passando.
- **Build:** Limpo, sem warnings.
- **Deploy ativo:** Vercel + Firebase Functions (`compliance-hub-br`).
- **Sem CI/CD:** Deploy é manual via CLI. Não há GitHub Actions configurado.
- **Arquivos não commitados:** ~1.447 (alta atividade de desenvolvimento).

### Decisões de Arquitetura Registradas (ADRs)

1. **ADR-001:** Campos derivados são computados no `concludeCaseByAnalyst`, não no enriquecimento.
2. **ADR-002:** Campos derivados nunca passam pelo `ALLOWED_CONCLUDE_FIELDS` (segurança).
3. **ADR-003:** TTL de relatórios públicos = 14 dias.
4. **ADR-004:** `PublicReportPage` diferencia erros de expiração vs. não encontrado.

---

## 12. Documentação Complementar

- **`README.md`** — Documento vivo de planejamento técnico e funcional (737 linhas). Contém fluxo de enriquecimento, referência de campos Firestore, ADRs, registro de progresso por fase.
- **`docs/superpowers/specs/`** — Especificações de design aprovadas.
- **`docs/superpowers/plans/`** — Planos de implementação detalhados (ex: layout standardization).
- **`docs/audits/`** — Relatórios de auditoria.

---

*ComplianceHub — Guia interno para agentes de código.*

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
