# MANUAL ULTRADETALHADO — Auditoria Real, Correções e Extração Restante — ComplianceHub

**Arquivo:** `MANUAL_AUDITORIA_CORRECOES_EXTRACAO_COMPLIANCEHUB.md`  
**Data:** 2026-05-30  
**Escopo:** revisão do repositório completo extraído de `ComplianceHub (2).zip`  
**Objetivo:** orientar o Kimi/agente local a corrigir o estado atual antes de qualquer remoção de código morto, merge, substituição ou deploy.

---

## 0. Veredito técnico desta revisão

### Decisão recomendada agora

**NO-GO para Phase D neste momento.**  
**NO-GO para merge/substituição/deploy neste momento.**  
**GO para rodada de correção pré-Phase D.**

A Phase D, que envolve remoção de código morto, **não deve começar ainda**, porque há inconsistências reais no estado atual do repositório:

1. `functions/index.js` ainda contém lógica de negócio relevante.
2. Existem exports duplicados/sobrescritos em `functions/index.js`.
3. O módulo `tenantUserManagement` foi extraído, mas os exports modulares são sobrescritos por implementações inline posteriores.
4. A documentação/handoff está divergente sobre o estado real da Phase C.
5. `backfillClientCasesMirrorInner` foi tratado como possível código morto, mas ainda é usado por export público, `__test` e testes.
6. Testes completos não puderam ser confirmados no meu ambiente por falha de dependência opcional do Rollup no ZIP extraído.

### O que foi validado por mim

Eu extraí o ZIP completo, auditei o repositório inteiro e executei validações estáticas/locais possíveis no ambiente atual.

Validações executadas:

- Extração integral do ZIP `ComplianceHub (2).zip`.
- Leitura do repositório inteiro.
- Análise de `functions/index.js`.
- Análise de `functions/modules/`.
- Análise de exports públicos.
- Detecção de exports duplicados.
- Busca por blocos residuais no monolito.
- Validação de sintaxe dos arquivos JS em `functions/`.
- Lint via chamada direta do ESLint com Node.
- Auditoria de índices Firestore.
- Auditoria de uso de `backfillClientCasesMirrorInner`.
- Conferência de contagem de arquivos de teste.

### O que NÃO foi possível confirmar aqui

Não consegui confirmar a execução completa de `npm test` e `npm run build` no ambiente extraído, porque o ZIP inclui `node_modules` com dependência opcional ausente do Rollup:

```text
Error: Cannot find module @rollup/rollup-linux-x64-gnu
```

Também `npm run lint` falhou via script porque os binários em `node_modules/.bin` vieram sem permissão de execução:

```text
sh: 1: eslint: Permission denied
```

Contudo, a chamada direta funcionou:

```bash
node node_modules/eslint/bin/eslint.js .
node ../node_modules/eslint/bin/eslint.js .
```

Resultado: lint direto sem erros no root e em `functions/`.

Portanto, a validação final deve ser refeita no ambiente local do Kimi com dependências corrigidas, usando `npm install`/`npm ci` conforme adequado.

---

## 1. Estado real observado no ZIP atual

### 1.1 Branch e estado do Git

O repositório extraído indica branch:

```text
refactor/full-local-roadmap
```

O working tree contém muitos arquivos modificados e novos. Isso é esperado após uma refatoração longa, mas exige revisão humana antes de merge.

### 1.2 Linhas atuais do monolito

Resultado observado:

```text
3971 functions/index.js
```

Isto diverge de relatórios que mencionavam `3597 linhas`.

### 1.3 Módulos existentes

Foram encontrados os seguintes arquivos principais em `functions/modules/`:

```text
functions/modules/_shared/index.js
functions/modules/aiOrchestrator.js
functions/modules/aiParsers.js
functions/modules/autoClassification.js
functions/modules/caseManager/caseFilters.js
functions/modules/caseManager/index.js
functions/modules/caseQueriesAssignments.js
functions/modules/concludeCaseAndSettings.js
functions/modules/deterministicPrefill.js
functions/modules/enrichmentPhases.js
functions/modules/exportJobsAndReports.js
functions/modules/index.js
functions/modules/juditWebhookAndFallback.js
functions/modules/notificationService.js
functions/modules/pdfGeneration.js
functions/modules/publishAndSync.js
functions/modules/reportEngine.js
functions/modules/systemHealth.js
functions/modules/tenantUserManagement.js
functions/modules/utilityHelpers.js
```

Testes de módulos encontrados:

