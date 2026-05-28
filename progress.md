# Progress Log

## 2026-05-27

### Politica Cliente, Checklist Local E Modais De Conclusao
- Usuario saiu de modo planejamento e autorizou implementacao com garantia de nao regressao, testes e deploy ao final.
- Carregada skill `planning-with-files`.
- Catchup inicial com `~/.opencode` falhou: arquivo `session-catchup.py` nao existe nesse caminho.
- Catchup pelo caminho correto `~/.config/opencode/skills/planning-with-files/scripts/session-catchup.py` executou sem output.
- `git diff --stat` mostrou mudancas preexistentes em `functions/index.js`, `functions/helpers/deterministicPrefill.test.js` e `graphify-out`; essas alteracoes nao devem ser revertidas.
- Lidos planning files e `graphify-out/GRAPH_REPORT.md` antes de editar.
- Auditoria do codigo real confirmou `concludeCaseByAnalyst`, `riskCalculator`, stepper de `CasoPage`, `Modal` reutilizavel e testes existentes.
- Planejamento persistente atualizado com Phase 15 antes de alterar codigo.
- Fase 15.1 RED: adicionados testes backend/frontend para `laborFlag: POSITIVE` com `laborSeverity LOW/MEDIUM/HIGH`; LOW e HIGH falharam como esperado porque o score ficava sempre 90.
- Fase 15.1 GREEN: `functions/shared/riskCalculator.js` e `src/core/riskCalculator.js` agora aplicam `laborSeverity`: LOW=50, MEDIUM/ausente=90, HIGH=95.
- Verificacao focada Fase 15.1 passou: `npm test -- shared/riskCalculator.test.js` em `functions` e `npm test -- src/core/riskCalculator.test.js` na raiz.
- Fase 15.2 RED: adicionados testes em `functions/helpers/aiCalibration.test.js` para politica de veredito do cliente; falharam porque `buildClientVerdictPolicy` e `validateClientVerdictPolicy` ainda nao existiam.
- Fase 15.2 GREEN: adicionados helpers backend para politica trabalhista/criminal, data de corte `CLIENT_VERDICT_POLICY_EFFECTIVE_AT`, validacao de override com `details.code = CLIENT_VERDICT_OVERRIDE_REQUIRED`, export em `__test` e integracao em `concludeCaseByAnalyst`.
- Fase 15.2 tambem corrigiu `riskInput` de conclusao para incluir `laborSeverity`.
- Verificacao focada Fase 15.2 passou: `npm test -- helpers/aiCalibration.test.js` em `functions`.
- Fase 15.3 RED/GREEN: criado `useChecklistSession` com testes para persistencia por caso em `sessionStorage` e isolamento entre casos.
- Fase 15.4 RED/GREEN: criado `ChecklistModal` reutilizando `Modal`, com teste de renderizacao e toggle.
- Fase 15.5: `CasoPage.jsx` agora mostra progresso do checklist, bloqueia conclusao localmente quando incompleto, abre modal final de confirmacao e trata `CLIENT_VERDICT_OVERRIDE_REQUIRED` com justificativa de override.
- Verificacao focada frontend passou: `useChecklistSession.test.jsx`, `ChecklistModal.test.jsx` e `CasoPage.test.jsx`.
- Verificacao completa passou: `functions npm test` (513), `functions npm run lint`, `npm test` (818), `npm run lint`, `npm run build`.
- Primeiro `npm run lint` frontend falhou por arquivo temporario de Vite durante execucao paralela; repetido isolado, revelou `sbColor` nao usado em `src/core/reportBuilder.js`. Removido tambem do mirror `functions/reportBuilder.cjs`; lint passou.
- `graphify update .` executado com sucesso: 1038 nodes, 1953 edges, 140 communities.
- Deploy backend concluido para Firebase `compliance-hub-br` via CLI depois que o job MCP ficou sem logs; o job MCP tambem terminou como `success` posteriormente.
- Deploy frontend concluido na Vercel: production `https://compliance-2t2hrw8tx-fagner-alexandro-s-projects.vercel.app`, alias `https://compliance-hub-hazel.vercel.app`.
- Pos-deploy: consulta de logs `ERROR` para `concludeCaseByAnalyst` nao retornou entradas.


## 2026-05-25

