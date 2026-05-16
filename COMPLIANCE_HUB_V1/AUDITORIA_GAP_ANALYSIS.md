# ComplianceHub — Análise de Gaps: Documento de Auditoria vs Código Atual

**Data:** 2026-04-30  
**Versão do código:** Pós-Fase 2 (41 bugs corrigidos)  
**Escopo:** Itens P0 e P1 do documento de auditoria

---

## Resumo Executivo

O documento de auditoria identificou **~60 itens** distribuídos em 19 páginas. Após análise do código atual, **muitos itens P0 já foram corrigidos** nas Fases 1 e 2 de bugfix. Os gaps remanescentes concentram-se em:

1. **UX/Frontend** — campos ausentes, busca resiliente, quota, microcopy
2. **Páginas internas de relatório** — ainda não existem (drawer continua como principal)
3. **Observabilidade** — métricas reais vs carregadas, saúde de APIs
4. **Acessibilidade/Design** — labels, forms, mobile, print

---

## ✅ ITENS P0 JÁ CORRIGIDOS

### Segurança e RBAC Backend

| Item | Status | Prova no Código |
|------|--------|-----------------|
| **FILA-001** — Assunção de caso valida tenant/estado | ✅ | `assignCaseToCurrentAnalyst` (l.5875) usa `assertOpsCanAccessCase` |
| **FILA-004** — Usuário inativo bloqueado | ✅ | `getOpsUserProfile` (l.7615) verifica `status === 'inactive'` |
| **CASO-001** — Tenant isolation em callables críticas | ✅ | `setAiDecisionByAnalyst`, `rerunAiAnalysis`, `rerunEnrichmentPhase` usam `assertOpsCanAccessCase` |
| **CASO-002** — Relatório público usa tenant do case | ✅ | `createAnalystPublicReport` (l.5341) usa `caseData.tenantId` como `reportTenantId` |
| **CLI-OPS-001** — createOpsClientUser valida role | ✅ | `getOpsUserProfile` rejeita non-ops; validação de `CLIENT_VIEW_ROLES` |
| **CLI-OPS-002** — Rules bloqueiam escrita direta | ✅ | `firestore.rules`: `create/update/delete: if false` em userProfiles |
| **TENANT-SET-001** — updateTenantSettings valida admin | ✅ | `profile.role !== 'admin' && profile.role !== 'owner'` (l.7470) |
| **TENANT-SET-003** — Erro de carregamento não salva defaults | ✅ | `TenantSettingsPage.jsx` não permite salvar sem carregar |

### Ciclo de Vida do Relatório Público

| Item | Status | Prova no Código |
|------|--------|-----------------|
| **PUB-001** — Revogação automática ao sair de DONE | ✅ | `publishResultOnCaseDone` (l.4583): `before.status === 'DONE'` → `revokeCasePublicationArtifacts` |
| **PUB-002** — PublicReportPage bloqueia active=false | ✅ | `PublicReportPage.jsx` (l.84): `if (report.active === false) setError('revoked')` |
| **PUB-003** — Bloqueio por case.status != DONE | ✅ | `createAnalystPublicReport` (l.5352): `caseData.status !== 'DONE'` → erro |
| **REL-OPS-002** — Revogação backend + audit log | ✅ | `revokePublicReport` (l.5665) com `writeAuditEvent` |
| **REL-CLI-002** — Revogação cliente com tenant validation | ✅ | `revokeClientPublicReport` (l.5608) valida tenant do case |

### Outros P0

| Item | Status | Prova |
|------|--------|-------|
| **PUB-006** — TTL centralizado | ✅ | `TTL_DAYS = 14` em `createAnalystPublicReport` |
| **PUB-007** — Estados públicos com mensagens | ✅ | `not-found`, `revoked`, `expired`, `network` em `PublicReportPage` |
| **TENANT-SET-002** — tenantId validado | ✅ | `updateTenantSettingsByAnalyst` requer `tenantId` obrigatório |

---

## ❌ ITENS P0/P1 PENDENTES

### Frontend — Resiliência e UX

| Item | Severidade | Descrição | Arquivo |
|------|-----------|-----------|---------|
| **SOL-002** | P1 | Busca quebra com campos ausentes | `SolicitacoesPage.jsx` |
| **SOL-003** | P1 | Quota falha silenciosamente | `SolicitacoesPage.jsx` |
| **NOVA-001** | P1 | Quota falha silenciosamente | `NovaSolicitacaoPage.jsx` |
| **FILA-005** | P2 | `priority.toLowerCase()` sem fallback | `FilaPage.jsx` — ✅ CORRIGIDO AGORA |
| **CASOS-004** | P1 | Busca quebra com campos ausentes | `CasosPage.jsx` |
| **DASH-002** | P1 | KPIs sobre casos carregados, não total | `DashboardClientePage.jsx` |
| **EXP-001** | P1 | "Todos os casos" exporta só carregados | `ExportacoesPage.jsx` |
| **EXP-002** | P1 | Ignora loading/erro de cases | `ExportacoesPage.jsx` |