```text
functions/modules/aiOrchestrator.test.js
functions/modules/autoClassification.test.js
functions/modules/caseManager/caseFilters.test.js
functions/modules/caseQueriesAssignments.test.js
functions/modules/concludeCaseAndSettings.test.js
functions/modules/deterministicPrefill.test.js
functions/modules/enrichmentPhases.test.js
functions/modules/exportJobsAndReports.test.js
functions/modules/juditWebhookAndFallback.test.js
functions/modules/notificationService.test.js
functions/modules/pdfGeneration.test.js
functions/modules/publishAndSync.test.js
functions/modules/reportEngine.test.js
functions/modules/systemHealth.test.js
functions/modules/tenantUserManagement.test.js
functions/modules/utilityHelpers.test.js
```

### 1.4 Linhas por módulo principal

Resumo observado:

```text
10   functions/modules/caseManager/index.js
15   functions/modules/index.js
53   functions/modules/utilityHelpers.js
121  functions/modules/_shared/index.js
122  functions/modules/systemHealth.js
188  functions/modules/caseManager/caseFilters.js
341  functions/modules/publishAndSync.js
391  functions/modules/pdfGeneration.js
451  functions/modules/notificationService.js
452  functions/modules/aiParsers.js
505  functions/modules/reportEngine.js
672  functions/modules/juditWebhookAndFallback.js
760  functions/modules/deterministicPrefill.js
835  functions/modules/tenantUserManagement.js
852  functions/modules/concludeCaseAndSettings.js
924  functions/modules/autoClassification.js
1138 functions/modules/exportJobsAndReports.js
1513 functions/modules/aiOrchestrator.js
1630 functions/modules/enrichmentPhases.js
1773 functions/modules/caseQueriesAssignments.js
```

Interpretação: houve uma extração significativa, mas `functions/index.js` ainda contém lógica de negócio relevante. Phase C deve ser tratada como **avançada/parcial**, não como 100% concluída, até que as duplicidades e blocos residuais sejam tratados.

---

## 2. Problema crítico confirmado: exports duplicados/sobrescritos

### 2.1 Resultado da auditoria de exports

Script executado sobre `functions/index.js` identificou:

```json
{
  "totalAssignments": 79,
  "uniqueExports": 70,
  "duplicateNames": 9
}
```

### 2.2 Exports duplicados encontrados

Foram encontrados 9 exports duplicados:

```text
DUP listTenantUsers
  L1325: exports.listTenantUsers = createListTenantUsersHandler({ db, getClientUserProfile });
  L1378: exports.listTenantUsers = onCall(

DUP createTenantUser
  L1326: exports.createTenantUser = createTenantUserHandler({
  L1411: exports.createTenantUser = onCall(

DUP updateTenantUser
  L1334: exports.updateTenantUser = createUpdateTenantUserHandler({
  L1471: exports.updateTenantUser = onCall(

DUP syncUserClaims
  L1342: exports.syncUserClaims = createSyncUserClaimsHandler({ db, getAuth });
  L1566: exports.syncUserClaims = onCall(

DUP repairAllClaims
  L1343: exports.repairAllClaims = createRepairAllClaimsHandler({ db, getAuth });
  L1663: exports.repairAllClaims = onCall(

DUP listOpsUsers
  L1349: exports.listOpsUsers = createListOpsUsersHandler({ db, getOpsUserProfile });
  L1669: exports.listOpsUsers = onCall(

DUP createOpsUser
  L1350: exports.createOpsUser = createOpsUserHandler({
  L1711: exports.createOpsUser = onCall(

DUP updateOpsUser
  L1358: exports.updateOpsUser = createUpdateOpsUserHandler({
  L1785: exports.updateOpsUser = onCall(

DUP updateOwnProfile
  L1366: exports.updateOwnProfile = createUpdateOwnProfileHandler({
  L1877: exports.updateOwnProfile = onCall(
```

### 2.3 Por que isso é grave

Em Node/CommonJS, a segunda atribuição vence. Exemplo:

```js
exports.listTenantUsers = createListTenantUsersHandler(...);
exports.listTenantUsers = onCall(...);
```

O export final usado pelo Firebase será o segundo. Isso significa que o módulo `tenantUserManagement` pode ter sido criado, importado e testado, mas **não está realmente ativo no export público final**.

### 2.4 Diagnóstico

Este é o problema mais importante antes da Phase D.

Classificação:

```text
BLOQUEADOR para Phase D
BLOQUEADOR para declarar Phase C como completa
BLOQUEADOR para merge/deploy
```

### 2.5 Correção recomendada

A correção deve ser feita com cautela:

