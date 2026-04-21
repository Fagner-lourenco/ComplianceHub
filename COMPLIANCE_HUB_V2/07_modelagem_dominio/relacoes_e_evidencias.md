# Relacoes e evidencias

## Tipos de relacao

- `person_owns_company`.
- `person_manages_company`.
- `person_related_to_person`.
- `company_related_to_company`.
- `person_party_in_lawsuit`.
- `company_party_in_lawsuit`.
- `person_has_address`.
- `company_has_address`.
- `person_has_phone`.
- `person_has_email`.
- `subject_has_provider_record`.
- `risk_signal_supported_by_evidence`.
- `decision_supported_by_signal`.

## Modelo de evidencia

Cada evidencia deve responder:

- Qual provider gerou?
- Qual endpoint/dataset?
- Quando foi consultado?
- Qual payload bruto sustenta?
- Qual normalizer transformou?
- Qual campo/fato foi extraido?
- Qual grau de confianca?
- Pode aparecer para cliente?

## EvidenceItem

Campos recomendados:

- `id`.
- `tenantId`.
- `subjectId`.
- `entityId`.
- `provider`.
- `sourceSnapshotId`.
- `providerRecordId`.
- `kind`.
- `title`.
- `summary`.
- `rawPath`.
- `normalizedValue`.
- `observedAt`.
- `ingestedAt`.
- `confidence`.
- `visibility`.
- `createdBy`.

## Proveniencia por decisao

Uma decisao nunca deve ser apenas:

```txt
verdict = NOT_RECOMMENDED
```

Ela deve ser:

```txt
verdict = NOT_RECOMMENDED
riskScore = 92
reasons = [...]
supportingSignalIds = [...]
supportingEvidenceIds = [...]
reviewedBy = analystId
reviewedAt = timestamp
reportSnapshotId = id
```

## Relatorio

O relatorio deve referenciar:

- `decisionId`.
- `reportSnapshotId`.
- `publicResultHash`.
- `evidenceIds` permitidos.
- `sections`.
- `buildVersion`.
- `generatedAt`.

