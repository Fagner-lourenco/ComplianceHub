# Resumo executivo da V2

## Decisao principal

ComplianceHub V2 deve ser uma arquitetura propria, inspirada parcialmente por Marble e Ballerine, mas nao baseada diretamente em nenhum dos dois.

## O que o ComplianceHub e hoje

Uma plataforma operacional de due diligence/background check com:

- Portal cliente.
- Portal operacional.
- Casos.
- Enriquecimento por provedores.
- Revisao humana.
- IA assistiva.
- Auditoria.
- Relatorio publico.

## Estagio de maturidade

V1.5 operacional. Ja e vendavel, mas ainda nao e uma plataforma investigativa completa.

## O que Marble resolve melhor

- Decisioning.
- Case management.
- Screening.
- Continuous monitoring.
- Data model.
- Inboxes/events.
- Observabilidade e filas.

## O que Ballerine resolve melhor

- Workflow runtime.
- KYC/KYB.
- Collection flow.
- Documentos.
- Manual review.
- Backoffice por entidades.
- Plugin/workflow architecture.

## O que nenhum resolve bem para nosso caso

- Investigacao brasileira CPF/CNPJ-first.
- BigDataCorp como fonte principal.
- Processos/mandados/contexto juridico brasileiro como dominio central.
- Relatorio comercial seguro com revisao humana no formato do ComplianceHub.
- Portal cliente simples para solicitacao, acompanhamento e entrega.

## V2 recomendada

Uma plataforma investigativa orientada a:

- Entidades.
- Evidencias.
- Relacoes.
- Sinais.
- Decisoes.
- Relatorios.
- Auditoria.

Com BigDataCorp-first, mas provider-agnostic por contrato.

## Quick wins

- Modularizar publicacao/relatorio.
- Criar contratos compartilhados.
- Materializar snapshot imutavel de relatorio.
- Criar raw snapshots BigDataCorp.
- Criar evidence items iniciais.
- Decompor `CasoPage`.
- Melhorar portal cliente sem expor detalhes internos.