1. Para cada export duplicado, comparar a lógica inline com a lógica modular correspondente.
2. Confirmar que a lógica modular é equivalente ou mais correta.
3. Se equivalente, manter apenas o export modular e remover/arquivar a implementação inline duplicada.
4. Se não equivalente, manter o inline temporariamente, remover a atribuição modular enganosa e registrar que o módulo ainda não está ativado.
5. Em nenhuma hipótese deixar duas atribuições `exports.nome = ...` para o mesmo nome.

Ordem sugerida:

1. `listTenantUsers`
2. `createTenantUser`
3. `updateTenantUser`
4. `syncUserClaims`
5. `repairAllClaims`
6. `listOpsUsers`
7. `createOpsUser`
8. `updateOpsUser`
9. `updateOwnProfile`

Depois de cada correção, rodar:

```bash
cd functions && npm test -- --run tenantUserManagement
cd functions && npm test -- --run repairAllClaims
cd ..
```

E depois:

```bash
cd functions && npm run lint && npm test
cd ..
npm run lint
npm test
npm run build
```

---

## 3. Blocos ainda presentes no monolito

### 3.1 Triggers de enriquecimento

Ainda estão em `functions/index.js`:

```text
L757  exports.enrichJuditOnCase
L842  exports.enrichBigDataCorpOnCase
L901  exports.enrichBigDataCorpOnCorrection
L948  exports.enrichJuditOnCorrection
L1017 exports.enrichEscavadorOnCase
L1122 exports.enrichDjenOnCase
```

Embora `functions/modules/enrichmentPhases.js` exista, os triggers ainda continuam como wiring com lógica relevante no monolito. A extração do pipeline está avançada, mas os triggers ainda precisam ser revisados para ficarem como wiring fino.

### 3.2 Identity Gate / publicação

Ainda estão em `functions/index.js`:

```text
L2965 buildResetPublishedCaseFields
L3008 isIdentityGateBlocked
L3019 buildIdentityGateCorrectionMessage
L3024 returnCaseForIdentityGateBlock
L3182 revokeCasePublicationArtifacts
```

Essas funções são críticas. Não devem ser removidas nem movidas sem testes específicos, pois afetam publicação, reset de artefatos e gate de identidade.

### 3.3 Notificações

Ainda estão em `functions/index.js`:

```text
L3254 createCaseCompletedNotifications
L3294 createNewSolicitationNotifications
```

Existe `functions/modules/notificationService.js`, mas essas funções ainda aparecem no monolito. Deve haver plano explícito para mover ou justificar.

### 3.4 RBAC/Auth/Profile

Ainda estão em `functions/index.js`:

```text
L3354 canBypassIdentityGate
L3364 assertOpsManager
L3367 assertCanAssignCase
L3371 getOpsUserProfile
L3388 assertOpsCanAccessCase
L3403 getClientUserProfile
L3423 assertClientManager
```

Essas funções são fundamentais para segurança. Devem permanecer até haver módulo compartilhado com testes robustos.

### 3.5 Configurações/providers

Ainda estão em `functions/index.js`:

```text
L573 loadFonteDataConfig
L604 loadEscavadorConfig
L623 loadJuditConfig
L663 loadBigDataCorpConfig
L683 loadDjenConfig
```

Essas funções poderiam ir para `providerConfig` ou `_shared/providerConfig.js`, mas devem ser movidas só com testes dos providers.

### 3.6 Validação/sanitização/utilitários

Ainda estão em `functions/index.js`:

```text
L364  asDate
L384  sanitizeStructuredList
L393  sanitizeStructuredText
L403  stripUndefined
L450  validateAiClassificationReviewSchema
L483  fixLatinMojibake
L518  normalizeUnicodeToAscii
L3559 validateCpfDigits
L3571 sanitizeCpf
L3575 maskCpf
L3581 formatRequestedBy
L3590 sanitizePublicReportHtml
L3599 getClientIp
```

Há módulos como `utilityHelpers`, `aiParsers`, `reportEngine`, `notificationService`, mas ainda há duplicidade/resíduos. Devem ser consolidados de forma controlada.

### 3.7 Solicitações de caso

Ainda estão em `functions/index.js`:

```text
L1922 exports.createClientSolicitation
L2170 exports.submitClientCorrection
```

Essas funções ainda são grandes e relevantes. Sugestão: extrair para `clientSolicitations` ou `clientPortal/solicitations` antes de declarar Phase C final.

---

## 4. Validação de módulos extraídos

### 4.1 Pontos positivos confirmados