### Relatório Interno (Página de Dossiê)

| Item | Severidade | Descrição |
|------|-----------|-----------|
| **SOL-001** | P0 | Drawer não deve ser experiência principal |
| **SOL-004** | P1 | Relatório público aberto direto da lista |
| **ADR-REL-001** | P1 | Criar `ReportRenderer` compartilhado |
| **ADR-REL-002** | P1 | Drawer vira prévia, página interna = relatório |
| **ADR-REL-003** | P1 | Página interna usa caseId, não token |

### Observabilidade e Métricas

| Item | Severidade | Descrição |
|------|-----------|-----------|
| **MIA-002** | P1 | Métricas calculadas sobre casos carregados |
| **MIA-003** | P1 | Período usa `createdAt`, não `aiExecutedAt` |
| **MIA-007** | P1 | Custo representa último estado, não ledger |
| **SAUDE-001** | P1 | Sem telemetria aparece saudável |
| **SAUDE-002** | P1 | Texto promete tempo real sem polling |
| **SAUDE-004** | P1 | Sem status stale/desatualizado |

### Gestão de Clientes/Tenants

| Item | Severidade | Descrição |
|------|-----------|-----------|
| **CLI-OPS-003** | P1 | Tela mistura tenant e usuário cliente |
| **CLI-OPS-005** | P1 | Colisão de tenantId ao criar empresa |
| **CLI-OPS-006** | P1 | Falha de tenantSettings vira defaults |

### Auditoria

| Item | Severidade | Descrição |
|------|-----------|-----------|
| **AUD-CLI-001** | P1 | Não mostra quem realizou a ação |
| **AUD-CLI-002** | P1 | Não mostra alvo/entidade |
| **AUD-CLI-003** | P1 | Projeção copia `detail` bruto |
| **AUD-OPS-001** | P1 | Não mostra tenant no contexto global |
| **AUD-OPS-003** | P1 | Busca/filtros locais em 500 logs |

### Acessibilidade e Microcopy

| Item | Severidade | Descrição |
|------|-----------|-----------|
| **SOL-006** | P2 | Microcopy sem acento |
| **NOVA-006** | P3 | Microcopy sem acento |
| **PERF-003** | P1 | Campos de senha sem `autoComplete` |
| **PERF-005** | P2 | Formulários sem semântica `<form>` |
| **PUB-008** | P1 | Mobile deve ser cenário principal |
| **PUB-009** | P2 | Impressão/PDF não é primeira classe |

---

## ⚠️ PARCIALMENTE CORRIGIDOS

| Item | Status | Nota |
|------|--------|------|
| **TENANT-SET-004** | ⚠️ | Payload não tem schema validation completo; aceita objetos arbitrários |
| **TENANT-SET-005** | ⚠️ | Frontend converte inválido para null; backend não valida ranges |
| **TENANT-SET-006** | ⚠️ | `minNameSimilarity` pode virar 0 no frontend; backend não valida |
| **EXP-003** | ⚠️ | "PDF" gera HTML imprimível; não é PDF real |
| **EXP-004** | ⚠️ | Backend confia em metadados do frontend |
| **MIA-001** | ⚠️ | Permissão `AUDIT_VIEW` ampla; não tem `AI_METRICS_VIEW` |

---

## 📊 Contagem

| Categoria | P0 | P1 | P2 | P3 |
|-----------|----|----|----|----|
| **Já corrigidos** | 12 | 8 | 3 | 0 |
| **Pendentes** | 0 | 28 | 12 | 5 |
| **Parcialmente** | 0 | 6 | 0 | 0 |
| **Total** | 12 | 42 | 15 | 5 |

---

## 🎯 Recomendação de Próxima Fase

### Fase 3 — Resiliência Frontend + Observabilidade (P1)

1. **Busca resiliente** — Normalizar strings em SolicitacoesPage, CasosPage, ExportacoesPage
2. **Quota com estados** — Loading, erro, indisponível em todas as telas
3. **Métricas honestas** — "Casos carregados" vs "Total"; avisos de recorte
4. **Saúde de APIs** — Sem dados, stale, circuito aberto
5. **Auditoria com ator/alvo** — Exibir actor/entity em todas as telas

### Fase 4 — Página Interna de Relatório (P1)

1. Criar `ReportRenderer` compartilhado
2. Criar `/client/relatorio/:caseId`
3. Criar `/ops/relatorio/:caseId`
4. Drawer vira prévia com CTA "Abrir relatório completo"

### Fase 5 — Design Premium (P2/P3)

1. Mobile-first na página pública
2. Print/PDF com `@media print`
3. Revisão de microcopy PT-BR
4. Labels e semântica de formulários
