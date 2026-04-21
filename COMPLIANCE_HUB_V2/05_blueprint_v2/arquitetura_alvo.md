# Arquitetura alvo da V2

## Camadas

```txt
apps/web
  -> client portal
  -> ops cockpit
  -> public report

backend
  -> cases
  -> subjects/entities
  -> providers
  -> ingestion jobs
  -> normalization
  -> evidence
  -> risk signals
  -> decisioning
  -> reports
  -> audit

data
  -> raw snapshots
  -> normalized provider records
  -> canonical entities
  -> facts
  -> relationships
  -> alerts
  -> report snapshots
```

## Principio arquitetural

O caso nao deve ser o banco de dados investigativo. O caso deve ser uma instancia operacional que referencia entidades, evidencias, sinais e decisoes.

## Fluxo alvo

```txt
Solicitacao
  -> Subject
  -> Provider jobs
  -> Raw snapshots
  -> Normalized records
  -> Canonical entities
  -> Evidence/facts/relationships
  -> Risk signals
  -> Analyst review
  -> Decision
  -> Report snapshot
  -> Client projection
```

## Persistencia recomendada

Curto prazo:

- Continuar com Firestore para reduzir risco.
- Criar novas colecoes normalizadas.
- Usar jobs idempotentes.

Medio prazo:

- Avaliar Postgres para relacionamentos, auditoria, queries complexas e grafo leve.
- Manter Firestore para UI realtime se fizer sentido.

## Jobs e filas

Opcoes:

- Curto prazo: Cloud Tasks ou colecao `jobs` no Firestore com idempotencia.
- Medio prazo: Pub/Sub/Cloud Tasks.
- Se migrar backend: BullMQ/Redis ou Cloud Run workers.

## Multi-tenant

Todo documento deve carregar:

- `tenantId`.
- `visibility`.
- `createdBy`.
- `source`.
- `dataClassification`.
- `retentionPolicy`.

Toda query deve ser tenant-scoped por padrao.