### Remover Contexto Profissional Do Resumo Trabalhista
- Usuario pediu remover de `laborNotes` tanto o bloco `Contexto profissional cadastral (nao se trata de apontamento trabalhista):` quanto o fallback `Contexto profissional cadastral: dados profissionais nao disponiveis.`.
- Revisao de escopo: manter dados BigDataCorp de profissao no banco e manter eventual uso em resumo executivo/areas tecnicas; remover apenas da narrativa trabalhista deterministica.
- Planejamento atualizado como Phase 14 antes de alterar codigo.
- RED confirmado em `cd functions; npm test -- helpers/deterministicPrefill.test.js`: 4 falhas esperadas porque `buildDetLaborNotes()` ainda inseria contexto profissional e fallback de dados indisponiveis.
- Removido de `buildDetLaborNotes()` o bloco morto que montava empregador, CNPJ, setor, vinculo, faixa salarial, servidor publico e fallback de dados profissionais indisponiveis.
- Teste focado `cd functions; npm test -- helpers/deterministicPrefill.test.js`: 82/82 passando.
- Suite functions `cd functions; npm test`: 17 arquivos, 482/482 testes passando.
- Lint functions `cd functions; npm run lint`: passou.
- Suite raiz `npm test`: 52 arquivos, 781/781 testes passando.
- Lint raiz `npm run lint`: passou.
- Build `npm run build`: passou.
- `git diff --check`: sem erros; apenas avisos LF/CRLF.
- `graphify update .`: executado; grafo atualizado para 1015 nodes, 1910 edges, 137 communities.

### Resumo Trabalhista Com Contraparte E Status Inteligente
- Usuario aprovou o novo padrao de resumo trabalhista e pediu implementacao passo a passo sem regressao.
- Auditoria somente leitura executada antes da implementacao: 68 casos reais com `laborFlag=POSITIVE`, 118 processos trabalhistas, 66 processos com parte passiva bruta e apenas 3 resumos atuais com parte passiva exibida.
- Confirmado que `Status: N/A` aparece por perda de status melhor durante o merge: BigDataCorp tem status em 116/118 processos, mas `selectTopProcessos()` fixa `N/A` cedo demais quando Judit nao traz status.
- Confirmado que Judit e BigDataCorp ja preservam partes nos normalizers (`parties[]` e `allParties[]`), mas `selectTopProcessos()` descarta esses arrays no objeto intermediario usado pelo prefill.
- Risco identificado: alguns fornecedores retornam o proprio candidato em papel passivo recursal ou tecnico; o resumo deve filtrar candidato antes de listar `Parte reclamada/passiva`.
- Carregada skill `test-driven-development`; a implementacao seguira RED/GREEN com testes em `functions/helpers/deterministicPrefill.test.js` antes de alterar producao.
- RED confirmado em `cd functions; npm test -- helpers/deterministicPrefill.test.js`: os testes novos falharam porque o resumo ainda exibia `Status: N/A`, `Papel:` e nao exibia contraparte.
- Backend: `selectTopProcessos()` agora preserva `parties`, `allParties` e `movements`, mescla status/datas/ultimo andamento por CNJ e evita fixar `N/A` cedo demais.
- Backend: criado formato trabalhista especifico com `Status processual`, `Papel do candidato`, contraparte, `Distribuição | Última movimentação` e `Último andamento`, mantendo o formato generico para criminal.
- Backend: contraparte trabalhista filtra candidato, nomes menores que 4 caracteres e papeis neutros/tecnicos como advogado/perito/testemunha.
- Teste focado `cd functions; npm test -- helpers/deterministicPrefill.test.js`: 82/82 passando.
- Suite functions `cd functions; npm test`: 17 arquivos, 482/482 testes passando.
- Lint functions `cd functions; npm run lint`: passou.
- Suite raiz `npm test`: 52 arquivos, 781/781 testes passando.
- Lint raiz `npm run lint`: passou.
- Build `npm run build`: passou.
- Ajuste pos-revisao: quando houver apenas ultima movimentacao sem distribuicao confiavel, o bloco trabalhista nao imprime `Distribuição: data não informada`.
- Revalidacao apos ajuste: `cd functions; npm test` passou com 17 arquivos e 482/482 testes; `cd functions; npm run lint` passou; `npm test` passou com 52 arquivos e 781/781 testes; `npm run build` passou; `npm run lint` passou.
- `git diff --check`: sem erros; apenas avisos LF/CRLF.
- `graphify update .`: executado; grafo atualizado para 1015 nodes, 1910 edges, 136 communities.

