# State Review — ComplianceHub Refactor (v2)

**Data:** 2026-05-30 (atualizado)
**Branch:** `refactor/full-local-roadmap`
**Auditor:** Agent CLI

---

## 1. Decisão

**GO COM CONDIÇÕES** (mantida)

A Phase C está avançada/parcial com monolito residual controlado. Extrações adicionais concluídas nesta rodada (auth, providerConfigs, sanitizers, fieldConstants, notificações). Não há bloqueadores críticos, mas há pendências documentadas antes de iniciar Phase D.

---

## 2. Estado Real

| Métrica | Valor |
|---------|-------|
| Branch | `refactor/full-local-roadmap` |
| Linhas `functions/index.js` | **9.854** (reduzido de ~13.366, **-26%**) |
| Atribuições `exports.*` | 64 |
| Exports únicos | 64 |
| Exports duplicados | **0** |
| Módulos extraídos | **21** (17 originais + 4 novos) |
| Módulos ativados | **21** |
| Módulos extraídos mas não ativados | **0** |

---

## 3. Correções Aplicadas

### 3.1 Exports Duplicados
- **Estado anterior:** 9 exports duplicados/sobrescritos (versão anterior do index.js)
- **Correção:** Reconstrução completa das importações modulares; todos os exports agora são únicos
- **Validação:** Script de detecção confirmou 0 duplicados

### 3.2 Case Communication
- **Problema:** `buildNotificationFunctions` removido do `caseCommunication.js` mas ainda referenciado no `index.js`; funções `sendCaseMessage` e `markCaseCommunicationRead` perdidas
- **Correção:** Restauradas funções do `.bak` para `caseCommunication.js`; atualizado import no `index.js`; criado objeto `caseComm` manual com todas as funções necessárias
- **Testes:** 8/8 passando

### 3.3 Tenant User Management
- **Problema:** Módulo extraído mas não importado após revert do index.js
- **Correção:** Reimportado com 10 handlers modulares; criado `tenantUserDeps` com dependências injetadas
- **Testes:** 30/30 passando

### 3.4 TDZ (Temporal Dead Zone)
- **Problema:** `tenantUserDeps` definido na linha 9.949 mas usado na linha 6.091
- **Correção:** Movidos os exports do tenantUserManagement para depois da definição de `tenantUserDeps`

### 3.5 Repair All Claims
- **Problema:** `repairAllClaimsInner` removido do index.js mas ainda exportado no `__test`
- **Correção:** Criado wrapper no index.js que adapta a assinatura do teste para a assinatura do módulo
- **Testes:** Todos passando

### 3.6 V2 Pagination
- **Problema:** Handlers V2 (`listOpsCasesV2`, `listClientCasesV2`) perdidos após revert
- **Correção:** Reimportados do módulo `caseQueriesAssignments`; adicionados wrappers no `__test`
- **Testes:** Todos passando

### 3.7 Lint
- **Problema:** `caseData` unused na linha 11.409
- **Correção:** Removido parâmetro não utilizado

---

## 4. Phase A — Cursor Pagination V2

| Item | Status |
|------|--------|
| Helper `paginateFirestoreQuery` | ✅ Existe e testado |
| `listOpsCasesV2` | ✅ Export ativo |
| `listClientCasesV2` | ✅ Export ativo |
| V1 preservada | ✅ `listOpsCases` e `listClientCases` intactos |
| Tie-breaker `__name__` | ✅ Presente |
| Docs de migração | ✅ `docs/migrations/v2-pagination.md` |
| Índices | ✅ 24 índices em `firestore.indexes.json`, não deployados |
| Testes V2 | ✅ Passando |

**Pendências:**
- Load test de paginação não executado (emulador indisponível)

---

## 5. Phase B — Async Export

| Item | Status |
|------|--------|
| Callables backend | ✅ `createExportJob`, `getExportJobStatus`, `listExportJobs`, `cancelExportJob`, `processExportJob` |
| UI frontend | ✅ `ExportacoesPage.jsx` com polling, cancelamento, download |
| Sanitização CSV | ✅ BOM UTF-8 + escape de campos |
| V1 preservada | ✅ `getClientExportCases` intacta |
| Testes backend | ✅ Passando |
| Testes frontend | ✅ `ExportacoesPage.test.jsx` passando |

