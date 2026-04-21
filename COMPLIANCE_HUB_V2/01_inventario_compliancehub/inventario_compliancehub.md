# Inventario forense do ComplianceHub

## Classificacao atual do produto

Confirmado no codigo: o ComplianceHub atual e uma plataforma operacional de due diligence/background check com portal do cliente, portal operacional, enriquecimento por provedores, revisao humana, publicacao de resultado e relatorio publico.

Evidencias:

- `src/App.jsx`: rotas autenticadas para `/client/*`, `/ops/*`, `/r/:token` e `/demo/r/:caseId`.
- `functions/index.js`: funcoes `createClientSolicitation`, `concludeCaseByAnalyst`, `publishResultOnCaseDone`, `createAnalystPublicReport`, `createClientPublicReport`.
- `src/core/firebase/firestoreService.js`: funcoes frontend que chamam backend e assinam colecoes.
- `firestore.rules`: regras para `cases`, `clientCases`, `publicResult`, `publicReports`, `auditLogs`, `tenantAuditLogs`.

Inferencia arquitetural: o produto hoje esta entre um V1 e V1.5 operacional. Ele ja tem fluxo ponta a ponta vendavel, mas ainda nao tem uma arquitetura de plataforma investigativa orientada a entidades, evidencias, fatos, relacoes e dossies reutilizaveis.

## Stack

Confirmado no codigo:

- Frontend: React 19, Vite, Firebase SDK, React Router.
- Backend: Firebase Cloud Functions v2, Node 22, Firebase Admin.
- Persistencia operacional: Firestore.
- Testes: Vitest, Testing Library, Playwright.

Evidencias:

- `package.json`: scripts `dev`, `build`, `lint`, `test`; dependencias `firebase`, `react`, `react-dom`, `react-router-dom`.
- `functions/package.json`: dependencias `firebase-admin`, `firebase-functions`; engine Node 22.

## Estrutura funcional

Confirmado no codigo:

- `src/portals/client`: portal do cliente.
- `src/portals/ops`: portal operacional.
- `src/core`: autenticacao, RBAC, Firestore service, client portal, report builder, validadores e auditoria frontend.
- `src/ui`: componentes e layouts reutilizaveis.
- `functions/adapters`: provedores externos.
- `functions/normalizers`: normalizacao de respostas externas.
- `functions/audit`: catalogo e escrita de eventos de auditoria.
- `functions/helpers`: IA, homonimia, calibracao, circuit breaker e normalizacao textual.

## Fluxo ponta a ponta confirmado

Fluxo operacional observado:

1. Cliente cria solicitacao.
2. Backend cria candidato e caso.
3. Triggers enriquecem dados.
4. IA e normalizadores preenchem campos.
5. Analista revisa em `CasoPage`.
6. `concludeCaseByAnalyst` grava conclusao.
7. `publicResult/latest` e sincronizado.
8. `clientCases` recebe espelho sanitizado.
9. `publicReports` materializa HTML publico.
10. Portal cliente abre relatorio via token.

Evidencias:

- `functions/index.js:createClientSolicitation`.
- `functions/index.js:enrichJuditOnCase`.
- `functions/index.js:enrichBigDataCorpOnCase`.
- `functions/index.js:enrichEscavadorOnCase`.
- `functions/index.js:enrichDjenOnCase`.
- `functions/index.js:concludeCaseByAnalyst`.
- `functions/index.js:syncPublicResultLatest`.
- `functions/index.js:publishResultOnCaseDone`.
- `functions/index.js:createClientPublicReport`.
- `src/portals/client/SolicitacoesPage.jsx:handleOpenReport`.
- `src/pages/PublicReportPage.jsx`.

## Providers e enriquecimento

Confirmado no codigo:

- BigDataCorp: `functions/adapters/bigdatacorp.js` e `functions/normalizers/bigdatacorp.js`.
- Judit: `functions/adapters/judit.js` e `functions/normalizers/judit.js`.
- Escavador: `functions/adapters/escavador.js` e `functions/normalizers/escavador.js`.
- FonteData: `functions/adapters/fontedata.js`.
- DJEN: `functions/adapters/djen.js` e `functions/normalizers/djen.js`.