## 2026-05-22

### Incidente: Tag Criminal Consultiva Em Caso Concluido
- Carregadas skills `systematic-debugging` e `test-driven-development` para conduzir a correcao como bug fix com causa raiz e testes antes de codigo.
- Consulta Firestore MCP falhou/ficou instavel; usado REST Firestore com token da Firebase CLI. `firebase login:list --json` tambem teve timeouts intermitentes, entao os comandos passaram a usar retry.
- Caso `v5ef9RJ0wBmQLUz4HLf0` confirmado com `criminalFlag=INCONCLUSIVE_HOMONYM`, `riskScore=45`, `riskLevel=YELLOW`, `suggestedVerdict=ATTENTION`, `finalVerdict=FIT`.
- Evidencia do caso real: Judit criminal negativo count 0, BigDataCorp criminal negativo count 0, trabalhista negativo, mandado negativo, DJEN criminal count 1 com evidencia fraca por nome/comunicacao (`WEAK_NAME_ONLY`).
- Snapshots afetados confirmados: `cases/v5ef9RJ0wBmQLUz4HLf0/publicResult/latest` e `clientCases/v5ef9RJ0wBmQLUz4HLf0` tambem carregavam `INCONCLUSIVE_HOMONYM` e risco amarelo.
- TDD backend: adicionado teste em `functions/helpers/aiCalibration.test.js` para `validateConcludeFinalFlags()` rejeitar `INCONCLUSIVE_HOMONYM` e aceitar `NEGATIVE`, `POSITIVE`, `INCONCLUSIVE`; falhou primeiro porque o helper nao existia.
- TDD frontend: adicionado teste em `src/portals/ops/CasoPage.test.jsx` para bloquear conclusao quando `criminalFlag=INCONCLUSIVE_HOMONYM`; falhou primeiro porque o botao `Concluir` estava habilitado.
- Backend: criado `FINAL_CRIMINAL_FLAGS` e `validateConcludeFinalFlags()` em `functions/index.js`; `concludeCaseByAnalyst` agora valida a flag efetiva apos fallback de `reviewDraft` e rejeita estados consultivos com `invalid-argument`.
- Backend: validacao de execucao penal tambem deixou de aceitar `INCONCLUSIVE_HOMONYM`/`INCONCLUSIVE_LOW_COVERAGE` como estado final; aceita apenas `POSITIVE` ou `INCONCLUSIVE`.
- Frontend: `CasoPage.jsx` agora considera final criminal apenas `NEGATIVE`, `POSITIVE` ou `INCONCLUSIVE`; checklist bloqueia estados consultivos e o botao de conclusao fica desabilitado.
- Teste frontend ajustado para validar o bloqueio imediato no botao do header, pois o checklist so aparece na etapa de revisao.
- Verificacao focada backend: `cd functions && npm test -- helpers/aiCalibration.test.js` passou com 35/35.
- Verificacao focada frontend: `npm test -- src/portals/ops/CasoPage.test.jsx` passou com 15/15.
- Correcao de dados aplicada via REST Firestore nos tres documentos: `cases/v5ef9RJ0wBmQLUz4HLf0`, `cases/v5ef9RJ0wBmQLUz4HLf0/publicResult/latest`, `clientCases/v5ef9RJ0wBmQLUz4HLf0`.
- Verificacao pos-correcao: os tres documentos retornam `criminalFlag=NEGATIVE`, `riskScore=0`, `riskLevel=GREEN`, `suggestedVerdict=FIT`, `finalVerdict=FIT` e justificativa sem ressalva generica.
- Suite completa raiz: `npm test` passou com 52 arquivos, 775/775 testes.
- Suite completa functions: `cd functions && npm test` passou com 17 arquivos, 476/476 testes.
- `npm run lint` e `cd functions && npm run lint` passaram.
- `npm run build` passou.
- `git diff --check` sem erros; apenas avisos LF/CRLF.
- `graphify update .` executado; grafo atualizado para 999 nodes, 1868 edges, 143 communities.
- Deploy Firebase Functions: concluido. 55 funcoes atualizadas com sucesso, incluindo `concludeCaseByAnalyst` com `validateConcludeFinalFlags`.
- Deploy Vercel: concluido. Aliased `https://compliance-hub-hazel.vercel.app`.

