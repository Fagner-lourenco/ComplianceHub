# Criminal Materiality, Prefill, and Analyst Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current `main` checkout. User explicitly authorized working on `main`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align criminal materiality, deterministic prefill, auto-classification, and analyst review UI so analysts see complete provider evidence while automated narratives remain consistent and do not silently hide criminal signals.

**Architecture:** Centralize criminal materiality decisions in backend helpers, then reuse that single decision in auto-classification, deterministic prefill, and client verdict policy. Frontend changes are read-only display improvements for analyst review: richer process tables, consistent badges, accessible process modal, and clearer provider status; no production case data is mutated.

**Tech Stack:** Firebase Cloud Functions Gen2 Node 22, CommonJS backend modules, Vitest backend tests, React 19 + Vite frontend, existing CSS token system.

## Global Constraints

- Do not modify, backfill, or reprocess existing Firestore cases, including `DONE` and `CORRECTION_NEEDED` cases.
- Do not overwrite analyst-edited narratives, verdicts, comments, review drafts, or manually curated prefill fields.
- Only change source code, tests, and documentation.
- UI copy, comments, and documentation: português (PT-BR). Code identifiers: English.
- Treat traffic crimes, environmental crimes, and criminal rogatory letters with material candidate role as review-worthy `ATTENTION`, not silent negative.
- Treat serious criminal cases with role `INTERESSADO`/neutral as `INCONCLUSIVE` or `ATTENTION` for human review, not confirmed negative.
- Preserve privacy: raw payloads and provider process arrays remain internal and are not added to public/client payloads.
- Use TDD: write failing tests before production code for each behavior change.

---

## File Structure

- Modify `functions/helpers/criminalMateriality.js`: new focused helper for criminal materiality and review category decisions.
- Modify `functions/helpers/reportHelpers.js`: delegate `isMaterialCriminalProcess()` and low-risk checks to the new helper while preserving exports.
- Modify `functions/helpers/crimeTypeFilter.js`: keep exclusion detection; do not broaden public behavior outside helper usage.
- Modify `functions/normalizers/escavador2.js`: align process-level `isCriminal` with Escavador2 summary/material role signals.
- Modify `functions/helpers/aiHomonym.js`: attach exclusion/materiality consistently for BigDataCorp, Judit, Escavador, and Escavador2 candidates.
- Modify `functions/modules/autoClassification.js`: use materiality/review categories instead of divergent ad hoc role checks.
- Modify `functions/modules/deterministicPrefill.js`: ensure criminal notes, key findings, executive summary, and final justification do not contradict flags and include non-material/review-worthy evidence transparently.
- Modify `functions/modules/clientVerdictPolicy.js`: align client verdict policy with shared materiality categories.
- Modify tests under `functions/helpers`, `functions/normalizers`, and `functions/modules`.
- Modify `src/portals/ops/CasoPage.jsx` and CSS: richer process tables, badges, Escavador inspection support.
- Modify `src/ui/components/ProcessInspectionModal/*`: accessible, richer process inspection.
- Modify `src/ui/components/EnrichmentPipeline/*`: provider counts and accessible statuses.

---

### Task 1: Shared Criminal Materiality Helper

**Files:**
- Create: `functions/helpers/criminalMateriality.js`
- Test: `functions/helpers/criminalMateriality.test.js`
- Modify: `functions/helpers/reportHelpers.js`

**Interfaces:**
- Produces: `classifyCriminalMateriality(process): { isCriminal, isMaterial, requiresAttention, isLowRiskRole, isExcluded, exclusionReason, roleCategory, roleRiskLevel, materialReason, reviewReason }`
- Produces: `isCriminalMaterial(process): boolean`
- Produces: `requiresCriminalAttention(process): boolean`
- Consumes: `isExcludedCrimeType(process)` from `crimeTypeFilter.js` and `classifyRole()` from `roleClassifier.js`.

- [ ] **Step 1: Write failing tests**

Add `functions/helpers/criminalMateriality.test.js` with cases:

```js
const { describe, it, expect } = require('vitest');
const { classifyCriminalMateriality, isCriminalMaterial, requiresCriminalAttention } = require('./criminalMateriality');

describe('criminalMateriality', () => {
  it('marks defendant violent criminal case as material', () => {
    const result = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'AÇÃO PENAL',
      assunto: 'Violência Doméstica Contra a Mulher',
      specificRole: 'Réu',
      isDefendant: true,
    });
    expect(result).toMatchObject({ isCriminal: true, isMaterial: true, requiresAttention: true, roleCategory: 'DEFENDANT' });
    expect(isCriminalMaterial(result)).toBe(true);
  });

  it('keeps traffic crime with defendant role as attention but not contraindicating material', () => {
    const result = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'AÇÃO PENAL',
      assunto: 'CONDUZIR VEICULO AUTOMOTOR SOB A INFLUENCIA DE ALCOOL OU OUTRA SUBSTANCIA PSICOATIVA (ART.306 - CTB)',
      specificRole: 'Réu',
      isDefendant: true,
    });
    expect(result).toMatchObject({ isMaterial: false, requiresAttention: true, exclusionReason: 'TRANSITO' });
    expect(requiresCriminalAttention(result)).toBe(true);
  });

  it('keeps criminal rogatory letter with defendant role as attention unless it is mere citation/intimation noise', () => {
    const substantive = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'Carta Precatória Criminal',
      assunto: 'Aplicação, Revovação, Cumprimento / Medidas de Segurança',
      specificRole: 'Réu',
      isDefendant: true,
    });
    expect(substantive).toMatchObject({ isMaterial: true, requiresAttention: true, exclusionReason: null });

    const noise = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'Carta Precatória Criminal',
      assunto: 'Intimação ou Notificação / Atos Processuais',
      specificRole: 'Réu',
      isDefendant: true,
    });
    expect(noise).toMatchObject({ isMaterial: false, requiresAttention: true, exclusionReason: 'CARTA_PRECATORIA_NOISE' });
  });

  it('marks neutral role in serious criminal case as attention but not material', () => {
    const result = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'AÇÃO PENAL DE COMPETÊNCIA DO JÚRI',
      assunto: 'HOMICIDIO QUALIFICADO',
      specificRole: 'INTERESSADO',
      isDefendant: false,
      isVictim: false,
      isWitness: false,
    });
    expect(result).toMatchObject({ isMaterial: false, requiresAttention: true, roleCategory: 'OTHER' });
  });

  it('does not treat victim or witness criminal matches as material', () => {
    expect(classifyCriminalMateriality({ isCriminal: true, specificRole: 'Vítima', isVictim: true }).isMaterial).toBe(false);
    expect(classifyCriminalMateriality({ isCriminal: true, specificRole: 'Testemunha', isWitness: true }).isMaterial).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd functions && npm test -- helpers/criminalMateriality.test.js`

Expected: FAIL because `./criminalMateriality` does not exist.

- [ ] **Step 3: Implement minimal helper and wire existing exports**

Create `functions/helpers/criminalMateriality.js`. Update `reportHelpers.js` so `isLowRiskCriminalProcess()` and `isMaterialCriminalProcess()` delegate to the new helper.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `cd functions && npm test -- helpers/criminalMateriality.test.js helpers/deterministicPrefill.test.js`

Expected: all selected tests pass.

---

### Task 2: Escavador2 Normalizer Parity

**Files:**
- Modify: `functions/normalizers/escavador2.js`
- Test: `functions/normalizers/escavador2.test.js`

**Interfaces:**
- Consumes: `classifyCriminalMateriality()`.
- Produces: `escavador2Processos[].isCriminal` consistent with area/material role and `escavador2CriminalCount`.

- [ ] **Step 1: Write failing tests**

