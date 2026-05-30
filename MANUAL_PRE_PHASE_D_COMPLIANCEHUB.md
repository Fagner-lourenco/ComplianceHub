# Manual Ultra Detalhado — Auditoria, Correções e Prompt Autosuficiente para o Agente

**Projeto:** ComplianceHub  
**Contexto:** Refatoração do monolito `functions/index.js` após Phases A, B e C  
**Objetivo deste documento:** orientar o agente local/Kimi a revisar o estado real do repositório, corrigir inconsistências, validar regressão, e **somente depois** decidir se a Phase D pode iniciar.  
**Regra central:** não remover código morto, não substituir fluxo antigo, não fazer merge e não fazer deploy antes da auditoria/correção completa.

---

## 1. Resumo Executivo

O repositório ComplianceHub passou por uma refatoração longa envolvendo:

1. **Phase A — Cursor Pagination V2**  
   Criação de paginação por cursor real, com `paginateFirestoreQuery`, `listOpsCasesV2`, `listClientCasesV2` e novos índices Firestore com `__name__` como tie-breaker.

2. **Phase B — Export Assíncrono**  
   Criação do fluxo de `exportJobs`, callables de criação/status/listagem/cancelamento e integração de frontend em `ExportacoesPage.jsx`.

3. **Phase C — Modularização**  
   Extração de diversos módulos de `functions/index.js`, incluindo módulos de AI, export, report, notification, tenant user management, enrichment etc.

4. **Phase D — Remoção de Código Morto**  
   Ainda **não deve ser executada** sem auditoria semântica e testes intensivos.

O agente anterior informou que Phase C estaria concluída e que Phase D estaria liberada. Porém, análise posterior indica que essa conclusão é arriscada, pois ainda existem sinais de inconsistência:

- `functions/index.js` ainda possui lógica de negócio relevante.
- Existem exports duplicados/sobrescritos no monolito.
- O módulo `tenantUserManagement` parece ter sido importado, mas seus handlers podem estar sendo sobrescritos por implementações inline.
- Documentos de handoff/ADR/progress podem conter informações divergentes.
- O candidato `backfillClientCasesMirrorInner` provavelmente **não deve ser removido** sem investigação, pois pode estar ligado a export público, testes ou `__test`.
- Load test local/emulador pode não ter sido executado corretamente.

Portanto, a decisão técnica mais segura é:

> **NO-GO para Phase D até concluir auditoria de estado real, corrigir duplicidades/sobrescritas, alinhar documentação e obter testes intensivos verdes.**

---

## 2. Estado Técnico Verificado / Pontos de Atenção

### 2.1. `functions/index.js` ainda não é apenas wiring

Apesar da modularização, o `functions/index.js` ainda contém blocos relevantes, incluindo:

- Triggers de enriquecimento.
- Solicitações de caso.
- Identity gate e publicação.
- Notificações.
- RBAC/auth/profile.
- Configurações e defaults.
- Helpers de sanitização e validação.
- Constantes de campos.
- Funções de AI/rerun.

Isso não significa que o sistema está errado; significa que a Phase C **não deve ser tratada como 100% concluída** sem ressalva. O status correto pode ser:

- **Phase C avançada/parcial**, ou
- **Phase C concluída parcialmente com monolito residual justificado**.

Se o objetivo arquitetural é `functions/index.js` com menos de 500 linhas, então ainda há distância relevante.

---

### 2.2. Problema crítico: exports duplicados / sobrescritos

Foi identificado um padrão perigoso:

```js
exports.listTenantUsers = createListTenantUsersHandler(...);
// depois, mais abaixo:
exports.listTenantUsers = onCall(...);
```

Quando isso ocorre, a segunda atribuição sobrescreve a primeira. Ou seja, o módulo importado pode existir, ter testes e parecer extraído, mas o export final que será usado pelo Firebase é a implementação inline posterior.

Exports que exigem verificação especial:

- `listTenantUsers`
- `createTenantUser`
- `updateTenantUser`
- `syncUserClaims`
- `repairAllClaims`
- `listOpsUsers`
- `createOpsUser`
- `updateOpsUser`
- `updateOwnProfile`

Esse é o ponto mais crítico antes de Phase D, porque ele pode gerar falsa sensação de modularização completa.

---

### 2.3. `backfillClientCasesMirrorInner` não deve ser removido automaticamente

O agente anterior mencionou `backfillClientCasesMirrorInner` como possível único candidato real a código morto. Isso deve ser tratado com muita cautela.

Antes de qualquer remoção, validar:

```bash
rg -n "backfillClientCasesMirrorInner|backfillClientCasesMirror" functions scripts src docs
```

Se aparecer em qualquer um destes locais, **não remover automaticamente**:

- `exports.backfillClientCasesMirror`
- `exports.__test`
- `functions/backfillClientCasesMirror.test.js`
- scripts operacionais
- documentação de manutenção

Classificação recomendada até prova contrária:

> `backfillClientCasesMirrorInner` = **NÃO REMOVER** ou, no máximo, **NÃO CONFIRMADO**.

---

### 2.4. Índices Firestore estão planejados, mas não deployados

O arquivo `firestore.indexes.json` contém índices novos para V2 com `__name__` como tie-breaker, incluindo `cases`, `clientCases` e `exports`.

Isso é positivo, mas há uma consequência:

> As queries V2 podem falhar em produção enquanto os índices não forem deployados e propagados.

Antes de ativar frontend V2 ou depender das callables V2 em produção, é necessário deploy separado dos índices, com validação.

Nesta fase, entretanto:

- não fazer deploy;
- apenas auditar o arquivo;
- confirmar ausência de duplicatas;
- confirmar que nenhum índice antigo foi removido indevidamente.

---

### 2.5. Load test local/emulador precisa ser real

O relatório anterior indicou que o load test falhou por problema de ambiente/dependência.

Isso impede uma liberação segura sem ressalva para escala.

Critério correto:

- Se load test não rodou: **GO COM CONDIÇÕES**, no máximo.
- Se testes automatizados passam, mas load test não rodou: não bloquear necessariamente Phase D documental, mas bloquear deploy/substituição.
- Nunca rodar load test em produção.

---

## 3. Decisão Técnica Recomendada

### 3.1. Antes de Phase D

Fazer uma rodada chamada:

> **State Review / Pre-Phase-D Correction**

Objetivos:

1. Validar estado real do repo.
2. Detectar exports duplicados.
3. Confirmar o que ainda está no monolito.
4. Corrigir sobrescritas de handlers importados.
5. Corrigir documentos inconsistentes.
6. Rodar testes intensivos.
7. Classificar código morto sem remover.
8. Emitir decisão final.

---

### 3.2. Estados possíveis após auditoria

#### `GO PARA PHASE D`

Somente se:

- não houver exports duplicados/sobrescritos;
- todos os módulos extraídos estiverem efetivamente usados;
- lint passa;
- testes backend passam;
- testes frontend passam;
- build passa;
- load test local/emulador passou ou há justificativa formal aceitável;
- documentação está coerente;
- candidatos de dead code foram classificados semanticamente.

#### `GO COM CONDIÇÕES`

Se:

- testes passam;
- sistema está estável;
- mas ainda falta load test, ajuste documental, ou Phase C é parcial porém segura.

#### `NO-GO`

Se:

- exports duplicados causam sobrescrita;
- módulos extraídos não estão sendo usados;
- testes falham;
- build falha;
- RBAC/tenant isolation falha;
- documentação declara estado falso;
- candidato a remoção ainda está em uso.

---

## 4. Correções Necessárias Recomendadas

### 4.1. Corrigir duplicidade/sobrescrita em `tenantUserManagement`

#### Problema

Handlers importados do módulo são atribuídos a `exports.*`, mas depois implementações inline sobrescrevem os mesmos nomes.

#### Como corrigir com segurança

