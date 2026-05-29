# Progress Log — Correção de Gargalos ComplianceHub

> **Sessão iniciada:** 2026-05-29
> **Fase atual:** Fase 4 completa. Revisão finalizada. Pronto para deploy.

---

## Timeline

| Data/Hora | Evento | Detalhes |
|-----------|--------|----------|
| 2026-05-29 | Análise inicial solicitada | Usuário pediu para analisar gargalos de performance e segurança |
| 2026-05-29 | Varredura paralela em 4 frentes | Frontend, Backend, Segurança, Arquitetura |
| 2026-05-29 | Análise profunda dos 15 itens | Leitura de código real, quantificação de impacto, correções precisas |
| 2026-05-29 | Planejamento ultradetalhado criado | task_plan.md, findings.md, progress.md |
| 2026-05-29 | Fase 0 concluída | rateLimiter.js criado com 9 testes, todos passando |
| 2026-05-29 | Fase 1 concluída | backfillClientCasesMirror corrigido: permissões, tenant filter, lock |
| 2026-05-29 | Fase 2 concluída | 5 itens backend: fetchTenantCaseDocuments, repairAllClaims, PDF, JSON.stringify, triggers |
| 2026-05-29 | Fase 3 concluída | 3 itens frontend: CasoPage debounce, subscriptions 5k, exportação asyncPool |
| 2026-05-29 | Fase 4 concluída | Revisão completa + remoção de código morto + fix de segurança cpf |

---

## Decisões do Usuário

| Decisão | Impacto no Plano |
|---------|------------------|
| Excluir item 1.2 (race condition conclude) | Não implementar transaction em `concludeCaseByAnalyst` |
| Excluir item 1.4 (listOpsUsers) | Manter comportamento atual (owner vê todos) |
| Excluir item 1.5 (rate limiting callables) | Não implementar rate limiting em endpoints |
| Excluir item 2.4 (Judit polling) | Manter polling atual de 7 minutos |

---

## Status por Item

| # | Item | Severidade | Status | Notas |
|---|------|------------|--------|-------|
| 1.1 | fetchTenantCaseDocuments sem limite | CRÍTICO | ✅ Concluído | Committed: db58cce |
| 1.3 | backfillClientCasesMirror sem permissões | CRÍTICO | ✅ Concluído | Committed: 319a6b2 |
| 2.1 | repairAllClaims sem paginação | CRÍTICO | ✅ Concluído | Committed: 7270e82 |
| 2.2 | PDF Puppeteer cold start | ALTO | ✅ Concluído | Committed: 27b680a |
| 2.3 | DJEN trigger sem timeout | ALTO | 🔲 Excluído | Decisão do usuário |
| 2.5 | writeClientCaseMirror JSON.stringify | ALTO | ✅ Concluído | Committed: 6a1ed1f |
| 2.6 | Cascata de triggers | MÉDIO | ✅ Concluído | Committed: 3e03681 |
| 3.1 | CasoPage.jsx recálculos | CRÍTICO | ✅ Concluído | Committed: a241449 |
| 3.2 | Subscriptions limit 500 | CRÍTICO | ✅ Concluído | Committed: b6bdc0c |
| 3.3 | Exportação síncrona frontend | CRÍTICO | ✅ Concluído | Committed: b6bdc0c |
| 4.1 | Revisão completa + dead code | — | ✅ Concluído | Committed: 041fb35 |
| 4.2 | Segurança: cpf em PUBLIC_RESULT_FIELDS | CRÍTICO | ✅ Concluído | Committed: 041fb35 |

---

## Próximos Passos

1. ~~Aprovação do usuário~~ ✅ Concluído
2. ~~Execução da Fase 0~~ ✅ Concluído
3. ~~Execução da Fase 1~~ ✅ Concluído
4. ~~Execução da Fase 2~~ ✅ Concluído
5. ~~Execução da Fase 3~~ ✅ Concluído
6. ~~Execução da Fase 4~~ ✅ Concluído
7. **Execução da Fase 5** (deploy) — PRÓXIMO

---

## Métricas Atuais (Pós-Revisão)

| Métrica | Valor Atual | Target | Status |
|---------|-------------|--------|--------|
| Testes frontend | 885 passando | Manter 820+ | ✅ Superou |
| Testes backend | 565 passando | Manter 513+ | ✅ Superou |
| Lint frontend | 0 erros, 0 warnings | Manter 0 | ✅ Limpo |
| Lint backend | 0 erros, 0 warnings | Manter 0 | ✅ Limpo |
| Build | Sucesso | Manter sucesso | ✅ Sucesso |
| Cold start PDF | 10-20s | <3s (warm) | 🔄 Aguardando deploy para medir |
| Casos carregados | 500 (truncado) | 5.000 | ✅ Implementado (5.000) |
| Tempo listOpsCases (10k) | Timeout/OOM | <3s | ✅ Implementado (limit + paginação) |
| Código morto removido | 176 linhas + 3 imports | — | ✅ Limpo |
| CPF exposto em publicResult | ✅ Removido | Não expor | ✅ Corrigido |

---

## Commits Recentes

| Commit | Mensagem | Fase |
|--------|----------|------|
| 041fb35 | fix(security): remove cpf from public result fields + remove dead code | 4.1 + 4.2 |
| a241449 | perf(frontend): debounce CasoPage text fields, memoize risk calc, fix 3 flaky tests | 3.1 |
| b6bdc0c | perf(frontend): increase query limits and limit export concurrency | 3.2 + 3.3 |
| 3e03681 | perf(backend): skip syncClientCaseOnUpdate when only auto-classify fields changed | 2.6 |
| 6a1ed1f | fix(backend): replace JSON.stringify comparison with field-by-field diff | 2.5 |
| 27b680a | perf(backend): reuse Puppeteer browser instance | 2.2 |
| 7270e82 | perf(backend): paginate repairAllClaims | 2.1 |
| db58cce | perf(backend): add hard limit to fetchTenantCaseDocuments | 1.1 |
| 319a6b2 | fix(security): add permissions, tenant filter, and lock to backfillClientCasesMirror | 1.3 |
| bdb6cec | feat(infra): add rate limiter helper with Firestore-backed sliding window | 0 |

---

## Notas Técnicas

- **Hook useDebouncedField**: Criado com sincronização externa via queueMicrotask, preservação de edições locais, callback onDirty, e função flush para commit forçado. 9 testes passando.
- **CasoPage.jsx**: 8 campos de texto com debounce 400ms, activeWarrantCount memoizado, calculateRisk com dependências granulares e formRef para leitura síncrona. 3 testes flaky resolvidos.
- **ExportacoesPage.jsx**: asyncPool com concorrência limitada a 5 para evitar sobrecarga do browser.
- **Firestore subscriptions**: DEFAULT_QUERY_LIMIT aumentado para 5.000 (era 500), MESSAGE_QUERY_LIMIT = 50.
- **Segurança cpf**: Removido 'cpf' de IDENTITY_FIELDS no backend. O frontend nunca esperava esse campo em PUBLIC_RESULT_FIELDS, mas o backend o incluia em publicResult/latest e clientCases.
- **Código morto removido**: src/core/roleClassifier.js (176 linhas, zero imports), 3 imports não utilizados.