**Pendências:**
- Load test de export não executado (emulador indisponível)

---

## 6. Phase C — Modularização

### 6.1 Módulos Extraídos e Ativados

| # | Módulo | Testes | Status | Rodada |
|---|--------|--------|--------|--------|
| 1 | `caseManager/caseFilters` | 15 | ✅ Ativo | Original |
| 2 | `aiOrchestrator` | 60 | ✅ Ativo | Original |
| 3 | `aiParsers` | — | ✅ Ativo | Original |
| 4 | `autoClassification` | 23 | ✅ Ativo | Original |
| 5 | `caseQueriesAssignments` | 90 | ✅ Ativo | Original |
| 6 | `concludeCaseAndSettings` | 28 | ✅ Ativo | Original |
| 7 | `deterministicPrefill` | 19 | ✅ Ativo | Original |
| 8 | `enrichmentPhases` | 22 | ✅ Ativo | Original |
| 9 | `exportJobsAndReports` | 21 | ✅ Ativo | Original |
| 10 | `juditWebhookAndFallback` | 25 | ✅ Ativo | Original |
| 11 | `notificationService` | 32 | ✅ Ativo (atualizado) | Original + 2026-05-30 |
| 12 | `pdfGeneration` | 11 | ✅ Ativo | Original |
| 13 | `publishAndSync` | 31 | ✅ Ativo | Original |
| 14 | `reportEngine` | 33 | ✅ Ativo | Original |
| 15 | `systemHealth` | 10 | ✅ Ativo | Original |
| 16 | `tenantUserManagement` | 30 | ✅ Ativo | Original |
| 17 | `utilityHelpers` | 12 | ✅ Ativo | Original |
| 18 | `_shared/auth` | 21 | ✅ Ativo | **2026-05-30** |
| 19 | `_shared/providerConfigs` | 17 | ✅ Ativo | **2026-05-30** |
| 20 | `_shared/sanitizers` | 32 | ✅ Ativo | **2026-05-30** |
| 21 | `_shared/fieldConstants` | 10 | ✅ Ativo | **2026-05-30** |

### 6.2 Monolito Residual (atualizado)

Blocos ainda presentes no `functions/index.js` que não foram extraídos ou não podem ser extraídos com segurança nesta rodada:

| Bloco | Linhas aprox. | Status | Justificativa |
|---:|---|---|---|
| `createClientSolicitation` | ~248 | Pendente | Handler com muitas dependências internas |
| `submitClientCorrection` | ~248 | Pendente | Handler com muitas dependências internas |
| Triggers de enriquecimento (6) | ~1.500 | Pendente | Triggers críticos; extração requer cuidado extremo |
| `rerunAiForCase` | ~140 | Pendente | Depende de ~15 helpers inline (AI, prefill, sanitização, auditoria) |
| Identity Gate helpers (`__test`) | ~100 | Parcial | Alguns helpers já em enrichmentPhases; outros no __test |
| Publication artifacts (`revokeCasePublicationArtifacts`, `buildResetPublishedCaseFields`) | ~60 | Pendente | Pode ser movido para `publishAndSync` ou módulo próprio |
| `buildDeterministicPrefill` | ~180 | Pendente | Função central usada por múltiplos handlers |
| Funções auxiliares AI (prompt building, analysis runners) | ~600 | Pendente | Interdependentes; extração requer reorg completa |
| Funções auxiliares de processo (formatCnj, normCnj, etc.) | ~200 | Pendente | Funções simples que poderiam ir para `_shared/` |

**Classificação da Phase C:** `Avançada/parcial com monolito residual controlado`

---

## 7. Phase D — Remoção de Código Morto

**Status:** NÃO iniciada

| Candidato | Classificação | Ação |
|---|---|---|
| `backfillClientCasesMirrorInner` | Em uso (export `__test`, script `backfill-client-cases.cjs`) | **NÃO REMOVER** |
| Funções inline removidas após extração | Verificar com `audit-dead-code.cjs` | Pendente |
| `repairAllClaimsInner` inline | Removida, substituída por wrapper | Já removida |

