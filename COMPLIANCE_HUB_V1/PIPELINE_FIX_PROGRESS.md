# PIPELINE_FIX_PROGRESS

## Etapas
- [x] 1. Auditoria inicial dos arquivos reais
- [x] 2. State machine central do pipeline
- [x] 3. Correção Judit RUNNING/PARTIAL
- [x] 4. Correção webhook Judit
- [x] 5. Correção fallback Judit
- [x] 6. Correção rerun parcial com generation/runId
- [x] 7. Implementação do rerun geral
- [x] 8. BigDataCorp lock no onCreate
- [x] 9. BigDataCorp respeitando datasets/fases
- [x] 10. DJEN/DPJe alinhado como etapa principal
- [x] 11. Escavador criminal/trabalhista
- [x] 12. AutoClassificação criminal/trabalhista/mandados
- [x] 13. Prefill criminal/trabalhista/mandados
- [x] 14. IA schema/cache/status
- [x] 15. Frontend: pipeline status + botão reprocessar caso inteiro
- [x] 16. Testes unitários/emulador
- [x] 17. Lint/build/check final

## Auditoria Inicial — Funções Confirmadas

| Função | Arquivo | Linha | Status |
|--------|---------|-------|--------|
| runJuditEnrichmentPhase | functions/index.js | 2716 | ✅ Confirmada |
| registerJuditWebhookRequest | functions/index.js | 1191 | ✅ Confirmada |
| exports.juditWebhook | functions/index.js | 8854 | ✅ Confirmada |
| juditAsyncFallback (scheduler) | functions/index.js | 9065 | ✅ Confirmada |
| runBigDataCorpEnrichmentPhase | functions/index.js | 2472 | ✅ Confirmada |
| enrichBigDataCorpOnCase | functions/index.js | 3451 | ✅ Confirmada |
| enrichJuditOnCase | functions/index.js | 3372 | ✅ Confirmada |
| enrichEscavadorOnCase | functions/index.js | 3612 | ✅ Confirmada |
| enrichDjenOnCase | functions/index.js | 3725 | ✅ Confirmada |
| runAutoClassifyAndAi | functions/index.js | 4008 | ✅ Confirmada |
| computeAutoClassification | functions/index.js | 4306 | ✅ Confirmada |
| buildDeterministicPrefill | functions/index.js | 7315 | ✅ Confirmada |
| buildDetCriminalNotes | functions/index.js | 6642 | ✅ Confirmada |
| buildDetLaborNotes | functions/index.js | 6761 | ✅ Confirmada |
| buildDetWarrantNotes | functions/index.js | 6850 | ✅ Confirmada |
| selectTopProcessos | functions/index.js | 1555 | ✅ Confirmada |
| concludeCaseByAnalyst | functions/index.js | 7749 | ✅ Confirmada |
| exports.rerunEnrichmentPhase | functions/index.js | 8581 | ✅ Confirmada |
| buildAiUpdatePayload | functions/index.js | 929 | ✅ Confirmada |
| computeAiCacheKey | functions/index.js | 1224 | ✅ Confirmada |
| queryCombined (BDC adapter) | functions/adapters/bigdatacorp.js | 184 | ✅ Confirmada |
| normalizeEscavadorProcessos | functions/normalizers/escavador.js | 48 | ✅ Confirmada |
| normalizeDjenComunicacoes | functions/normalizers/djen.js | ~1 | ✅ Confirmada |
| normalizeBigDataCorpProcesses | functions/normalizers/bigdatacorp.js | ~1 | ✅ Confirmada |
| callRerunEnrichmentPhase | src/core/firebase/firestoreService.js | 778 | ✅ Confirmada |
| EnrichmentPipeline | src/ui/components/EnrichmentPipeline/EnrichmentPipeline.jsx | 1 | ✅ Confirmada |

## Correções Aplicadas

### 1. State Machine Central (functions/index.js)
- **hasPendingJuditAsync(caseData)** — Detecta callbacks pendentes
- **isProviderTerminalForPipeline(status)** — DONE/PARTIAL/FAILED/SKIPPED/BLOCKED
- **isJuditSettled(caseData)** — Terminal + sem pendências
- **canRunFinalClassification(caseData)** — Bloqueia se pipeline não estiver pronto
- **maybeRunAutoClassifyAndAi(caseRef, caseId, sourceLabel, options)** — Re-lê caso, verifica readiness, só então classifica

### 2. Judit RUNNING vs PARTIAL (functions/index.js)
- Judit com `pendingCount > 0` agora fica `RUNNING`, não `PARTIAL`
- `juditEnrichedAt` só é setado quando não há pendências
- `juditPartialDataAvailable` indica se há dados parciais

### 3. Webhook Judit (functions/index.js)
- Evento incremental: atualiza mapping com `lastIncrementalEventAt`, responde 200 ignored, NÃO adquire lock
- Evento final: adquire lock com `status: PROCESSING_COMPLETION/PROCESSING_ERROR`
- Geração stale: marca mapping como `STALE`, não altera caso
- Persistência ANTES do resposta 200
- Mapping NÃO é deletado — atualizado para `DONE` ou `FAILED`
- Usa `maybeRunAutoClassifyAndAi` após processamento

### 4. Fallback Judit (functions/index.js)
- Lock temporário usa `CHECKING` + `claimExpiresAt` + `claimedBy` em vez de `processedBy`
- Request ainda pending: libera claim (volta para `PENDING`)
- Geração stale: marca `STALE` em vez de deletar
- Terminal: marca `DONE`/`FAILED` com `processedBy: 'fallback'`
- Não deleta mais mappings

