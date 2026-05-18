# Auditoria Completa do Fluxo Principal - ComplianceHub

## Objetivo
Realizar auditoria completa de todos os fluxos principais do ComplianceHub, identificar bugs críticos, e corrigi-los em sequência antes do deploy de produção.

## Status Geral
- **Data início**: 2026-05-05
- **Fase atual**: Auditoria e Correção
- **Testes backend**: 358/358 passando (baseline)
- **Testes frontend**: 614/614 passando (baseline)

## Fluxos a Auditar

### Flow 1: Solicitação do Cliente [PENDENTE]
- [ ] Criação de caso via portal cliente
- [ ] Validação de CPF/nome
- [ ] Limites de submissão (daily/monthly)
- [ ] Notificação de nova solicitação
- [ ] Criação de candidato vinculado

### Flow 2: Pipeline de Enriquecimento [PENDENTE]
- [ ] Gate de identidade (Judit/FonteData)
- [ ] Consulta Judit (processos, mandados, execução)
- [ ] Cross-validação Escavador (condicional)
- [ ] Enriquecimento FonteData (financeiro, identidade)
- [ ] KYC BigDataCorp (processos, profissão)
- [ ] Comunicações DJEN (condicional)
- [ ] Circuit breaker em todas as APIs

### Flow 3: Análise do Analista [PENDENTE]
- [ ] Atribuição de caso
- [ ] Prefill IA (determinístico + AI)
- [ ] Review e ajuste de narratives
- [ ] Conclusão do caso (concludeCaseByAnalyst)
- [ ] Cálculo de campos derivados
- [ ] Publicação de publicResult/latest

### Flow 4: Geração de Relatórios [PENDENTE]
- [ ] Geração de HTML canônico
- [ ] Sanitização de HTML público
- [ ] Criação de publicReport (token)
- [ ] Verificação de TTL/expiração
- [ ] Revogação quando sair de DONE
- [ ] Renderização no frontend (iframe)
- [ ] Exportação PDF

### Flow 5: Autenticação e Autorização [PENDENTE]
- [ ] Login Firebase Auth
- [ ] Custom claims (role, tenantId)
- [ ] RBAC (8 roles, 10 permissions)
- [ ] Firestore rules (cross-tenant, role escalation)
- [ ] Portal guards (ops vs client)

### Flow 6: Notificações [PENDENTE]
- [ ] Criação de notificações
- [ ] Entrega em tempo real
- [ ] Marcação de leitura
- [ ] Templates e variáveis

### Flow 7: Exportações [PENDENTE]
- [ ] Exportação batch
- [ ] CSV consolidado
- [ ] PDF individual
- [ ] Histórico de exportações