- `functions/modules/` existe e contém muitos módulos.
- Cada módulo principal possui teste correspondente.
- Não encontrei import direto de `functions/index.js` dentro de `functions/modules`.
- Não encontrei `initializeApp` duplicado dentro de `functions/modules`.
- A sintaxe dos arquivos JS em `functions/` foi validada com `node --check`.
- Lint direto via Node não retornou erros no root e em `functions/`.

### 4.2 Limite da validação

Não consegui executar Vitest/build no ambiente atual por falha de dependência opcional do Rollup. Portanto, não confirmo os números de testes reportados pelo agente anterior.

### 4.3 Conclusão sobre as extrações

As extrações **não estão todas confirmadas como corretas**.

Há pelo menos uma extração com problema confirmado:

```text
tenantUserManagement foi extraído, importado e atribuído a exports, mas depois os mesmos exports foram sobrescritos por implementações inline.
```

Isso significa que a extração existe e tem testes, mas pode não estar efetivamente ativa em produção para esses exports.

---

## 5. Auditoria de `backfillClientCasesMirrorInner`

### 5.1 Resultado da busca

```text
functions/index.js:2599 async function backfillClientCasesMirrorInner(request)
functions/index.js:2672 exports.backfillClientCasesMirror = onCall(
functions/index.js:2674     backfillClientCasesMirrorInner,
functions/index.js:3874     backfillClientCasesMirrorInner,
functions/backfillClientCasesMirror.test.js:10 const { backfillClientCasesMirrorInner, _setDb } = mod.__test;
functions/backfillClientCasesMirror.test.js:101 describe('backfillClientCasesMirrorInner', () => {
```

### 5.2 Classificação correta

`backfillClientCasesMirrorInner` **não deve ser classificada como removível agora**.

Classificação recomendada:

```text
NÃO REMOVER
```

Motivos:

- É usada por export público `exports.backfillClientCasesMirror`.
- É exposta em `exports.__test`.
- Possui teste específico `functions/backfillClientCasesMirror.test.js`.

Se no futuro a função for substituída, primeiro deve haver:

1. nova implementação equivalente;
2. alteração do export público;
3. alteração dos testes;
4. validação de compatibilidade;
5. só então remoção da função antiga.

---

## 6. Auditoria de índices Firestore

### 6.1 Resultado

`firestore.indexes.json` possui:

```json
{
  "indexes": 24,
  "duplicates": 0
}
```

### 6.2 Observações

O arquivo contém índices V2 com `__name__` para paginação por cursor. Também contém índices para `exports`, `notifications`, `caseMessages`, `auditLogs`, `tenantAuditLogs`, `clientCases`, `cases` e `publicReports`.

### 6.3 Estado

```text
Índices adicionados ao arquivo, mas não deployados.
```

Isso está correto para execução local, mas deve ser pendência obrigatória antes de ativar V2 em produção.

---

## 7. Testes e validações executados nesta revisão

### 7.1 Lint

`npm run lint` falhou por permissão dos binários `.bin` do ZIP:

```text
sh: 1: eslint: Permission denied
```

Mas o lint direto funcionou:

```bash
node node_modules/eslint/bin/eslint.js .
cd functions && node ../node_modules/eslint/bin/eslint.js .
```

Resultado: sem erros reportados.

### 7.2 Testes

Tentativa de rodar Vitest:

```bash
node node_modules/vitest/vitest.mjs run --reporter=dot
```

Falhou por dependência opcional ausente do Rollup:

```text
Cannot find module @rollup/rollup-linux-x64-gnu
```

### 7.3 Build

Tentativa de rodar Vite build:

```bash
node node_modules/vite/bin/vite.js build
```

Falhou pelo mesmo problema do Rollup.

### 7.4 npm ls

`npm ls --depth=0` no root e em `functions/` retornou status 0, indicando que o package tree principal parece coerente, mas o pacote opcional nativo do Rollup está ausente no `node_modules` extraído.

### 7.5 Contagem de testes no filesystem

Arquivos de teste encontrados:

```text
Root/src: 39 arquivos de teste
Functions: 62 arquivos de teste
Functions/modules: 16 arquivos de teste
```

Isso difere dos relatórios que mencionam 87 arquivos frontend e 47 backend, provavelmente por diferenças na contagem, padrões de arquivos, estado de execução ou documentos antigos. O agente deve registrar a contagem real pelo runner, não só pelo `find`.

---

## 8. Plano de correção recomendado

## Ordem segura

1. Corrigir ambiente local de dependências para permitir testes reais.
2. Corrigir exports duplicados/sobrescritos.
3. Confirmar equivalência do módulo `tenantUserManagement`.
4. Atualizar documentação e `progress.md` com estado real.
5. Rodar testes completos.
6. Rodar testes focados por área.
7. Rodar load test em emulador.
8. Só depois decidir Phase D.