Confirmado: BigDataCorp ja possui retry/backoff e normalizacao com `_source`, mas ainda nao ha camada formal de `raw snapshots`, `ProviderRecord`, `Evidence` ou `canonical entity`.

## Portais

Portal cliente confirmado:

- Dashboard: `src/portals/client/DashboardClientePage.jsx`.
- Solicitacoes e drawer: `src/portals/client/SolicitacoesPage.jsx`.
- Nova solicitacao: `src/portals/client/NovaSolicitacaoPage.jsx`.
- Relatorios publicos: `src/portals/client/RelatoriosClientePage.jsx`.
- Auditoria cliente: `src/portals/client/AuditoriaClientePage.jsx`.
- Equipe: `src/portals/client/EquipePage.jsx`.

Portal operacional confirmado:

- Fila: `src/portals/ops/FilaPage.jsx`.
- Caso: `src/portals/ops/CasoPage.jsx`.
- Todos os casos: `src/portals/ops/CasosPage.jsx`.
- Clientes: `src/portals/ops/ClientesPage.jsx`.
- Auditoria: `src/portals/ops/AuditoriaPage.jsx`.
- Relatorios: `src/portals/ops/RelatoriosPage.jsx`.
- Saude APIs: `src/portals/ops/SaudePage.jsx`.
- Configuracoes tenant: `src/portals/ops/TenantSettingsPage.jsx`.
- Metricas IA: `src/portals/ops/MetricasIAPage.jsx`.

## Autenticacao, autorizacao e multi-tenant

Confirmado no codigo:

- `src/core/auth/AuthContext.jsx` resolve perfil e estado autenticado.
- `src/core/rbac/permissions.js` define roles, permissoes e portal.
- `src/App.jsx` usa `RequirePortal` e `RequirePermission`.
- `firestore.rules` valida `tenantId` para leituras de cliente.

Inferencia arquitetural: multi-tenant existe no nivel operacional e de regras Firestore, mas ainda nao e uma camada de dominio isolada com politicas centrais, data partitioning formal, quota model amplo e isolamento por modulo.

## Auditoria

Confirmado no codigo:

- `functions/audit/auditCatalog.js`: catalogo central de eventos.
- `functions/audit/writeAuditEvent.js`: escreve em `auditLogs` e projeta eventos permitidos em `tenantAuditLogs`.
- `src/core/audit/auditCatalog.js`: catalogo seguro para renderizacao no frontend.
- `src/portals/ops/AuditoriaPage.jsx` e `src/portals/client/AuditoriaClientePage.jsx`: consumo visual.

Inferencia: a auditoria ja e um diferencial relevante, mas ainda falta transformar cada fato/evidencia/decisao em item auditavel com proveniencia granulada.

## Relatorios e publicacao

Confirmado no codigo:

- Backend report builder: `functions/reportBuilder.cjs`.
- Frontend report builder: `src/core/reportBuilder.js`.
- Pagina publica: `src/pages/PublicReportPage.jsx`.
- Criacao de relatorio pelo cliente: `functions/index.js:createClientPublicReport`.
- Criacao pelo analista: `functions/index.js:createAnalystPublicReport`.

Achado: ha paridade parcial entre builders, com secoes como `processHighlights`, `warrantFindings`, `timelineEvents`, `nextSteps`, `keyFindings` e `executiveSummary` aparecendo nos dois. Ainda assim, manter dois builders separados continua sendo risco estrutural de drift.

## Maturidade atual

Estagio recomendado: V1.5.

Pontos fortes:

- Fluxo operacional real.
- Revisao humana.
- Portal cliente funcional.
- Publicacao controlada.
- Auditoria.
- Multi-provider.
- Testes unitarios relevantes.

Pontos fracos:

- `functions/index.js` concentra responsabilidades demais.
- Firestore `cases` tende a virar documento universal.
- Falta modelo investigativo canonico.
- Falta dossie reutilizavel por entidade.
- Falta grafo de relacoes.
- Falta evidence store.
- Falta workflow engine formal.
- Falta decision model versionado.
- Falta monitoramento continuo/watchlists.

