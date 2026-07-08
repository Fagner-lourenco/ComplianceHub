# Progress — Controle de IA desabilitada

## Sessão atual

### 2026-06-18
- [x] Mapeamento backend e frontend concluído via subagentes.
- [x] Arquivos de planejamento criados (`task_plan.md`, `findings.md`, `progress.md`).
- [x] Git status verificado: `graphify-out/` possui modificações não commitadas do trabalho anterior.
- [x] Criado helper `functions/modules/_shared/aiEnabledHelper.js`.
- [x] Criado teste `functions/modules/_shared/aiEnabledHelper.test.js`.
- [x] Refatorado `functions/modules/autoClassification.js` para usar helper.
- [x] Adicionado bloqueio em `functions/index.js` → `rerunAiForCase`.
- [x] Adicionado bloqueio em `functions/modules/caseQueriesAssignments.js` → handlers de rerun.
- [x] Atualizados testes backend para cobrir toggle/budget/rerun.

### Próxima ação
- Executar testes completos do backend (functions) e depois iniciar ajustes no frontend.

## Notas
- Branch atual: `main`.
- Commit mais recente: `8b17130 fix: expoe Escavador2 no pipeline e abas criminal/trabalhista, ajusta gate de identidade e limpa warnings`.
