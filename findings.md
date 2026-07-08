# Findings — Controle de IA desabilitada

## Backend

### Toggle é lido em
- `functions/modules/autoClassification.js` linha ~686: `aiEnabled = tenantData.enrichmentConfig?.ai?.enabled === true;`
- `functions/modules/_shared/providerConfigs.js` default `ai: { enabled: false }`.

### Comportamento automático quando IA desabilitada
- `runAiHomonymAnalysis` e `runAiClassificationReviewAnalysis` **não** são chamados.
- Campos escritos:
  - `aiStatus = 'SKIPPED'`
  - `aiError = 'IA desabilitada para este tenant.'`
  - `aiHomonymTriggered = true` (se houver ambiguidade) com valores de fallback `UNCERTAIN/LOW/MEDIUM/MANUAL_REVIEW`.
  - Prefill determinístico continua.

### Gaps
- `rerunAiForCase` (`functions/index.js` ~1132) não verifica `ai.enabled`.
- `rerunAiAnalysis` / `rerunEnrichmentPhase` não verificam.
- `monthlyBudgetUsd` só é verificado no fluxo automático.
- Runners do `aiOrchestrator.js` não têm guarda (dependem dos callers).

## Frontend

### Toggle é lido em
- Apenas `src/portals/ops/TenantSettingsPage.jsx` lê/altera `enrichmentConfig.ai.enabled`.
- `CasoPage.jsx` não lê essa configuração.

### Comportamento atual
- Pipeline mostra "Análise assistida — Ignorado" após `aiStatus='SKIPPED'`; antes mostra "Pendente".
- Aba Revisão aparece sempre.
- Section "Análise assistida da autoclassificação" aparece sempre com subtítulo "Revisão consultiva da IA".
- Botão Reexecutar aparece no status `SKIPPED`.

### Gaps
- UI não informa que a IA está desabilitada.
- Retry manual disponível mesmo com IA desligada.
- Pipeline mostra estado "Pendente" antes da autoclassificação, gerando expectativa falsa.

## Contratos relevantes
- `aiStatus` pode ser `null`, `'SKIPPED'`, `'DONE'`, `'PARTIAL'`, `'FAILED'`.
- `aiError` guarda a razão quando `SKIPPED`/`FAILED`.
- `caseData.enrichmentConfig` não vem populado no caso; precisa buscar `tenantSettings`.
