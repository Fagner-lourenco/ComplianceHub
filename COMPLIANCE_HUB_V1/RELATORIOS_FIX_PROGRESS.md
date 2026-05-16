# RELATORIOS_FIX_PROGRESS.md
> Controle incremental da rodada de estabilização de relatórios/PDF/link público.
> Atualizado a cada mudança. Fonte de verdade para o progresso desta rodada.

## Status Geral
**Iniciado:** 2026-05-13  
**Versão atual do build:** REPORT_BUILD_VERSION = 4

---

## Inventário Confirmado (código real vs spec)

### Funções/helpers que EXISTEM no código real
| Símbolo | Arquivo | Linha | Notas |
|---------|---------|-------|-------|
| `buildCanonicalReportHtml(caseId, caseData, sanitizedPayload)` | functions/index.js | 9155 | Aceita payload opcional |
| `syncPublicResultLatest(caseId, caseData, payload, opts)` | functions/index.js | 8420 | OK |
| `hasPublicReportMinimumContent(caseData, publicSnapshot)` | functions/index.js | 8508 | Aceita finalVerdict + (executiveSummary \| keyFindings \| warrantFindings \| analystComment) |
| `computePublicSnapshotHash(publicData)` | functions/index.js | 8504 | OK |
| `buildSanitizedPublicResultSnapshot(...)` | functions/index.js | 8347 | Constrói processHighlights mas NÃO está em PUBLIC_RESULT_FIELDS |
| `resolvePublicReportStatus(reportData, now)` | functions/index.js | 6528 | OK |
| `serializeManagedPublicReport(docSnap)` | functions/index.js | 6537 | Retorna: id,token,caseId,tenantId,candidateName,active,status,createdAt,expiresAt |
| `assertOpsCanAccessCase(profile, caseData, caseId)` | functions/index.js | 6054 | OK |
| `getOpsUserProfile(uid)` | functions/index.js | 9037 | OK |
| `getClientUserProfile(uid, opts)` | functions/index.js | 9069 | OK |
| `injectPdfExportCss(html, opts)` | functions/helpers/pdfHtml.js | 13 | tem `includeWatermark` param |
| `injectPublicVerificationBanner(html, reportData, token)` | functions/helpers/pdfHtml.js | 53 | Banner HTML inline, não usado atualmente |
| `createAnalystPublicReport` callable | functions/index.js | 6295 | TTL_DAYS declarado corretamente (linha 6304) |
| `createClientPublicReport` callable | functions/index.js | 6419 | **BUG: TTL_DAYS usado em linha 6467, declarado em linha 6490** |
| `listClientPublicReports` callable | functions/index.js | 6555 | OK |
| `revokeClientPublicReport` callable | functions/index.js | 6586 | OK |
| `revokePublicReport` callable | functions/index.js | 6643 | OK |
| `generateClientCasePdf` callable | functions/index.js | 10680 | usa `includeWatermark: true` |
| `generatePublicReportPdf` callable | functions/index.js | 10818 | usa `includeWatermark: false` ← **INCONSISTENTE** |
| `callBackendFunction(name, payload)` | src/core/firebase/firestoreService.js | 794 | Privado, não exportado. Usado internamente |
| `buildCaseReportHtml(caseData, candidateData)` | src/core/reportBuilder.js | 439 | Frontend builder |
| `buildBatchReportHtml(cases, tenantName)` | src/core/reportBuilder.js | 453 | Existe, usado em ExportacoesPage |
| `getReportAvailability(caseData, publicResult)` | src/core/clientPortal.js | 221 | **BUG: exige executiveSummary estritamente (linha 248)** |
| `REPORT_BUILD_VERSION = 4` | functions/reportBuilder.cjs:6 + src/core/reportBuilder.js:3 | — | Ambos = 4 |
| `IDENTITY_FIELDS`, `RESULT_ONLY_FIELDS`, `CLIENT_SAFE_PUBLICATION_FIELDS`, `PUBLIC_RESULT_FIELDS` | functions/index.js | 4839–4882 | OK |
| `escapeCsvField` | src/portals/client/ExportacoesPage.jsx | 68 | CSV injection já tratado |