---

## 9. Correção 1 — ambiente de testes

No ambiente local do Kimi, executar:

```bash
rm -rf node_modules functions/node_modules
npm install
cd functions && npm install && cd ..
```

Ou, se for ambiente CI com lockfile confiável:

```bash
rm -rf node_modules functions/node_modules
npm ci
cd functions && npm ci && cd ..
```

Depois:

```bash
npm run lint
npm test
cd functions && npm run lint
cd functions && npm test
cd ..
npm run build
```

Não usar `--force`.

---

## 10. Correção 2 — exports duplicados

### 10.1 Regra

Cada export público deve aparecer apenas uma vez:

```js
exports.nome = ...
```

Não pode haver duas atribuições para o mesmo `nome`.

### 10.2 Estratégia preferencial

Para `tenantUserManagement`, a estratégia preferencial é:

1. Usar os handlers modulares importados de `functions/modules/tenantUserManagement.js`.
2. Remover as implementações inline duplicadas do `functions/index.js`.
3. Manter `functions/index.js` apenas como wiring.
4. Garantir que os testes existentes continuem passando.

### 10.3 Exemplo de estado desejado

```js
exports.listTenantUsers = createListTenantUsersHandler({ db, getClientUserProfile });
exports.createTenantUser = createTenantUserHandler({
  db,
  getAuth,
  getClientUserProfile,
  writeAuditEvent,
  ACTOR_TYPE,
  SOURCE,
});
exports.updateTenantUser = createUpdateTenantUserHandler({
  db,
  getAuth,
  getClientUserProfile,
  writeAuditEvent,
  ACTOR_TYPE,
  SOURCE,
});
exports.syncUserClaims = createSyncUserClaimsHandler({ db, getAuth });
exports.repairAllClaims = createRepairAllClaimsHandler({ db, getAuth });
exports.listOpsUsers = createListOpsUsersHandler({ db, getOpsUserProfile });
exports.createOpsUser = createOpsUserHandler({
  db,
  getAuth,
  getOpsUserProfile,
  writeAuditEvent,
  ACTOR_TYPE,
  SOURCE,
});
exports.updateOpsUser = createUpdateOpsUserHandler({
  db,
  getAuth,
  getOpsUserProfile,
  writeAuditEvent,
  ACTOR_TYPE,
  SOURCE,
});
exports.updateOwnProfile = createUpdateOwnProfileHandler({
  db,
  getAuth,
  writeAuditEvent,
  ACTOR_TYPE,
  SOURCE,
});
```

E remover as duplicatas inline posteriores.

### 10.4 Se os testes falharem

Se remover a implementação inline fizer teste falhar, não force.

Opções:

1. Corrigir o módulo para ficar equivalente ao inline.
2. Se o módulo não estiver pronto, manter o inline e remover a atribuição modular anterior para não gerar falso positivo.
3. Documentar como `tenantUserManagement extraído, mas ainda não ativado para todos os exports`.

---

## 11. Correção 3 — documentação

Atualizar `progress.md` para refletir o estado real.

### 11.1 Status recomendado agora

Até corrigir duplicidades e rodar testes completos, use:

```md
| A | **Baseline + V2 Cursor Pagination** | ✅ Concluída localmente / requer índices em deploy futuro |
| B | **Export Assíncrono** | ✅ Implementada localmente / requer validação final em ambiente íntegro |
| C | **Extração de Módulos** | 🔄 Avançada/parcial — módulos extraídos, mas ainda há monolito residual e exports duplicados a corrigir |
| D | **Remoção de Código Morto** | 🔲 Bloqueada até correção de exports, testes completos e load test |
| E | **Documentação e Handoff** | 🔄 Parcial — precisa alinhar handoffs/ADRs ao código real |
```

### 11.2 Documentos a corrigir

Corrigir:

- `progress.md`
- `findings.md`
- `task_plan.md`, se necessário
- `docs/audits/HANDOFF-*.md`
- `docs/adr/ADR-005-*`, se estiver desatualizado
- `docs/audits/PRE-PHASE-D-VALIDATION-2026-05-30.md`, se existir no repo

### 11.3 O que documentar

- `functions/index.js` com 3971 linhas no ZIP auditado.
- 79 atribuições de exports.
- 70 exports únicos.
- 9 exports duplicados antes da correção.
- `tenantUserManagement` sobrescrito por inline antes da correção.
- `backfillClientCasesMirrorInner` classificado como `NÃO REMOVER`.
- Testes completos pendentes até corrigir ambiente Rollup.
- Índices não deployados.

