# ComplianceHub — Agent Guide

> Documento para agentes de código. Língua principal dos comentários e docs: **português (PT-BR)**. Identificadores de código: **inglês**.
> Última atualização: 2026-05-31.

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
(raiz do projeto)
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
│   ├── index.js                  # Entry principal (~1.800 linhas): wiring, triggers, wrappers
│   ├── reportBuilder.cjs         # Mirror server-side do reportBuilder (CommonJS)
│   ├── modules/                  # 26 módulos extraídos (Phase C)
│   │   ├── _shared/              # auth, fieldConstants, sanitizers, providerConfigs, analysisConfig
│   │   ├── aiOrchestrator.js     # Prompts, runners, payload builders, cost
│   │   ├── aiParsers.js          # Sanitização e parsing de respostas OpenAI
│   │   ├── autoClassification.js # Classificação automática + handlers AI
│   │   ├── caseManager/          # caseFilters.js
│   │   ├── caseQueriesAssignments.js # Listagens V1/V2, métricas, assignments, reruns
│   │   ├── clientSolicitations.js    # Criação e correção de solicitações
│   │   ├── clientVerdictPolicy.js    # Política de veredito do cliente
│   │   ├── concludeCaseAndSettings.js # Funções puras: pickConcludePayload, syncPublicResult
│   │   ├── deterministicPrefill.js   # Prefill determinístico
│   │   ├── enrichmentPhases.js       # Fases: FonteData, Escavador, BigDataCorp, Judit, DJEN
│   │   ├── enrichmentTriggers.js     # 6 triggers Firestore (onDocument)
│   │   ├── exportJobsAndReports.js   # Export jobs + relatórios públicos
│   │   ├── juditWebhookAndFallback.js # Webhook + fallback async Judit
│   │   ├── notificationService.js    # Notificações push/email
│   │   ├── opsReviewHandlers.js      # Handlers: conclude, settings, draft, aiDecision
│   │   ├── pdfGeneration.js          # Geração de PDF via Puppeteer
│   │   ├── publishAndSync.js         # Sincronização cases↔clientCases + publicação
│   │   ├── rateLimitMiddleware.js    # Rate limiting via Firestore
│   │   ├── reportEngine.js           # Geração e sanitização de relatórios
│   │   ├── systemHealth.js           # Saúde do sistema + quotas
│   │   ├── tenantUserManagement.js   # Gestão de usuários por tenant
│   │   └── utilityHelpers.js         # formatDateKey, formatMonthKey
│   ├── adapters/                 # Clientes HTTP para APIs externas (6 adapters)
│   ├── normalizers/              # Mapeamento resposta externa → schema interno
│   ├── helpers/                  # 14 helpers: circuitBreaker, aiHomonym, tribunalMap, pdfHtml, pdfRenderer, textNormalize, enrichmentStatus, exportManager, normalize, paginateFirestoreQuery, rateLimiter, processClassifier, roleClassifier, reportHelpers
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

55+ arquivos de teste em `src/` cobrindo:
- Lógica de negócio: `caseSla`, `clientPortal`, `enrichmentStatus`, `errorUtils`, `portalPaths`, `validators`
- Contextos: `AuthContext`, `TenantContext`
- Serviços: `firestoreService`
- Permissões: `permissions`
- Componentes: `QuotaBar`, `Sidebar`, `Topbar`, `NovaSolicitacaoPage`, `CasoPage`, páginas diversas
- Hooks: `useAuditLogs`, `useCases`

Mais `firestore.rules.test.js` na raiz (5 testes de contrato de segurança) e `frontendBackendContract.test.js` (contrato frontend↔backend).

### Backend (`functions/`)

