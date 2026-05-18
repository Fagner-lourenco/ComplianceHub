# Findings - Auditoria Completa do Fluxo Principal

## Data: 2026-05-05
## Sessao: Auditoria e Correcao de Todos os Fluxos

---

## Bugs Pre-Identificados

### BUG-001: Mojibake em Relatorios Armazenados
- **Severidade**: P1
- **Descricao**: Relatorios em publicReports contem mojibake
- **Causa**: HTML gerado antes da normalizacao Unicode
- **Impacto**: Relatorios antigos exibem caracteres corrompidos

### BUG-002: ID Vazio no Footer do Relatorio
- **Severidade**: P2
- **Descricao**: Footer mostra "ID: -" em vez do caseId
- **Causa**: Relatorios gerados antes do fix id: caseId
- **Impacto**: Dificulta rastreabilidade

### BUG-003: CPF Redundante no Relatorio
- **Severidade**: P3
- **Descricao**: Campo CPF mostra "CPF regular" duplicado
- **Causa**: formatCpfStatus retorna "CPF regular" e o label ja eh "CPF"
- **Impacto**: Poluicao visual

---

## Descobertas da Auditoria

### Flow 1: Solicitacao do Cliente
**Status**: PENDENTE AUDITORIA

### Flow 2: Pipeline de Enriquecimento
**Status**: PENDENTE AUDITORIA

### Flow 3: Analise do Analista
**Status**: PENDENTE AUDITORIA

### Flow 4: Geracao de Relatorios
**Status**: PENDENTE AUDITORIA

### Flow 5: Autenticacao e Autorizacao
**Status**: PENDENTE AUDITORIA

### Flow 6: Notificacoes
**Status**: PENDENTE AUDITORIA

### Flow 7: Exportacoes
**Status**: PENDENTE AUDITORIA

### Flow 8: Modo Demo
**Status**: PENDENTE AUDITORIA

---

## Resumo
- **Bugs Pre-Identificados**: 3
- **Bugs Encontrados na Auditoria**: 0 (em andamento)
- **Correcoes Aplicadas**: 0

---

# Findings - Sessao 2026-05-18 Classificacao/SLA

## Requirements
- Corrigir classificacao automatica: fontes concluidas com retorno zero devem produzir "Sem apontamento"/negativo, nao inconclusivo.
- Manter inconclusivo para apontamentos ambiguos: duvida se e criminal/trabalhista, duvida de vinculo ao CPF/candidato, homonimia, divergencia ou falha relevante.
- Revisar classificacoes automaticas/sugeridas ainda persistidas no banco, inclusive campos de IA/prefill.
- Corrigir casos entrando na operacao com SLA vencido em UTC-3 Brasil.
- Corrigir erro de Cloud Function em rerun com `FieldValue.delete()` dentro de metadata.
- Corrigir tambem erros/travamentos de processamento do pipeline Madero quando confirmados por logs/dados.

## Research Findings
- Consulta read-only Firestore REST para `tenantId=madero-br`: 35 casos, 34 criados em `2026-05-18`, todos com `slaHours: 3`.
- Distribuicao atual Madero: `INCONCLUSIVE_LOW_COVERAGE`: 1, `POSITIVE`: 6, `NEGATIVE`: 27, `NEGATIVE_PARTIAL`: 1.
- `coverageLevel=LOW_COVERAGE` aparece em 19 casos, geralmente por `NO_PROCESS_EVIDENCE_RETURNED`, mas muitos ja estao com `criminalFlag=NEGATIVE` apos ajuste manual.
- `src/core/firebase/firestoreService.js` trunca `createdAt` para `YYYY-MM-DD` em `mapCaseDocument`, `getCase` e `subscribeToCaseDoc`.
- `src/core/caseSla.js` soma `slaHours` sobre `createdAt`; com data-only string, prazo fica calculado desde meia-noite UTC, causando atraso falso.
- `functions/helpers/aiHomonym.js` adiciona `NO_PROCESS_EVIDENCE_RETURNED` quando Judit, Escavador e BigDataCorp retornam zero processos/exact matches.
- `functions/index.js` transforma `LOW_COVERAGE` com qualquer coverage note em `INCONCLUSIVE_LOW_COVERAGE`.
- Logs recentes: erro em `rerunenrichmentphase` porque `metadata.homonymDecision` recebeu `FieldValue.delete()` nested.
- Testes existentes ja cobrem calibracao offline em `functions/helpers/aiCalibration.test.js`; melhor adicionar regressao ali para caso limpo com Judit/BDC zero.
- `src/core/firebase/firestoreService.test.js` ja mocka `fetchCases`, permitindo validar que `createdAt` preserva ISO completo sem depender da UI.
- Pipeline Madero com travamento: 3 casos estavam `DONE`, mas com `djenEnrichmentStatus=PENDING`, `juditNeedsEscavador=true` e `escavadorEnrichmentStatus=SKIPPED`.
- Logs desses casos mostram `DJEN waiting for Escavador`, depois `Escavador disabled`, depois `AutoClassify ... deferred — djen_PENDING`; causa: trigger DJEN so reagia a mudanca de Judit, nao a mudanca posterior de Escavador para `SKIPPED`.
- Scan de narrativas Madero encontrou 20 casos com texto/metadata automaticos ainda falando `apontamento criminal inconclusivo` ou `CRIMINAL_FLAG_INCONCLUSIVE`, apesar de varios `criminalFlag=NEGATIVE` apos ajuste manual.
- Script read-only `scripts/audit-madero-cleanup.cjs` confirma o escopo residual: 20 casos com narrativas automaticas antigas e 3 casos `DONE` com DJEN pendente apos Escavador `SKIPPED`.
- Deploy code-only concluido em Firebase Functions e Vercel; nenhum script de backfill/rerun foi executado, portanto casos `DONE` e publicacoes ja enviadas nao foram regravados por esta sessao.
- Auditoria read-only de `publicResult/latest` para Madero encontrou inconsistencias client-visible residuais: 4 casos `NEGATIVE` com texto de inconclusivo/cobertura, 9 `NEGATIVE` sem nota criminal claramente limpa, 2 conflitos texto trabalhista positivo vs flag negativa, 1 positivo trabalhista pouco explicado, e 6 positivos criminais que o detector marcou como subdescritos.
- Auditoria do documento completo do caso mostra mais ruido interno do que o cliente ve: 18 casos `NEGATIVE` ainda possuem texto interno/prefill com inconclusivo; 20 possuem `deterministicPrefill`/`prefillNarratives` antigos. Esses campos podem confundir revisao operacional se usados em reabertura/rerun, mas nao devem ser alterados automaticamente em casos ja enviados.
- Textos de mandado foram revisados com detector refinado: todos os 35 casos Madero estao `warrantFlag=NEGATIVE` e nao houve conflito client-visible real depois de excluir falso positivo de frases como "Nenhum mandado".

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Tratar zero retorno como negativo quando pelo menos fontes principais terminaram sem falha relevante | Alinha com regra do usuario e evita falso inconclusivo. |
| Inconclusivo por cobertura deve exigir falha/divergencia/ambiguidade, nao apenas ausencia de processos | Inconclusivo indica duvida, nao ausencia de apontamento. |
| Preservar timestamp completo no frontend e manter `createdDateKey` para agrupamento/filtro | Resolve SLA sem perder filtros por data. |
| Testar casos limpos e rerun metadata | Evita regressao nos bugs de producao. |
| Nao corrigir casos concluidos/enviados automaticamente | Usuario priorizou nao alterar relatorios ja enviados; a auditoria ficou read-only. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Catchup script no caminho colado pelo usuario nao existe | Usado caminho real da skill em `.config/opencode`. |
| Admin SDK local sem ADC e `gcloud` ausente | Usado Firestore REST com credenciais do Firebase CLI para consulta read-only. |
| Working tree contem mudancas nao relacionadas ao fix Madero | Nao fazer deploy sem decisao explicita sobre escopo da release. |

