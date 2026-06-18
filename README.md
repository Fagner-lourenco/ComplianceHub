# ComplianceHub — Planejamento Técnico e Funcional

> Documento vivo. Atualizado em 2026-06-01.
> Stack: React 19 + Vite 7 → Vercel | Firebase Cloud Functions (Node 22, Gen2, southamerica-east1) | Firestore | OpenAI GPT

---

## Índice

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Arquitetura Atual](#2-arquitetura-atual)
3. [Diagnóstico — Estado do Sistema](#3-diagnóstico--estado-do-sistema)
4. [Fluxo de Enriquecimento](#4-fluxo-de-enriquecimento)
5. [Sistema de Backup Automatizado](#5-sistema-de-backup-automatizado)
6. [Referência de APIs e Provedores](#6-referência-de-apis-e-provedores)
7. [Referência de Campos do Firestore](#7-referência-de-campos-do-firestore)
8. [Comandos de Deploy](#8-comandos-de-deploy)
9. [Decisões de Arquitetura (ADRs)](#9-decisões-de-arquitetura-adrs)
10. [Registro de Progresso](#10-registro-de-progresso)
11. [Próximas Fases](#11-próximas-fases)

---

## 1. Visão Geral do Produto

O **ComplianceHub** é uma plataforma SaaS B2B de análise de antecedentes e *due diligence* para compliance trabalhista e criminal em empresas brasileiras. O sistema automatiza a coleta de dados em múltiplas fontes externas (Judit, Escavador, FonteData, BigDataCorp, DJEN), aplica IA (OpenAI GPT) para triagem de homônimos e síntese, e entrega um relatório HTML estruturado ao analista e, opcionalmente, ao cliente.

### Objetivos de Negócio

| Objetivo | Métrica Chave |
|---|---|
| Reduzir tempo de análise por caso | < 30 min/caso (meta: < 10 min com IA) |
| Cobertura processual CPF | ≥ 95% dos casos com CPF utilizado |
| Satisfação do cliente final | Zero falsos positivos criminais entregues |
| Confiabilidade da plataforma | Uptime ≥ 99,5% / mês |
| Backup e recuperação | Backup diário automatizado, retenção 7 dias |

### Personas

- **Analista Ops** — usa o painel interno (`/ops/*`) para revisar, anotar e concluir casos
- **Gestor / Admin** — configura tenants, fases habilitadas, limites de SLA, gerencia usuários
- **Cliente Final** — acessa o portal de leitura (`/client/*`) para ver status e, quando liberado, o relatório

---

## 2. Arquitetura Atual

```
Usuário / Cliente
    │
    ├──► Vercel (React 19 + Vite 7) — SPA
    │        ├── Portal Ops    (/ops/*)     → analistas, supervisores, admins, owners
    │        ├── Portal Client (/client/*)  → clientes finais (viewer, operator, manager)
    │        └── Relatório Público (/r/:token) → acesso sem login
    │
    └──► Firebase (southamerica-east1)
             ├── Cloud Functions Gen2 (Node 22) — 50+ endpoints
             │       ├── Enriquecimento: BigDataCorp (gate), Judit, Escavador, DJEN
             │       │   FonteData (fallback)
             │       ├── Conclusão: concludeCaseByAnalyst
             │       ├── Relatório Público: createAnalystPublicReport
             │       ├── Exportações: createExportJob, processExportJob (assíncrono)
             │       ├── PDF: generateClientCasePdf, generatePublicReportPdf
             │       ├── Backup: backupDaily (Cloud Scheduler, diário)
             │       └── Triggers: publishResultOnCaseDone, syncClientCaseOn*
             ├── Firestore
             │       ├── cases/{caseId}           ← documento principal (~150 campos)
             │       ├── cases/{caseId}/publicResult/latest  ← campos públicos
             │       ├── publicReports/{token}    ← HTML + expiresAt
             │       ├── clientCases/{caseId}     ← visão do cliente
             │       ├── auditLogs/{logId}        ← auditoria OPS
             │       ├── tenantAuditLogs/{logId}  ← auditoria cliente
             │       └── systemHealth/{provider}  ← health checks
             └── Firebase Auth — autenticação com custom claims (role, tenantId)
```

### RBAC

8 roles, 10 permissions via custom claims no Firebase Auth:

| Role | Escopo | Acesso |
|------|--------|--------|
| `owner` | Global | Tudo + backfill + repair claims |
| `admin` | Global | Gestão de tenants, usuários, auditoria |
| `supervisor` | Tenant | Atribuir casos, bypass gate, auditoria |
| `analyst` | Tenant | Analisar, concluir, rerun AI |
| `client_manager` | Tenant | Criar solicitações, exportar, gerar relatórios |
| `client_operator` | Tenant | Criar solicitações, ver status |
| `client_viewer` | Tenant | Somente leitura |
| `CLIENT` (legacy) | Tenant | Compatibilidade reversa |

### Módulos Extraídos (Phase C)

O backend foi modularizado em 26 módulos:

| Módulo | Responsabilidade |
|--------|-----------------|
| `aiOrchestrator.js` | Prompts, runners, payload builders, custo IA |
| `aiParsers.js` | Sanitização e parsing de respostas OpenAI |
| `autoClassification.js` | Classificação automática + handlers AI |
| `backupWorker.js` | Backup diário Firestore + Auth |
| `caseQueriesAssignments.js` | Listagens V1/V2, métricas, assignments, reruns |
| `clientSolicitations.js` | Criação e correção de solicitações |
| `clientVerdictPolicy.js` | Política de veredito do cliente |
| `concludeCaseAndSettings.js` | Funções puras: pickConcludePayload, syncPublicResult |
| `deterministicPrefill.js` | Prefill determinístico |
| `enrichmentPhases.js` | Fases: FonteData, Escavador, BigDataCorp, Judit, DJEN |
| `enrichmentTriggers.js` | 6 triggers Firestore (onDocument) |
| `exportJobsAndReports.js` | Export jobs + relatórios públicos |
| `juditWebhookAndFallback.js` | Webhook + fallback async Judit |
| `notificationService.js` | Notificações push/email |
| `opsReviewHandlers.js` | Handlers: conclude, settings, draft, aiDecision |
| `pdfGeneration.js` | Geração de PDF via Puppeteer |
| `publishAndSync.js` | Sincronização cases↔clientCases + publicação |
| `rateLimitMiddleware.js` | Rate limiting via Firestore |
| `reportEngine.js` | Geração e sanitização de relatórios |
| `systemHealth.js` | Saúde do sistema + quotas |
| `tenantUserManagement.js` | Gestão de usuários por tenant |
| `utilityHelpers.js` | formatDateKey, formatMonthKey |
| `_shared/auth.js` | Autenticação e autorização |
| `_shared/fieldConstants.js` | Constantes de campos |
| `_shared/sanitizers.js` | Sanitização de dados |
| `_shared/providerConfigs.js` | Configuração de provedores |

---

## 3. Diagnóstico — Estado do Sistema

### Métricas Atuais

| Métrica | Valor |
|---------|-------|
| **Testes backend** | 55 arquivos, 1223 testes |
| **Testes frontend** | 55+ arquivos, ~1200 testes |
| **Testes totais** | ~2400+ passando |
| **Lint** | 0 erros (root + functions) |
| **Build** | Limpo, sem warnings |
| **Cobertura Segurança** | CSP, CORS em 21/22 callables, rate limiting, circuit breaker |
| **Deploy** | Vercel + Firebase Functions (`compliance-hub-br`) |
| **Branch ativa** | `main` |

### Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | React | 19.2 |
| **Router** | React Router DOM | 7.13 |
| **Build** | Vite | 7.3 |
| **Backend** | Firebase Cloud Functions Gen2 | Node 22 |
| **Admin SDK** | firebase-admin | 13.7 |
| **Functions SDK** | firebase-functions | 7.2 |
| **Database** | Firestore (NoSQL) | Standard, southamerica-east1 |
| **Auth** | Firebase Auth + custom claims | — |
| **PDF/Print** | Puppeteer-core + @sparticuz/chromium | 24.4 / 148 |
| **Testes Frontend** | Vitest + jsdom + @testing-library/react | 4.0 |
| **Testes Backend** | Vitest | 2.0 |
| **E2E** | Playwright | 1.58 |
| **Lint** | ESLint 9 (flat config) | — |
| **Hospedagem** | Vercel (frontend), Firebase (backend) | — |

### Circuit Breakers

| Provedor | Threshold | Cooldown |
|----------|-----------|----------|
| Judit | 5 falhas | 10 min |
| Escavador | 5 falhas | 10 min |
| FonteData | 5 falhas | 10 min |
| OpenAI | 3 falhas | 5 min |

---

## 4. Fluxo de Enriquecimento

> Atual: **BigDataCorp-first** (async desabilitado por padrão).

```
Criação do Caso
    │
    ▼
BigDataCorp — Gate de Identidade (R$ 0,03)
    │  └─ valida CPF ativo + similaridade nome + óbito
    │  └─ Fallback: FonteData receita-federal-pf (R$ 0,54) se gate falhar
    ▼ (gate passou)
BigDataCorp — Processos (R$ 0,07) + Judit sync datalake (R$ 0,50)
    │
    ▼
PARALELO: Mandados Judit (R$ 1,00) + Execução Penal Judit (R$ 0,50)
    │
    ▼
Escavador — Cross-validação [condicional: criminal/warrant/execution flags]
    │
    ▼
DJEN — Comunicações processuais [condicional]
    │
    ▼
IA — Triagem de Homônimos (se ambiguidade detectada)
    │
    ▼
IA — Estruturação Semântica + Classificação
    │  └─ { resumo, evidencias[], riskScore, riskLevel, autoClassification... }
    │
    ▼
[ANALISTA CONCLUI] → concludeCaseByAnalyst
    │  └─ Computa: processHighlights, warrantFindings, keyFindings, executiveSummary
    │  └─ Calcula: riskScore, riskLevel
    ▼
publishResultOnCaseDone (trigger)
    │  └─ Copia campos públicos → publicResult/latest
    ▼
Relatório disponível (frontend + backend reportBuilder)
```

### Estados do Caso

| Status | Significado |
|--------|-------------|
| `PENDING` | Aguardando enriquecimento |
| `IN_PROGRESS` | Em análise pelo analista |
| `DONE` | Concluído, relatório disponível |
| `CORRECTION_NEEDED` | Devolvido ao cliente para correção |
| `BLOCKED` | Gate de identidade bloqueado |
| `REJECTED` | Rejeitado manualmente |

---

## 5. Sistema de Backup Automatizado

### Visão Geral

Backup diário automático do Firestore e Firebase Auth, implementado em **2026-06-01**.

```
Cloud Scheduler (02:00 BRT)
    │
    ▼
Cloud Function: backupDaily (onSchedule)
    │
    ├──► Firestore managed export → gs://backups-compliance-hub-br/firestore/<data>/
    │    └─ API: POST /v1/projects/.../databases/(default):exportDocuments
    │
    └──► Auth export → gs://backups-compliance-hub-br/auth/<data>/users.json
         └─ admin.auth().listUsers() paginado + admin.storage().bucket().file().save()
    │
    ▼
GCS Lifecycle: auto-delete objetos > 7 dias
```

### Configuração

| Item | Valor |
|------|-------|
| **Bucket** | `gs://backups-compliance-hub-br` |
| **Região** | `southamerica-east1` |
| **Agenda** | Todo dia às 02:00 (horário de Brasília) |
| **Retenção** | 7 dias (lifecycle GCS) |
| **Função** | `backupDaily` (Cloud Function Gen2, onSchedule) |
| **Timeout** | 300s |
| **Memória** | 512 MiB |
| **IAM Projeto** | `roles/datastore.importExportAdmin` → service account |
| **IAM Bucket** | `roles/storage.objectAdmin` → service account |

### Estrutura no Bucket

```
backups-compliance-hub-br/
├── firestore/
│   ├── 2026-06-01/       ← managed export (metadados + dados)
│   └── 2026-06-02/
├── auth/
│   ├── 2026-06-01/
│   │   └── users.json    ← todos os usuários (uid, email, claims, providers)
│   └── 2026-06-02/
│       └── users.json
```

### Restauração de Emergência

```bash
# Restaurar Firestore
gcloud firestore import gs://backups-compliance-hub-br/firestore/2026-06-01/ \
  --project=compliance-hub-br

# Auth — script de recriação a partir do users.json
# (usuários precisam redefinir senha; dados + customClaims são preservados)
```

### Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `functions/modules/backupWorker.js` | Cloud Function de backup diário |
| `scripts/setup-backup-bucket.cjs` | Script one-time de criação do bucket |

---

## 6. Referência de APIs e Provedores

| Provedor | Dados | Adapter | Gate | Custo Aprox. |
|----------|-------|---------|------|-------------|
| **BigDataCorp** | KYC, processos, profissão | `adapters/bigdatacorp.js` | ✅ Primário | R$ 0,03-0,07 |
| **Judit** | Processos, mandados, execução criminal, entity data lake | `adapters/judit.js` | — | R$ 0,50-1,00 |
| **Escavador** | Processos por CPF/nome | `adapters/escavador.js` | — | Por requisição |
| **FonteData** | Receita Federal, financeiro, identidade | `adapters/fontedata.js` | ⚠️ Fallback | R$ 0,54 |
| **DJEN** | Comunicações processuais | `adapters/djen.js` | — | Gratuito |
| **OpenAI GPT** | Análise estruturada, triagem homônimos | inline em `aiOrchestrator.js` | — | Por token |

### Campos Estruturados por Provedor

**`juditRoleSummary` (por processo):**
```js
{
  code, area, status, isCriminal,
  hasExactCpfMatch, hasDivergentCpf,
  tribunalAcronym, distributionDate,
  personType, side,
  subjects[], classifications[], phase,
  isPossibleHomonym, secrecyLevel,
}
```

**`juditWarrants` (por mandado):**
```js
{
  code, status, warrantType, arrestType,
  issueDate, expirationDate, tribunalAcronym,
  court, regime, durationYears, judgementSummary,
}
```

**`escavadorProcessos` (por processo):**
```js
{
  numeroCnj, area, classe, assuntoPrincipal,
  valorCausa, status, tribunalSigla,
  dataInicio, polo, tipoNormalizado,
  segredoJustica, grau, grauFormatado,
  hasExactCpfMatch, hasDivergentCpf,
}
```

---

## 7. Referência de Campos do Firestore

### `cases/{caseId}` — Campos Principais

| Campo | Tipo | Descrição | Populado por |
|---|---|---|---|
| `candidateName` | string | Nome do candidato | Criação |
| `cpf` | string | CPF sem formatação | Criação |
| `tenantId` | string | ID do tenant | Criação |
| `status` | string | PENDING / IN_PROGRESS / DONE / CORRECTION_NEEDED / BLOCKED | Sistema |
| `bigdatacorpGateResult` | object | Resultado do gate BDC | Enriquecimento |
| `bigdatacorpProcessos` | array | Processos BigDataCorp | Enriquecimento |
| `juditRoleSummary` | array | Processos Judit normalizados | Enriquecimento |
| `juditWarrants` | array | Mandados Judit normalizados | Enriquecimento |
| `juditCriminalCount` | number | Processos criminais confirmados | Enriquecimento |
| `juditActiveWarrantCount` | number | Mandados pendentes | Enriquecimento |
| `escavadorProcessos` | array | Processos Escavador | Enriquecimento |
| `djenComunicacoes` | array | Comunicações DJEN | Enriquecimento |
| `aiStructured` | object | Saída estruturada da IA | Enriquecimento |
| `aiHomonymStructured` | object | Resultado da triagem de homônimos | Enriquecimento |
| `processHighlights` | array | Destaques processuais | `concludeCaseByAnalyst` |
| `warrantFindings` | array | Achados de mandados | `concludeCaseByAnalyst` |
| `keyFindings` | array | Principais apontamentos | `concludeCaseByAnalyst` |
| `executiveSummary` | string | Resumo executivo final | `concludeCaseByAnalyst` |
| `deterministicPrefill` | object | Prefill determinístico (v5) | `concludeCaseByAnalyst` |
| `criminalFlag` | string | POSITIVE / NEGATIVE / INCONCLUSIVE / NOT_FOUND | Formulário analista |
| `warrantFlag` | string | POSITIVE / NEGATIVE / NOT_FOUND | Formulário analista |
| `riskScore` | number | 0-100 | `concludeCaseByAnalyst` |
| `riskLevel` | string | HIGH / MEDIUM / LOW | `concludeCaseByAnalyst` |
| `finalVerdict` | string | FIT / ATTENTION / NOT_RECOMMENDED | Formulário analista |
| `analystComment` | string | Comentário do analista | Formulário analista |

### `publicReports/{token}` — Campos

| Campo | Tipo | Descrição |
|---|---|---|
| `html` | string | HTML sanitizado do relatório |
| `createdAt` | Timestamp | Data de criação |
| `expiresAt` | Date | Data de expiração (14 dias) |
| `caseId` | string | Referência ao caso |
| `tenantId` | string | Tenant dono do relatório |
| `active` | boolean | `false` = revogado manualmente |
| `token` | string | Token público de acesso |

---

## 8. Comandos de Deploy

```bash
# Deploy apenas das Cloud Functions
firebase deploy --only functions --project=compliance-hub-br

# Deploy de função específica
firebase deploy --only functions:backupDaily --project=compliance-hub-br

# Deploy do frontend
npm run build && vercel --prod --yes

# Deploy completo
firebase deploy --only functions --project=compliance-hub-br && npm run build && vercel --prod --yes

# Rodar todos os testes
npm test                        # frontend (55+ arquivos)
cd functions && npm test        # backend (55 arquivos, 1223 testes)
```

### Pré-condições para Deploy Seguro

1. `npm test` — 55+ arquivos frontend passando
2. `cd functions && npm test` — 55 arquivos backend, 1223 testes passando
3. `npm run build` — zero erros de compilação
4. Variáveis de ambiente validadas: `JUDIT_API_KEY`, `ESCAVADOR_API_KEY`, `OPENAI_API_KEY`
5. `RESULT_ONLY_FIELDS` (backend) e `PUBLIC_RESULT_FIELDS` (frontend) em sincronia

---

## 9. Decisões de Arquitetura (ADRs)

### ADR-001 — Derivação de Campos no Conclude (não no Enriquecimento)

**Decisão:** `processHighlights`, `warrantFindings`, `keyFindings` e `executiveSummary` são computados na hora da conclusão, não durante o enriquecimento.

**Motivação:** O analista pode re-categorizar flags que afetam quais processos são destaques. Derivar no conclude garante que o relatório sempre reflita a decisão final do analista.

### ADR-002 — Campos Derivados não Passam pelo `ALLOWED_CONCLUDE_FIELDS`

**Decisão:** Os campos derivados são adicionados diretamente ao `updatePayload` no servidor, NUNCA ao `ALLOWED_CONCLUDE_FIELDS`.

**Motivação:** Campos computados pelo servidor a partir de dados confiáveis. Permitir que o cliente os envie seria superfície de injeção de conteúdo.

### ADR-003 — Relatório Público com TTL de 14 dias

**Decisão:** TTL de 14 dias para links de relatório público.

**Motivação:** Links de dados sensíveis têm ciclo de vida curto em compliance. 14 dias cobre o período de análise com menor janela de exposição.

### ADR-004 — `PublicReportPage` diferencia erros de expiração

**Decisão:** Verificar `expiresAt` no frontend antes de renderizar. Exibir mensagem específica para link expirado vs. não encontrado.

### ADR-005 — Backup Diário Automatizado

**Decisão:** Implementar backup diário do Firestore (managed export) e Firebase Auth (listUsers) com retenção de 7 dias via lifecycle GCS.

**Motivação:** Garantir recuperação de dados em caso de falha catastrófica. Managed export é operação server-side sem impacto no tráfego de produção.

### ADR-006 — BigDataCorp como Gate Primário

**Decisão:** BigDataCorp é o gate de identidade primário. FonteData é fallback quando BDC falha.

**Motivação:** BigDataCorp tem menor custo (R$ 0,03 vs R$ 0,54) e oferece validação de CPF ativo + óbito + nome.

### ADR-007 — Modularização (Phase C)

**Decisão:** Extrair lógica de negócio do `index.js` para 26 módulos especializados com factory pattern + injeção de dependência.

**Motivação:** `index.js` passou de ~13.366 para ~1.850 linhas (-87%). Cada módulo é testável isoladamente.

### ADR-008 — Escavador2 Classifica Papéis pelo Role Classifier Central

**Decisão:** O normalizador `escavador2.js` usa `classifyRole(role, area, side)` de `helpers/roleClassifier.js` ao invés de atribuir papéis de forma ad-hoc.

**Motivação:** Centralizar regras de classificação reduz inconsistências entre provedores e garante que a área `LABOR` seja normalizada para `Trabalhista` antes da classificação.

### ADR-009 — Processos Escavador2 Visíveis no Portal Ops

**Decisão:** Todos os processos retornados pelo Escavador2 são renderizados no `CasoPage` do portal Ops, separados em "Novos achados" e "Processos confirmatórios/duplicados".

**Motivação:** Auditar processos duplicados/confirmatórios é necessário para supervisores, mesmo quando não alteram prefill ou classificação automática.

### ADR-010 — Pipeline Escavador2 Endurecido contra Dados Stale

**Decisão:** A fase `runEscavador2EnrichmentPhase` limpa campos derivados (`escavador2Processos`, `escavador2NewFinding`, etc.) no início da execução e em caso de falha, preservando apenas `escavador2RawPayloads`. Reruns manuais e em cascade exigem provedores upstream terminalizados.

**Motivação:** Evitar que resultados antigos persistam após reprocessamento, garantindo integridade da classificação automática e do relatório final.

---

## 10. Registro de Progresso

### Linha do Tempo

```
2026-04-03  ✅ Fase 0: Relatório Final Completo
2026-04-05  ✅ Fase 1: Inteligência Contextual
2026-04-05  ✅ Fase 2: Portal do Cliente
2026-04-05  ✅ Fase 3A: Qualidade da Análise (Circuit Breaker, Saúde, Checklist)
2026-04-05  ✅ Fase 3B: UX e Eficiência (Bulk Actions, Atalhos, Filtros, Dark Mode)
2026-05-31  ✅ Phase B: Exportação Assíncrona (5 callables + contrato)
2026-05-31  ✅ Phase C: Modularização (26 módulos extraídos, -87% index.js)
2026-05-31  ✅ Auditorias: correções de segurança, remoção de código morto
2026-06-01  ✅ Backup Diário: Firestore + Auth, retenção 7 dias
2026-06-18  ✅ Escavador2: visibilidade Ops, role classifier central e pipeline endurecido
```

### Fase 0 — Relatório Final Completo ✅ 2026-04-03

| Item | Descrição | Status |
|------|-----------|--------|
| 5.1 | 4 helpers backend | ✅ |
| 5.2 | Helpers plugados em `concludeCaseByAnalyst` | ✅ |
| 5.3 | `RESULT_ONLY_FIELDS` expandido (+4 campos) | ✅ |
| 5.4 | `PUBLIC_RESULT_FIELDS` espelhado no frontend | ✅ |
| 5.5 | TTL 14 dias | ✅ |
| 5.6 | `PublicReportPage` verifica `expiresAt` | ✅ |
| 5.7 | `analystComment` pré-preenchido com IA | ✅ |

### Fase 1 — Inteligência Contextual ✅ 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| 6.1 | Scorecard chips no cabeçalho | ✅ |
| 6.2 | Painel "Síntese da IA" colapsável | ✅ |
| 6.3 | Modal de confirmação risco alto + FIT | ✅ |
| 6.4 | Timeline de auditoria no CasoPage | ✅ |

### Fase 2 — Portal do Cliente ✅ 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| 7.1 | Phase stepper no drawer do cliente | ✅ |
| 7.2 | Notificações Push | ⏳ Adiada |
| 7.3 | PDF Download | ✅ |
| 7.4 | Página Relatórios Públicos (ops) | ✅ |

### Fase 3A — Qualidade da Análise ✅ 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| 8.2 | Circuit Breaker + `getSystemHealth` | ✅ |
| NEW-1 | SaudePage — `/ops/saude` | ✅ |
| NEW-2 | Checklist de Conclusão Inteligente | ✅ |
| NEW-3 | Comparativo IA vs Analista | ✅ |

### Fase 3B — UX e Eficiência ✅ 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| NEW-4 | Bulk Actions na FilaPage | ✅ |
| NEW-5 | Atalhos de Teclado (Ctrl+S, Ctrl+Enter) | ✅ |
| NEW-6 | Filtros Avançados CasosPage | ✅ |
| NEW-7 | Dark Mode | ✅ |

### Phase B — Exportação Assíncrona ✅ 2026-05-31

| Item | Descrição | Status |
|------|-----------|--------|
| EXP-1 | `createExportJob` callable | ✅ |
| EXP-2 | `getExportJobStatus` callable | ✅ |
| EXP-3 | `listExportJobs` callable | ✅ |
| EXP-4 | `cancelExportJob` callable | ✅ |
| EXP-5 | `processExportJob` callable | ✅ |
| EXP-6 | Teste de contrato export jobs | ✅ |

### Phase C — Modularização ✅ 2026-05-31

| Item | Descrição | Status |
|------|-----------|--------|
| MOD-1 | Extração de 26 módulos | ✅ |
| MOD-2 | Factory pattern + dependency injection | ✅ |
| MOD-3 | `index.js`: 13.366 → ~1.850 linhas (-87%) | ✅ |
| MOD-4 | Todos os 1223 testes adaptados | ✅ |

### Correções e Melhorias — 2026-05-31

| Item | Descrição | Status |
|------|-----------|--------|
| FIX-1 | Remoção de CPF dos campos públicos | ✅ |
| FIX-2 | Remoção de código morto | ✅ |
| FIX-3 | Skip syncClientCaseOnUpdate para auto-classify | ✅ |
| FIX-4 | Debounce campos de texto CasoPage | ✅ |
| FIX-5 | Aumento limites de query exportação | ✅ |

### Sistema de Backup ✅ 2026-06-01

| Item | Descrição | Status |
|------|-----------|--------|
| BKP-1 | Bucket GCS `backups-compliance-hub-br` | ✅ |
| BKP-2 | Lifecycle auto-delete 7 dias | ✅ |
| BKP-3 | IAM `datastore.importExportAdmin` | ✅ |
| BKP-4 | IAM `storage.objectAdmin` | ✅ |
| BKP-5 | Cloud Function `backupDaily` (onSchedule) | ✅ |
| BKP-6 | Script `setup-backup-bucket.cjs` | ✅ |

### Estado Atual (2026-06-01)

- **Testes backend:** 55 arquivos, 1223 testes passando
- **Testes frontend:** 55+ arquivos, ~1200 testes passando
- **Lint:** 0 erros (root + functions)
- **Build:** Limpo
- **Vercel:** https://compliance-hub-hazel.vercel.app
- **Firebase:** compliance-hub-br (southamerica-east1)
- **Backup:** Diário, 02:00 BRT, retenção 7 dias

---

## 11. Próximas Fases

### Fase 4 — Confiabilidade e Infraestrutura

| Prio | Item | Descrição | Complexidade |
|:---:|------|-----------|:---:|
| P0 | 8.4 | **Cache Escavador** — `escavadorCache/{cpf}` TTL 7d | Média |
| P0 | 8.5 | **Observabilidade** — structured logging por Cloud Function | Média |
| P1 | 8.3 | **Alertas de Expiração** — Cloud Scheduler, avisa < 48h | Baixa |
| P1 | NEW-8 | **Rate Limiting por Tenant** — dailyLimit/monthlyLimit | Média |
| P2 | 7.2 | **Notificações Push (Web)** — FCM | Alta |

### Fase 5 — Produto Premium

| Prio | Item | Descrição | Complexidade |
|:---:|------|-----------|:---:|
| P1 | NEW-9 | **API REST para Integrações** — `/api/v1/cases` com API key | Alta |
| P1 | NEW-10 | **White-label Relatório** — logo, cores, rodapé por tenant | Média |
| P2 | NEW-11 | **Audit Trail Exportável** — CSV | Baixa |
| P2 | NEW-12 | **SLA Dashboard** — tempo médio, aging report | Média |

### Ordem de Implementação Recomendada

```
✅ Fase 0:   Relatório Final Completo       — 2026-04-03
✅ Fase 1:   Inteligência Contextual         — 2026-04-05
✅ Fase 2:   Portal do Cliente               — 2026-04-05
✅ Fase 3A:  Qualidade da Análise            — 2026-04-05
✅ Fase 3B:  UX e Eficiência                 — 2026-04-05
✅ Phase B:  Exportação Assíncrona           — 2026-05-31
✅ Phase C:  Modularização                   — 2026-05-31
✅ Backup:   Sistema de Backup Diário        — 2026-06-01

Próxima sprint (Fase 4):
  1. 8.4  Cache Escavador               ← economia
  2. 8.5  Observabilidade               ← diagnóstico
  3. 8.3  Alertas de Expiração          ← proativo

Longo prazo (Fase 5):
  4. NEW-9  API REST                    ← B2B enterprise
  5. NEW-10 White-label                 ← diferencial
  6. NEW-12 SLA Dashboard               ← gestão
```

---

*ComplianceHub — Documento interno de planejamento técnico.*
