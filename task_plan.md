# Task Plan: IA Revisora da Autoclassificacao

## Goal
Criar e endurecer a analise assistida que atua como segundo analista consultivo: auditar a autoclassificacao deterministica, apontar possiveis erros/inconsistencias, orientar a revisao humana e reorganizar a aba `Identificacao do candidato` para priorizar identidade, validacao da classificacao, evidencias usadas e dados tecnicos recolhidos. Nesta rodada, corrigir o vazamento de JSON bruto/termos tecnicos da IA revisora, melhorar o prompt/parser, reduzir ruido visual, tornar comunicacoes DJEN clicaveis nas abas criminal/trabalhista com modal de movimentacoes por processo e especializar a revisao por eixo para impedir ressalvas genericas em negativos bem cobertos.

## Scope
- Backend Firebase Functions: novo prompt/schema/parser/persistencia para `aiClassificationReview` e guardrails determinísticos de conclusao/classificacao.
- Frontend Ops `CasoPage`: remover a experiencia principal baseada em `aiStructured`, `aiHomonymStructured` e `prefillNarratives`; usar `aiClassificationReview` como bloco principal de analise assistida.
- UI da aba `Identificacao do candidato`:
  - Cabecalho de identidade.
  - Verificacao de identidade.
  - Analise assistida da autoclassificacao.
  - Evidencias usadas na analise.
  - Dados tecnicos recolhidos.
- Testes backend e frontend anti-regressao.
- UI Ops: comunicacoes judiciais DJEN em abas criminal/trabalhista devem abrir modal semelhante aos modais de BigDataCorp/Judit, agrupando todas as movimentacoes/comunicacoes do processo clicado.
- IA revisora especializada por eixo: fonte consultada com sucesso e zero achados deve sustentar negativo, nao gerar ressalva generica.
- Frontend Ops: guardrails nao devem transformar todos os eixos `AGREE` em `AGREE_WITH_CAUTION`; cautela deve ser especifica do eixo afetado.
- Incidente de producao: caso `v5ef9RJ0wBmQLUz4HLf0` foi concluido com tag criminal `Precisa de revisao manual`; corrigir para `Sem apontamento` quando apropriado e impedir conclusao futura com tags que nao sejam estados finais validos.
- DJEN deve permanecer consultivo: comunicacao isolada por nome nao pode alterar flags, score, veredito ou textos finais; so pode entrar em prefill/autoclassificacao quando correlacionada por mesmo CNJ confirmado por Judit/BigDataCorp.

## Non-Goals
- Nao permitir que DJEN isolado por nome/comunicacao altere a decisao deterministica em `computeAutoClassification()`.
- Nao permitir que a IA altere flags, score ou veredito automaticamente.
- Nao fazer backfill automatico de casos `DONE`.
- Nao remover campos legados do banco nesta rodada; eles podem existir para compatibilidade/auditoria, mas nao devem comandar a nova experiencia principal.
- Nao alterar `reportBuilder` ou relatorio publico nesta rodada, salvo se teste revelar regressao direta.
- Nao alterar a semantica deterministica das flags ao tornar DJEN clicavel; mudanca deve ser apenas de navegacao/inspecao de evidencias.

## Decisions
- A nova IA deve ser dedicada: `aiClassificationReview`, nao uma adaptacao de `aiStructured`.
- A IA revisora valida a coerencia das flags (`criminalFlag`, `laborFlag`, `warrantFlag`) e retorna `AGREE`, `AGREE_WITH_CAUTION`, `DISAGREE` ou `INSUFFICIENT_DATA` por eixo.
- O prompt deve tratar match por CPF/hasExactCpfMatch/isDirectCpfMatch como fato forte.
- DJEN e achados por nome entram como evidencia complementar/ambigua, nao como motor principal da classificacao.
- `aiHomonymStructured`, quando existir, vira insumo consultivo para interpretar ambiguidades.
- `prefillNarratives` continua podendo alimentar campos finais legados, mas nao deve aparecer como bloco principal da aba `Identificacao`.
- A UI deve esconder a antiga `Síntese da análise automática` e rebaixar dados tecnicos da IA antiga para detalhes tecnicos, se mantidos.
- Resposta invalida da IA revisora nao pode ser persistida como `aiClassificationReviewOk=true` nem aparecer como JSON bruto na UI.
- Prompt da IA revisora deve produzir portugues operacional; enums e nomes internos podem existir apenas em campos controlados do JSON, nunca em texto livre.
- Comunicacoes DJEN em abas criminal/trabalhista devem ser clicaveis sem quebrar os modais existentes de BigDataCorp/Judit.
- Ausencia de achado em fonte consultada e concluida e evidencia negativa valida para aquela fonte.
- `AGREE_WITH_CAUTION` exige motivo concreto por eixo: falha/parcialidade de fonte relevante, divergencia material, homonimo, papel ambiguo ou conflito entre achado e flag.
- Ressalva generica sobre cobertura futura ou bases externas nao deve aparecer quando as fontes configuradas retornaram sem apontamento.
- Tags consultivas/de revisao (`Precisa de revisao manual`, equivalentes) nao sao resultado final criminal valido para conclusao; o analista deve escolher `Sem apontamento`, `Com apontamento` ou `Inconclusivo`.
- DJEN por nome/comunicacao isolada e fonte consultiva. Para impactar autoclassificacao ou texto final, a comunicacao deve ter o mesmo CNJ de processo confirmado por CPF em Judit ou BigDataCorp.