### DJEN Consultivo Sem Impacto Isolado
- Adicionados testes de regressao em `functions/helpers/aiCalibration.test.js` cobrindo DJEN criminal isolado, DJEN trabalhista isolado, DJEN positivo com muitos homonimos e DJEN positivo com poucos homonimos.
- Adicionados testes em `functions/helpers/deterministicPrefill.test.js` para impedir listagem de DJEN isolado sem CNJ confirmado e permitir DJEN correlacionado ao mesmo CNJ confirmado por BigDataCorp.
- RED confirmado: `aiCalibration.test.js` falhou em 4 testes porque DJEN ainda alterava `criminalFlag`/`laborFlag`; `deterministicPrefill.test.js` falhou porque `criminalNotes` ainda listava comunicacao DJEN isolada.
- Backend: criados helpers `getDjenProcessNumber()`, `getConfirmedProviderProcessNumbers()` e `filterDjenComunicacoesByConfirmedProcess()` em `functions/index.js`.
- Backend: `computeAutoClassification()` deixou de usar confianca por homonimos/geo-score do DJEN isolado e so considera DJEN quando ha CNJ confirmado por Judit/BigDataCorp no mesmo eixo.
- Backend: `buildDetCriminalNotes()` e `buildDetLaborNotes()` agora filtram DJEN por CNJ confirmado antes de listar comunicacoes em textos finais.
- Testes focados passaram: `cd functions && npm test -- helpers/aiCalibration.test.js` com 35/35 e `cd functions && npm test -- helpers/deterministicPrefill.test.js` com 79/79.
- Suite completa raiz: `npm test` passou com 52 arquivos, 778/778 testes.
- Suite completa functions: `cd functions && npm test` passou com 17 arquivos, 479/479 testes.
- `cd functions && npm run lint` passou.
- `npm run lint` na raiz falhou uma vez por artefato temporario `vite.config.js.timestamp-...mjs`; rerun passou.
- `npm run build` passou.
- `git diff --check` sem erros; apenas avisos LF/CRLF.
- Deploy nao executado nesta fase.

## 2026-05-21

### Incidente: Tag Criminal Consultiva Em Caso Concluido
- Usuario reportou caso `/ops/caso/v5ef9RJ0wBmQLUz4HLf0` concluido com tag criminal `Precisa de revisao manual`, quando deveria ser `Sem apontamento`.
- Rodado `session-catchup.py`; sem output.
- `git diff --stat` mostra mudancas locais extensas da fase anterior ainda nao deployadas.
- Lidos `task_plan.md`, `findings.md`, `progress.md` e `graphify-out/GRAPH_REPORT.md` antes de investigar.
- Nova Phase 11 registrada para corrigir dado real e impedir conclusao com tag criminal consultiva.

### IA Revisora Especializada Por Eixo
- Usuario pediu implementacao passo a passo com garantia de nao regressao.
- Rodado `session-catchup.py` pelo caminho real em `~/.config/opencode`; sem output.
- `git diff --stat` mostra mudancas locais extensas da rodada anterior ja verificadas, incluindo backend/frontend/testes/planning/graphify.
- Lidos `task_plan.md`, `findings.md`, `progress.md` e inspecionados pontos atuais do backend/UI/testes.
- Achado principal: `applyClassificationReviewGuardrails()` promovia todos os eixos `AGREE` para `AGREE_WITH_CAUTION` com base em cautela global; isso explica ressalvas genericas em trabalhista/mandado.
- Planejamento atualizado para Phase 10 antes de novas alteracoes de codigo.
- TDD backend: adicionados testes em `functions/helpers/aiCalibration.test.js` para contexto por eixo e remocao de cautela generica em trabalhista/mandado negativos bem cobertos.
- TDD frontend: adicionado teste em `src/portals/ops/CasoPage.test.jsx` garantindo que ressalva criminal nao contamina trabalhista/mandado.
- Backend: criado `buildAiClassificationReviewContext()` com cobertura por eixo, fontes zeradas, conflitos, materialidade e motivo objetivo de cautela.
- Backend: `buildAiClassificationReviewPrompt()` agora inclui `reviewContext` e regra explicita de que fonte concluida com zero achados sustenta negativo.
- Backend: `runAiClassificationReviewAnalysis()` aplica `applyAiClassificationReviewGuardrails()` antes de retornar/persistir resposta estruturada.
- Frontend: `CasoPage.jsx` ganhou contexto por eixo para display/fallback; `applyClassificationReviewGuardrails()` deixou de promover cautela global para todos os eixos.
- Frontend: fallback de trabalhista/mandado negativo bem coberto agora usa evidencia forte quando fontes consultadas retornaram zero achados.
- Erro de teste 1: novo teste frontend encontrou 3 ocorrencias de `Concorda com ressalva`; corrigido com guardrail por eixo.
- Erro de teste 2: fixture novo nao trazia conflito criminal real e a cautela criminal foi removida; corrigido adicionando Judit criminal positivo e BigDataCorp criminal negativo.
- Verificacao focada: `cd functions && npm test -- helpers/aiCalibration.test.js` passou com 34/34.
- Verificacao focada: `npm test -- src/portals/ops/CasoPage.test.jsx` passou com 14/14.
- Suite completa raiz: `npm test` passou com 52 arquivos, 773/773 testes.
- Suite completa functions: `cd functions && npm test` passou com 17 arquivos, 475/475 testes.
- `npm run lint` e `cd functions && npm run lint` passaram.
- `npm run build` passou.
- `git diff --check` sem erros; apenas avisos LF/CRLF.
- `graphify update .` executado; grafo atualizado para 997 nodes, 1865 edges, 137 communities.
- Deploy nao executado nesta fase.