### Funções/callables que NÃO EXISTEM (precisam ser criadas)
| Símbolo | Status |
|---------|--------|
| `prepareCanonicalReport(caseId, caseData, opts)` | ❌ Não existe |
| `getClientCaseReportHtml` callable | ❌ Não existe |
| `getOpsCaseReportHtml` callable | ❌ Não existe |
| `getPublicReportView` callable | ❌ Não existe |
| `listOpsPublicReports` callable | ❌ Não existe |
| `PUBLIC_REPORT_TTL_MS` global | ❌ Não existe |
| Watermark em REPORT_CSS (HTML canônico) | ❌ Não existe (só no PDF via injectPdfExportCss) |
| Media queries mobile em REPORT_CSS | ❌ Não existe |
| `safeFilenamePart(value)` helper frontend | ❌ Não existe (existe `makeSafePdfFilename` no backend) |
| Topbar pública em PublicReportPage | ❌ Não existe (existe CSS mas não está renderizando) |
| `serializeDate(value)` helper | ❌ Não existe (asDate() existe, serializeManagedPublicReport usa .toISOString() inline) |

---

## Bugs Confirmados no Código Real

### BUG-001 — TTL_DAYS TDZ em createClientPublicReport
- **Arquivo:** functions/index.js linha 6467
- **Problema:** `TTL_DAYS` usado na regeneração de token existente (linha 6467) mas `const TTL_DAYS = 14` só é declarado na linha 6490 → JavaScript `const` TDZ → ReferenceError em runtime no caminho de regeneração
- **Impacto:** Quando cliente regenera link de relatório existente, a função crasha
- **Fix:** Criar `PUBLIC_REPORT_TTL_DAYS = 14` e `PUBLIC_REPORT_TTL_MS` no topo do módulo

### BUG-002 — processHighlights fora de PUBLIC_RESULT_FIELDS
- **Arquivo:** functions/index.js linha 4854–4868
- **Problema:** `processHighlights` é construído em `buildSanitizedPublicResultSnapshot` mas não está em `RESULT_ONLY_FIELDS`, então não entra no `publicResult/latest` e não aparece no relatório
- **Fix:** Adicionar `'processHighlights'` em `RESULT_ONLY_FIELDS`

### BUG-003 — buildCanonicalReportHtml espalha dados brutos
- **Arquivo:** functions/index.js linhas 9196–9204
- **Problema:** `reportData = {...candidateData, ...caseData, ...publicResultData}` — campos internos/brutos do case e do candidate sobrescrevem o publicResult (ordem errada) e podem vazar campos não sanitizados
- **Fix:** Inverter prioridade: publicResult sobrescreve caseData, remover acesso direto a candidates/

### BUG-004 — Watermark inconsistente entre PDFs
- **Arquivo:** functions/index.js linhas 10710 e 10852
- **Problema:** PDF autenticado usa `includeWatermark: true`; PDF público usa `includeWatermark: false` → PDFs visualmente diferentes
- **Fix:** Adicionar watermark no REPORT_CSS canônico e setar ambos para `includeWatermark: false`

### BUG-005 — getReportAvailability diverge do backend
- **Arquivo:** src/core/clientPortal.js linha 248
- **Problema:** Frontend exige `executiveSummary` obrigatório, mas backend aceita `keyFindings || warrantFindings || analystComment` como alternativas → relatórios válidos aparecem como pendentes no frontend
- **Fix:** Alinhar com `hasPublicReportMinimumContent`

### BUG-006 — createClientPublicReport gera HTML antes de syncPublicResultLatest
- **Arquivo:** functions/index.js linha 6482–6488
- **Problema:** HTML gerado na linha 6482 (`buildCanonicalReportHtml`), sync feito na linha 6485 → hash calculado do snapshot pós-sync mas HTML pode ter sido gerado de snapshot anterior
- **Fix:** Integrar em `prepareCanonicalReport` que sincroniza primeiro

### BUG-007 — PublicReportPage lê Firestore diretamente + lê cases/{caseId}
- **Arquivo:** src/pages/PublicReportPage.jsx linhas 79 e 113
- **Problema:** `getPublicReport(token)` → `getDoc(doc(db,'publicReports',token))`. Além disso valida `cases/{caseId}` pelo frontend público. Isso depende de regra Firestore pública aberta
- **Fix:** Criar callable `getPublicReportView` e migrar

