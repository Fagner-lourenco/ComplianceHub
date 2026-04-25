# ComplianceHub — Planejamento Técnico e Funcional de Evolução

> Documento vivo. Atualizado em 2026-04-05.
> Stack: React + Vite → Vercel | Firebase Cloud Functions (Node 22, Gen2, southamerica-east1) | Firestore | OpenAI GPT

---

## Índice

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Arquitetura Atual](#2-arquitetura-atual)
3. [Diagnóstico — Estado do Sistema](#3-diagnóstico--estado-do-sistema)
4. [Gap Central: Relatório Final Incompleto](#4-gap-central-relatório-final-incompleto)
5. [Itens de Implementação Imediata (Fase 0)](#5-itens-de-implementação-imediata-fase-0)
6. [Fase 1 — Inteligência Contextual no Painel do Analista](#6-fase-1--inteligência-contextual-no-painel-do-analista)
7. [Fase 2 — Portal do Cliente Aprimorado](#7-fase-2--portal-do-cliente-aprimorado)
8. [Fase 3 — Confiabilidade e Operações](#8-fase-3--confiabilidade-e-operações)
9. [Referência de APIs e Provedores](#9-referência-de-apis-e-provedores)
10. [Referência de Campos do Firestore](#10-referência-de-campos-do-firestore)
11. [Comandos de Deploy](#11-comandos-de-deploy)
12. [Decisões de Arquitetura (ADRs)](#12-decisões-de-arquitetura-adrs)
13. [Registro de Progresso](#13-registro-de-progresso)
14. [Próximas Fases — Plano de Implementação](#14-próximas-fases--plano-de-implementação)

---

## 1. Visão Geral do Produto

O **ComplianceHub** é uma plataforma SaaS B2B de análise de antecedentes e due diligence para compliance trabalhista e criminal em empresas brasileiras. O sistema automatiza a coleta de dados em múltiplas fontes externas (Judit, Escavador, FonteData), aplica IA (GPT) para triagem de homônimos e síntese, e entrega um relatório HTML altamente estruturado ao analista e, opcionalmente, ao cliente.

### Objetivos de Negócio

| Objetivo | Métrica Chave |
|---|---|
| Reduzir tempo de análise por caso | < 30 min/caso (meta: < 10 min com IA) |
| Cobertura processual CPF | ≥ 95% dos casos com CPF utilizado |
| Satisfação do cliente final | Zero falsos positivos criminais entregues |
| Confiabilidade da plataforma | Uptime ≥ 99,5% / mês |

### Personas

- **Analista Ops** — usa o painel interno (`/ops/*`) para revisar, anotar e concluir casos
- **Gestor / Admin** — configura tenants, fases habilitadas, limites de SLA
- **Cliente Final** — acessa o portal de leitura (`/client/*`) para ver status e, quando liberado, o relatório

---

## 2. Arquitetura Atual

```
Usuário / Cliente
    │
    ├──► Vercel (React 18 + Vite)
    │        ├── Portal Ops   (src/portals/ops/)
    │        ├── Portal Client (src/portals/client/)
    │        └── Página Relatório Público (src/pages/PublicReportPage.jsx)
    │
    └──► Firebase (southamerica-east1)
             ├── Cloud Functions (22+ endpoints onCall/onDocumentUpdated)
             │       ├── Enriquecimento: fetchJuditLawsuits, fetchJuditWarrants,
             │       │   fetchEscavadorByCpf, fetchFontedataFinanceiro...
             │       ├── Conclusão: concludeCaseByAnalyst
             │       ├── Relatório Público: createAnalystPublicReport
             │       └── Triggers: publishResultOnCaseDone, syncClientCaseOnUpdate
             ├── Firestore
             │       ├── cases/{caseId}          ← documento principal (~150 campos)
             │       ├── cases/{caseId}/publicResult/latest  ← campos públicos
             │       ├── publicReports/{token}   ← HTML + expiresAt
             │       └── clientCases/{caseId}    ← visão do cliente
             └── Hosting (index.html fallback)
```

### Fluxo de Enriquecimento

```
Criação do Caso
    │
    ▼
Judit — Processos (fetchJuditLawsuits)
    │  └─ juditRoleSummary[], juditCriminalCount, juditLaborCount...
    ▼
Judit — Mandados (fetchJuditWarrants)
    │  └─ juditWarrants[], juditActiveWarrantCount
    ▼
Escavador — Processos/CPF (fetchEscavadorByCpf)  [condicional]
    │  └─ escavadorProcessos[], escavadorCriminalCount...
    ▼
FonteData — Financeiro/Dívida  [condicional]
    │  └─ fontedataDebitoTotal, fontedataFlags...
    ▼
IA — Triagem Homônimos (aiHomonymCheck)  [se necessário]
    │  └─ aiHomonymResult, aiHomonymJustification
    ▼
IA — Estruturação Semântica (aiStructured)
    │  └─ { resumo, evidencias[], riskScore, riskLevel... }
    ▼
[ANALISTA CONCLUI] → concludeCaseByAnalyst
    │  └─ Salva form fields + computa processHighlights/warrantFindings/keyFindings/executiveSummary
    ▼
publishResultOnCaseDone (trigger)
    │  └─ Copia PUBLIC_RESULT_FIELDS → publicResult/latest
    ▼
Relatório disponível via buildCaseReportHtml(caseData)
```

---

## 3. Diagnóstico — Estado do Sistema

### Correções Concluídas (Sessões Anteriores)

| ID | Descrição | Status |
|---|---|---|
| FIX-A | Análise com CPF ausente travava o enriquecimento | ✅ Deployed |
| FIX-B | Trigger `publishResultOnCaseDone` não disparava em re-conclusão | ✅ Deployed |
| FIX-C | Filtro de homônimos descartava CPFs válidos em casos multi-CPF | ✅ Deployed |
| FIX-D | Webhook Judit recebia payloads duplicados | ✅ Deployed |
| FIX-E | `syncClientCaseOnUpdate` falha silenciosa em tenant sem config | ✅ Deployed |

Coverage: **51/51 testes passando** em 16 arquivos de teste.

### Diagnóstico de Código Atual

| Arquivo | Situação |
|---|---|
| `functions/normalizers/judit.js` | ✅ OK — `juditRoleSummary` e `juditWarrants` bem estruturados |
| `functions/normalizers/escavador.js` | ✅ OK — `escavadorProcessos[]` com todos os campos necessários |
| `src/core/reportBuilder.js` | ✅ OK — `processHighlightsHtml()`, `warrantFindingsHtml()` 100% implementados |
| `functions/index.js` — `concludeCaseByAnalyst` | ✅ RESOLVIDO — computa `processHighlights`, `warrantFindings`, `keyFindings`, `executiveSummary` |
| `functions/index.js` — `RESULT_ONLY_FIELDS` | ✅ RESOLVIDO — 4 campos novos incluídos |
| `src/core/clientPortal.js` — `PUBLIC_RESULT_FIELDS` | ✅ RESOLVIDO — espelhado do backend |
| `src/pages/PublicReportPage.jsx` | ✅ RESOLVIDO — verifica `expiresAt`; erros diferenciados (expirado/não encontrado) |
| `src/portals/ops/CasoPage.jsx` — `createInitialForm` | ✅ RESOLVIDO — `analystComment` pré-preenchido com `aiStructured.resumo` |

---

## 4. Gap Central: Relatório Final Incompleto

### Causa Raiz

A função `concludeCaseByAnalyst` usa `pickConcludePayload()` para filtrar estritamente os campos do formulário. Ela **nunca deriva** `processHighlights`, `warrantFindings`, `keyFindings` ou `executiveSummary` a partir dos dados de enriquecimento já armazenados no Firestore.

Os renderizadores em `reportBuilder.js` estão 100% prontos mas recebem arrays/strings vazios:

```
caseData.processHighlights  → []      ← nunca populado
caseData.warrantFindings    → []      ← nunca populado
caseData.keyFindings        → []      ← nunca populado
caseData.executiveSummary   → ''      ← nunca populado
```

### Cadeia de Propagação Após a Correção

```
concludeCaseByAnalyst()
  └─ computa os 4 campos a partir de caseData
  └─ caseRef.update(updatePayload)  ← inclui os 4 campos
        │
        ├─ Listener Firestore em CasoPage.jsx atualiza caseData
        │    └─ buildCaseReportHtml(caseData) renderiza seções ricas
        │
        └─ publishResultOnCaseDone (trigger)
             └─ copia PUBLIC_RESULT_FIELDS → publicResult/latest
                  └─ buildCaseReportHtml no portal do cliente ← também rico
```

---

## 5. Itens de Implementação Imediata (Fase 0)

### 5.1 — Helpers de Derivação no Backend

**Arquivo:** `functions/index.js` — inserir antes de `exports.v2ConcludeCaseByAnalyst`

```js
function buildProcessHighlights(caseData) {
  const juditItems = caseData.juditRoleSummary || [];
  const escItems   = caseData.escavadorProcessos || [];
  const seenCnj    = new Set();
  const relevant   = [];

  for (const p of juditItems) {
    if (p.secrecyLevel > 0) continue;                        // segredo de justiça
    if (!p.isCriminal && !p.hasExactCpfMatch && p.status !== 'ATIVO') continue;
    if (p.isPossibleHomonym && !p.hasExactCpfMatch) continue;
    if (p.code) seenCnj.add(p.code);
    relevant.push({ processNumber: p.code, area: p.area, status: p.status,
      court: p.tribunalAcronym, classification: (p.classifications || [])[0] || null,
      stage: p.phase, source: 'Judit', isCriminal: p.isCriminal });
  }
  for (const p of escItems) {
    const cnj = p.numeroCnj || '';
    if (cnj && seenCnj.has(cnj)) continue; // dedup cross-provider
    const isCriminal = /penal|criminal/i.test(p.area || '');
    const isActive   = /ativo/i.test(p.status || '');
    if (!isCriminal && !isActive) continue;
    relevant.push({ processNumber: cnj || null, area: p.area, status: p.status,
      court: p.tribunalSigla, classification: p.assuntoPrincipal || null,
      stage: p.grauFormatado || null, source: 'Escavador', isCriminal });
  }

  const byArea = {};
  for (const p of relevant.slice(0, 30)) {
    const area = p.area || 'Outros';
    if (!byArea[area]) byArea[area] = [];
    byArea[area].push(p);
  }
  return Object.entries(byArea).map(([area, items]) => ({
    title: area, area, source: 'Judit / Escavador', total: items.length,
    summary: `${items.length} registro(s) identificado(s) na área ${area}.`,
    items: items.map((p) => ({
      processNumber: p.processNumber || 'Nº não disponível',
      status: p.status, court: p.court,
      classification: p.classification, stage: p.stage,
    })),
  }));
}

function buildWarrantFindings(caseData) {
  return (caseData.juditWarrants || []).map((w) => ({
    status:    w.status || 'Status não informado',
    court:     w.court || w.tribunalAcronym || null,
    reference: w.code || null,
    source:    'Judit',
    summary:   [
      w.warrantType,
      w.arrestType,
      w.issueDate     ? `Emitido em ${w.issueDate}`  : null,
      w.regime        ? `Regime: ${w.regime}`        : null,
    ].filter(Boolean).join('. '),
  }));
}

function buildKeyFindings(caseData, formPayload) {
  const findings = [];
  const aiEvidencias = (caseData.aiStructured?.evidencias || []).slice(0, 5);
  findings.push(...aiEvidencias.filter((e) => typeof e === 'string'));
  if ((caseData.juditActiveWarrantCount || 0) > 0)
    findings.push(`${caseData.juditActiveWarrantCount} mandado(s) de prisão pendente(s) de cumprimento.`);
  const criminalFlag = formPayload?.criminalFlag || caseData.criminalFlag;
  if (criminalFlag === 'POSITIVE' && (caseData.juditCriminalCount || 0) > 0)
    findings.push(`${caseData.juditCriminalCount} processo(s) criminal(is) confirmado(s).`);
  return [...new Set(findings)].slice(0, 7);
}

function buildExecutiveSummary(caseData) {
  return caseData.aiStructured?.resumo || '';
}
```

### 5.2 — Plugar Helpers em `concludeCaseByAnalyst`

**Arquivo:** `functions/index.js` — antes de `await caseRef.update(updatePayload)`

```js
updatePayload.processHighlights = buildProcessHighlights(caseData);
updatePayload.warrantFindings   = buildWarrantFindings(caseData);
updatePayload.keyFindings       = buildKeyFindings(caseData, updatePayload);
updatePayload.executiveSummary  = buildExecutiveSummary(caseData);
```

### 5.3 — Expandir `RESULT_ONLY_FIELDS`

**Arquivo:** `functions/index.js`

```js
const RESULT_ONLY_FIELDS = [
    // ... campos existentes ...
    'enabledPhases',
    'processHighlights',   // ← novo
    'warrantFindings',     // ← novo
    'keyFindings',         // ← novo
    'executiveSummary',    // ← novo
];
```

### 5.4 — Espelhar no `clientPortal.js`

**Arquivo:** `src/core/clientPortal.js` — adicionar ao final do array `PUBLIC_RESULT_FIELDS`

```js
    'processHighlights',
    'warrantFindings',
    'keyFindings',
    'executiveSummary',
```

### 5.5 — TTL do Relatório Público: 30 → 14 dias

**Arquivo:** `functions/index.js` — em `createAnalystPublicReport`

```js
const TTL_DAYS = 14; // era 30
```

### 5.6 — Verificação de Expiração em `PublicReportPage.jsx`

**Arquivo:** `src/pages/PublicReportPage.jsx`

- Adicionar verificação `report.expiresAt` antes de usar `report.html`
- Diferenciar estados de erro: `'expired'` vs `'not-found'` vs `'network'`
- Exibir mensagem clara de expiração com data formatada

### 5.7 — Pré-preenchimento do `analystComment`

**Arquivo:** `src/portals/ops/CasoPage.jsx` — em `createInitialForm`

```js
analystComment: caseData?.analystComment
    || caseData?.aiStructured?.resumo
    || '',
```

O label do campo deve indicar visualmente `(pré-preenchido pela IA)` quando o valor veio do `aiStructured.resumo` e ainda não foi editado manualmente.

---

## 6. Fase 1 — Inteligência Contextual no Painel do Analista ✅ CONCLUÍDA

> Implementada em 2026-04-05.

### 6.1 — Scorecard de Risco no Cabeçalho do Caso ✅

**Onde:** `CasoPage.jsx` — `caso-header__meta`

Chips inline implementados: contagem criminal, contagem mandados, `riskLevel` + `riskScore` pts (apenas para `DONE`).

### 6.2 — Painel de Evidências IA ✅

**Onde:** `CasoPage.jsx` — `<details>` "Síntese da IA" entre EnrichmentPipeline e stepper

Exibe `aiStructured.resumo` + `aiStructured.evidencias[]` em painel colapsável. Oculto quando `aiStructured` vazio.

### 6.3 — Validação em Tempo Real do Formulário ✅

**Onde:** `CasoPage.jsx` — `handleConclude()`

Modal `showHighRiskConfirm` quando `riskScore ≥ 70` e `finalVerdict === 'FIT'`. Exige confirmação explícita.

### 6.4 — Timeline de Eventos do Caso ✅

**Onde:** `CasoPage.jsx` — `<details>` "🕒 Histórico do caso" no final da página

- Nova função `subscribeToCaseAuditLogs(caseId)` em `firestoreService.js`
- Firestore query: `where('target', '==', caseId)` + `orderBy('timestamp', 'desc')` + `limit(50)`
- Índice composto `(target ASC, timestamp DESC)` deployado em `firestore.indexes.json`
- Constante `TIMELINE_ACTION_LABELS` mapeia 7 ações para labels em PT-BR

---

## 7. Fase 2 — Portal do Cliente Aprimorado (PARCIALMENTE CONCLUÍDA)

> Itens 7.1, 7.3 e 7.4 concluídos. Item 7.2 adiado.

### 7.1 — Progresso Visual de Fases ✅

**Onde:** `SolicitacoesPage.jsx` — aba "Detalhes" do drawer

Seção "Fases da análise" com chips por fase usando `ANALYSIS_PHASE_LABELS`. ✓ verde quando `DONE`, ○ cinza quando pendente.

### 7.2 — Notificações Push (Web) ⏳ ADIADA

Requisitos de infraestrutura (FCM + service worker + opt-in do navegador) são pesados demais para sprint atual. Prioridade baixa — o cliente já recebe email de conclusão.

### 7.3 — Download do Relatório em PDF ✅ (JÁ EXISTIA)

**Onde:** `PublicReportPage.jsx` — botão "Imprimir / Salvar PDF" → `window.print()`. CSS `@media print` já implementado.

### 7.4 — Histórico de Relatórios Públicos ✅

**Onde:** Nova página `src/portals/ops/RelatoriosPage.jsx` + CSS

- Tabela com token (link clicável), candidato, criado em, expira em, status, botão revogar
- Nova função `fetchPublicReports(tenantId)` e `revokePublicReport(token)` em `firestoreService.js`
- Rota `/ops/relatorios` + `/demo/ops/relatorios` em `App.jsx`
- Item "Relatórios" no sidebar com permissão `AUDIT_VIEW`

---

## 8. Fase 3 — Confiabilidade e Operações

### Fase 3A — Qualidade da Análise ✅ CONCLUÍDA

> Implementada em 2026-04-05.

#### 8.2 — Circuit Breaker por Provedor ✅

**Arquivo:** `functions/helpers/circuitBreaker.js` (novo)

- `checkCircuit(providerId)` — lê `systemHealth/{providerId}`, retorna `{ open, reason, halfOpen }`
- `recordSuccess(providerId)` — reseta failCount, atualiza lastSuccess
- `recordFailure(providerId, errorMessage)` — incrementa failCount, se >= maxFails seta `disabledUntil`
- Defaults: judit/escavador/fontedata (5 falhas, 10min cooldown), openai (3 falhas, 5min cooldown)
- Integrado nos 3 adapters: FonteData, Escavador, Judit em `functions/index.js`
- Endpoint `getSystemHealth` callable — retorna status de todos provedores

#### NEW-1 — Dashboard de Saúde dos Provedores ✅

**Onde:** `src/portals/ops/SaudePage.jsx` + CSS

- Cards por provedor (judit, escavador, fontedata, openai) com status saudável/degradado/indisponível
- Exibe: failCount, último sucesso, última falha, bloqueado até, último erro
- Rota `/ops/saude` + `/demo/ops/saude`; item "Saúde APIs" no sidebar com permissão `AUDIT_VIEW`
- Firestore rules: `systemHealth/{providerId}` — analyst read, Cloud Functions write

#### NEW-2 — Checklist de Conclusão Inteligente ✅

**Onde:** `CasoPage.jsx` — checklist de conclusão expandida

4 warnings de qualidade de dados (não-bloqueantes, `ok: true, warn: true`):
- `criminalFlag === 'NEGATIVE'` mas `juditCriminalCount > 0`
- `warrantFlag === 'NEGATIVE'` mas `juditActiveWarrantCount > 0`
- `analystComment` < 20 chars
- `riskScore` 50-69 com veredito FIT

Estilo amber (⚠) via classe `.caso-checklist__item--warn`.

#### NEW-3 — Comparativo IA vs Analista ✅

**Onde:** `CasoPage.jsx` — `<details>` "Comparativo IA vs Analista" entre Síntese IA e stepper

- Grid 2 colunas: IA (azul) vs Analista (verde) com score, riskLevel, veredicto
- Badge de concordância: alta (≤10 pts diff), média (≤25), baixa (>25)
- Visível apenas para casos DONE com `aiStructured.riskScore` disponível

### Fase 3B — UX e Eficiência do Analista ✅ CONCLUÍDA

> Implementada em 2026-04-05.

#### NEW-4 — Bulk Actions na FilaPage ✅

**Onde:** `FilaPage.jsx` + CSS

- Checkbox por linha + "Selecionar todos" no header
- Barra de ação bulk: quantidade selecionada + "Assumir selecionados" + "Limpar"
- Execução sequencial (`callAssignCaseToCurrentAnalyst` por caso)
- Feedback de falha (`X de Y caso(s) falharam`)
- Classe `.fila-table__row--selected` com highlight

#### NEW-5 — Atalhos de Teclado no CasoPage ✅

**Onde:** `CasoPage.jsx` — `useEffect` com `keydown` listener

- `Ctrl+S` / `⌘+S` → salva draft
- `Ctrl+Enter` / `⌘+Enter` → clica no botão Concluir (via `data-conclude`)
- `←` / `→` → navega entre steps (apenas quando foco não está em input/textarea/select)
- Indicador ⌨ no stepper com tooltip explicativo

#### NEW-6 — Filtros Avançados no CasosPage ✅

**Onde:** `CasosPage.jsx` — 3 novos filtros

- **Risco:** ALL / HIGH / MEDIUM / LOW (filtra por `riskLevel`)
- **Veredito:** ALL / FIT / ATTENTION / NOT_RECOMMENDED (filtra por `finalVerdict`)
- **Enriquecimento:** ALL / DONE / RUNNING / PARTIAL / FAILED (filtra por `getOverallEnrichmentStatus`)

#### NEW-7 — Dark Mode ✅

**Onde:** `src/index.css` — `@media (prefers-color-scheme: dark)`

- Override completo de tokens semânticos: surfaces, text, borders, shadows, semantic colors
- Sidebar, cards, modals, drawers todos adaptados
- `<meta name="color-scheme" content="light dark">` em `index.html`
- Respeita preferência do sistema operacional automaticamente

### 8.3 — Alertas de Expiração de Token ⏳

Job diário (Cloud Scheduler) que verifica tokens de `publicReports` próximos de expirar (< 48h) e notifica o analista por email.

### 8.4 — Cache de Resultados Escavador ⏳

Armazenar respostas do Escavador em `escavadorCache/{cpf}` com TTL de 7 dias. Evitar re-chamadas desnecessárias em casos de mesmo candidato em tenants diferentes.

### 8.5 — Observabilidade ⏳

- Adicionar `structuredLog()` em cada Cloud Function com campos: `caseId`, `tenantId`, `providerId`, `durationMs`, `statusCode`
- Dashboard Cloud Monitoring com alertas em p95 latência > 10s

---

## 9. Referência de APIs e Provedores

| Provedor | Endpoint | Campos Derivados | Custo |
|---|---|---|---|
| **Judit** | `/lawsuits` por CPF | `juditRoleSummary[]`, `juditCriminalCount`, `juditLaborCount`, `juditTotalCount` | Por requisição |
| **Judit** | `/warrants` por CPF | `juditWarrants[]`, `juditActiveWarrantCount` | Por requisição |
| **Escavador** | `/processos` por CPF | `escavadorProcessos[]`, `escavadorCriminalCount`, `escavadorTotalCount` | Por requisição |
| **Escavador** | `/processos` por nome | `escavadorByName*` | Por requisição |
| **FonteData** | `/financeiro` | `fontedataDebitoTotal`, `fontedataFlags[]` | Por requisição |
| **OpenAI GPT** | Chat Completions | `aiStructured.resumo`, `aiStructured.evidencias[]`, `aiStructured.riskScore` | Por token |

### Campos Estruturados por Provedor

**`juditRoleSummary` (por processo):**
```js
{
  code,           // número CNJ
  area,           // Criminal / Cível / Trabalhista / ...
  status,         // ATIVO / ARQUIVADO / ...
  isCriminal,     // boolean
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

## 10. Referência de Campos do Firestore

### `cases/{caseId}` — Campos Principais

| Campo | Tipo | Descrição | Populado por |
|---|---|---|---|
| `candidateName` | string | Nome do candidato | Criação |
| `cpf` | string | CPF sem formatação | Criação |
| `cpfMasked` | string | CPF mascarado (***) | Criação |
| `tenantId` | string | ID do tenant | Criação |
| `status` | string | PENDING / IN_PROGRESS / DONE / ... | Ops |
| `juditRoleSummary` | array | Processos Judit normalizados | Enriquecimento |
| `juditWarrants` | array | Mandados Judit normalizados | Enriquecimento |
| `juditCriminalCount` | number | Processos criminais confirmados | Enriquecimento |
| `juditActiveWarrantCount` | number | Mandados pendentes | Enriquecimento |
| `escavadorProcessos` | array | Processos Escavador normalizados | Enriquecimento |
| `aiStructured` | object | Saída estruturada da IA | Enriquecimento |
| `aiStructured.resumo` | string | Resumo executivo IA | Enriquecimento |
| `aiStructured.evidencias` | array | Evidências chave identificadas | Enriquecimento |
| `processHighlights` | array | Destaques processuais computados | `concludeCaseByAnalyst` |
| `warrantFindings` | array | Achados de mandados computados | `concludeCaseByAnalyst` |
| `keyFindings` | array | Principais apontamentos | `concludeCaseByAnalyst` |
| `executiveSummary` | string | Resumo executivo final | `concludeCaseByAnalyst` |
| `criminalFlag` | string | POSITIVE / NEGATIVE / NOT_FOUND | Formulário analista |
| `riskScore` | number | 0-100 | Calculado no conclude |
| `riskLevel` | string | HIGH / MEDIUM / LOW | Calculado no conclude |
| `finalVerdict` | string | APPROVED / REPROVED / INCONCLUSIVE | Formulário analista |
| `analystComment` | string | Comentário analista (editável) | Formulário analista |

### `publicReports/{token}` — Campos

| Campo | Tipo | Descrição |
|---|---|---|
| `html` | string | HTML sanitizado do relatório |
| `createdAt` | Timestamp | Data de criação |
| `expiresAt` | Date | Data de expiração (TTL_DAYS a partir da criação) |
| `caseId` | string | Referência ao caso |
| `tenantId` | string | Tenant dono do relatório |
| `active` | boolean | `false` = revogado manualmente |

---

## 11. Comandos de Deploy

```bash
# Deploy apenas das Cloud Functions
firebase deploy --only functions

# Deploy do frontend
npm run build && vercel --prod --yes

# Deploy completo
firebase deploy --only functions && npm run build && vercel --prod --yes

# Rodar testes antes do deploy
npm test
```

### Pré-condições para Deploy Seguro

1. `npm test` — 51/51 passing
2. `npm run build` — zero erros de compilação
3. Variáveis de ambiente validadas: `JUDIT_API_KEY`, `ESCAVADOR_API_KEY`, `OPENAI_API_KEY`
4. Revisão de `RESULT_ONLY_FIELDS` vs `PUBLIC_RESULT_FIELDS` em sincronia

---

## 12. Decisões de Arquitetura (ADRs)

### ADR-001 — Derivação de Campos no Conclude (não no Enriquecimento)

**Decisão:** `processHighlights`, `warrantFindings`, `keyFindings` e `executiveSummary` são computados na hora da conclusão, não durante o enriquecimento.

**Motivação:** O analista pode re-categorizar flags (ex: `criminalFlag`) que afetam quais processos são destaques. Derivar no conclude garante que o relatório sempre reflita a decisão final do analista, não uma interpretação intermediária da IA.

**Trade-off:** Se o analista não conclui o caso, esses campos ficam vazios. Casos em progresso têm relatório parcial — aceitável.

### ADR-002 — Campos Derivados não Passam pelo `ALLOWED_CONCLUDE_FIELDS`

**Decisão:** Os 4 novos campos são adicionados diretamente ao `updatePayload` no servidor, NUNCA ao `ALLOWED_CONCLUDE_FIELDS`.

**Motivação:** Esses campos são computados pelo servidor a partir de dados confiáveis (Firestore). Permitir que o cliente os envie seria uma superfície de injeção de conteúdo no relatório público.

### ADR-003 — Relatório Público com TTL de 14 dias

**Decisão:** Reduzir o TTL de 30 para 14 dias.

**Motivação:** Links de dados sensíveis de candidatos têm ciclo de vida curto em compliance. 14 dias cobre o período de análise e aprovação, com menor janela de exposição.

### ADR-004 — `PublicReportPage` diferencia erros de expiração

**Decisão:** Verificar `expiresAt` no frontend antes de renderizar o HTML. Exibir mensagem específica para link expirado vs. não encontrado.

**Motivação:** Melhor UX para o destinatário do relatório que recebe um link via e-mail dias depois.

---

## 13. Registro de Progresso

### Fase 0 — Relatório Final Completo ✅ Deployed 2026-04-03

| Item | Descrição | Status |
|------|-----------|--------|
| 5.1 | 4 helpers backend (`buildProcessHighlights`, `buildWarrantFindings`, `buildKeyFindings`, `buildExecutiveSummary`) | ✅ |
| 5.2 | Helpers plugados em `concludeCaseByAnalyst` | ✅ |
| 5.3 | `RESULT_ONLY_FIELDS` expandido (+4 campos) | ✅ |
| 5.4 | `PUBLIC_RESULT_FIELDS` espelhado em `clientPortal.js` | ✅ |
| 5.5 | `TTL_DAYS = 14` | ✅ |
| 5.6 | `PublicReportPage` verifica `expiresAt` + erros diferenciados | ✅ |
| 5.7 | `analystComment` pré-preenchido com `aiStructured.resumo` | ✅ |

### Fase 1 — Inteligência Contextual ✅ Deployed 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| 6.1 | Scorecard chips no cabeçalho (criminal, mandados, risk) | ✅ |
| 6.2 | Painel "Síntese da IA" colapsável | ✅ |
| 6.3 | Modal de confirmação risco alto + FIT | ✅ |
| 6.4 | Timeline de auditoria no CasoPage | ✅ |

### Fase 2 — Portal do Cliente ✅ Deployed 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| 7.1 | Phase stepper no drawer do cliente | ✅ |
| 7.2 | Notificações Push | ⏳ Adiada |
| 7.3 | PDF Download | ✅ (já existia) |
| 7.4 | Página Relatórios Públicos (ops) | ✅ |

### Correções de Auditoria — 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| AUD-1 | Rota demo `/demo/ops/relatorios` faltante | ✅ Corrigido |
| AUD-2 | Índice Firestore `(target, timestamp)` para auditLogs | ✅ Deployado |

### Fase 3A — Qualidade da Análise ✅ Deployed 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| 8.2 | Circuit Breaker (`circuitBreaker.js` + integrado em 3 adapters + `getSystemHealth`) | ✅ |
| NEW-1 | SaudePage — dashboard `/ops/saude` com cards por provedor | ✅ |
| NEW-2 | Checklist de Conclusão Inteligente — 4 warnings de qualidade | ✅ |
| NEW-3 | Comparativo IA vs Analista — grid com concordância | ✅ |

### Fase 3B — UX e Eficiência ✅ Deployed 2026-04-05

| Item | Descrição | Status |
|------|-----------|--------|
| NEW-4 | Bulk Actions na FilaPage — checkbox + assumir selecionados | ✅ |
| NEW-5 | Atalhos de Teclado — Ctrl+S, Ctrl+Enter, ←/→ | ✅ |
| NEW-6 | Filtros Avançados CasosPage — risco, veredito, enriquecimento | ✅ |
| NEW-7 | Dark Mode — `prefers-color-scheme: dark` completo | ✅ |

### Estado Atual

- **Testes:** 51/51 passando (16 suites)
- **Build:** ✅ Limpo, sem warnings
- **Vercel:** https://compliance-hub-hazel.vercel.app
- **Firebase Functions:** Deployed

---

## 14. Próximas Fases — Plano de Implementação

### Fase 4 — Confiabilidade e Infraestrutura (próxima sprint)

| Prio | Item | Descrição | Impacto | Complexidade |
|:---:|------|-----------|---------|:---:|
| P0 | 8.4 | **Cache de Resultados Escavador** — `escavadorCache/{cpf}` com TTL 7d | Economia de custo em re-consultas | Média |
| P0 | 8.5 | **Observabilidade** — `structuredLog()` em Cloud Functions: caseId, tenantId, provider, durationMs | Base para alertas e diagnóstico | Média |
| P1 | 8.3 | **Alertas de Expiração de Token** — Cloud Scheduler diário, `publicReports.expiresAt < now + 48h` | Proativo antes do link expirar | Baixa |
| P1 | NEW-8 | **Rate Limiting por Tenant** — enforced no backend, `dailyLimit`/`monthlyLimit` do tenant config | Segurança contra abuso | Média |
| P2 | 7.2 | **Notificações Push (Web)** — FCM quando caso muda para DONE | Nice-to-have para clientes | Alta |

### Fase 5 — Produto Premium (longo prazo)

| Prio | Item | Descrição | Impacto | Complexidade |
|:---:|------|-----------|---------|:---:|
| P1 | NEW-9 | **API REST para Integrações** — `/api/v1/cases` autenticado por API key por tenant | Abre canal B2B enterprise | Alta |
| P1 | NEW-10 | **White-label do Relatório Público** — tenant configura logo, cores, texto de rodapé | Diferencial competitivo | Média |
| P2 | NEW-11 | **Audit Trail Exportável** — exportar logs filtrados como CSV | Requisito compliance bancário | Baixa |
| P2 | NEW-12 | **SLA Dashboard** — tempo médio de conclusão, % em < 24h, aging report | Gestão de performance | Média |

### Ordem de Implementação Recomendada

```
✅ Fase 0:  Relatório Final Completo       — deployed 2026-04-03
✅ Fase 1:  Inteligência Contextual         — deployed 2026-04-05
✅ Fase 2:  Portal do Cliente               — deployed 2026-04-05
✅ Fase 3A: Qualidade da Análise            — deployed 2026-04-05
✅ Fase 3B: UX e Eficiência do Analista     — deployed 2026-04-05

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