## Phases

### Phase 0: Persistent Planning
- [x] Rodar `session-catchup.py`.
- [x] Ler `task_plan.md`, `findings.md`, `progress.md`.
- [x] Registrar novo escopo e erro de caminho da skill.

### Phase 1: Backend Schema And Prompt
- [x] Criar `AI_CLASSIFICATION_REVIEW_JSON_SCHEMA`.
- [x] Criar sanitizacao/validacao/parser para `aiClassificationReview`.
- [x] Criar `AI_CLASSIFICATION_REVIEW_SYSTEM_MESSAGE`.
- [x] Criar `buildAiClassificationReviewPrompt(caseData)` com payload enxuto e estruturado.
- [x] Exportar helpers em `exports.__test`.

### Phase 2: Backend Execution And Persistence
- [x] Criar `runAiClassificationReviewAnalysis()`.
- [x] Criar `buildAiClassificationReviewUpdatePayload()`.
- [x] Integrar no fluxo `runAutoClassifyAndAi()` apos homonimos, substituindo a IA geral como experiencia principal.
- [x] Integrar em `rerunAiAnalysis` para atualizar a nova analise em reprocessamentos.
- [x] Preservar campos legados sem usa-los como UI principal.

### Phase 3: Backend Tests
- [x] Testar schema valido/invalido.
- [x] Testar prompt contem autoclassificacao, cobertura, evidencias fortes e ambiguas.
- [x] Testar prompt nao trata CPF mascarado como ausencia de CPF.
- [ ] Testar caso com vitima/testemunha como possivel erro se flag criminal positiva.
- [x] Testar DJEN fraco como evidencia complementar.

### Phase 4: Frontend UX
- [x] Criar helpers/componentes para renderizar `aiClassificationReview`.
- [x] Remover bloco global `✦ Síntese da análise automática`.
- [x] Reorganizar `Identificacao do candidato` em identidade, verificacao, analise assistida, evidencias e dados tecnicos.
- [x] Rebaixar/remover visual principal de `Análise automática GPT-5.4-nano JSON`.
- [x] Manter a acao `Re-analisar` funcionando via pipeline.

### Phase 5: Frontend Tests
- [x] Atualizar `CasoPage.test.jsx` para nova analise assistida.
- [x] Remover fluxo visual de aplicar sugestao IA legada; teste agora valida que a revisao consultiva nao chama `setAiDecisionByAnalyst`.
- [x] Garantir que caso sem `aiClassificationReview` tem fallback deterministico legivel.

### Phase 6: Verification
- [x] `npm test -- src/portals/ops/CasoPage.test.jsx`.
- [x] `npm test`.
- [x] `npm run lint`.
- [x] `npm run build`.
- [x] `cd functions && npm test`.
- [x] `cd functions && npm run lint`.
- [x] `git diff --check`.
- [x] `graphify update .`.