### BUG-008 — CasoPage botão "Relatório" gera link público sem prévia separada
- **Arquivo:** src/portals/ops/CasoPage.jsx linha 966–978
- **Problema:** Único botão que simultaneamente gera link público e abre a URL → operador não pode visualizar relatório sem publicar
- **Fix:** Separar em "Prévia do relatório" (sem gerar link) e "Gerar link público" (mantém comportamento atual)

### BUG-009 — RelatoriosPage lê publicReports direto do Firestore
- **Arquivo:** src/portals/ops/RelatoriosPage.jsx linha 94 → firestoreService.js linha 669
- **Problema:** `fetchPublicReports(tenantId)` → query direta `publicReports` collection → sem validação RBAC no backend; analyst pode ver qualquer tenant se rule falhar
- **Fix:** Criar callable `listOpsPublicReports`

### BUG-010 — ClientReportPage monta HTML no frontend
- **Arquivo:** src/portals/client/ClientReportPage.jsx
- **Problema:** HTML do relatório autenticado é montado pelo builder frontend (`buildCaseReportHtml`) que pode divergir do builder backend
- **Fix:** Criar callable `getClientCaseReportHtml` e migrar

---

## Bugs do Spec que NÃO EXISTEM no Código Atual
| Item | Situação real |
|------|--------------|
| TTL_DAYS bug em createAnalystPublicReport | NÃO há bug: linha 6304 declara antes do uso na linha 6305 |
| `getPublicReport` callable mencionada no spec | Não existe callable, a leitura é direta no firestoreService.js |
| Banner público "htmlWithBanner = reportHtml" sem banner | O código já faz isso (htmlWithBanner = reportHtml), mas a topbar CSS existe sem ser renderizada |
| `PUBLIC_RESULT_FIELDS` ausente no frontend | Frontend tem sua própria lista em clientPortal.js (diferente mas funcional) |

---

## Checklist de Etapas

### ETAPA 1 — Campos canônicos e TTL ✅
- [x] **BUG-001** TTL_DAYS: criar `PUBLIC_REPORT_TTL_DAYS` / `PUBLIC_REPORT_TTL_MS` globais e corrigir
- [x] **BUG-002** processHighlights: adicionar em `RESULT_ONLY_FIELDS` (backend)
- [x] **BUG-005** getReportAvailability: alinhar com hasPublicReportMinimumContent (frontend)

### ETAPA 2 — Helper canônico e fonte ✅
- [x] Criar `prepareCanonicalReport` helper (functions/index.js)
- [x] **BUG-003** Corrigir `buildCanonicalReportHtml` — publicResult first, sem spread de caseData bruto
- [x] **BUG-006** Usar `prepareCanonicalReport` em `createClientPublicReport` (novo e regeneração)
- [x] Atualizar `generateClientCasePdf` para usar `prepareCanonicalReport`

### ETAPA 3 — Watermark canônico ✅
- [x] **BUG-004** Adicionar watermark no `REPORT_CSS` (backend reportBuilder.cjs)
- [x] Adicionar watermark no `REPORT_CSS` (frontend reportBuilder.js)
- [x] Adicionar media queries mobile (backend + frontend)
- [x] `generateClientCasePdf` → `includeWatermark: false` (evita duplicação)
- [x] `generatePublicReportPdf` → já usava `includeWatermark: false` (correto)

### ETAPA 4 — Novas callables backend ✅
- [x] Criar `getClientCaseReportHtml` callable
- [x] Criar `getOpsCaseReportHtml` callable
- [x] **BUG-007** Criar `getPublicReportView` callable
- [x] **BUG-009** Criar `listOpsPublicReports` callable
- [x] Adicionar wrappers em firestoreService.js (`getClientCaseReportHtml`, `getOpsCaseReportHtml`, `getPublicReportView`, `fetchOpsPublicReports`)

### ETAPA 5 — Frontend: cliente autenticado ✅
- [x] **BUG-010** ClientReportPage → usa `getClientCaseReportHtml`, mantém demo com builder local
- [x] iframe sandbox atualizado

### ETAPA 6 — Frontend: operacional (prévia separada) ✅
- [x] **BUG-008** CasoPage → separar [Prévia do relatório] de [Gerar link público]
- [x] Estado `reportPreview` + modal com iframe
- [x] Handler `handleOpenReportPreview` usa `getOpsCaseReportHtml`

