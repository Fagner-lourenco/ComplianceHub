# Arquitetura implementavel da V2

## 1. Principio arquitetural

A V2 deve ser implementada sem reescrever a V1 inteira.

Principio:

> **Manter a V1 operando, criar novas fronteiras de dominio e migrar responsabilidades por projecoes, snapshots e contratos.**

## 2. Arquitetura alvo em uma frase

ComplianceHub V2 deve ter:

- dominio operacional para casos e revisao;
- dominio investigativo para sujeitos, entidades, evidencias, fatos e relacoes;
- dominio analitico para sinais e decisoes;
- dominio de publicacao para report snapshots e projecoes cliente-safe;
- camada provider-first para BigDataCorp e demais fontes;
- trilha de auditoria em todas as transicoes relevantes.

## 3. Fronteiras principais

### 3.1 Operacional

Responsavel por:

- solicitacoes;
- casos;
- filas;
- tarefas;
- status;
- revisao;
- aprovacoes;
- devolucao ao cliente.

Entidades:

- `InvestigationCase`;
- `ReviewTask`;
- `AnalystReview`;
- `CaseAssignment`;
- `CaseStatusEvent`.

Na transicao:

- `cases` atual continua como base operacional;
- novos campos devem referenciar `subjectId`, `decisionId`, `reportSnapshotId`.

### 3.2 Investigativo

Responsavel por:

- sujeitos;
- pessoas;
- empresas;
- identificadores;
- evidencias;
- fatos;
- relacoes;
- timeline.

Entidades:

- `Subject`;
- `Person`;
- `Company`;
- `EntityIdentifier`;
- `EvidenceItem`;
- `Fact`;
- `Relationship`;
- `TimelineEvent`.

### 3.3 Provider/data

Responsavel por:

- conexao com BigDataCorp e demais providers;
- request ledger;
- raw snapshots;
- retries;
- rate limit;
- normalizacao;
- versionamento de payload;
- provenance.

Entidades:

- `ProviderRequest`;
- `RawSnapshot`;
- `ProviderRecord`;
- `ProviderDatasetVersion`;
- `NormalizerVersion`.

### 3.4 Analitico/decisao

Responsavel por:

- risk signals;
- score;
- severidade;
- divergencias;
- veredito sugerido;
- decisao final;
- justificativa.

Entidades:

- `RiskSignal`;
- `SignalEvaluation`;
- `Decision`;
- `DecisionRevision`;
- `DecisionEvidenceLink`.

### 3.5 Reporting/publicacao

Responsavel por:

- composicao de relatorio;
- snapshot imutavel;
- HTML publico;
- token seguro;
- projection cliente-safe.

Entidades:

- `ReportSnapshot`;
- `ReportSection`;
- `PublicReport`;
- `ClientProjection`;
- `PublicResultProjection`.

### 3.6 Governanca/auditoria

Responsavel por:

- eventos de auditoria;
- acesso;
- alteracoes;
- publicacao;
- visualizacao;
- revogacao.

Entidades:

- `AuditEvent`;
- `AccessEvent`;
- `PolicyDecision`;
- `PublicationEvent`.

## 4. O que fica no backend

Backend deve conter:

- provider connectors;
- raw snapshot persistence;
- normalizers;
- evidence/fact/relationship builders;
- risk signal generation;
- decision finalization;
- report snapshot generation;
- client-safe projection generation;
- audit writing;
- RBAC enforcement;
- idempotency controls;
- background jobs/triggers.

## 5. O que fica no frontend

Frontend deve conter:

- cockpit operacional;
- dossie visual;
- viewer de evidencias;
- review forms;
- report preview;
- portal cliente;
- auditoria visual;
- configuracoes de modulos;
- estados de carregamento e bloqueio.

Frontend nao deve:

- chamar provider diretamente;
- decidir permissao sensivel sozinho;
- reconstruir relatorio a partir de dados mutaveis;
- conter whitelist divergente da backend sem teste/contrato;
- acessar raw payload sem permissao explicita.

## 6. Shared contracts

Contratos compartilhados devem existir para:

- `ClientProjection`;
- `ReportSnapshot`;
- `EvidenceItem`;
- `RiskSignal`;
- `Decision`;
- `ProviderStatus`;
- `CaseStatus`;
- `ModuleConfig`;
- `PublicReportAvailability`.

Objetivo:

- reduzir drift entre frontend e backend;
- testar whitelists;
- impedir relatorio vazio;
- impedir campos internos no cliente.

## 7. Pipeline assincrono recomendado

### 7.1 Fluxo

1. `case.created`
2. `subject.resolve.requested`
3. `provider.requested`
4. `provider.raw_snapshot.created`
5. `provider.record.normalized`
6. `evidence.created`
7. `facts.relationships.extracted`
8. `risk_signals.generated`
9. `review.required`
10. `decision.approved`
11. `report_snapshot.created`
12. `client_projection.published`
13. `public_report.created`

### 7.2 Implementacao inicial

Nao e necessario introduzir um sistema complexo de eventos no primeiro corte.

Pode comecar com:

- Firebase Functions triggers/callables;
- documentos de status por etapa;
- idempotency keys;
- logs de auditoria;
- jobs reexecutaveis;
- feature flags.

### 7.3 Evolucao futura

Quando houver volume:

- fila duravel;
- workers separados;
- DLQ;
- retry policies por provider;
- observabilidade por etapa;
- custos por tenant/modulo.

## 8. Materializacoes

### 8.1 `clientCases`