### AI Review Hardening + DJEN Modal
- Usuario pediu implementacao passo a passo, com planning files, evitando regressao, e deploy final de Functions + Vercel.
- Carregada skill `planning-with-files`.
- Primeira tentativa de catchup com `~/.opencode` falhou; caminho correto e `~/.config/opencode`.
- Catchup pelo caminho correto nao retornou output.
- `git diff --stat` mostra alteracoes extensas da rodada anterior ja em working tree, incluindo `functions/index.js`, `CasoPage.jsx`, testes, planning files e `graphify-out`.
- Lidos `task_plan.md`, `findings.md`, `progress.md`.
- Atualizados `task_plan.md` e `findings.md` com novo escopo: endurecer IA revisora contra JSON bruto/termos tecnicos, melhorar prompt/parser/UI e tornar DJEN clicavel com modal de movimentacoes.
- Backend AI hardening iniciado: prompt da IA revisora reforcado para portugues operacional, sem nomes internos em textos livres, com semantica clara de `evidenceStrength`.
- Backend: `runStructuredAiAnalysis()` ganhou `responseFormat` opt-in e `runAiClassificationReviewAnalysis()` passa `response_format: { type: 'json_object' }`, com fallback automatico sem response_format se a API rejeitar.
- Backend: removido fallback bruto de `extractFallbackAiClassificationReviewResponse()`; schema quebrado nao vira `summary` valido.
- Backend: adicionada sanitizacao contra caracteres de controle e textos com JSON/schema/nomes internos em narrativas da IA revisora.
- Backend: `buildAiClassificationReviewUpdatePayload()` nao persiste `aiClassificationReview` estruturado quando `structuredOk=false`.
- Teste focado `cd functions && npm test -- helpers/aiCalibration.test.js`: 32/32 passando.
- Frontend: `CasoPage.jsx` agora sanitiza a analise assistida antes de renderizar, cai em fallback deterministico quando o Firestore tem payload bruto, humaniza cobertura/divergencia e oculta redes sociais vazias na identificacao.
- `npm test -- src/portals/ops/CasoPage.test.jsx` falhou na primeira tentativa por texto duplicado `Cobertura alta`; teste ajustado para `getAllByText`.
- `npm test -- src/portals/ops/CasoPage.test.jsx`: 11/11 passando.
- DJEN modal: `ProcessInspectionModal` agora aceita fonte `DJEN`, badge verde e mostra detalhes da comunicacao selecionada.
- `CasoPage.jsx`: processo DJEN na aba criminal agora e botao clicavel; abre modal com todas as comunicacoes do mesmo CNJ pela timeline existente.
- `CasoPage.jsx`: adicionada tabela de comunicacoes DJEN trabalhistas na aba trabalhista, com processo clicavel e mesmo modal.
- Removido lazy render apenas do bloco DJEN criminal porque o conteudo clicavel dependia de `openedSections` e podia nao renderizar apos abrir `<details>`.
- `npm test -- src/portals/ops/CasoPage.test.jsx` teve falhas de seletor por textos duplicados (`Criminal`, `Trabalhista`, `DJEN`, tipos); testes ajustados para seletores nao-unicos.
- `npm test -- src/portals/ops/CasoPage.test.jsx`: 13/13 passando.
- Proximo passo: rodar suites completas, lint, build, diff-check, graphify e deploy.
- `npm test`: 52 arquivos, 770/770 testes passando.
- `cd functions && npm test`: 17 arquivos, 473/473 testes passando.
- `npm run lint` e `cd functions && npm run lint` falharam inicialmente por `no-control-regex` nas regexes de caracteres de controle.
- Corrigido `no-control-regex` trocando regex por filtragem `charCodeAt` no backend e frontend.
- `npm run lint`: passou.
- `cd functions && npm run lint`: passou.
- `npm run build`: passou.
- Como houve alteracao apos suites completas (filtragem charCode), proximo passo e rerodar suites completas antes do deploy.
- Suites completas rerodadas apos a correcao de lint:
- `npm test`: 52 arquivos, 770/770 testes passando.
- `cd functions && npm test`: 17 arquivos, 473/473 testes passando.
- `git diff --check`: sem erros; apenas avisos LF/CRLF.
- `git status --short`: confirma mudancas esperadas em backend/frontend/tests/planning/graphify e arquivo untracked preexistente `functions/extract_done_cases.cjs`.
- `graphify update .`: executado; grafo atualizado para 977 nodes, 1817 edges, 139 communities.
- Proximo passo: deploy Firebase Functions e Vercel.

