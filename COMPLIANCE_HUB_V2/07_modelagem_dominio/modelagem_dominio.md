# Modelagem de dominio investigativo

## Principio

A V2 deve modelar investigacao como rede de entidades, fatos, evidencias, relacoes, sinais e decisoes.

O caso e apenas o envelope operacional.

## Tipos de objetos

- Entidade: algo que existe no mundo, como pessoa, empresa, processo, endereco.
- Fato: declaracao normalizada sobre uma entidade.
- Relacao: vinculo entre entidades.
- Evidencia: item que sustenta fato, relacao, sinal ou decisao.
- Sinal: interpretacao analitica.
- Decisao: recomendacao revisada.
- Projecao: versao segura para cliente/relatorio.

## Modelo macro

```txt
Subject
  -> Person/Company
  -> Identifiers
  -> ProviderRecords
  -> EvidenceItems
  -> Facts
  -> Relationships
  -> RiskSignals
  -> InvestigationCase
  -> AnalystReview
  -> Decision
  -> Report
```

## Visibilidade

Cada entidade/fato/evidencia deve ter:

- `visibility: internal | client_safe | report_safe | restricted`.
- `sensitivity`.
- `legalBasis`.
- `retentionPolicy`.

Isso previne vazamento de metodologia e dados internos.