55+ arquivos de teste:
- Adapters: `djen.test.js`, `judit.test.js`
- Audit: `auditCatalog.test.js`, `writeAuditEvent.test.js`
- Helpers: `aiCalibration.test.js`, `aiHomonym.test.js`, `deterministicPrefill.test.js`, `sanitizeAiOutput.test.js`, `paginateFirestoreQuery.test.js`, `rateLimiter.test.js`, `processClassifier.test.js`, `roleClassifier.test.js`, `exportManager.test.js`, `pdfRenderer.test.js`
- Modules: `aiOrchestrator.test.js`, `autoClassification.test.js`, `caseQueriesAssignments.test.js`, `clientSolicitations.test.js`, `concludeCaseAndSettings.test.js`, `deterministicPrefill.test.js`, `enrichmentPhases.test.js`, `enrichmentTriggers.test.js`, `exportJobsAndReports.test.js`, `juditWebhookAndFallback.test.js`, `notificationService.test.js`, `opsReviewHandlers.test.js`, `pdfGeneration.test.js`, `publishAndSync.test.js`, `reportEngine.test.js`, `systemHealth.test.js`, `tenantUserManagement.test.js`, `utilityHelpers.test.js`
- Normalizers: `bigdatacorp.test.js`, `djen.test.js`
- Shared: `auth.test.js`, `fieldConstants.test.js`, `providerConfigs.test.js`, `sanitizers.test.js`
- Raiz: `backfillClientCasesMirror.test.js`, `caseCommunication.test.js`, `clientPayloadChanged.test.js`, `enforceTenantSubmissionLimits.test.js`, `exportJobsExportsContract.test.js`, `exportWorker.test.js`, `fetchTenantCaseDocuments.test.js`, `getClientQuotaStatus.test.js`, `getPublicReportView.test.js`, `identityGate.test.js`, `isAutoClassifyOnlyChange.test.js`, `listClientCasesV2.test.js`, `listOpsCasesV2.test.js`, `publicResultPrivacy.test.js`, `repairAllClaims.test.js`, `shared/riskCalculator.test.js`

### Estado Atual dos Testes

- **Raiz:** 55+ arquivos de teste, ~1.200+ testes passando
- **Functions:** 55 arquivos de teste, ~1.200+ testes passando
- Duração total backend: ~8s

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

## 11. Estado Atual do Projeto (2026-05-31)

- **Phase C — Modularização:** CONCLUÍDA. `functions/index.js` de ~13.366 para ~1.800 linhas (−87%). 26 módulos extraídos com factories e wrappers de dependência.
- **Phase B — Async Export:** CONCLUÍDA. 5 callables de exportação assíncrona registrados + teste de contrato.
- **Testes:** 55 arquivos backend + 55+ frontend = ~2.400+ testes passando.
- **Lint:** 0 erros (root + functions).
- **Deploy ativo:** Vercel + Firebase Functions (`compliance-hub-br`). Nenhum deploy da branch `refactor/full-local-roadmap`.
- **Sem CI/CD:** Deploy é manual via CLI. Não há GitHub Actions configurado.
- **Segurança:** CSP atualizado (`*.cloudfunctions.net` → domínio específico). CORS restrito em 21 de 22 callables. Rate limiter wireado via middleware.
- **Phase D (código morto):** Pendente. Stale handlers removidos de `concludeCaseAndSettings.js`, re-export modules deletados.

### Decisões de Arquitetura Registradas (ADRs)

1. **ADR-001:** Campos derivados são computados no `concludeCaseByAnalyst`, não no enriquecimento.
2. **ADR-002:** Campos derivados nunca passam pelo `ALLOWED_CONCLUDE_FIELDS` (segurança).
3. **ADR-003:** TTL de relatórios públicos = 14 dias.
4. **ADR-004:** `PublicReportPage` diferencia erros de expiração vs. não encontrado.

---

## 12. Acesso Firestore REST via OAuth (Firebase CLI)

Para consultar documentos do Firestore em produção sem depender do MCP instável ou de `serviceAccountKey.json`, usar o token de refresh do Firebase CLI:

### Pré-requisitos
- `firebase-tools` instalado e logado (`firebase login`).
- Arquivo de tokens: `%USERPROFILE%\.config\configstore\firebase-tools.json` (Windows) ou `~/.config/configstore/firebase-tools.json` (Linux/Mac).

### Passo a passo
1. Ler o refresh token do arquivo acima (`tokens.refresh_token`).
2. Trocar por access token via `POST https://oauth2.googleapis.com/token`:
   - `grant_type=refresh_token`
   - `refresh_token=<token>`
   - `client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com`
   - `client_secret=j9iVZfS8kkCEFUPaAeJV0sAi`
3. Usar o access token no header `Authorization: Bearer <token>`.
4. Endpoint Firestore REST:
   ```
   GET https://firestore.googleapis.com/v1/projects/compliance-hub-br/databases/(default)/documents/cases/{caseId}
   ```
   - Usar `mask.fieldPaths=field1&mask.fieldPaths=field2` para evitar erros de `nullValue`.
   - Para subcoleções: `.../documents/cases/{caseId}/publicResult/latest`.

### Exemplo de script
O script `scripts/normalize-firestore-cases.cjs` já implementa esse fluxo completo com decodificação de tipos Firestore (`stringValue`, `integerValue`, `mapValue`, `arrayValue`, etc.).

### Observações de segurança
- Nunca commitar tokens, client secrets ou outputs de documentos sensíveis.
- O access token expira em ~1h; usar refresh token para renovar.
- Preferir field masks para limitar dados transferidos e evitar parsing de campos nulos.

---

## 13. Documentação Complementar

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