## Resources
- `functions/helpers/aiHomonym.js` linhas 408-529: cobertura e reasons.
- `functions/index.js` linhas 4442-4670: classificacao automatica criminal.
- `src/core/firebase/firestoreService.js` linhas 164-191 e 609-633: truncamento de timestamps.
- `src/core/caseSla.js` linhas 48-70: calculo de prazo.
- `functions/index.js` linhas 9700-9758: AI rerun audit metadata.

---

# Findings - Sessao 2026-05-18 Coerencia de Narrativas Futuras

## Requirements
- Corrigir somente fluxo futuro; nao alterar relatorios ja enviados/concluidos.
- Textos finais para cliente devem ser claros, didaticos e nao expor fontes/limitacoes da ferramenta.
- `NEGATIVE_PARTIAL` deve ser tratado como alerta operacional, nao como ressalva client-facing automatica.
- Contexto profissional pode continuar em notas trabalhistas, desde que claramente rotulado como contexto cadastral/profissional e nao como apontamento trabalhista.
- Inconsistencia texto-vs-flag deve gerar alerta operacional e texto seguro; nao deve bloquear conclusao.

## Research Findings
- `runAutoClassifyAndAi` sempre gera `deterministicPrefill` e copia para `prefillNarratives`; esses campos preenchem a tela de revisao para casos ainda nao `DONE`.
- `CasoPage.resolveDraftField` usa prioridade: campo final para `DONE`, depois `reviewDraft`, depois `prefillNarratives`, depois fallback/AI.
- Ao concluir, `optionalNarrative` envia campos preenchidos mesmo se vieram do prefill, desde que estejam no form.
- Backend `concludeCaseByAnalyst` hoje valida dependencias basicas, mas nao valida coerencia semantica entre flags e textos.
- `buildDetExecutiveSummary` e `buildDetFinalJustification` geram ressalvas genericas e podem omitir frase criminal negativa clara.
- `buildDetLaborNotes` mistura resultado trabalhista com contexto profissional sem rotulo suficientemente claro.
- Sanitizacao precisa rodar em tres pontos para cobrir fluxos futuros: merge de prefill deterministico, conclusao do analista e snapshot publico canonico.
- `rerunAiForCase` tinha caminho separado de merge deterministico e tambem precisava receber a mesma sanitizacao.
- `sourceSummary` ainda podia expor nomes de providers em fallback HTML; foi trocado por resumo operacional generico.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Sanitizar narrativa contra flags finais no backend | Evita que texto antigo/prefill contradiga classificacao salva/publicada. |
| Guardar `narrativeConsistencyWarnings` no caso, nao em `publicResult` | Alerta deve ser operacional e nao aparecer para cliente. |
| Mostrar alerta simples no `CasoPage` quando houver warnings | Analista sabe revisar narrativa, sem bloquear conclusao. |
| Usar textos negativos claros para criminal, trabalhista e mandado | Reduz ambiguidade e evita linguagem de baixa cobertura quando nao ha apontamento. |
| Trocar `sourceSummary` client-facing por resumo generico | Evita expor Judit/Escavador/FonteData/BigDataCorp/DJEN e limitacoes da ferramenta. |