Uso: lista/detalhe no portal cliente.

Tipo: projection cliente-safe.

Fonte futura: `ClientProjection`.

### 8.2 `publicResult/latest`

Uso: compatibilidade e leitura publica/cliente atual.

Tipo: projection transicional.

Fonte futura: `Decision` + `ReportSnapshot`.

### 8.3 `publicReports`

Uso: token/link publico.

Tipo: documento publico seguro.

Fonte futura: `ReportSnapshot` imutavel.

### 8.4 `ReportSnapshot`

Uso: fonte da verdade do relatorio gerado.

Tipo: snapshot imutavel.

Deve guardar:

- secoes;
- dados permitidos;
- decisionId;
- evidenceSetHash;
- geradoEm;
- geradoPor;
- versao do builder;
- hash do conteudo.

## 9. Anti-corruption layers

### 9.1 `LegacyCaseAdapter`

Traduz o `case` atual para interfaces V2.

Responsabilidade:

- ler campos antigos;
- normalizar nomes;
- preencher defaults;
- evitar que novo codigo dependa diretamente de estrutura legada.

### 9.2 `ProviderPayloadAdapter`

Traduz payload de provider para `ProviderRecord`.

Responsabilidade:

- isolar BigDataCorp;
- guardar raw;
- versionar normalizacao;
- emitir evidencias/fatos.

### 9.3 `ReportProjectionBuilder`

Traduz `Decision` + `Evidence` + `Subject` para `ReportSnapshot`.

Responsabilidade:

- validar completude;
- aplicar whitelist;
- montar secoes;
- impedir dados internos.

### 9.4 `ClientProjectionBuilder`

Traduz decisao e relatorio para portal cliente.

Responsabilidade:

- construir `clientCases`;
- construir `publicResult/latest`;
- indicar disponibilidade de relatorio;
- evitar stale data.

## 10. Colecoes/documentos sugeridos no Firestore

### 10.1 Curto prazo

- `cases/{caseId}`;
- `subjects/{subjectId}`;
- `providerRequests/{requestId}`;
- `rawSnapshots/{snapshotId}`;
- `providerRecords/{recordId}`;
- `evidenceItems/{evidenceId}`;
- `riskSignals/{signalId}`;
- `decisions/{decisionId}`;
- `reportSnapshots/{snapshotId}`;
- `clientProjections/{projectionId}`;
- `publicReports/{token}`;
- `auditEvents/{eventId}`.

### 10.2 Observacao sobre Firestore

Firestore pode sustentar a V2 minima e parte da vendavel se os documentos forem bem delimitados. O risco nao e Firestore em si; e documento gigante, projection sem versao e ausencia de snapshots.

## 11. Como migrar sem reescrever tudo

### Etapa 1: contratos e snapshots

- manter handlers atuais;
- criar `Decision` e `ReportSnapshot`;
- fazer `publicReports` depender de snapshot;
- criar testes golden.

### Etapa 2: provider ledger

- encapsular BigDataCorp;
- persistir raw snapshots;
- criar provider records.

### Etapa 3: evidence store

- gerar evidencias a partir de records;
- exibir evidencias no cockpit;
- ligar evidencias a sinais.

### Etapa 4: subject/dossie

- criar `Subject`;
- relacionar casos;
- começar reuso controlado.

### Etapa 5: cockpit modular

- decompor `CasoPage.jsx`;
- introduzir paineis;
- manter feature flag para fallback.

## 12. Modulos que devem nascer primeiro

1. `reporting/reportSnapshotService`
2. `publication/clientProjectionService`
3. `providers/providerRequestService`
4. `providers/bigDataCorpConnector`
5. `evidence/evidenceBuilder`
6. `decision/decisionService`
7. `audit/auditServiceV2`
8. `cockpit` no frontend

## 13. Modulos que podem coexistir com V1

- `subjects`;
- `providerRequests`;
- `rawSnapshots`;
- `evidenceItems`;
- `riskSignals`;
- `decisions`;
- `reportSnapshots`;
- `clientProjections`.

## 14. Protecao contra acoplamento ao provider

Regras:

- payload bruto nunca vira campo de dominio diretamente;
- todo payload fica em `RawSnapshot`;
- todo dado normalizado fica em `ProviderRecord`;
- todo fato exibivel precisa de `EvidenceItem`;
- todo signal precisa apontar para evidencia;
- todo relatorio precisa apontar para `ReportSnapshot`;
- toda decisao precisa apontar para evidence set.

## 15. Feature flags recomendadas

- `v2ProviderLedgerEnabled`;
- `v2ReportSnapshotEnabled`;
- `v2EvidenceStoreEnabled`;
- `v2SubjectDossierEnabled`;
- `v2ClientProjectionEnabled`;
- `v2CockpitPanelsEnabled`;
- `v2ReportComposerEnabled`.

## 16. Validacoes obrigatorias

- relatorio nao pode ser criado sem snapshot;
- snapshot nao pode ser criado sem decisao aprovada;
- decisao nao pode ser aprovada sem evidence set;
- cliente nao pode ler raw snapshot;
- projection cliente-safe deve passar whitelist;
- provider request deve ser idempotente;
- reconsulta deve respeitar politica de freshness.

## 17. Conclusao

A arquitetura implementavel nao exige trocar tudo. Ela exige mudar a fonte de verdade:

- V1: `case` como deposito universal.
- V2: `case` como processo; `subject/dossie` como conhecimento; `evidence` como prova; `decision` como conclusao; `reportSnapshot` como entrega.