### Phase 7: AI Review Hardening
- [x] Atualizar prompt `AI_CLASSIFICATION_REVIEW_SYSTEM_MESSAGE` para portugues operacional, sem nomes internos em textos livres, sem JSON bruto e com semantica clara de `evidenceStrength`.
- [x] Adicionar `response_format` JSON para `runAiClassificationReviewAnalysis()` quando chamar OpenAI.
- [x] Remover fallback bruto de `extractFallbackAiClassificationReviewResponse()`; resposta quebrada deve virar `ok=false` ou fallback seguro sem payload cru.
- [x] Sanitizar/rejeitar textos contaminados por JSON, schema, nomes internos ou caracteres de controle.
- [x] Blindar `CasoPage.jsx` para nao renderizar `summary`/rationales/listas contaminadas e cair em fallback deterministico seguro.
- [x] Humanizar cobertura/divergencia/valores ausentes na UI operacional.
- [x] Ocultar redes sociais vazias na aba de identificacao.

### Phase 8: DJEN Clickable Modal
- [x] Mapear como BigDataCorp/Judit ja abrem modal de processos em `CasoPage.jsx`.
- [x] Localizar renderizacao de `Comunicacoes judiciais DJEN (...)` nas abas criminal e trabalhista.
- [x] Criar agrupamento por CNJ/processo para DJEN e abrir modal ao clicar no item/processo.
- [x] Reutilizar ou adaptar modal existente para listar todas as movimentacoes/comunicacoes daquele processo, preservando dados essenciais: data, classe, area, polo, tipo de comunicacao, texto/resumo.
- [x] Garantir acessibilidade basica: botao clicavel, teclado, titulo do modal, fechamento sem quebrar modais existentes.

### Phase 9: Tests And Deploy
- [x] Testes backend anti-regressao para parser/prompt/sanitizacao da IA revisora.
- [x] Testes frontend para JSON bruto oculto, labels humanizados, redes sociais vazias ocultas e DJEN modal clicavel.
- [x] Rodar verificacoes focadas.
- [x] Rodar suite completa raiz e functions, lint, build e diff-check.
- [x] Rodar `graphify update .`.
- [x] Deploy Firebase Functions.
- [x] Deploy Vercel producao e verificar alias.

### Phase 10: Axis-Specific AI Review Semantics
- [x] Recuperar contexto persistido e revisar diff/planning files.
- [x] Adicionar testes backend para negativo trabalhista/mandado bem coberto sem ressalva generica.
- [x] Adicionar testes frontend para garantir que cautela criminal nao contamina trabalhista/mandado.
- [x] Criar contexto deterministico por eixo para a IA revisora: criminal, trabalhista, mandado e identidade.
- [x] Incluir o contexto por eixo no prompt da IA revisora.
- [x] Aplicar guardrails backend pos-IA para remover cautela generica sem motivo objetivo do eixo.
- [x] Corrigir fallback/guardrails frontend para respeitar cautela especifica por eixo.
- [x] Rodar testes focados backend/frontend.
- [x] Rodar suites completas, lint, build, diff-check e graphify.

### Phase 11: Incident - Criminal Review Tag Cannot Conclude
- [x] Recuperar contexto persistido e revisar planning/diff/grafo.
- [x] Consultar caso real `v5ef9RJ0wBmQLUz4HLf0` e identificar campos incorretos.
- [x] Localizar origem da tag `Precisa de revisao manual` e fluxo de conclusao.
- [x] Adicionar validação frontend para bloquear conclusao com tag criminal nao-final.
- [x] Adicionar validação backend em `concludeCaseByAnalyst` para rejeitar tag criminal nao-final.
- [x] Corrigir dados do caso real para `Sem apontamento`/flag negativa conforme evidencia.
- [x] Adicionar testes anti-regressao frontend/backend.
- [x] Rodar verificacoes focadas e completas.
- [x] Atualizar graphify/planning.

