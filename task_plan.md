# Task Plan: Classificacao Processual e Narrativas Seguras

## Goal
Corrigir a classificacao deterministica de processos criminais/trabalhistas e a narrativa client-facing para que o sistema considere esfera, assunto, classe/procedimento, fonte, identidade forte e papel do candidato no processo, sem expor evidencias fracas como apontamento material.

## Scope
- Backend Firebase Functions.
- Normalizacao/classificacao de papeis processuais.
- Classificacao de esfera processual por `area`, `courtType`, `cnjBroadSubject`, `subject`, `procedure`, `classifications`, `tribunal` e `tags`.
- Prefill deterministico e sanitizacao de narrativas.
- Testes backend focados e suite completa.

## Non-Goals
- Nao fazer backfill automatico em casos `DONE` ja publicados.
- Nao alterar `nextSteps` agora.
- Nao expor provider, CNJ, tribunal, vara, advogado ou numero de processo em novos textos client-facing.
- Nao mudar thresholds de DJEN nesta primeira rodada, salvo se teste mostrar quebra direta.

## Decisions
- Criminal recursal/material (`APELANTE`, `APELADO`, `RECORRENTE`, `RECORRIDO`, `AGRAVANTE`, `AGRAVADO`) conta como material apenas quando a esfera for criminal.
- Trabalhista recursal/material (`RECORRENTE`, `RECORRIDO`, `AGRAVANTE`, `AGRAVADO`, `POLO ATIVO`) conta como material apenas quando a esfera for trabalhista.
- Vítima/ofendido/testemunha/advogado nao viram criminal positivo.
- `IMPETRANTE` criminal e `AUTOR` criminal sem `AUTOR DO FATO` ficam baixo risco/parte ativa nao acusada.
- `DEPRECADO(A)`, `V`, `D`, `T` e papeis ausentes ficam ambiguos/neutros, nao positivos automaticos.
- DJEN fraco nao deve aparecer como achado material em texto cliente quando a flag final for negativa.

## Phases

### Phase 0: Persistent Planning
- [x] Rodar `session-catchup.py`.
- [x] Ler arquivos de planejamento existentes.
- [x] Atualizar `task_plan.md`, criar `findings.md`, atualizar `progress.md`.

### Phase 1: Role Classifier
- [x] Atualizar `functions/helpers/roleClassifier.js` com normalizacao sem acento, limpeza de parenteses/pontuacao e regexes ampliadas.
- [x] Cobrir papeis criminais materiais, baixo risco e ambiguos.
- [x] Cobrir papeis trabalhistas materiais, baixo risco e ambiguos.
- [x] Adicionar testes em `functions/helpers/roleClassifier.test.js`.

### Phase 2: Process Area Classifier
- [x] Criar helper compartilhado para classificar esfera por sinais de area/assunto/classe/procedimento.
- [x] Integrar em `normalizers/judit.js`, `normalizers/bigdatacorp.js` e, se necessario, `normalizers/escavador.js`.
- [x] Integrar em `selectTopProcessos()` para narrativas usarem a mesma inferencia.
- [x] Adicionar testes unitarios do helper.

### Phase 3: Auto Classification Fixtures
- [x] Adicionar/ajustar testes em `functions/helpers/aiCalibration.test.js` para Judit/BDC criminal e trabalhista com CPF forte e papeis reais.
- [x] Validar vitima/testemunha como baixo risco.
- [x] Validar recursal criminal como positivo somente em esfera criminal.
- [x] Validar recursal trabalhista como positivo somente em esfera trabalhista.

### Phase 4: Deterministic Narrative Safety
- [x] Corrigir `buildDetExecutiveSummary()` para eliminar `Ha nenhum`/`Há nenhum`.
- [x] Corrigir `buildDetLaborNotes()` para nao listar DJEN trabalhista quando `laborFlag !== 'POSITIVE'`.
- [x] Reforcar `sanitizeNarrativesForFlags()` contra comunicacoes/processos contraditorios em flags negativas.
- [x] Adicionar testes em `functions/helpers/deterministicPrefill.test.js`.

### Phase 5: Verification
- [x] Rodar testes focados: roleClassifier, deterministicPrefill, aiCalibration e novo helper.
- [x] Rodar `cd functions && npm test`.
- [x] Rodar `graphify update .` apos alteracoes de codigo.
- [x] Revisar `git diff --stat` e registrar resultados.
- [x] Corrigir falha da suite raiz em `CasoPage.test.jsx` causada por `activeStep` fora do range apos sincronizacao de fases.
- [x] Rodar `npm test`, `npm run lint` e `npm run build` na raiz.
- [x] Rodar `cd functions && npm test` e `cd functions && npm run lint`; nao ha script de build backend.
- [x] Rodar `git diff --check`.
- [x] Rodar `graphify update .` apos a correcao frontend.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `session-catchup.py` nao retornou output | 1 | Prosseguir com leitura de planejamento e `git diff --stat` para recuperar contexto |
| `roleClassifier.test.js` falhou em 28 novos casos | 1 | Falha esperada por TDD; implementar normalizacao e regexes ampliadas em `roleClassifier.js` |
| `CasoPage.test.jsx` passava isolado mas falhava na suite completa sem `Resumo executivo` | 1 | Causa raiz: `activeStep` podia ficar fora do range quando `enabledPhases` reduzia a lista de steps; normalizar indice visivel em `CasoPage.jsx` |

## Current Status
- Implementacao completa.
- Frontend tests/lint/build passando.
- Backend tests e lint passando; sem script de build separado em `functions/package.json`.
- Graphify atualizado.