---

## 12. Extração restante recomendada

Depois de corrigir duplicidades e passar testes, a extração restante deve seguir esta ordem.

### 12.1 Módulo `rbacAndProfiles`

Extrair:

- `getOpsUserProfile`
- `getClientUserProfile`
- `assertOpsCanAccessCase`
- `assertClientManager`
- `assertOpsManager`
- `assertCanAssignCase`
- `canBypassIdentityGate`
- role sets relacionados

Motivo: essas funções são usadas por muitos módulos. Devem virar dependência compartilhada estável.

Cuidados:

- Não quebrar tenant isolation.
- Não relaxar permissões.
- Testar roles `analyst`, `supervisor`, `admin`, `owner`, `client_manager`, `client_operator`, `client_viewer`.

### 12.2 Módulo `providerConfig`

Extrair:

- `loadFonteDataConfig`
- `loadEscavadorConfig`
- `loadJuditConfig`
- `loadBigDataCorpConfig`
- `loadDjenConfig`
- defaults relacionados

Cuidados:

- Garantir fallback global/tenant.
- Não quebrar segredos/env.
- Testar tenant sem config, tenant com config e config inválida.

### 12.3 Módulo `identityGateAndPublication`

Extrair:

- `isIdentityGateBlocked`
- `buildIdentityGateCorrectionMessage`
- `returnCaseForIdentityGateBlock`
- `buildResetPublishedCaseFields`
- `revokeCasePublicationArtifacts`

Cuidados:

- Altíssimo risco.
- Testar caso bloqueado BDC.
- Testar caso bloqueado Judit.
- Testar devolução automática.
- Testar bypass.
- Testar reset de publicação.
- Testar que falha de notificação/auditoria não impede atualização principal.

### 12.4 Módulo `clientSolicitations`

Extrair:

- `createClientSolicitation`
- `submitClientCorrection`
- `enforceTenantSubmissionLimits` se ainda estiver parcialmente ligado
- notificações de nova solicitação se fizer sentido

Cuidados:

- Testar quota.
- Testar correção do cliente.
- Testar restart do pipeline.
- Testar notificações.
- Testar payload mínimo e inválido.

### 12.5 Módulo `notificationWorkflows`

Extrair:

- `createCaseCompletedNotifications`
- `createNewSolicitationNotifications`

Cuidados:

- Já existe `notificationService`; evitar duplicação.
- Testar destinatários OPS e cliente.
- Testar falha parcial.

### 12.6 Módulo `sanitizersAndFields`

Extrair:

- `validateCpfDigits`
- `sanitizeCpf`
- `maskCpf`
- `sanitizeStructuredList`
- `sanitizeStructuredText`
- `sanitizePublicReportHtml`
- constantes de campos:
  - `IDENTITY_FIELDS`
  - `RESULT_ONLY_FIELDS`
  - `PUBLIC_RESULT_FIELDS`
  - `CLIENT_CASE_FIELDS`
  - `ALLOWED_DRAFT_FIELDS`
  - `ALLOWED_CONCLUDE_FIELDS`

Cuidados:

- Não vazar CPF em `publicResult`.
- Não quebrar `clientCases` autenticado.
- Testar public result.

### 12.7 Módulo `enrichmentTriggers`

Extrair wiring dos triggers:

- `enrichJuditOnCase`
- `enrichBigDataCorpOnCase`
- `enrichBigDataCorpOnCorrection`
- `enrichJuditOnCorrection`
- `enrichEscavadorOnCase`
- `enrichDjenOnCase`

Cuidados:

- Preservar paths dos triggers.
- Preservar opções de região, timeout, memória, secrets.
- Preservar guards de status.
- Preservar idempotência.
- Testar que `CORRECTION_NEEDED` não continua pipeline.

### 12.8 Módulo `aiRerun`

Extrair:

- `rerunAiForCase` / `rerunAiAnalysis`, se ainda não estiver totalmente modularizado.

Cuidados:

- Mockar IA.
- Não chamar API real.
- Testar permissões e payload.

---

## 13. Ordem recomendada de execução pelo Kimi

### Etapa 1 — Corrigir ambiente e rodar testes

```bash
rm -rf node_modules functions/node_modules
npm ci
cd functions && npm ci && cd ..
npm run lint
npm test
cd functions && npm run lint
cd functions && npm test
cd ..
npm run build
```

Se `npm ci` falhar por lock inconsistente, usar `npm install`, mas registrar.