1. Comparar o handler modular com o handler inline.
2. Confirmar que ambos têm mesmo contrato.
3. Confirmar que testes cobrem:
   - auth;
   - RBAC;
   - tenant isolation;
   - validação de payload;
   - auditoria;
   - claims;
   - erros esperados.
4. Se o módulo for equivalente ou mais seguro:
   - manter export modular;
   - remover/renomear a implementação inline apenas depois de testes verdes.
5. Se o módulo não for equivalente:
   - corrigir módulo;
   - adicionar teste de regressão;
   - só então usar módulo.

#### Critério de aceite

- Cada export aparece uma única vez em `functions/index.js`.
- O export final usa o módulo ou uma decisão explícita documentada.
- Testes de tenant user management passam.
- Nenhum contrato público foi removido.

---

### 4.2. Reclassificar Phase C

Se ainda houver lógica de negócio relevante no monolito, atualizar `progress.md`:

```md
| C | Extração de Módulos | 14 módulos extraídos | 40h | 🔄 Avançada/parcial — módulos extraídos, mas monolito ainda contém lógica residual |
```

Ou, se a equipe aceitar que o residual é intencional:

```md
| C | Extração de Módulos | 14 módulos extraídos | 40h | ✅ Concluída com residual documentado |
```

Mas não usar “completa” de forma absoluta se ainda há blocos como triggers, RBAC, solicitação de caso e identity gate no `index.js`.

---

### 4.3. Atualizar ADR-005

O ADR-005 antigo ainda pode dizer que apenas `_shared` e `caseManager/caseFilters` foram extraídos.

Atualizar para refletir:

- módulos realmente extraídos;
- módulos efetivamente usados;
- módulos extraídos mas ainda não conectados;
- blocos ainda no monolito;
- decisão sobre manter residual no `index.js`.

---

### 4.4. Consolidar handoffs

Há handoffs com estados diferentes. Criar um handoff final único:

`docs/audits/HANDOFF-FINAL-REFATORACAO-2026-05-30.md`

Conteúdo:

- estado real atual;
- o que foi feito;
- o que ainda falta;
- quais documentos antigos estão obsoletos;
- riscos;
- próximos passos;
- comandos de validação;
- bloqueios para deploy.

Marcar handoffs antigos como “históricos” ou “parciais”.

---

### 4.5. Corrigir classificação de código morto

Não usar número bruto do script como verdade.

O script pode gerar falso positivo por:

- uso dinâmico;
- uso por export Firebase;
- uso por `__test`;
- uso por scripts;
- uso por documentação operacional;
- uso como fallback.

Atualizar `findings.md` com tabela:

```md
| Item | Evidência | Classificação | Decisão |
|---|---|---|---|
| backfillClientCasesMirrorInner | usado por export/test ou pendente de prova | NÃO CONFIRMADO / NÃO REMOVER | manter até prova |
```

---

### 4.6. Corrigir ambiente de testes

Se o teste falhar por dependência opcional do Rollup, corrigir ambiente sem `--force`:

```bash
rm -rf node_modules package-lock.json
npm install
cd functions
rm -rf node_modules package-lock.json
npm install
cd ..
```

Mas só fazer isso se o projeto aceitar regenerar lockfile. Se o lockfile for parte do controle de versão e já foi alterado, preferir:

```bash
npm ci
cd functions && npm ci && cd ..
```

Critério:

- não usar `--force`;
- não ignorar falha;
- registrar comandos executados.

---

## 5. Checklist de Auditoria Técnica

### 5.1. Repositório

- [ ] Branch correta.
- [ ] Working tree conhecido.
- [ ] `git diff --stat` revisado.
- [ ] Arquivos novos listados.
- [ ] Arquivos modificados listados.

### 5.2. Exports

- [ ] Lista de `exports.*` gerada.
- [ ] Duplicidades detectadas.
- [ ] Duplicidades corrigidas ou justificadas.
- [ ] V1 preservado.
- [ ] V2 preservado.
- [ ] Export async preservado.
- [ ] Triggers preservados.

