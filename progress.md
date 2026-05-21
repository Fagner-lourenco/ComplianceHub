# Progress Log

## 2026-05-21

### Started
- Iniciada implementacao das correcoes de classificacao processual e narrativas seguras.
- Rodado `session-catchup.py`; sem output. Contexto recuperado via `git diff --stat` e leitura dos planning files.
- `task_plan.md` atualizado para a nova tarefa.
- `findings.md` criado com auditoria de Judit, BigDataCorp, DJEN, taxonomia de papeis e sinais de esfera.

### Current Phase
- Phase 1: Role Classifier.

### Phase 1 TDD
- Adicionados testes para papeis reais criminais/trabalhistas em `functions/helpers/roleClassifier.test.js`.
- `npm test -- helpers/roleClassifier.test.js` falhou como esperado: 28 falhas cobrindo `RÉU`, `VÍTIMA`, `ACUSADO(A)`, `DENUNCIADO(A)`, `APELANTE`, `RECORRENTE`, `POLO ATIVO (PRINCIPAL)`, `REQDO` etc.
- Implementada normalizacao em `roleClassifier.js` e regexes ampliadas para papeis criminais/trabalhistas reais.
- `npm test -- helpers/roleClassifier.test.js`: 54/54 passando.

### Phase 2/3
- Criado `functions/helpers/processClassifier.js` com testes para esfera criminal/trabalhista por area, courtType, broadSubject, assunto, classe/procedimento e tribunal.
- Integrado `classifyProcessArea()` em Judit, BigDataCorp, Escavador e `selectTopProcessos()`.
- Adicionados testes em `aiCalibration.test.js` para Judit/BDC com `RÉU`, `VÍTIMA`, `APELANTE`, `TESTEMUNHA DO JUÍZO`, `RECORRENTE`, `RECLAMADO`.
- Corrigido `computeAutoClassification()` para nao deixar `bigdatacorpCriminalFlag`/`bigdatacorpLaborFlag` sobrepor papel baixo risco quando ha detalhe processual disponivel.
- `npm test -- helpers/processClassifier.test.js helpers/roleClassifier.test.js normalizers/judit.test.js normalizers/bigdatacorp.test.js`: 75/75 passando nos arquivos existentes executados.
- `npm test -- helpers/aiCalibration.test.js`: 27/27 passando.

### Phase 4
- Adicionados testes para sanitizacao de comunicacoes DJEN contraditorias, DJEN trabalhista em `laborFlag=NEGATIVE` e gramatica do resumo executivo.
- Corrigido `buildDetExecutiveSummary()` para nao gerar `Ha nenhum`.
- Corrigido `buildDetLaborNotes()` para nao listar DJEN trabalhista quando a flag final nao e positiva.
- Reforcado `sanitizeNarrativesForFlags()` para comunicacoes/processos criminais/trabalhistas contraditorios.
- Atualizado teste antigo de BDC trabalhista para usar papel material (`Recorrente`) em vez de `Reclamado`.
- `npm test -- helpers/deterministicPrefill.test.js`: 76/76 passando.

### Verification
- Testes focados: 178/178 passando.
- `cd functions && npm test`: 468/468 passando.
- `cd functions && npm run lint`: passou; foi removida uma declaracao `topProcessos` nao usada em `buildAiPrefillPrompt`.
- `graphify update .` executado apos alteracoes finais.
- `git diff --stat` revisado. Observacao: `functions/extract_done_cases.cjs` permanece untracked e ja existia como artefato separado, nao faz parte desta implementacao.

### Frontend Verification Fix
- Root cause da falha intermitente em `src/portals/ops/CasoPage.test.jsx`: clique em `Revisao` podia usar a lista legada de etapas antes da sincronizacao de `enabledPhases`; quando a lista reduzia, `activeStep` ficava fora do range e o conteudo da etapa ficava vazio.
- Corrigido `src/portals/ops/CasoPage.jsx` para normalizar o indice visivel da etapa e evitar render vazio quando `steps.length` muda.
- Corrigidos mocks com chave duplicada `keyFindings` em `src/data/mockCasesTenant1.js` e `src/data/mockCasesTenant2.js`.
- Ajustado teste para navegar para `Revisao` diretamente no caso de prefill.
- `npm test -- src/portals/ops/CasoPage.test.jsx`: 9/9 passando.
- `npm test`: 52 arquivos, 761/761 testes passando.
- `npm run lint`: passou.
- `npm run build`: passou.
- `cd functions && npm test`: 17 arquivos, 468/468 testes passando.
- `cd functions && npm run lint`: passou.
- `functions/package.json` nao possui script de build separado.
- `git diff --check`: sem erros; apenas avisos de conversao LF para CRLF.
- `graphify update .`: executado apos a correcao frontend.

## 2026-05-20

### Started
- Criado task_plan.md com todas as fases
- Iniciando implementacao da remocao de Apontamentos Relevantes + CPF fix

### Phase 1: Report Builders
- Lendo src/core/reportBuilder.js e functions/reportBuilder.cjs

## Notes
- analystComment sera obrigatorio para todos os casos
- CPF fix requer deploy backend + backfill
