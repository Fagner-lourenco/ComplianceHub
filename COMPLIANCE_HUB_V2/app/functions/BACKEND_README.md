# Backend — Compliance Hub V2

## Arquitetura

```
Domain -> Application -> Infrastructure -> Interface
```

| Camada | Responsabilidade | Exemplos |
|--------|------------------|----------|
| **Domain** | Regras de negócio puras, sem I/O | `v2ScoreEngine`, `v2NormalizationRules`, `dossierSchema` |
| **Application** | Orquestração de casos de uso | `createDossier`, `processDossier`, `getDossierDetail` |
| **Infrastructure** | I/O e externos | `firestore`, `cloudStorage`, `bigdatacorp` adapter |
| **Interface** | API HTTP, triggers, webhooks | `controllers`, `middleware`, `onCaseCreated` |

## Estrutura de Pastas

```
functions/
├── index.js                    # Entry point (~80 linhas)
├── bootstrap.js                # Monolito legacy (backup durante migração)
├── config/                     # Variáveis de ambiente, defaults, feature flags
├── constants/                  # Coleções, erros, roles
├── domain/                     # Regras de negócio puras
├── application/                # Casos de uso
├── infrastructure/             # I/O e clientes externos
├── adapters/                   # Clientes de API (BDC, Judit, Escavador, etc.)
├── normalizers/                # Transformação de respostas externas
├── interfaces/                 # HTTP controllers, triggers, webhooks
├── helpers/                    # Utilitários cross-cutting
└── __tests__/                  # Testes unitários e integração
```

## APIs Externas

### BigDataCorp (BDC) — Fonte Primária

- **Base URL:** `https://plataforma.bigdatacorp.com.br`
- **Auth:** Dual-header JWT (`AccessToken` + `TokenId`)
- **Endpoints:** `/pessoas`, `/empresas`, `/processos`, etc.
- **Datasets suportados:** 30+ catalogados em `adapters/bigdatacorpCatalog.js`
- **Query Builder:** `adapters/bigdatacorpQueryBuilder.js`

### Outros Provedores (Fallback)

- Judit, Escavador, FonteData, DJEN

## Endpoints REST (V2)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/dossiers` | Listar dossiês |
| POST | `/api/v1/dossiers` | Criar dossiê |
| GET | `/api/v1/dossiers/:id` | Detalhe do dossiê |
| POST | `/api/v1/dossiers/:id/process` | Iniciar processamento |
| POST | `/api/v1/dossiers/:id/process` | Iniciar processamento (status only) |
| POST | `/api/v1/dossiers/:id/retry-source` | Reprocessar fonte específica |
| POST | `/api/v1/dossiers/:id/reprocess-bdc` | **Reprocessar todas as consultas BDC** |
| PATCH | `/api/v1/dossiers/:id` | Atualizar tag/análise |
| GET | `/api/v1/sources` | Listar fontes disponíveis |
| GET | `/api/v1/profiles` | Listar perfis |
| POST | `/api/v1/profiles` | Criar perfil customizado |
| POST | `/api/v1/analysis/comments` | Adicionar comentário |
| PATCH | `/api/v1/analysis` | Atualizar análise conclusiva |
| POST | `/api/v1/analysis/approve` | Aprovar dossiê |
| POST | `/api/v1/analysis/reject` | Reprovar dossiê |

## Triggers Firestore

| Trigger | Coleção | Ação |
|---------|---------|------|
| `enrichBigDataCorpOnCaseV2` | `cases` onCreate | Orquestra enriquecimento BDC-first |
| `onModuleRunUpdatedV2` | `moduleRuns` onUpdate | Retry automático e progresso |

## Score de Risco

Engine em `domain/v2ScoreEngine.js`:
- **6 dimensões:** Reguladores (30%), Jurídico (25%), Financeiro (20%), Reputacional (10%), Conflito (10%), ESG (5%)
- **18+ regras de sinal:** PEP, sanções, processos criminais, dívidas, etc.
- **Classificação:** low (0-24), medium (25-49), high (50-74), critical (75-100)

## Cache

3 camadas:
1. **Provider Ledger** (Firestore) — cache de negócio com TTL por dataset
2. **Memória** (LRU) — 100 itens, 5 minutos
3. **Firestore** — `providerRequests` com índice composto

## Segurança

- **Auth:** Firebase Authentication (JWT)
- **RBAC:** 5 papéis (client_viewer, analyst, senior_analyst, supervisor, admin)
- **Tenant Isolation:** 100% das queries exigem `tenantId`
- **Dados sensíveis:** CPF/CNPJ via `dochash{SHA-256}` na BDC

## Variáveis de Ambiente

```bash
BIGDATACORP_ACCESS_TOKEN=xxx
BIGDATACORP_TOKEN_ID=yyy
BIGDATACORP_BASE_URL=https://plataforma.bigdatacorp.com.br
ENABLE_BDC_FIRST=true
ENABLE_SCORE_ENGINE=true
ENABLE_AUTO_PROCESS=true
```

## Testes

```bash
npm test              # Jest com coverage
npm run test:watch    # Modo watch
```

## Deploy

```bash
firebase deploy --only functions
```

## Migração do Monolito

O arquivo `bootstrap.js` contém a lógica legacy de ~10.600 linhas.
Durante a migração, novas functions são adicionadas nos registradores modulares.
O `index.js` importa tanto o legacy quanto os novos módulos.