### 5.3. Modularização

- [ ] Módulos existem.
- [ ] Módulos têm testes.
- [ ] Nenhum módulo importa `functions/index.js`.
- [ ] Nenhum módulo inicializa Firebase indevidamente.
- [ ] Sem ciclo óbvio.
- [ ] Módulos extraídos são usados.
- [ ] Residual no monolito documentado.

### 5.4. Segurança

- [ ] Toda callable nova exige auth.
- [ ] Tenant isolation testado.
- [ ] Cliente não controla `tenantId` arbitrário.
- [ ] Export job valida acesso.
- [ ] Signed URL só para usuário autorizado.
- [ ] Public result não vaza CPF indevido.
- [ ] Audit events preservam tenant.

### 5.5. Testes

- [ ] `npm run lint`.
- [ ] `npm test`.
- [ ] `cd functions && npm run lint`.
- [ ] `cd functions && npm test`.
- [ ] `npm run build`.
- [ ] Testes focados por módulo.
- [ ] Testes de export.
- [ ] Testes de pagination.
- [ ] Testes de RBAC.
- [ ] Testes de report/public result.
- [ ] Testes de enrichment.

### 5.6. Load test

- [ ] Emulador disponível.
- [ ] Script roda fora de produção.
- [ ] Dataset fake.
- [ ] Valida duplicatas.
- [ ] Valida omissões.
- [ ] Valida ordenação.
- [ ] Resultado documentado.

### 5.7. Documentação

- [ ] `progress.md` coerente.
- [ ] `findings.md` coerente.
- [ ] `task_plan.md` coerente.
- [ ] ADR-005 atualizado.
- [ ] ADR-006 atualizado se necessário.
- [ ] ADR-007 atualizado se necessário.
- [ ] Handoff final consolidado.

---

## 6. Prompt Autosuficiente para Enviar ao Kimi / Agente Local

Copie e envie o prompt abaixo ao agente.

```text
COMANDO MESTRE — STATE REVIEW + CORREÇÃO PRÉ-PHASE D — COMPLIANCEHUB

Você deve atuar como agente técnico sênior no projeto ComplianceHub.

Sua tarefa atual NÃO é continuar removendo código morto.
Sua tarefa atual é revisar o estado real do repositório após as Phases A, B e C, corrigir inconsistências críticas e determinar se a Phase D pode começar.

Não confie nos relatórios anteriores sem verificar no código real.

CONTEXTO

A refatoração anterior informou:
- Phase A concluída com cursor pagination V2.
- Phase B concluída com export assíncrono backend/frontend.
- Phase C concluída com 14 módulos extraídos.
- Phase D pronta para iniciar.
- Backend com 1085 tests.
- Frontend com 1408 tests.
- Total com 2493 tests.
- Monolito com 3597 linhas.

Porém, há indícios de problemas:
- functions/index.js pode estar com mais linhas do que o informado.
- Existem exports duplicados/sobrescritos.
- tenantUserManagement parece importado do módulo e depois sobrescrito por handlers inline.
- Ainda há blocos relevantes no monolito.
- backfillClientCasesMirrorInner pode ter sido classificado errado como código morto.
- Load test pode não ter rodado corretamente.
- progress.md, ADRs e handoffs podem estar divergentes.

OBJETIVO

1. Verificar o estado real do repositório.
2. Detectar e corrigir duplicidade/sobrescrita de exports.
3. Confirmar o que ainda está no monolito.
4. Validar se os módulos extraídos estão realmente sendo usados.
5. Corrigir documentação inconsistente.
6. Rodar testes intensivos.
7. Auditar código morto em modo leitura, sem remover.
8. Emitir decisão final: GO / GO COM CONDIÇÕES / NO-GO para Phase D.

PROIBIÇÕES

Não fazer:
- Não remover código morto.
- Não fazer deploy.
- Não fazer merge para main.
- Não alterar dados reais.
- Não rodar load test em produção.
- Não apagar arquivos sem prova.
- Não usar --force.
- Não mascarar erro de teste.
- Não declarar Phase C completa se ainda houver monolito residual não justificado.
- Não declarar GO para Phase D se houver exports duplicados/sobrescritos.

Pode fazer:
- Rodar comandos de leitura.
- Rodar lint/test/build.
- Corrigir bugs claros causados pela refatoração.
- Corrigir duplicidade/sobrescrita de exports.
- Corrigir documentação.
- Criar relatório de auditoria.
- Atualizar progress.md.

FASE 0 — BASELINE REAL

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

Registre:
- branch;
- working tree;
- linhas reais de functions/index.js;
- arquivos modificados;
- arquivos novos;
- módulos existentes;
- documentos existentes.

FASE 1 — DETECTAR EXPORTS DUPLICADOS

Execute:

```bash
rg -n "^exports\.[A-Za-z0-9_]+\s*=" functions/index.js
```

Depois execute:

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
let total = 0;
for (const entries of map.values()) total += entries.length;

for (const [name, entries] of map.entries()) {
  if (entries.length > 1) {
    duplicates++;
    console.log(`\nDUPLICATE EXPORT: ${name}`);
    for (const e of entries) console.log(`  L${e.line}: ${e.text}`);
  }
}

console.log(`\nTotal export assignments: ${total}`);
console.log(`Unique exports: ${map.size}`);
console.log(`Duplicate export names: ${duplicates}`);
NODE
```

