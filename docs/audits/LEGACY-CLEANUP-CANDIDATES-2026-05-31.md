# Candidatos de Limpeza e Código Legado — ComplianceHub

**Data:** 2026-05-31  
**Objetivo:** listar arquivos que parecem temporários, legados, artefatos de auditoria ou scripts one-off para remoção/arquivamento controlado.  
**Regra:** não remover em massa sem validação humana, porque alguns scripts acessam produção ou servem como runbook operacional.

---

## Remoção Provavelmente Segura

Status em 2026-06-01: **removidos**.

Arquivos temporários sem referência útil fora do graphify/manifest:

```text
functions/temp_insert.txt
functions/temp_insert2.txt
functions/temp_insert3.txt
functions/temp_tab.txt
stdout
src_exports.txt
src_imports.txt
```

Motivo:

- Parecem artefatos de sessões/refatoração.
- Não são usados por `package.json`, `functions/package.json`, Vite, Firebase, Playwright ou testes.
- `stdout` tem ~530 KB e parece log bruto.
- `src_exports.txt` e `src_imports.txt` parecem snapshots de análise estática, substituíveis por scripts/grep.

Recomendação:

- Remover em um commit próprio após uma última checagem de `git grep`.

---

## Arquivar em `docs/audits/archive/` ou Remover Depois de Consolidar

Status em 2026-06-01: **movidos para `docs/audits/archive/`**.

Documentos manuais antigos na raiz:

```text
MANUAL_AUDITORIA_CORRECOES_EXTRACAO_COMPLIANCEHUB.md
MANUAL_PRE_PHASE_D_COMPLIANCEHUB.md
```

Motivo:

- São documentos úteis historicamente, mas poluem a raiz.
- Parte do conteúdo já foi absorvido por `docs/audits/FULL-APP-AUDIT-2026-05-31.md`, `progress.md` e handoffs.

Recomendação:

- Mover para `docs/audits/archive/` ou substituir por links no relatório final.

---

## Revisar Antes de Remover

Scripts one-off no root de `functions/` que deveriam estar em `scripts/` ou serem removidos:

```text
functions/debug-case.js
functions/extract_done_cases.cjs
functions/fix-tenant-configs.js
functions/promote-to-admin.cjs
functions/repair-all-claims.js
functions/rerun-case.cjs
```

Motivo:

- Não fazem parte do bundle principal de Cloud Functions.
- Misturam scripts operacionais com código deployável.
- Alguns podem acessar dados reais ou alterar produção.

Recomendação:

- Mover scripts ainda úteis para `scripts/ops/` com README e guard rails.
- Remover duplicatas quando existir equivalente em `scripts/`.
- Manter fora de `functions/` para reduzir ruído de auditoria e risco de import acidental.

Observações específicas:

- `functions/debug-case.js` foi corrigido para não exigir `serviceAccountKey.json` hardcoded, mas ainda é script local/debug.
- `functions/promote-to-admin.cjs` diz no cabeçalho `node scripts/promote-to-admin.cjs`, mas está dentro de `functions/`; isso indica drift.
- `functions/rerun-case.cjs` parece duplicar `scripts/rerun-case.cjs`.

---

## Scripts em `scripts/` que Parecem One-Off de Produção

Revisar e classificar como `scripts/ops/`, `scripts/audits/`, `scripts/migrations/` ou remover:

```text
scripts/audit-madero-cleanup.cjs
scripts/audit-madero-narratives.cjs
scripts/clean-madero-all.cjs
scripts/clear-madero-logs.cjs
scripts/clear-madero-reports.cjs
scripts/delete-case.cjs
scripts/fix-francisco-autoclassify.cjs
scripts/fix-francisco-warrant.cjs
scripts/patch-madero-cases.cjs
scripts/test-exato.cjs
```

Status em 2026-06-01: outputs textuais `scripts/francisco-audit.txt`, `scripts/francisco-candidates.txt`, `scripts/prefill-output.txt` e `scripts/prefill-output2.txt` foram removidos por parecerem artefatos de investigacao com potencial dado sensivel.

Motivo:

- Nomes indicam casos/clientes específicos ou investigações pontuais.
- Podem conter dados sensíveis ou outputs de produção.
- Não devem ficar misturados com scripts reutilizáveis.

Recomendação:

- Se forem necessários para auditoria histórica, mover para `docs/audits/artifacts/` ou `results/` com sanitização.
- Se contiverem PII/dados reais, remover do repo e guardar fora do versionamento.

---

## `results/` — Artefatos Grandes e Possível Dado Sensível

Diretório com muitos JSON/HTML/TXT de auditorias, providers e casos reais:

```text
results/
results/advanced/
results/bigdatacorp/
results/exato/
results/missing/
results/mobile-audit-2026-04-09/
results/names/
results/real-mobile-audit-2026-04-09/
results/ui-audit/
```

Motivo:

- Há arquivos grandes de respostas externas, casos, relatórios HTML e backups.
- Alguns nomes indicam dados reais ou CPF completo.
- Isso aumenta risco de privacidade, peso do repo e ruído de auditoria.

Recomendação:

- Auditar conteúdo sensível antes de qualquer commit/merge.
- Remover artefatos com dados reais do Git.
- Manter apenas amostras anonimizadas mínimas em `fixtures/` ou `docs/audits/samples/`.
- Adicionar padrões adequados ao `.gitignore` para novos dumps.

---

## Manter Por Enquanto

Arquivos de planejamento e estado ainda úteis durante Phase D:

```text
progress.md
task_plan.md
findings.md
AGENTS.md
README.md
docs/audits/FULL-APP-AUDIT-2026-05-31.md
docs/audits/LEGACY-CLEANUP-CANDIDATES-2026-05-31.md
```

Motivo:

- Ainda são contexto operacional ativo da refatoração.
- Devem ser consolidados depois da Phase D, não antes.

---

## Ordem Recomendada de Limpeza

1. Remover temporários óbvios: `temp_*`, `stdout`, `src_exports.txt`, `src_imports.txt`.
2. Mover manuais antigos da raiz para `docs/audits/archive/`.
3. Mover scripts úteis de `functions/` para `scripts/ops/` e remover duplicatas.
4. Auditar `results/` por PII e remover dumps reais do Git.
5. Reorganizar `scripts/` por categoria.
6. Rodar `npm run lint`, `npm test`, `cd functions && npm run lint`, `cd functions && npm test`, `npm run build`, `npx playwright test`.
7. Rodar `graphify update .` após a limpeza de código/docs.
