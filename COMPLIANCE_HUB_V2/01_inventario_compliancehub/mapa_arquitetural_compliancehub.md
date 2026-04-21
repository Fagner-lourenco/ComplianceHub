# Mapa arquitetural do ComplianceHub atual

## Visao em camadas

```txt
Usuario cliente
  -> Portal Cliente React
  -> firestoreService / callable functions
  -> Firebase Functions
  -> Firestore: clientCases, cases, publicResult, publicReports

Analista operacional
  -> Portal Ops React
  -> CasoPage / FilaPage / AuditoriaPage / RelatoriosPage
  -> callable functions e subscriptions
  -> Firebase Functions
  -> Providers externos
  -> Firestore

Relatorio publico
  -> /r/:token
  -> publicReports/{token}
  -> HTML sanitizado
```

## Collections inferidas e confirmadas por codigo/regras

Confirmadas em `firestore.rules` e servicos:

- `cases`
- `cases/{caseId}/publicResult/latest`
- `clientCases`
- `candidates`
- `publicReports`
- `auditLogs`
- `tenantAuditLogs`
- `tenantSettings`
- `tenantUsage`
- `users`

Inferencia: `cases` atua como documento operacional e tambem como agregador de dados enriquecidos. Para V2, isso deve ser quebrado em caso, entidade, evidencia, provider snapshot e decisao.

## Backend atual

Arquivo central: `functions/index.js`.

Responsabilidades encontradas no mesmo arquivo:

- Configuracao de ambiente e providers.
- Sanitizacao de IA.
- Montagem de prompts.
- Triggers de enriquecimento.
- Triggers de espelhamento `clientCases`.
- Publicacao de `publicResult`.
- Usuarios e tenants.
- Criacao de solicitacao.
- Correcao pelo cliente.
- Exportacao.
- Relatorios publicos.
- Conclusao por analista.
- Draft de revisao.
- IA e reprocessamento.
- Webhook Judit.
- Fallback agendado.
- Health e quota.

Risco: alto acoplamento e dificuldade de evoluir para plataforma V2.

## Frontend atual

Rotas principais confirmadas em `src/App.jsx`:

- Cliente: `dashboard`, `solicitacoes`, `nova-solicitacao`, `exportacoes`, `relatorios`, `equipe`, `auditoria`, `perfil`.
- Ops: `fila`, `caso/:caseId`, `casos`, `auditoria`, `relatorios`, `saude`, `perfil`.
- Publico: `/r/:token`, `/demo/r/:caseId`.

Arquitetura UI:

- `src/ui/components`: componentes gerais.
- `src/ui/layouts`: app layout, sidebar e topbar.
- `src/core`: servicos e regras de negocio compartilhadas.

Risco: `CasoPage.jsx` tem tamanho muito elevado e concentra captura, analise, revisao, calculo de risco e conclusao. Isso dificulta transformar a tela em cockpit investigativo modular.

## Publicacao e relatorio

Fluxo confirmado:

```txt
concludeCaseByAnalyst
  -> buildSanitizedPublicResultSnapshot
  -> syncPublicResultLatest
  -> publishResultOnCaseDone como trigger de consistencia
  -> clientCases mirror
  -> createClientPublicReport/createAnalystPublicReport
  -> buildCanonicalReportHtml
  -> publicReports token
  -> PublicReportPage iframe srcDoc
```

Risco arquitetural: o relatorio publico deve ser sempre construido a partir de snapshot canonico imutavel, nao de uma mistura dinamica de `caseData`, `publicResult` e fallback.

## BigDataCorp no mapa atual

Confirmado:

- Adapter chama endpoint de pessoas com datasets.
- Normalizer transforma blocos de dados em campos do caso.
- `_source` ja aparece como metadado de auditoria.

Ausente como arquitetura formal:

- `rawProviderSnapshots`
- `providerRequests`
- `normalizedProviderRecords`
- `canonicalEntities`
- `evidenceItems`
- `facts`
- `relationships`
- `riskSignals`

## Estado recomendado para V2

```txt
Provider adapters
  -> Raw snapshots
  -> Provider records
  -> Canonical entities
  -> Facts / relationships / evidence
  -> Risk signals / alerts
  -> Investigation cases
  -> Decisions
  -> Report snapshots
  -> Client-safe projections
```

