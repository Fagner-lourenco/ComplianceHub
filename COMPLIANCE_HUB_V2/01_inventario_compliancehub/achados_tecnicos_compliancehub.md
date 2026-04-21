# Achados tecnicos do ComplianceHub

## ACH-CH-001: Monolito serverless em `functions/index.js`

Confirmado no codigo: `functions/index.js` contem triggers, callables, normalizacao parcial, publicacao, relatorio, IA, conclusao, usuarios, health e quotas.

Risco: alteracoes pequenas em um fluxo critico podem afetar publicacao, relatorio ou enriquecimento. Para V2, separar por bounded context.

Recomendacao: criar modulos `cases`, `publishing`, `reports`, `providers`, `audit`, `tenant`, `ai`, `decisioning`, `entities`.

## ACH-CH-002: `cases` como documento agregador universal

Confirmado no codigo: campos de Judit, Escavador, BigDataCorp, IA, revisao, publicacao e resultado final coexistem no caso.

Risco: dados brutos, interpretacoes, flags finais e projecoes de cliente se misturam.

Recomendacao: manter `cases` como workflow operacional e mover dados investigativos para entidades/fatos/evidencias.

## ACH-CH-003: Contratos duplicados backend/frontend

Confirmado no codigo:

- Backend: `functions/index.js:PUBLIC_RESULT_FIELDS`.
- Frontend: `src/core/clientPortal.js:PUBLIC_RESULT_FIELDS`.

Risco: drift de campos permitidos, relatorio incompleto, portal cliente com dados faltantes ou campos indevidos.

Recomendacao: extrair contrato compartilhado versionado ou gerar os contratos do backend para frontend.

## ACH-CH-004: Report builders duplicados

Confirmado no codigo:

- Backend: `functions/reportBuilder.cjs`.
- Frontend: `src/core/reportBuilder.js`.

Situacao atual: ha boa paridade em varias secoes, mas a duplicacao ainda e um risco de divergencia.

Recomendacao: usar uma unica implementacao compartilhavel ou criar golden tests comparando saidas para payloads canonicos.

## ACH-CH-005: Publicacao tem mecanismos de seguranca, mas precisa virar snapshot imutavel

Confirmado no codigo:

- `buildSanitizedPublicResultSnapshot`.
- `syncPublicResultLatest`.
- `publishResultOnCaseDone`.
- `createAnalystPublicReport`.
- `createClientPublicReport`.

Risco: relatorio publico deve ser prova do que foi revisado e publicado. Qualquer fallback dinamico reduz auditabilidade.

Recomendacao: `publicReports` deve carregar `sourceSnapshotId`, `publicResultHash`, `reportBuildVersion`, `caseConclusionVersion` e `generatedFrom`.

## ACH-CH-006: BigDataCorp tem adapter e normalizer, mas nao tem camada provider-first

Confirmado:

- `functions/adapters/bigdatacorp.js`.
- `functions/normalizers/bigdatacorp.js`.

Risco: dependencia futura do payload do fornecedor e dificuldade de explicar cada conclusao.

Recomendacao: formalizar `ProviderContract`, `ProviderRequest`, `RawSnapshot`, `ProviderRecord`, `Evidence`.

## ACH-CH-007: Revisao humana e forte, mas acoplada a uma tela gigante

Confirmado:

- `src/portals/ops/CasoPage.jsx` tem logica de draft, prefill, score, conclusao, renderizacao de fontes e eventos.

Risco: dificil evoluir para cockpit investigativo sem quebrar comportamento atual.

Recomendacao: decompor em `CaseHeader`, `SubjectIdentityPanel`, `ProviderEvidencePanel`, `RiskReviewPanel`, `DecisionPanel`, `ReportPreviewPanel`.

## ACH-CH-008: Auditoria existe, mas nao ainda como evidence-grade audit

Confirmado:

- `functions/audit/writeAuditEvent.js` escreve `auditLogs` e `tenantAuditLogs`.
- `functions/audit/auditCatalog.js` cataloga acoes.

Risco: auditoria operacional nao substitui proveniencia por fato.

Recomendacao: cada fato, alerta e decisao deve apontar para evidencias e snapshots de origem.

## ACH-CH-009: Falta modelo entidade-centrico

Nao confirmado no reposititorio analisado:

- Dossie por `Person`.
- Dossie por `Company`.
- Relacionamentos reutilizaveis.
- Grafo de vinculos.
- Watchlists.
- Monitoramento continuo.

Recomendacao: criar camada `subjects/entities/relationships/evidence` antes de rule builder avancado.

## ACH-CH-010: Produto ja tem diferencial comercial

Confirmado:

- Portal cliente com solicitacoes, relatorios, auditoria e equipe.
- Relatorio publico com token.
- Revisao humana.
- Modulos habilitados por configuracao.

Recomendacao: preservar esse diferencial. A V2 deve elevar investigacao e confiabilidade sem transformar a experiencia do cliente em produto tecnico demais.