Add tests to `functions/normalizers/escavador2.test.js` for:
- `area=CRIMINAL`, `Carta Precatória Criminal`, `Medidas de Segurança`, `Réu`, `risco_material=true` -> `isCriminal=true`.
- `area=CRIMINAL`, `Procedimento do Juizado Especial Cível`, consumer subject -> `isCriminal=false`, excluded as `CONSUMER_CIVIL_NOISE`.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd functions && npm test -- normalizers/escavador2.test.js`

Expected: first new test fails because current `hasCriminalIndicator()` rejects the process.

- [ ] **Step 3: Implement minimal normalizer adjustment**

In `mapProcess()`, compute preliminary criminal from area/indicator, then call shared materiality/attention helper. Mark `isCriminal=true` when the helper returns material or attention and the process is not civil/consumer false-positive.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `cd functions && npm test -- normalizers/escavador2.test.js helpers/criminalMateriality.test.js`

Expected: pass.

---

### Task 3: Deterministic Prefill Consistency

**Files:**
- Modify: `functions/modules/deterministicPrefill.js`
- Test: `functions/helpers/deterministicPrefill.test.js`

**Interfaces:**
- Consumes: `classifyCriminalMateriality()`.
- Produces: consistent `criminalNotes`, `keyFindings`, `executiveSummary`, `finalJustification`.

- [ ] **Step 1: Write failing tests**

Add tests for:
- Negative case with BDC homicide and role `INTERESSADO` must not produce key finding “processo(s) criminal(is) com CPF confirmado”; it should mention review/attention evidence separately.
- CPF `108.741.627-26` style fixture must list one substantive criminal and summarize excluded/attention items instead of silently hiding them.
- `criminalFlag=POSITIVE` with multiple material Escavador2 findings must list all material findings up to limit.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd functions && npm test -- helpers/deterministicPrefill.test.js`

Expected: tests fail on current contradictory key finding and missing attention summary.

- [ ] **Step 3: Implement minimal prefill changes**

Use shared helper to split criminal processes into `materialCriminalProcesses`, `attentionCriminalProcesses`, and `nonMaterialCriminalProcesses`. Keep material findings separate from attention-only evidence.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `cd functions && npm test -- helpers/deterministicPrefill.test.js helpers/criminalMateriality.test.js`

Expected: pass.

---

### Task 4: Auto-Classification Alignment

**Files:**
- Modify: `functions/helpers/aiHomonym.js`
- Modify: `functions/modules/autoClassification.js`
- Test: `functions/helpers/aiHomonym.test.js`
- Test: `functions/modules/autoClassification.test.js`

**Interfaces:**
- Consumes: `classifyCriminalMateriality()`.
- Produces: traffic/environmental/noise or neutral serious roles become `INCONCLUSIVE`/attention where appropriate, not silent confirmed negative.

- [ ] **Step 1: Write failing tests**

Add tests for:
- BDC serious criminal with exact CPF and `INTERESSADO` -> `criminalFlag='INCONCLUSIVE'` and review note.
- Traffic crime with defendant role -> `criminalFlag='INCONCLUSIVE'` or attention-level output, not `CONFIRMED_NEGATIVE`.
- Consumer/civil false-positive remains negative/ignored.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd functions && npm test -- helpers/aiHomonym.test.js modules/autoClassification.test.js`

Expected: new tests fail under current logic.

- [ ] **Step 3: Implement alignment**

Attach materiality metadata to process candidates and use it in `relevantCriminalCandidates`, weak/attention branches, and notes.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `cd functions && npm test -- helpers/aiHomonym.test.js modules/autoClassification.test.js helpers/criminalMateriality.test.js`

Expected: pass.

---

### Task 5: Client Verdict Policy Alignment

**Files:**
- Modify: `functions/modules/clientVerdictPolicy.js`
- Test: create `functions/modules/clientVerdictPolicy.test.js` if absent.

**Interfaces:**
- Consumes: `classifyCriminalMateriality()`.
- Produces: client verdict policy aligned with classification/prefill.

- [ ] **Step 1: Write failing tests**

Test:
- violent defendant criminal -> `NOT_RECOMMENDED`.
- traffic/environmental/material rogatory attention -> `ATTENTION`.
- victim/witness/consumer noise -> not `NOT_RECOMMENDED`.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd functions && npm test -- modules/clientVerdictPolicy.test.js`

Expected: fail if test file/helper behavior missing.

- [ ] **Step 3: Implement policy alignment**

Use the shared helper inside `isClientMaterialCriminalProcess()` / category logic.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `cd functions && npm test -- modules/clientVerdictPolicy.test.js helpers/criminalMateriality.test.js`

Expected: pass.

---

### Task 6: Analyst Process Tables and Badges

