# Modulos backend propostos

## `subjects`

Responsavel por representar o alvo da investigacao.

Inclui:

- PF.
- PJ.
- Documento principal.
- Alias.
- Dados declarados pelo cliente.

## `providers`

Contrato unico para provedores externos.

Inclui:

- Adapter.
- Rate limit.
- Retry.
- Credentials.
- Dataset selection.
- Request log.
- Health.

## `ingestion`

Orquestra consultas.

Inclui:

- Jobs idempotentes.
- Estado de execucao.
- Erros recuperaveis.
- Reprocessamento.

## `rawSnapshots`

Armazena payload bruto.

Inclui:

- Hash.
- Provider.
- Endpoint/dataset.
- Request metadata.
- Response metadata.
- Payload version.

## `normalization`

Transforma payload em registros normalizados.

Inclui:

- Provider records.
- Versao do normalizador.
- Erros de normalizacao.

## `entities`

Cria entidades canonicas.

Inclui:

- Person.
- Company.
- Lawsuit.
- Warrant.
- Address.
- Phone.
- Email.

## `evidence`

Guarda evidencias e fatos.

Inclui:

- EvidenceItem.
- Fact.
- Relationship.
- Confidence.
- Source references.

## `riskSignals`

Transforma evidencias em sinais.

Inclui:

- Criminal signal.
- Warrant signal.
- Labor signal.
- Corporate risk signal.
- Sanctions/PEP signal.
- Divergence signal.

## `decisioning`

Gera recomendacao explicavel.

Inclui:

- Decision.
- Score.
- Verdict.
- Reasons.
- Supporting evidence.
- Analyst override.

## `reports`

Materializa relatorios.

Inclui:

- ReportSnapshot.
- PublicReport.
- Token.
- Hash.
- Build version.
- Client-safe payload.

## `audit`

Auditoria operacional e de dados.

Inclui:

- AuditEvent.
- EvidenceAuditEvent.
- TenantAuditEvent.
- DecisionAuditTrail.

