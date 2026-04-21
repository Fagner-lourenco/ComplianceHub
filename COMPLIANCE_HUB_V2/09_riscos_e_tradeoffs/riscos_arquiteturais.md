# Riscos arquiteturais

## Risco 1: continuar usando `cases` como data lake

Impacto: dificulta reuso de dados, auditoria por evidencia, grafo, monitoramento continuo e explicabilidade.

Mitigacao: separar `cases` de `subjects`, `entities`, `rawSnapshots`, `evidence`, `decisions`.

## Risco 2: relatorio publicado divergir da revisao

Impacto: risco juridico, reputacional e operacional.

Mitigacao: relatorio sempre gerado de `ReportSnapshot` imutavel, com hash do `publicResult` e `decisionId`.

## Risco 3: duplicacao de contratos

Impacto: portal cliente pode ver dados faltantes ou indevidos.

Mitigacao: contratos client-safe compartilhados/versionados e testes de regressao.

## Risco 4: dependencia excessiva da BigDataCorp

Impacto: custo, indisponibilidade e vendor lock-in.

Mitigacao: provider contract, cache, fallback, versionamento de payload e normalizacao independente.

## Risco 5: overengineering com rule builder cedo demais

Impacto: atraso sem ROI.

Mitigacao: comecar com `RiskSignal` codificado e explicavel; rule builder fica para V3.

## Risco 6: copiar Marble ou Ballerine sem aderencia

Impacto: produto perder diferencial brasileiro.

Mitigacao: usar apenas padroes arquiteturais e UX; manter dominio proprio.

## Risco 7: multi-tenant fraco

Impacto: vazamento de dados e violacao contratual.

Mitigacao: tenantId obrigatorio, regras centralizadas, testes de isolamento e visibility por item.

## Risco 8: cockpit bonito, mas improdutivo

Impacto: analista demora mais e erra mais.

Mitigacao: cockpit orientado a tarefas, evidencias relevantes, atalhos, resumo executivo e fila inteligente.

## Risco 9: custo operacional invisivel

Impacto: consultas duplicadas e margem baixa.

Mitigacao: cache, quotas, request ledger, custo por dataset e modulos por plano.

## Risco 10: governanca de dados insuficiente

Impacto: dificuldade de auditoria, LGPD e contratos.

Mitigacao: retention policy, classification, audit trail, finalidade da consulta e segregacao de visibilidade.