### Phase 12: DJEN Consultivo Sem Impacto Isolado
- [x] Adicionar testes backend para DJEN criminal isolado nao alterar `criminalFlag` nem notas finais.
- [x] Adicionar testes backend para DJEN trabalhista isolado nao alterar `laborFlag` nem notas finais.
- [x] Adicionar testes backend para DJEN positivo com muitos/poucos homonimos permanecer consultivo.
- [x] Adicionar testes de prefill para nao listar DJEN isolado sem CNJ confirmado.
- [x] Permitir DJEN em prefill quando correlacionado ao mesmo CNJ confirmado por BigDataCorp/Judit.
- [x] Implementar filtro de comunicacoes DJEN por CNJ confirmado em `computeAutoClassification()`.
- [x] Implementar filtro de comunicacoes DJEN por CNJ confirmado em `buildDetCriminalNotes()` e `buildDetLaborNotes()`.
- [x] Rodar testes focados, suites completas, lint, build e diff-check.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `python "$env:USERPROFILE\\.opencode\\skills\\planning-with-files\\scripts\\session-catchup.py"` falhou com arquivo nao encontrado | 1 | Skill instalada em `~/.config/opencode`; repetir com caminho real `~/.config/opencode/skills/planning-with-files/scripts/session-catchup.py` |
| `session-catchup.py` com caminho real nao retornou output | 1 | Sem contexto pendente; seguir com leitura dos planning files e `git diff --stat` |
| `CasoPage.test.jsx` falhou procurando `Evidencias ambiguas` apos remover bloco `aiStructured` | 1 | Atualizar expectativa para `Achados ambiguos` do card deterministico de cobertura |
| `CasoPage.test.jsx` falhou procurando texto de `aiStructured.evidenciasAmbiguas` removido da UI principal | 2 | Atualizar teste para `ambiguityNotes` realmente exibido |
| `CasoPage.test.jsx` encontrou texto duplicado de `ambiguityNotes` | 3 | Usar `getAllByText` para validar presenca sem assumir unicidade |
| `npm run lint` na raiz analisou `.vercel/output/static` e reportou erros de bundles gerados | 1 | Adicionar `.vercel` e `graphify-out` em `globalIgnores` do ESLint, mantendo `dist` ignorado |
| `python "$env:USERPROFILE\.opencode\skills\planning-with-files\scripts\session-catchup.py"` falhou novamente nesta rodada | 1 | Usar caminho real `~/.config/opencode/skills/planning-with-files/scripts/session-catchup.py` |
| `CasoPage.test.jsx` falhou porque `getByText('Cobertura alta')` encontrou duas ocorrencias validas | 1 | Trocar para `getAllByText(...).length > 0`, pois a label pode aparecer no resumo de evidencias e na leitura tecnica |
| `CasoPage.test.jsx` falhou ao clicar `Criminal`/`Trabalhista` porque os textos tambem aparecem na analise assistida | 1 | Usar `getAllByText(...)[0]` para clicar na aba da stepper |
| `CasoPage.test.jsx` nao encontrou botao DJEN dentro do `<details>` aberto porque o conteudo dependia de `openedSections` | 1 | Remover lazy render apenas do bloco DJEN para garantir conteudo clicavel e evitar dessicronia do evento `toggle` |
| `CasoPage.test.jsx` falhou por textos DJEN/tipo de comunicacao duplicados entre pipeline, tabela e modal | 1 | Usar `getAllByText(...).length > 0` nas assercoes de presenca |
| `npm run lint` e `functions npm run lint` falharam com `no-control-regex` nas regexes de caracteres de controle | 1 | Substituir regex por filtragem via `charCodeAt`, preservando tab/newline/CR |
| `session-catchup.py` nao retornou output nesta retomada | 1 | Prosseguir com `git diff --stat` e leitura dos planning files existentes |
| Teste frontend novo esperava 1 ressalva, mas o guardrail antigo ainda mostrava 3 | 1 | Implementar contexto por eixo e impedir promocao global de `AGREE` para `AGREE_WITH_CAUTION` |
| Teste frontend novo ficou sem ressalva criminal porque o fixture nao trazia conflito criminal por fonte | 2 | Ajustar fixture com Judit criminal positivo e BigDataCorp criminal negativo para representar divergencia criminal real |
| MCP Firestore falhou com timeout ao consultar o caso real | 1 | Usar REST Firestore com token da Firebase CLI e retry em `firebase login:list` |
| `firebase login:list --json` retornou timeout de forma intermitente | 1 | Adicionar loop de retry antes de usar o access token |
| Teste frontend da Phase 11 procurava mensagem de checklist fora da etapa de revisao | 1 | Validar o bloqueio pelo botao `Concluir` do header desabilitado, que e o comportamento imediato esperado |
| `npm run lint` na raiz falhou com `ENOENT` em `vite.config.js.timestamp-...mjs` | 1 | Reexecutar `npm run lint`; o arquivo temporario sumiu e o lint passou |