Atenção especial:
- listTenantUsers
- createTenantUser
- updateTenantUser
- syncUserClaims
- repairAllClaims
- listOpsUsers
- createOpsUser
- updateOpsUser
- updateOwnProfile

Se houver duplicidade:
- não avançar para Phase D;
- comparar implementação modular vs inline;
- manter apenas uma atribuição final por export;
- preferir handler modular somente se equivalente ou mais seguro;
- se não for equivalente, corrigir o módulo e adicionar teste;
- documentar decisão.

Critério de aceite:
- zero exports duplicados;
- V1 preservado;
- V2 preservado;
- triggers preservados;
- testes verdes.

FASE 2 — MAPEAR O QUE AINDA ESTÁ NO MONOLITO

Execute:

```bash
rg -n "exports\.enrich|function isIdentityGateBlocked|function returnCaseForIdentityGateBlock|function buildIdentityGateCorrectionMessage|function revokeCasePublicationArtifacts|function buildResetPublishedCaseFields|createCaseCompletedNotifications|createNewSolicitationNotifications|getOpsUserProfile|getClientUserProfile|assertOpsCanAccessCase|assertClientManager|assertOpsManager|assertCanAssignCase|canBypassIdentityGate|loadFonteDataConfig|loadEscavadorConfig|loadJuditConfig|loadBigDataCorpConfig|loadDjenConfig|validateCpfDigits|sanitizeCpf|maskCpf|validateAiClassificationReviewSchema|sanitizeStructuredList|sanitizeStructuredText|asDate|stripUndefined|getClientIp|fixLatinMojibake|normalizeUnicodeToAscii|sanitizePublicReportHtml|formatRequestedBy|rerunAiForCase|createClientSolicitation|submitClientCorrection" functions/index.js
```

Gerar tabela:

| Bloco | Ainda no index.js? | Linhas aproximadas | Módulo sugerido | Risco |
|---|---:|---:|---|---|

Blocos a mapear:
1. Triggers de enriquecimento.
2. Tenant user management.
3. Solicitações de caso.
4. Identity gate/publicação.
5. Notificações.
6. RBAC/Auth/Profile.
7. Configurações e defaults.
8. Helpers de validação/sanitização.
9. Constantes de campos.
10. Utilitários diversos.
11. Funções de AI/rerun.

Se houver muitos blocos restantes, atualizar Phase C para “parcial/avançada” e não “completa absoluta”.

