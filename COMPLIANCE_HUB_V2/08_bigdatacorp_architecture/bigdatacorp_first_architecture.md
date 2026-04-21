# BigDataCorp-first architecture

## Objetivo

Transformar a BigDataCorp no provedor principal da V2 sem acoplar o dominio do ComplianceHub ao payload da BigDataCorp.

## Principio central

Nunca usar payload bruto diretamente no portal, relatorio ou decisao.

Fluxo correto:

```txt
BigDataCorp response
  -> RawSnapshot
  -> ProviderRecord
  -> NormalizedFacts
  -> CanonicalEntities
  -> Evidence
  -> RiskSignals
  -> Decision
  -> ReportSnapshot
```

## Camadas

### Raw

Armazena resposta bruta.

Campos:

- `provider`.
- `endpoint`.
- `datasets`.
- `requestHash`.
- `responseHash`.
- `payload`.
- `status`.
- `queriedAt`.
- `credentialsRef`.
- `costMetadata`.

### Normalized provider records

Transforma blocos do payload em registros previsiveis.

Exemplos:

- `bdc_basic_data_record`.
- `bdc_process_record`.
- `bdc_kyc_record`.
- `bdc_company_record`.
- `bdc_relationship_record`.

### Canonical

Converte registros para dominio proprio:

- Person.
- Company.
- Lawsuit.
- Warrant.
- Sanction.
- PepRecord.
- Relationship.

### Analytical

Gera sinais:

- CPF divergente.
- Processo criminal ativo.
- Mandado ativo.
- PEP.
- Sanction.
- Empresa relacionada inativa.
- Vinculo societario relevante.
- Divergencia entre fontes.

### Investigative

Organiza:

- Dossie.
- Timeline.
- Grafo.
- Evidencias.
- Decisao.
- Relatorio.

## Deduplicacao

Chaves sugeridas:

- Pessoa: CPF normalizado.
- Empresa: CNPJ normalizado.
- Processo: CNJ normalizado.
- Mandado: provider + court + caseNumber + type + issuedAt.
- Endereco: hash normalizado de logradouro/numero/cidade/UF/CEP.
- Telefone/e-mail: valor normalizado.
- Relacao societaria: holder + company + role + period.

## Reconciliacao

Quando dois providers divergirem:

- manter ambos os fatos.
- criar `providerDivergence`.
- atribuir confianca.
- exigir revisao humana se impacto for alto.

## Resultado esperado

A V2 deve conseguir responder:

- Esta conclusao veio de qual dataset?
- Quando consultamos?
- Qual payload sustentou?
- Qual normalizador extraiu?
- O analista revisou?
- Isso pode ser mostrado ao cliente?