### Flow 8: Modo Demo [PENDENTE]
- [ ] Dados mock (cases, candidates)
- [ ] Rotas /demo/*
- [ ] Simulação de auth/tenant
- [ ] Relatórios demo

## Bugs Conhecidos (Pré-Auditoria)
1. **Mojibake em relatórios existentes**: HTML armazenado antes da normalização Unicode
2. **ID vazio no footer do relatório**: Reports gerados antes do fix de `id: caseId`
3. **CPF redundante**: "CPF regular" aparece duplicado no campo CPF

## Checklist de Correção
- [ ] Corrigir mojibake em relatórios armazenados
- [ ] Corrigir ID vazio em relatórios antigos
- [ ] Corrigir formato do CPF no reportBuilder
- [ ] Verificar consistência frontend/backend reportBuilder
- [ ] Validar todos os testes após correções
- [ ] Deploy para produção

## Métricas de Sucesso
- Todos os testes passando (backend + frontend)
- Zero mojibake em novos relatórios
- ID do caso presente em todos os relatórios
- CPF formatado corretamente sem redundância

---

# Sessao 2026-05-18 - Classificacao Automatica e SLA Madero

## Goal
Corrigir a classificacao automatica para que retorno zero de fontes concluídas seja tratado como sem apontamento, corrigir o SLA baseado no timestamp real, eliminar o erro de rerun que grava sentinelas Firestore em metadata, e corrigir travamentos/erros confirmados no pipeline Madero.

## Current Phase
Phase 5: Delivery

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirmar regra de negocio com usuario: zero retorno concluido = sem apontamento.
- [x] Levantar dados de producao Madero sem expor nomes/CPFs.
- [x] Identificar pontos de codigo afetados.
- [x] Levantar casos Madero com providers nao terminais ou pipeline incompleto.
- **Status:** complete

### Phase 2: Plan & Tests
- [x] Planejar alteracao minima em classificacao, SLA e audit metadata.
- [x] Adicionar testes que reproduzam os bugs.
- **Status:** complete

### Phase 3: Implementation
- [x] Corrigir classificacao de zero evidencia concluida.
- [x] Preservar timestamp completo para SLA no frontend.
- [x] Sanitizar metadata de AI rerun.
- [x] Corrigir erros de processamento do pipeline confirmados por logs/dados Madero.
- **Status:** complete

### Phase 4: Verification
- [x] Rodar testes backend focados.
- [x] Rodar testes frontend focados.
- [x] Rodar suites relevantes/build se necessario.
- **Status:** complete

### Phase 5: Delivery
- [x] Resumir arquivos alterados, testes e riscos residuais.
- [x] Preparar auditoria read-only para escopo de backfill Madero.
- [x] Fazer deploy code-only sem backfill/rerun de casos concluidos.
- [x] Auditar textos de resumo/notas e publicResult/latest Madero em modo read-only.
- **Status:** complete

## Key Questions
1. Quando Judit/BigDataCorp retornam zero processos com status terminal, isso deve virar negativo? Sim, por regra do usuario.
2. Inconclusivo deve ficar para quais casos? Duvida de natureza, area, vinculo ao CPF/candidato, homonimia, falha/divergencia relevante ou apontamento ambiguo.
3. SLA deve usar qual timezone? Timestamp real do Firestore e exibicao em America/Sao_Paulo.
4. Ha travamento real de pipeline em Madero? A investigar por status nao-terminal/logs por caseId.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Preservar full ISO timestamp em `createdAt` mapeado | `getSlaStatus` precisa de hora real; filtros de data podem usar `createdDateKey` ou slice do ISO. |
| Nao classificar zero evidencia como `INCONCLUSIVE_LOW_COVERAGE` por si so | Usuario confirmou que zero retornado por fonte concluida significa sem apontamento. |
| Manter baixa cobertura como metadata possivel sem tornar flag inconclusiva | A UI pode mostrar qualidade de cobertura, mas o resultado criminal nao deve assustar o cliente se nao ha apontamento. |
| Sanitizar sentinelas Firestore antes de metadata nested | Firestore permite `FieldValue.delete()` apenas top-level em update/set merge. |
| Separar deploy/backfill como decisao explicita | Working tree inclui mudancas nao relacionadas e backfill altera dados de producao. |
| Nao alterar relatorios ja enviados | Casos `DONE`/publicResult existentes nao devem ser regravados sem aprovacao explicita. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `python ...\.opencode\...session-catchup.py` file not found | 1 | Reexecutado com caminho real `.config\opencode`. |

---

# Sessao 2026-05-18 - Coerencia de Narrativas Futuras

## Goal
Garantir que casos futuros preencham Resumo/notas criminal, trabalhista e mandado, Resumo executivo, Principais apontamentos e Justificativa final com textos seguros, didaticos e coerentes com as classificacoes, sem alterar relatorios ja concluidos/enviados.

## Current Phase
Phase 3: Verification complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirmar regras do usuario: texto seguro sem bloqueio; alerta operacional; contexto profissional pode continuar no trabalhista se rotulado; `NEGATIVE_PARTIAL` so para operacao; nao expor fonte/limitacao ao cliente.
- [x] Revisar fluxo `runAutoClassifyAndAi` -> `deterministicPrefill` -> `prefillNarratives` -> tela de revisao -> conclusao.
- **Status:** complete

### Phase 2: Implementation
- [x] Ajustar templates determinísticos para texto seguro e didatico.
- [x] Adicionar coerencia texto-vs-flag com alerta operacional sem bloqueio.
- [x] Ajustar testes de prefill/revisao para cobrir regressões.
- **Status:** complete

### Phase 3: Verification
- [x] Rodar testes backend focados.
- [x] Rodar testes frontend focados se UI/alerta mudar.
- [x] Rodar build/testes relevantes.
- [x] Atualizar graphify apos mudancas de codigo.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Nao alterar casos `DONE` antigos | Relatorios ja enviados devem permanecer intactos. |
| Corrigir apenas geracao futura e revisao operacional | Reduz risco em producao. |
| Nao bloquear conclusao por inconsistencia textual | Usuario pediu apenas texto seguro e alerta. |
| Nao expor fontes/limitacoes ao cliente em texto final | Cliente deve receber linguagem clara, sem limitações da ferramenta. |