**Recomendação:** Iniciar Phase D apenas após completar extrações do monolito residual e validar que nenhuma função inline é mais usada.

---

## 8. Testes

| Suite | Arquivos | Tests | Status |
|-------|----------|-------|--------|
| Backend | 51 | 1.172 | ✅ Passando |
| Frontend | 91 | 1.495 | ✅ Passando |
| **Total** | **142** | **2.667** | ✅ **Passando** |

| Comando | Status |
|---------|--------|
| `npm run lint` (root) | ✅ 0 erros |
| `npm test` (root) | ✅ 1.495 passando |
| `cd functions && npm run lint` | ✅ 0 erros |
| `cd functions && npm test` | ✅ 1.172 passando |
| `npm run build` | ✅ Sucesso |

### Testes Focados

| Área | Status |
|------|--------|
| tenantUserManagement | ✅ 30 passando |
| paginateFirestoreQuery | ✅ Passando |
| listOpsCasesV2 | ✅ Passando |
| listClientCasesV2 | ✅ Passando |
| export (backend) | ✅ Passando |
| audit | ✅ Passando |
| notification | ✅ Passando |
| caseCommunication | ✅ 8 passando |
| identityGate | ✅ 16 passando |
| aiCalibration | ✅ Passando |
| deterministicPrefill | ✅ Passando |
| enrich (bigdatacorp, escavador, djen, judit) | ✅ Passando |
| ExportacoesPage (frontend) | ✅ Passando |

### Load Test

| Teste | Status |
|-------|--------|
| Load test paginação | ❌ Não executado (emulador indisponível) |
| Load test export | ❌ Não executado (emulador indisponível) |

---

## 9. Índices Firestore

| Métrica | Valor |
|---------|-------|
| Total índices | 24 |
| Duplicatas | 0 |
| Novos (não deployados) | 7 (adicionados na Phase A) |
| Deploy realizado | ❌ Nenhum |

---

## 10. Riscos Residuais

1. **Monolito residual:** Ainda há ~3.000 linhas de lógica de negócio no `index.js` que poderiam ser extraídas (solicitações, triggers, AI helpers).
2. **Load test:** Não foi possível validar performance de V2 pagination e export assíncrono sem emulador.
3. **Deploy de índices:** Os 7 índices novos ainda não foram deployados; sem eles, as queries V2 podem falhar em produção.
4. **Tamanho do index.js:** Ainda tem 9.854 linhas; idealmente deveria ser <5.000 (apenas wiring).
5. **Babel warning:** O arquivo ainda excede 500KB, causando warning do Babel.

## 11. Próximo Passo Recomendado

1. **Extração dos blocos residuais complexos** (solicitações, triggers, AI helpers) — requer sessão dedicada com testes intensivos
2. **Reduzir index.js para <7.000 linhas**
3. **Rodar load test em emulador** (se disponível)
4. **Iniciar Phase D** (remoção de código morto) após extrações completas
5. **Deploy de índices:** `firebase deploy --only firestore:indexes`
6. **Deploy de functions:** `firebase deploy --only functions`

## 12. Extrações Concluídas Nesta Rodada (2026-05-30)

| Bloco | Módulo | Testes | Redução |
|-------|--------|--------|---------|
| RBAC/Auth/Profile | `_shared/auth.js` | 21 | -56 linhas |
| Configurações de provedores | `_shared/providerConfigs.js` | 17 | -80 linhas |
| Validação/Sanitização | `_shared/sanitizers.js` | 32 | -2.194 linhas (cumulativo) |
| Constantes de campos | `_shared/fieldConstants.js` | 10 | -30 linhas |
| Notificações restantes | `notificationService.js` | 10 (novos) | -85 linhas |
| **Total desta rodada** | **5 módulos** | **90 tests** | **-2.445 linhas** |

## 13. Confirmações

- [x] Nenhum deploy executado
- [x] Nenhum dado real alterado
- [x] Nenhum código morto removido (Phase D não iniciada)
- [x] Nenhum merge para main
- [x] Todos os testes passando
- [x] Build passando
- [x] Lint passando
- [x] Documentação reflete estado real

---

*Relatório gerado automaticamente durante sessão de auditoria pré-Phase D.*
