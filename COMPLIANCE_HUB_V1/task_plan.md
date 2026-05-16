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
