# Task Plan: Remover Apontamentos Relevantes + CPF Fix

## Goal
1. Remover completamente as secoes "Apontamentos Relevantes" (processHighlights) e "Situacao de Mandados" (warrantFindings) de TODOS os relatorios
2. Tornar `analystComment` obrigatorio para todos os casos (frontend + backend)
3. Corrigir busca por CPF (adicionar 'cpf' aos IDENTITY_FIELDS + backfill)

## Decisions
- analystComment obrigatorio para TODOS os casos (incluindo reabertos)
- Manter keyFindings (Principais Apontamentos)
- CPF fix: backend + backfill (Opcao A)

## Phases

### Phase 1: Report Builders (Frontend + Backend)
- [x] src/core/reportBuilder.js - remover processHighlightsHtml, warrantFindingsHtml
- [x] functions/reportBuilder.cjs - mirror das mudancas

### Phase 2: Backend Core (functions/index.js)
- [x] Remover buildProcessHighlights() e buildWarrantFindings()
- [x] Remover de RESULT_ONLY_FIELDS
- [x] Remover do prefill preliminaryHighlights
- [x] Remover da conclusao concludeCaseByAnalyst
- [x] Remover fallback buildSanitizedPublicResultSnapshot
- [x] Ajustar reportReady e hasPublicReportMinimumContent
- [x] Ajustar hasEvidence em buildClientCasePayload
- [x] Remover de allDerivedFields e aiDerivedFields
- [x] Adicionar 'cpf' a IDENTITY_FIELDS
- [x] Validacao analystComment obrigatorio

### Phase 3: Frontend Pages
- [x] src/portals/client/SolicitacoesPage.jsx - remover drawer block
- [x] src/portals/ops/CasoPage.jsx - checklist analystComment obrigatorio

### Phase 4: Frontend Helpers
- [x] src/core/clientPortal.js - remover de PUBLIC_RESULT_FIELDS e getReportAvailability

### Phase 5: Mock Data
- [x] src/data/mockData.js
- [x] src/data/mockCasesTenant1.js
- [x] src/data/mockCasesTenant2.js

### Phase 6: Scripts
- [x] scripts/regenerate-reports.cjs
- [x] scripts/normalize-firestore-cases.cjs
- [x] scripts/backfill-client-cases.cjs
- [x] scripts/backfill-cpf-client-cases.cjs (novo)

### Phase 7: Validation
- [x] npm test -- --run (frontend) - 702/702 passando
- [x] cd functions && npm test (backend) - 409/409 passando
- [x] npm run build - sucesso
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Executar backfill CPF
- [ ] Commit

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Parse failure em mockCasesTenant1.js | Remocao incompleta deixou objetos soltos | Removidos blocos de objetos sem chave |