## Current Status
- Phase 7 (`AI Review Hardening`) concluida localmente.
- Phase 8 (`DJEN Clickable Modal`) concluida localmente.
- Testes completos, lint, build, diff-check e graphify passaram.
- Phase 10 concluida localmente: revisao especializada por eixo implementada, testes completos/lint/build/diff-check/graphify passaram.
- Phase 11 concluida localmente: bloqueio frontend/backend para flag criminal consultiva implementado, caso real corrigido nos documentos `cases`, `publicResult/latest` e `clientCases`, testes/lint/build/diff-check/graphify passaram.
- Phase 12 concluida localmente: DJEN isolado ficou consultivo e nao impacta flags/prefill; testes/lint/build/diff-check passaram.
- Deploy das mudancas Phase 12 segue pendente; nao foi executado nesta fase.

### Phase 15: Politica Cliente, Checklist Local E Modais De Conclusao
- [x] Carregar skill `planning-with-files`.
- [x] Rodar catchup inicial; caminho `~/.opencode` falhou porque a skill real esta em `~/.config/opencode`.
- [x] Rodar catchup pelo caminho correto; sem output.
- [x] Ler `task_plan.md`, `findings.md`, `progress.md` e `graphify-out/GRAPH_REPORT.md`.
- [x] Auditar codigo real antes de implementar: `riskCalculator`, `concludeCaseByAnalyst`, `selectTopProcessos`, `CasoPage`, `Modal`, testes existentes.
- [x] Fase 15.1: Corrigir `laborSeverity` no `riskCalculator` backend/frontend com testes espelhados.
- [x] Fase 15.2: Implementar politica obrigatoria do cliente no backend com data de corte, override confirmado e justificativa.
- [x] Fase 15.3: Implementar checklist manual local por fase usando `sessionStorage` e hook dedicado.
- [x] Fase 15.4: Implementar modais reutilizando `Modal`: checklist por fase, conclusao final e veredito divergente.
- [x] Fase 15.5: Integrar bloqueio local nos dois botoes de conclusao e atalho `Ctrl+Enter`.
- [x] Fase 15.6: Adicionar testes backend/frontend e validar que checklist local nao substitui regras backend.
- [x] Fase 15.7: Rodar suites, lint, build, diff-check e `graphify update .`.
- [x] Fase 15.8: Deploy backend primeiro e frontend depois, se todas as verificacoes passarem.

#### Phase 15 Decisions
- Checklist manual sera local por fase/aba usando `sessionStorage` com chave `compliancehub:case-checklist:{caseId}`.
- Checklist manual nao sera persistido no backend e nao criara AuditLog nesta etapa.
- Checklist manual bloqueia apenas visualmente/localmente a conclusao.
- Regras criticas de veredito/override continuam obrigatorias no backend.
- Casos antigos nao serao reprocessados; novas regras valem apenas apos data de corte do deploy.
- Nao havera feature flag nesta etapa.
- Execucao sera passo a passo, com testes depois de cada fase relevante.

### Phase 13: Resumo Trabalhista Com Contraparte E Status Inteligente
- [x] Auditar todos os casos reais com `laborFlag=POSITIVE` em modo somente leitura.
- [x] Confirmar formatos normalizados de Judit, BigDataCorp e Escavador para processos trabalhistas.
- [x] Definir padrao final aprovado para bloco trabalhista: `Status processual`, `Papel do candidato`, `Parte reclamada/passiva`, datas e `Ultimo andamento`.
- [x] Adicionar testes de regressao antes da implementacao.
- [x] Preservar `parties`/`allParties`/`movements` em `selectTopProcessos()`.
- [x] Implementar merge inteligente por CNJ para status, datas, ultimo andamento e partes.
- [x] Implementar formatacao trabalhista especifica sem alterar formato criminal/mandado.
- [x] Filtrar contraparte para remover candidato, nomes curtos e papeis neutros/tecnicos.
- [x] Rodar testes focados e suites completas.
- [x] Atualizar graphify apos alteracoes de codigo.

### Phase 14: Remover Contexto Profissional Do Resumo Trabalhista
- [x] Confirmar que o bloco profissional cadastral e gerado em `buildDetLaborNotes()` a partir de campos BigDataCorp `occupation_data`.
- [x] Decidir escopo: remover apenas de `laborNotes`, preservando dados profissionais e resumo executivo.
- [x] Atualizar testes para garantir ausencia de `Contexto profissional cadastral`, `Ultimo empregador` e `dados profissionais nao disponiveis` em `laborNotes`.
- [x] Remover bloco morto de contexto profissional em `buildDetLaborNotes()`.
- [x] Rodar testes focados, suites completas, lint, build e diff-check.
- [x] Atualizar graphify apos alteracoes de codigo.