FASE 3 — VALIDAR MÓDULOS EXTRAÍDOS

Execute:

```bash
find functions/modules -maxdepth 4 -type f | sort
rg -n "module.exports|exports\.|require\(" functions/modules
rg -n "require\(.*index|from .*index|functions/index" functions/modules
rg -n "initializeApp|admin\.initializeApp" functions/modules
```

Confirmar:
- módulos existem;
- testes existem;
- nenhum módulo importa functions/index.js;
- nenhuma inicialização Firebase duplicada;
- módulos importados no index.js são efetivamente usados;
- não há ciclo óbvio.

FASE 4 — VALIDAR PHASE A

Execute:

```bash
rg -n "paginateFirestoreQuery|encodeCursor|decodeCursor|normalizeLimit|listOpsCasesV2|listClientCasesV2" functions docs
rg -n "__name__|tenantId.*createdAt|createdAt.*__name__" firestore.indexes.json functions docs
```

Confirmar:
- helper existe;
- V2 existe;
- V1 ainda existe;
- índices estão no arquivo;
- documentação de migração existe;
- V2 usa cursor composto com tie-breaker.

FASE 5 — VALIDAR PHASE B

Execute:

```bash
rg -n "createExportJob|getExportJobStatus|listExportJobs|cancelExportJob|processExportJob|exportJobs|ExportacoesPage|setInterval|clearInterval|poll|download|CSV|sanitize" functions src docs
```

Confirmar:
- callables existem;
- frontend usa export assíncrono;
- polling tem cleanup;
- cancelamento existe;
- fallback V1 está claro;
- CSV é sanitizado;
- não há Promise.all ilimitado.

FASE 6 — CORRIGIR DOCUMENTAÇÃO INCONSISTENTE

