# Provider contract

## Interface conceitual

```ts
interface ProviderAdapter {
  providerId: string;
  query(input: ProviderQueryInput): Promise<ProviderQueryResult>;
  normalize(snapshot: RawSnapshot): Promise<ProviderRecord[]>;
  health(): Promise<ProviderHealth>;
}
```

## ProviderQueryInput

Campos:

- `tenantId`.
- `subjectId`.
- `document`.
- `documentType`.
- `datasets`.
- `purpose`.
- `requestedBy`.
- `caseId`.
- `forceRefresh`.
- `idempotencyKey`.

## ProviderQueryResult

Campos:

- `rawSnapshotId`.
- `status`.
- `provider`.
- `endpoint`.
- `datasets`.
- `queriedAt`.
- `durationMs`.
- `costEstimate`.
- `retryCount`.
- `error`.

## RawSnapshot

Campos:

- `id`.
- `tenantId`.
- `provider`.
- `endpoint`.
- `datasets`.
- `request`.
- `response`.
- `statusCode`.
- `providerStatus`.
- `requestHash`.
- `responseHash`.
- `payloadVersion`.
- `adapterVersion`.
- `queriedAt`.
- `expiresAt`.

## ProviderRecord

Campos:

- `id`.
- `rawSnapshotId`.
- `provider`.
- `recordType`.
- `providerRecordKey`.
- `normalized`.
- `normalizerVersion`.
- `confidence`.
- `errors`.

## Politicas

- Toda consulta deve ter `idempotencyKey`.
- Todo payload deve ter hash.
- Todo normalizer deve ter versao.
- Todo fato deve apontar para `sourceSnapshotId`.
- Toda exibicao ao cliente deve passar por `visibility`.

## BigDataCorp como primeiro adapter

O adapter atual em `functions/adapters/bigdatacorp.js` deve ser encapsulado neste contrato. O normalizer atual em `functions/normalizers/bigdatacorp.js` deve passar a emitir `ProviderRecord` e `Evidence`, nao apenas campos finais no caso.