### IA Revisora Da Autoclassificacao
- Usuario aprovou reorganizacao da aba `Identificacao do candidato` e solicitou implementacao da nova IA revisora da autoclassificacao.
- Carregada skill `planning-with-files`.
- Tentativa inicial de `session-catchup.py` com caminho `~/.opencode` falhou porque a instalacao real esta em `~/.config/opencode`.
- Repetido `session-catchup.py` com caminho real; sem output.
- `git diff --stat` antes da implementacao mostrou apenas alteracoes geradas em `graphify-out/`.
- `task_plan.md` reescrito para o novo escopo: backend `aiClassificationReview`, UI de identificacao reorganizada e testes anti-regressao.
- Backend: criado schema/parser/sanitizacao/prompt `aiClassificationReview`; integrado em `runAutoClassifyAndAi()` e `rerunAiAnalysis()`.
- Backend: `npm test -- helpers/aiCalibration.test.js` passou com 30 testes.
- Frontend: removido bloco global `Síntese da análise automática`; adicionada `Análise assistida da autoclassificação` na aba Identificacao; antigo bloco principal `Análise automática GPT-5.4-nano JSON` removido da experiencia principal.
- Frontend: homonimos rebaixados para `Detalhes técnicos de homônimos`; `EnrichmentPipeline` agora chama a fase de `Análise assistida` e usa custo/erro de `aiClassificationReview`.
- `npm test -- src/portals/ops/CasoPage.test.jsx` falhou em 2 testes por expectativas antigas; testes atualizados para a nova UX.
- `npm test -- src/portals/ops/CasoPage.test.jsx` passou: 9/9.
- Ajustado portal cliente para considerar `aiClassificationReview` como analise finalizada no macro progresso.
- Ajustada pagina de metricas de IA para contar `aiClassificationReview*` em total, sucesso/falha, cache, tokens e custo, preservando fallback para campos legados.
- Ajustado fallback de budget mensal no backend para somar `aiClassificationReviewCostUsd` junto com custos legados e homonimos.
- `npm test -- src/portals/client/SolicitacoesPage.test.jsx src/portals/ops/CasoPage.test.jsx`: 15/15 passando.
- `npm test`: 52 arquivos, 764/764 testes passando.
- `npm run lint`: passou apos ignorar `.vercel` e `graphify-out` no ESLint; erro anterior vinha de bundles gerados em `.vercel/output/static`.
- `npm run build`: passou.
- `cd functions && npm test`: 17 arquivos, 471/471 testes passando.
- `cd functions && npm run lint`: passou.
- `git diff --check`: sem erros; apenas avisos de conversao LF para CRLF.
- `graphify update .`: executado; grafo atualizado para 965 nodes, 1790 edges, 137 communities.

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