### Etapa 2 — Corrigir duplicidades de exports

Rodar script de duplicidade, corrigir `tenantUserManagement`, testar.

### Etapa 3 — Atualizar documentação real

Corrigir status de Phase C e Phase D.

### Etapa 4 — Testes completos

Rodar tudo de novo.

### Etapa 5 — Load test em emulador

Se emulador disponível.

### Etapa 6 — Decidir Phase D

Somente liberar Phase D se:

- exports duplicados = 0;
- testes passam;
- build passa;
- documentação coerente;
- `backfillClientCasesMirrorInner` não está classificado como removível;
- índices pendentes documentados;
- load test executado ou pendência registrada.

---

## 14. Prompt autosuficiente para enviar ao Kimi

Copie e envie o bloco abaixo ao Kimi/agente local.

```md
# COMANDO MESTRE — CORREÇÃO PRÉ-PHASE D E VALIDAÇÃO REAL — COMPLIANCEHUB

Você deve corrigir e validar o estado real da refatoração do ComplianceHub antes de iniciar Phase D.

Leia obrigatoriamente:

- `MANUAL_AUDITORIA_CORRECOES_EXTRACAO_COMPLIANCEHUB.md`
- `progress.md`
- `task_plan.md`
- `findings.md`
- `firestore.indexes.json`
- handoffs em `docs/audits/`
- ADRs em `docs/adr/` ou `docs/audits/`

## Objetivo

Corrigir inconsistências reais da refatoração, principalmente exports duplicados/sobrescritos, validar testes, alinhar documentação e decidir se Phase D pode começar.

## Proibições

- Não remover código morto ainda.
- Não fazer deploy.
- Não fazer merge.
- Não alterar dados reais.
- Não rodar load test em produção.
- Não usar `--force`.
- Não mascarar erro.
- Não apagar teste.

## Fase 0 — Corrigir ambiente

Execute:

```bash
node -v
npm -v
npm ls --depth=0
cd functions && npm ls --depth=0 && cd ..
```

Se Vitest/Vite falharem por pacote opcional do Rollup, corrigir com:

```bash
rm -rf node_modules functions/node_modules
npm ci
cd functions && npm ci && cd ..
```

Se `npm ci` falhar por lockfile inconsistente, usar `npm install` e registrar.

Não usar `--force`.

## Fase 1 — Baseline real

Execute:

```bash
git status --short
git branch --show-current
git log --oneline -n 20
git diff --stat
git diff --name-only
wc -l functions/index.js
find functions/modules -maxdepth 4 -type f | sort
find docs -maxdepth 5 -type f | sort
find scripts -maxdepth 5 -type f | sort
```

## Fase 2 — Detectar exports duplicados

Execute:

```bash
node - <<'NODE'
const fs = require('fs');
const text = fs.readFileSync('functions/index.js', 'utf8');
const lines = text.split(/\r?\n/);
const map = new Map();

lines.forEach((line, idx) => {
  const m = line.match(/^exports\.([A-Za-z0-9_]+)\s*=/);
  if (!m) return;
  const name = m[1];
  if (!map.has(name)) map.set(name, []);
  map.get(name).push({ line: idx + 1, text: line.trim() });
});

let duplicates = 0;
for (const [name, entries] of map.entries()) {
  if (entries.length > 1) {
    duplicates++;
    console.log(`\nDUPLICATE EXPORT: ${name}`);
    for (const e of entries) console.log(`  L${e.line}: ${e.text}`);
  }
}

