# Fix "Solicitante não identificado" nos relatórios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer com que o campo "Solicitado por" dos relatórios exiba o nome/e-mail do solicitante original, em vez de "Solicitante não identificado".

**Architecture:** Os campos `requestedBy`, `requestedByName` e `requestedByEmail` já são gravados em `cases/{caseId}` na criação, mas são removidos do snapshot `publicResult/latest` e da mirror `clientCases`. A correção simples consiste em incluí-los nesses snapshots, propagando-os para todos os relatórios (público, cliente, ops, PDF, exportação em lote).

**Tech Stack:** Node.js 22 (Firebase Functions Gen2), CommonJS/ESM misto, Vitest (backend e frontend), ESLint flat config.

---

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `functions/modules/reportEngine.js` | Gera o snapshot `publicResult/latest`; contém lista inline `PUBLIC_RESULT_FIELDS` que precisa incluir `requestedBy*`. |
| `functions/modules/publishAndSync.js` | Sincroniza `cases` → `clientCases`; contém lista inline `IDENTITY_FIELDS` que precisa incluir `requestedBy*`. |
| `functions/publicResultPrivacy.test.js` | Teste de privacidade que atualmente espera que `requestedBy*` não existam no snapshot público; deve ser atualizado. |
| `functions/reportBuilder.cjs` | Backend report builder; já lê `requestedBy*` se presentes no `caseData`. Não precisa de alteração. |
| `src/core/reportBuilder.js` | Frontend report builder; mesmo comportamento do backend. Não precisa de alteração. |

---

### Task 1: Incluir `requestedBy*` no snapshot `publicResult/latest`

**Files:**
- Modify: `functions/modules/reportEngine.js:425-457`
- Test: `functions/modules/reportEngine.test.js` (testes existentes não devem quebrar)

- [ ] **Step 1: Modificar a lista inline `PUBLIC_RESULT_FIELDS`**

Adicionar `'requestedBy'`, `'requestedByName'`, `'requestedByEmail'` logo após `'createdAt'` no array:

```js
const PUBLIC_RESULT_FIELDS = [
    'candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'createdAt',
    'requestedBy', 'requestedByName', 'requestedByEmail',
    'slaHours',
    // ... resto permanece igual
];
```

- [ ] **Step 2: Rodar testes de reportEngine**

Run:
```bash
cd functions
npx vitest run modules/reportEngine.test.js
```

Expected: PASS (nenhum teste existente valida enumeração de campos).

- [ ] **Step 3: Commit**

```bash
git add functions/modules/reportEngine.js
git commit -m "fix(report): inclui requestedBy* no snapshot publicResult/latest"
```

---

### Task 2: Incluir `requestedBy*` no espelho `clientCases`

**Files:**
- Modify: `functions/modules/publishAndSync.js:12-33`
- Test: `functions/modules/publishAndSync.test.js`

- [ ] **Step 1: Modificar a lista inline `IDENTITY_FIELDS`**

Adicionar `'requestedBy'`, `'requestedByName'`, `'requestedByEmail'` após `'createdAt'`:

```js
const IDENTITY_FIELDS = [
    'candidateName',
    'candidateId',
    'tenantId',
    'tenantName',
    'status',
    'priority',
    'createdAt',
    'updatedAt',
    'concludedAt',
    'correctedAt',
    'analystAssigned',
    'analystName',
    'cpf',
    'cpfMasked',
    'birthDate',
    'motherName',
    'bigdatacorpAge',
    'bigdatacorpGender',
    'bigdatacorpMotherName',
    'bigdatacorpHasDeathRecord',
    'requestedBy',
    'requestedByName',
    'requestedByEmail',
];
```

- [ ] **Step 2: Rodar testes de publishAndSync**

Run:
```bash
cd functions
npx vitest run modules/publishAndSync.test.js
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add functions/modules/publishAndSync.js
git commit -m "fix(sync): espelha requestedBy* para clientCases"
```

---

