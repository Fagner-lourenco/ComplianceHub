# Entidades canonicas

## Subject

Proposito: alvo da analise solicitada.

Campos centrais: `id`, `tenantId`, `type`, `primaryDocument`, `declaredName`, `declaredData`, `createdFromCaseId`.

Origem: cliente ou analista.

Tipo: entidade operacional.

Exibicao ao cliente: sim, com sanitizacao.

## Person

Proposito: pessoa fisica canonica.

Campos: `id`, `cpf`, `name`, `birthDate`, `motherName`, `gender`, `nationality`, `aliases`, `confidence`.

Origem: BigDataCorp, cliente, outros providers.

Tipo: entidade.

Exibicao ao cliente: parcial.

## Company

Proposito: pessoa juridica canonica.

Campos: `id`, `cnpj`, `legalName`, `tradeName`, `status`, `openingDate`, `mainActivity`, `size`, `capital`, `addresses`.

Origem: BigDataCorp e outras fontes.

Tipo: entidade.

Exibicao ao cliente: sim quando relevante.

## EntityIdentifier

Proposito: documentos e identificadores.

Campos: `entityId`, `kind`, `value`, `country`, `status`, `sourceEvidenceId`.

Origem: providers e dados declarados.

Tipo: fato/identificador.

## Lawsuit

Proposito: processo judicial.

Campos: `cnj`, `court`, `area`, `class`, `subject`, `status`, `partyRole`, `distributionDate`, `lastMovementAt`.

Origem: BigDataCorp, Judit, Escavador, DJEN.

Tipo: entidade/fato juridico.

## CourtEvent

Proposito: andamento/movimento processual.

Campos: `lawsuitId`, `date`, `title`, `description`, `source`, `isRelevant`.

Origem: Judit, Escavador, DJEN.

Tipo: evento.

## Warrant

Proposito: mandado/prisao/ordem judicial.

Campos: `type`, `status`, `court`, `caseNumber`, `issuedAt`, `expiresAt`, `details`, `active`.

Origem: Judit, FonteData, BigDataCorp se aplicavel.

Tipo: fato critico/evidencia.

## CorporateRole

Proposito: papel societario/administrativo.

Campos: `personId`, `companyId`, `role`, `since`, `until`, `sharePercentage`, `source`.

Origem: BigDataCorp.

Tipo: relacao.

## Shareholding

Proposito: participacao societaria.

Campos: `holderEntityId`, `companyId`, `percentage`, `capital`, `sourceEvidenceId`.

Origem: BigDataCorp.

Tipo: relacao/fato.

## Evidence

Proposito: sustentar fatos, sinais e decisoes.

Campos: `id`, `sourceSnapshotId`, `providerRecordId`, `summary`, `rawPointer`, `confidence`, `observedAt`, `ingestedAt`, `visibility`.

Origem: qualquer provider ou revisao humana.

Tipo: evidencia.

## RiskSignal

Proposito: interpretacao analitica.

Campos: `kind`, `severity`, `scoreImpact`, `reason`, `supportingEvidenceIds`, `confidence`, `status`.

Origem: motor analitico.

Tipo: resumo analitico.

## Decision

Proposito: decisao/recomendacao final.

Campos: `verdict`, `riskScore`, `riskLevel`, `summary`, `reasons`, `analystId`, `reviewedAt`, `supportingSignalIds`, `overrideReason`.

Origem: IA/motor + analista.

Tipo: decisao.