Ler:
- progress.md
- findings.md
- task_plan.md
- docs/audits/*.md
- docs/adr/*.md
- docs/migrations/v2-pagination.md

Buscar inconsistências:

```bash
rg -n "Phase C|módulos|modulos|3597|3971|4941|1085|1408|2493|31 funções|15 funções|backfillClientCasesMirrorInner|GO PARA PHASE D|NO-GO|load test|emulador|emulator" progress.md findings.md task_plan.md docs
```

Corrigir:
- progress.md;
- ADR-005;
- handoff final;
- findings.md;
- task_plan.md, se necessário.

Documentar quais handoffs são históricos/parciais.

FASE 7 — TESTES INTENSIVOS

Verificar ambiente:

```bash
node -v
npm -v
npm ls --depth=0
cd functions && npm ls --depth=0 && cd ..
```

Se dependências estiverem quebradas, preferir:

```bash
npm ci
cd functions && npm ci && cd ..
```

Não usar --force.

Rodar:

```bash
npm run lint
npm test
cd functions && npm run lint
cd functions && npm test
cd ..
npm run build
```

Rodar testes focados:

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

Se algum teste focado não existir, registrar como “não encontrado”. Não declarar como sucesso.

FASE 8 — LOAD TEST LOCAL/EMULADOR

Somente se emulador estiver disponível.

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 ALLOW_LOCAL_LOAD_TEST=true node scripts/load-test-pagination.cjs
```

Se existir:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 ALLOW_LOCAL_LOAD_TEST=true node scripts/load-test-export.cjs
```

Se não rodar:
- registrar pendência;
- não declarar validação completa de escala.

FASE 9 — AUDITAR CÓDIGO MORTO SEM REMOVER

Primeiro verificar backfill:

```bash
rg -n "backfillClientCasesMirrorInner|backfillClientCasesMirror" functions scripts src docs
```

Rodar script:

```bash
node scripts/refactor/audit-dead-code.cjs
```

Não confiar cegamente no script.

Para cada candidato, classificar:

| Item | Evidência | Classificação | Decisão |
|---|---|---|---|

Classificações:
- REMOVÍVEL COM SEGURANÇA
- PROVAVELMENTE REMOVÍVEL, MAS PRECISA TESTE
- NÃO CONFIRMADO
- NÃO REMOVER

Não remover nada nesta tarefa.

FASE 10 — CRIAR RELATÓRIO FINAL

Criar:

`docs/audits/STATE-REVIEW-2026-05-30.md`

Conteúdo obrigatório:
1. Decisão: GO / GO COM CONDIÇÕES / NO-GO.
2. Estado real do repositório.
3. Linhas reais de functions/index.js.
4. Exports totais e duplicados.
5. Lista de duplicidades e correções.
6. Fases realmente concluídas.
7. Fases parcialmente concluídas.
8. O que falta na Phase C.
9. Resultado dos testes.
10. Resultado dos testes focados.
11. Resultado dos load tests.
12. Auditoria de índices.
13. Auditoria de documentação.
14. Auditoria de código morto, sem remoção.
15. Bloqueadores.
16. Riscos residuais.
17. Próximo comando recomendado.

FASE 11 — ATUALIZAR progress.md

Atualizar progress.md com:
- resultado real da auditoria;
- se Phase C está completa ou parcial;
- se Phase D está liberada ou não;
- testes executados;
- pendências;
- link para STATE-REVIEW-2026-05-30.md.

Não marcar Phase D como concluída.

CRITÉRIO DE DECISÃO

GO PARA PHASE D somente se:
- zero exports duplicados/sobrescritos;
- módulos extraídos usados de fato;
- testes completos passam;
- build passa;
- documentação coerente;
- dead code classificado corretamente.

GO COM CONDIÇÕES se:
- testes passam;
- sistema está estável;
- mas load test ou documentação ainda tem ressalvas.

NO-GO se:
- exports duplicados persistem;
- módulo extraído não é usado;
- teste falha;
- build falha;
- RBAC/tenant isolation falha;
- documentação declara estado falso.

RESPOSTA FINAL

Responder:
1. Decisão.
2. O que foi feito.
3. O que falta.
4. O que estava errado.
5. Se Phase D pode começar.
6. Se pode substituir/mergear.
7. Se pode fazer deploy.
8. Confirmações:
   - nenhum deploy;
   - nenhum dado real alterado;
   - nenhum código morto removido.
```

---

## 7. Comando Curto para Você Enviar Antes do Prompt

Se quiser mandar uma orientação curta antes do prompt grande, use:

```text
Atenção: antes de continuar Phase D, preciso que você faça uma auditoria real do estado atual. Não confie no resumo anterior. Há suspeita de exports duplicados/sobrescritos em tenantUserManagement, Phase C possivelmente parcial, documentação inconsistente e backfillClientCasesMirrorInner possivelmente classificado errado como dead code. Não remova nada ainda. Execute o prompt abaixo integralmente e entregue decisão GO/NO-GO.
```

---

## 8. Próxima Etapa Depois do Relatório

Depois que o agente gerar `STATE-REVIEW-2026-05-30.md`, a próxima decisão deve ser:

### Se der `NO-GO`

Corrigir bloqueadores primeiro.

### Se der `GO COM CONDIÇÕES`

Corrigir condições pendentes antes de deploy/merge.

### Se der `GO PARA PHASE D`

Enviar um comando específico e limitado:

> “Remova apenas itens classificados como `REMOVÍVEL COM SEGURANÇA`, um pequeno lote por vez, rodando testes completos após cada lote.”

Não usar comando genérico “remova código morto”, porque isso é arriscado.

---

## 9. Conclusão

O ponto mais importante para o Kimi entender:

> Teste passando não basta se o export final está sobrescrito. Um módulo pode existir, ter teste e mesmo assim não estar sendo usado pelo Firebase, porque `exports.nome = ...` foi redefinido depois no `functions/index.js`.

Portanto, a prioridade agora é:

1. Detectar exports duplicados.
2. Corrigir sobrescritas.
3. Confirmar uso real dos módulos.
4. Corrigir documentos.
5. Rodar testes.
6. Só então decidir Phase D.