### ETAPA 7 — Frontend: link público ✅
- [x] PublicReportPage → usa `getPublicReportView` callable (sem leitura direta Firestore)
- [x] Removido `getDoc(db, 'cases', linkedCaseId)` do frontend público
- [x] `candidateName` adicionado ao `reportMeta`
- [x] `safeFilenamePart` criado e filename do PDF público corrigido
- [x] Topbar pública com metadados (candidato, gerado, válido até, token)
- [x] iframe sandbox atualizado
- [x] Estado 'stale' tratado

### ETAPA 8 — Frontend: gestão de links ops ✅
- [x] RelatoriosPage → usa `fetchOpsPublicReports` callable (não mais `fetchPublicReports`)

### ETAPA 9 — Responsividade mobile ✅
- [x] Media queries adicionadas ao REPORT_CSS (backend + frontend)
- [x] Topbar pública responsiva em 720px

### ETAPA 10 — iframe sandbox ✅
- [x] ClientReportPage: `sandbox="allow-modals allow-popups allow-popups-to-escape-sandbox"`
- [x] PublicReportPage: mesmo sandbox
- [x] CasoPage preview modal: mesmo sandbox

### ETAPA 11 — Firestore Rules
- [ ] Pendente: avaliar endurecer publicReports após validação manual
  - BLOQUEADOR: `listClientPublicReports` pode ainda precisar de read direto — verificar antes

### ETAPA 12 — Testes e build
- [x] npm test (raiz) → 619/619 ✅
- [x] npm run build (raiz) → built in 3.64s ✅
- [ ] cd functions && npm test (executar manualmente)

---

## Arquivos Alterados

| Arquivo | Etapa | Mudança |
|---------|-------|---------|
| functions/index.js | 1 | PUBLIC_REPORT_TTL_MS global, processHighlights em RESULT_ONLY_FIELDS |
| src/core/clientPortal.js | 1 | getReportAvailability alinhado |
| functions/index.js | 2 | prepareCanonicalReport, buildCanonicalReportHtml fix, createClientPublicReport fix |
| functions/reportBuilder.cjs | 3 | watermark no REPORT_CSS |
| src/core/reportBuilder.js | 3 | watermark no REPORT_CSS (frontend) |
| functions/helpers/pdfHtml.js | 3 | includeWatermark:false nos dois PDFs |
| functions/index.js | 4 | 4 novas callables |
| src/core/firebase/firestoreService.js | 4 | 4 novos wrappers |
| src/portals/client/ClientReportPage.jsx | 5 | usa callable backend |
| src/portals/ops/CasoPage.jsx | 6 | prévia separada |
| src/pages/PublicReportPage.jsx | 7 | usa getPublicReportView |
| src/portals/ops/RelatoriosPage.jsx | 8 | usa listOpsPublicReports |
| functions/reportBuilder.cjs | 9 | media queries mobile |
| src/core/reportBuilder.js | 9 | media queries mobile |

---

## Decisões Técnicas
1. **prepareCanonicalReport** criado como função async privada no functions/index.js (não exported, só usada internamente)
2. **Watermark no REPORT_CSS**: fonte canônica passa a ter watermark; PDFs passam a usar `includeWatermark: false` para evitar duplicação
3. **buildCanonicalReportHtml**: não remove busca a `candidates/` completamente, mas muda ordem para que `publicResultData` tenha prioridade máxima sobre `caseData` e `candidateData`
4. **getPublicReportView**: callable sem autenticação obrigatória (chamada por usuários anônimos). Validação é feita internamente (token, expiresAt, active, DONE)
5. **Frontend demo mode**: mantido usando buildCaseReportHtml local em todos os casos de demo
6. **Firestore Rules**: NÃO endurecidas nesta rodada até todas as telas estarem migradas

---

## Riscos Restantes
- `buildBatchReportHtml` (consolidado) ainda usa builder frontend — documentado, correto para esta rodada
- `serializeManagedPublicReport` não retorna `reportBuildVersion` nem `publicSnapshotHash` — será necessário em etapas futuras para exibir versão no /client/relatorios e /ops/relatorios
- Firestore Rules de `publicReports` ainda permitem leitura pública direta — intencional nesta rodada até migração completa