console.log(`\nTotal export assignments: ${[...map.values()].reduce((a,b)=>a+b.length,0)}`);
console.log(`Unique exports: ${map.size}`);
console.log(`Duplicate export names: ${duplicates}`);
NODE
```

Se houver duplicidade, corrigir antes de Phase D.

Atenção especial:

- `listTenantUsers`
- `createTenantUser`
- `updateTenantUser`
- `syncUserClaims`
- `repairAllClaims`
- `listOpsUsers`
- `createOpsUser`
- `updateOpsUser`
- `updateOwnProfile`

## Fase 3 — Corrigir tenantUserManagement

Se os exports modulares estão sendo sobrescritos por implementações inline:

1. Comparar lógica modular com inline.
2. Se equivalente, manter apenas o export modular.
3. Remover duplicidade inline.
4. Se não equivalente, manter o inline e remover a atribuição modular enganosa.
5. Nunca deixar dois `exports.nome = ...`.

Depois rodar:

```bash
cd functions && npm test -- --run tenantUserManagement
cd functions && npm test -- --run repairAllClaims
cd ..
```

## Fase 4 — Mapear monolito residual

Execute:

```bash
rg -n "exports\.enrich|function isIdentityGateBlocked|function returnCaseForIdentityGateBlock|function buildIdentityGateCorrectionMessage|function revokeCasePublicationArtifacts|function buildResetPublishedCaseFields|createCaseCompletedNotifications|createNewSolicitationNotifications|getOpsUserProfile|getClientUserProfile|assertOpsCanAccessCase|assertClientManager|assertOpsManager|assertCanAssignCase|canBypassIdentityGate|loadFonteDataConfig|loadEscavadorConfig|loadJuditConfig|loadBigDataCorpConfig|loadDjenConfig|validateCpfDigits|sanitizeCpf|maskCpf|validateAiClassificationReviewSchema|sanitizeStructuredList|sanitizeStructuredText|asDate|stripUndefined|getClientIp|fixLatinMojibake|normalizeUnicodeToAscii|sanitizePublicReportHtml|formatRequestedBy|rerunAiForCase|createClientSolicitation|submitClientCorrection" functions/index.js
```

Criar tabela de blocos restantes e não declarar Phase C como completa se ainda houver monolito residual relevante.

## Fase 5 — Validar backfillClientCasesMirrorInner

Execute:

```bash
rg -n "backfillClientCasesMirrorInner|backfillClientCasesMirror" functions scripts src docs
```

Se aparecer em export público, `__test` ou teste, classificar como:

`NÃO REMOVER`

## Fase 6 — Testes completos

Execute:

```bash
npm run lint
npm test
cd functions && npm run lint
cd functions && npm test
cd ..
npm run build
```

Depois testes focados:

```bash
cd functions && npm test -- --run paginateFirestoreQuery
cd functions && npm test -- --run listOpsCasesV2
cd functions && npm test -- --run listClientCasesV2
cd functions && npm test -- --run export
cd functions && npm test -- --run audit
cd functions && npm test -- --run notification
cd functions && npm test -- --run caseCommunication
cd functions && npm test -- --run report
cd functions && npm test -- --run client
cd functions && npm test -- --run enrich
cd functions && npm test -- --run ai
cd functions && npm test -- --run judit
cd functions && npm test -- --run bigdatacorp
cd functions && npm test -- --run escavador
cd functions && npm test -- --run djen
cd ..
npm test -- --run ExportacoesPage
```

Se um grupo não existir, registrar como não encontrado.

## Fase 7 — Load test local

Somente com emulador:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 ALLOW_LOCAL_LOAD_TEST=true node scripts/load-test-pagination.cjs
```

Nunca rodar em produção.

## Fase 8 — Documentação

Atualizar:

- `progress.md`
- `findings.md`
- `task_plan.md`, se necessário
- handoffs
- ADR-005
- relatório pré-Phase D

Corrigir:

- linhas reais do monolito;
- exports duplicados;
- status real da Phase C;
- status real da Phase D;
- `backfillClientCasesMirrorInner` como NÃO REMOVER;
- load test executado ou pendente.

## Fase 9 — Relatório final

Criar:

`docs/audits/STATE-REVIEW-2026-05-30.md`

Com:

1. Decisão: GO / GO COM CONDIÇÕES / NO-GO.
2. Estado real do repo.
3. Linhas de `functions/index.js`.
4. Exports totais/únicos/duplicados.
5. O que foi corrigido.
6. O que ainda falta.
7. Resultado dos testes.
8. Resultado dos load tests.
9. Classificação de código morto.
10. Se Phase D pode começar.
11. Se pode mergear/substituir/deployar.

## Critério de decisão

`GO PARA PHASE D` somente se:

- exports duplicados = 0;
- testes completos passam;
- build passa;
- documentação está coerente;
- `backfillClientCasesMirrorInner` não está marcado como removível;
- candidatos de código morto estão classificados corretamente.

`NO-GO` se:

- exports duplicados persistem;
- testes falham;
- build falha;
- documentação afirma estado falso;
- candidato em uso está marcado para remoção.

Lembrete: não remover código morto nesta rodada.
```

---

## 15. Conclusão executiva

A refatoração avançou bastante, mas não está pronta para Phase D.

A próxima ação correta é:

```text
Corrigir exports duplicados, validar tenantUserManagement, alinhar documentação, rodar testes completos em ambiente com dependências íntegras, e só depois decidir Phase D.
```

Não recomendo remover código morto agora.

Não recomendo merge/deploy agora.

Não recomendo declarar Phase C como 100% completa enquanto `functions/index.js` ainda tiver exports duplicados e blocos residuais sem justificativa.