**Files:**
- Modify: `src/portals/ops/CasoPage.jsx`
- Modify: `src/portals/ops/CasoPage.css`
- Modify: `src/ui/styles/shared-tables.css` if needed.
- Test: existing `CasoPage` tests or add targeted tests if component tests are present.

**Interfaces:**
- Consumes existing case fields plus backend-enriched fields: `isMaterialRisk`, `isExcludedCrimeType`, `roleClassification`, duplicate fields, exact CPF flags.
- Produces richer read-only analyst display.

- [ ] **Step 1: Write/extend failing frontend tests**

Tests should assert visible labels for:
- `Material`, `Atenção`, `Descartado`, `CPF confirmado`, `Novo`, `Confirmatório`, `Duplicado`.
- Escavador2 process row displays `materialRisk` and `isExcludedCrimeType` when present.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- CasoPage`

Expected: new assertions fail.

- [ ] **Step 3: Implement UI changes**

Add small local helpers in `CasoPage.jsx` for semantic process badges. Keep changes minimal; do not introduce new global state.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- CasoPage`

Expected: pass or document existing known flaky test if unrelated.

---

### Task 7: Accessible Process Inspection Modal

**Files:**
- Modify: `src/ui/components/ProcessInspectionModal/ProcessInspectionModal.jsx`
- Modify: `src/ui/components/ProcessInspectionModal/ProcessInspectionModal.css`
- Test: create/extend modal tests if available.

**Interfaces:**
- Consumes `process`, `djenTimeline`, `onClose`.
- Produces accessible read-only modal with richer provider detail.

- [ ] **Step 1: Write failing tests**

Test:
- modal has `role="dialog"`, `aria-modal="true"`, accessible title.
- Escape calls `onClose`.
- materiality and provider metadata badges render when present.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- ProcessInspectionModal`

Expected: fail on missing ARIA/Escape/badges.

- [ ] **Step 3: Implement modal changes**

Add ARIA attributes, Escape handler, richer sections, tokenized CSS colors.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- ProcessInspectionModal`

Expected: pass.

---

### Task 8: Enrichment Pipeline Context

**Files:**
- Modify: `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.jsx`
- Modify: `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.css`
- Test: `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.test.jsx`

**Interfaces:**
- Consumes provider count fields already present in `caseData`.
- Produces richer provider status details for analysts.

- [ ] **Step 1: Write failing tests**

Assert that Escavador2 displays total/new/duplicate/material-risk counts and callback queue status when fields exist.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- EnrichmentPipeline`

Expected: fail on missing detail text.

- [ ] **Step 3: Implement minimal detail rendering**

Add per-provider detail chips, avoid clutter when fields are absent.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- EnrichmentPipeline`

Expected: pass.

---

### Task 9: Verification and No-Backfill Guard

**Files:**
- No production case writes.
- Update docs only if needed.

- [ ] **Step 1: Run targeted backend tests**

Run: `cd functions && npm test -- helpers/criminalMateriality.test.js normalizers/escavador2.test.js helpers/deterministicPrefill.test.js helpers/aiHomonym.test.js modules/autoClassification.test.js modules/clientVerdictPolicy.test.js`

Expected: pass.

- [ ] **Step 2: Run targeted frontend tests**

Run: `npm test -- CasoPage ProcessInspectionModal EnrichmentPipeline`

Expected: pass or report known unrelated flaky test with evidence.

- [ ] **Step 3: Run lint/build checks**

Run: `cd functions && npm run lint`

Run: `npm run build`

Expected: pass.

- [ ] **Step 4: Confirm no Firestore writes/backfill scripts were run**

Check shell history/output in this session and final status. Do not run production write commands.

- [ ] **Step 5: Run graph update after code changes**

Run: `graphify update .`

Expected: completes without blocking implementation.

---

## Critical Review Notes

- This plan intentionally does not backfill or mutate completed cases. Existing concluded case narratives remain as-is unless a human explicitly reruns/reopens later.
- The backend helper must distinguish `isMaterial` from `requiresAttention`; not every criminal signal should contraindicate, but analyst-visible evidence should not disappear.
- UI work must present richer evidence without letting public/client reports leak raw provider arrays.
- If tests reveal existing persisted cases have analyst edits, code must preserve manual fields and only affect future generation paths.