### 5. Rerun Geral (functions/index.js)
- `phase='all'` suportado em `rerunEnrichmentPhase`
- Valida `force=true` quando providers estão RUNNING
- Marca requests Judit pendentes como `STALE`
- Incrementa `enrichmentGeneration`
- Gera novos `runIds` para todos os providers
- Limpa dados derivados (providers + classificação + IA + prefill)
- Inicia BigDataCorp com lock
- Registra evento de auditoria

### 6. BigDataCorp Lock + Datasets (functions/index.js + adapters/bigdatacorp.js)
- `enrichBigDataCorpOnCase` agora usa `acquirePhaseRun` antes de consultar
- Adapter `queryCombined` aceita `options.datasets` com `basicData/processes/kyc/occupation`
- Caller monta datasets dinamicamente baseado em `bdcConfig.phases`
- Fase desabilitada retorna `null` sem erro

### 7. DJEN SKIPPED + Auto-classify (functions/index.js)
- DJEN disabled: chama `maybeRunAutoClassifyAndAi` antes de retornar
- DJEN SKIPPED por falta de processos: também chama auto-classify

### 8. Escavador Criminal + Labor (functions/normalizers/escavador.js)
- `CRIMINAL_AREAS` agora reconhece: CRIME, Ação Penal, Inquérito, Termo Circunstanciado, Contravenção, Violência Doméstica, Maria da Penha, Medida Protetiva
- Adiciona `escavadorLaborFlag`, `escavadorLaborCount`, `isLabor` nos processos
- Reconhece trabalhista por área, classe, ou sigla TRT/TST

### 9. BDC Contadores Direto/Homônimo (functions/normalizers/bigdatacorp.js)
- Adiciona `bigdatacorpDirectCriminalCount`, `bigdatacorpPossibleHomonymCriminalCount`
- Adiciona `bigdatacorpDirectLaborCount`, `bigdatacorpPossibleHomonymLaborCount`
- `bigdatacorpCriminalFlag` baseado apenas em CPF confirmado (direct)

### 10. DJEN Trabalhista Weak/Strong (functions/index.js)
- `djenLaborStrong` = DJEN labor + nome comum ≤ 10
- `djenLaborWeak` = DJEN labor + nome comum > 10
- Weak vira `INCONCLUSIVE` em vez de `POSITIVE`

### 11. Conclusão — Mandado + Execução Penal (functions/index.js)
- `effectiveWarrantFlag` considera payload → reviewDraft → caseData
- Bloqueia conclusão se mandado ativo e flag não é POSITIVE/INCONCLUSIVE
- `effectiveCriminalFlag` considera payload → reviewDraft → caseData
- Bloqueia conclusão se execução penal positiva e criminal inadequado

### 12. IA Status/Cache (functions/index.js)
- `aiStatus`: FAILED (erro API) / DONE (structuredOk=true) / FAILED_SCHEMA (structuredOk=false)
- `computeAiCacheKey` inclui `AI_MODEL`, `kind`, `promptVersion`, `contextVersion`

### 13. Prefill Criminal/Trabalhista (functions/index.js)
- `buildDetCriminalNotes` agora inclui: DJEN comunicações criminais, FonteData criminal, mandado ativo, KYC/sanções
- `buildDetLaborNotes` agora inclui: DJEN comunicações trabalhistas, FonteData trabalhista
- Explica fonte quando flag é positivo mas não há processos estruturados

### 14. Frontend (src/ui/components/EnrichmentPipeline + src/core/firebase/firestoreService)
- `FAILED_SCHEMA` adicionado ao `STATE_CONFIG`
- `callRerunFullEnrichment(caseId, options)` exportado do firestoreService

## Testes Executados

| Suite | Resultado |
|-------|-----------|
| Backend (functions) | ✅ 317 passed |
| Frontend (src) | ✅ 564 passed |
| **Total** | **✅ 881 passed** |

## Validação de Sintaxe

| Arquivo | Resultado |
|---------|-----------|
| functions/index.js | ✅ OK |
| functions/adapters/bigdatacorp.js | ✅ OK |
| functions/normalizers/escavador.js | ✅ OK |
| functions/normalizers/bigdatacorp.js | ✅ OK |

## Lint

| Suite | Resultado |
|-------|-----------|
| Backend | ✅ **100% limpo** — 0 erros, 0 warnings |
| Frontend | ✅ Sem erros de lint nos arquivos modificados |

## Pontos NÃO Aplicados e Justificativa

| Item | Justificativa |
|------|---------------|
| DJEN default enabled | Mantido backend `enabled: false` para não quebrar tenants existentes. Frontend já permite habilitar. |
| Separação civil/criminal de mandados | DESCARTADO por regra do produto: mandado ativo é hard fact único |

## Riscos Remanescentes

1. **Rerun geral não revoga publicação pública automaticamente** — Caso já publicado permanece acessível até novo prefill ser gerado.
2. **Escavador labor detection pode ter falsos positivos** — Regex simples pode capturar áreas não-trabalhistas.
3. **DJEN byProcess sem processos conhecidos** — Ainda pode resultar em SKIPPED quando não há CNJs das outras fontes.

## Próximos Passos Recomendados

1. Testar rerun geral em ambiente de staging com caso real
2. Monitorar logs de `maybeRunAutoClassifyAndAi` para verificar deferred reasons
3. Validar comportamento do webhook Judit com eventos incrementais reais
4. Verificar se `FAILED_SCHEMA` aparece corretamente na UI quando IA retorna JSON inválido
5. Considerar migration de `djenLaborFlag` de boolean para string para consistência