### Task 3: Atualizar teste de privacidade para refletir novo comportamento

**Files:**
- Modify: `functions/publicResultPrivacy.test.js:46-54`

- [ ] **Step 1: Reescrever a asserção do teste de privacidade**

O snapshot público agora inclui os campos, mas ainda não expõe `tenantId`, `cpf` completo nem `bigdatacorpMotherName`. Alterar o teste:

```js
it('publica metadados do solicitante sanitizados em publicResult/latest', () => {
    const snapshot = buildSanitizedPublicResultSnapshot('case-1', baseCase);

    expect(snapshot.requestedBy).toBe('uid-interno');
    expect(snapshot.requestedByName).toBe('Solicitante Interno');
    expect(snapshot.requestedByEmail).toBe('solicitante@example.com');
});
```

- [ ] **Step 2: Remover as asserções antigas do teste combinado**

No teste `nao publica metadados internos ou filiacao sensivel em publicResult/latest`, remover as três linhas:

```js
expect(snapshot.requestedBy).toBeUndefined();
expect(snapshot.requestedByName).toBeUndefined();
expect(snapshot.requestedByEmail).toBeUndefined();
```

- [ ] **Step 3: Rodar o teste de privacidade**

Run:
```bash
cd functions
npx vitest run publicResultPrivacy.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/publicResultPrivacy.test.js
git commit -m "test(privacy): atualiza expectativas de requestedBy* no publicResult"
```

---

### Task 4: Validar contrato de campos públicos

**Files:**
- Read: `functions/modules/_shared/fieldConstants.js`
- Read: `src/core/clientPortal.js`
- Test: `functions/modules/_shared/fieldConstants.test.js`, `src/core/clientPortal.test.js`

- [ ] **Step 1: Verificar se `fieldConstants.js` já está alinhado**

`functions/modules/_shared/fieldConstants.js` já contém `requestedBy*` em `IDENTITY_FIELDS`. Não requer alteração.

- [ ] **Step 2: Verificar `src/core/clientPortal.js`**

`src/core/clientPortal.js:10-12` já lista `requestedBy*` em `PUBLIC_RESULT_FIELDS`. Não requer alteração.

- [ ] **Step 3: Rodar testes de contrato**

Run:
```bash
cd functions
npx vitest run modules/_shared/fieldConstants.test.js
```

Expected: PASS.

Run:
```bash
npx vitest run src/core/clientPortal.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit (se houver mudanças; caso contrário, apenas marque)**

Se nenhuma alteração for necessária, não há commit nesta task.

---

### Task 5: Rodar suites completas e lint

**Files:**
- All modified files above

- [ ] **Step 1: Rodar todos os testes do backend**

Run:
```bash
cd functions
npm test
```

Expected: PASS (todos os ~330 testes).

- [ ] **Step 2: Rodar todos os testes do frontend**

Run:
```bash
cd D:\ComplianceHub
npm test
```

Expected: PASS (todos os ~579 testes).

- [ ] **Step 3: Rodar lint do backend**

Run:
```bash
cd functions
npm run lint
```

Expected: 0 erros.

- [ ] **Step 4: Rodar lint do frontend**

Run:
```bash
cd D:\ComplianceHub
npm run lint
```

Expected: 0 erros.

- [ ] **Step 5: Commit final (opcional)**

```bash
git add -A
git commit -m "test: valida contratos e lint após fix de requestedBy*"
```

---

## Self-Review

**1. Spec coverage:** A causa raiz foi confirmada: `requestedBy*` estão em `cases` mas ausentes de `publicResult/latest` e `clientCases`. Task 1 e Task 2 cobrem a propagação. Task 3 atualiza o teste de privacidade. Task 4 valida contratos. Task 5 garante qualidade.

**2. Placeholder scan:** Nenhum TBD/TODO. Código completo em cada step.

**3. Type consistency:** Nomes de campos (`requestedBy`, `requestedByName`, `requestedByEmail`) consistentes com o restante da base.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-12-fix-requested-by-report.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?