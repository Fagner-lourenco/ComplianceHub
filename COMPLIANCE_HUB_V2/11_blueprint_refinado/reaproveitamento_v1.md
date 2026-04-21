# Estrategia de reaproveitamento da V1

## 1. Principio de migracao

A V2 deve evoluir a V1 por estrangulamento gradual, nao por reescrita total.

Principio:

> **Manter o que gera valor operacional hoje, cercar os pontos frageis com contratos mais seguros e mover o dominio investigativo para novos agregados.**

## 2. Classificacoes usadas

- **REAPROVEITAR COMO ESTA:** baixo risco, ja adequado ao desenho V2.
- **REAPROVEITAR COM REFATORACAO LEVE:** util, mas precisa de ajuste de contrato, nomes ou separacao pequena.
- **REAPROVEITAR COM REFATORACAO PROFUNDA:** contem valor, mas esta acoplado demais.
- **SUBSTITUIR:** a abordagem atual conflita com a V2.
- **MANTER TEMPORARIAMENTE E DEPRECAR DEPOIS:** necessario para transicao, mas nao deve ser fundamento futuro.
- **NAO APROVEITAR:** sem aderencia ou custo maior que beneficio.

## 3. Mapa de reaproveitamento

| Area / arquivo | Classificacao | Evidencia consolidada | Motivo | Risco | Recomendacao |
|---|---|---|---|---|---|
| `src/App.jsx` | REAPROVEITAR COM REFATORACAO LEVE | Inventario aponta rotas cliente, ops e relatorio publico | Estrutura de portais ja existe e ajuda a transicao | Rotas crescerem sem arquitetura de dominio | Manter rotas e reorganizar gradualmente telas V2 por modulo |
| `src/portals/client/DashboardClientePage.jsx` | REAPROVEITAR COM REFATORACAO LEVE | Portal cliente ja exibe solicitacoes/resultados | Base util para cliente acompanhar status | Mostrar dados stale ou campos internos | Migrar leitura para `ClientProjection` e contratos cliente-safe |
| `src/portals/client/SolicitacoesPage.jsx` | REAPROVEITAR COM REFATORACAO LEVE | Inventario identifica leitura de `clientCases` e abertura de relatorio | Fluxo comercial existe | Link de relatorio incompleto/stale se snapshot nao estiver pronto | Botao abrir relatorio deve depender de `reportSnapshotId`/`publicReportToken` valido |
| `src/portals/ops/CasoPage.jsx` | REAPROVEITAR COM REFATORACAO PROFUNDA | Inventario aponta pagina central com draft, prefill, score, providers, revisao e conclusao | Tem muito conhecimento operacional embutido | Arquivo gigante virar gargalo da V2 | Fatiar em cockpit: Header, DossierPanel, EvidencePanel, SignalsPanel, ReviewPanel, ReportPanel |
| `src/portals/ops/FilaPage` ou equivalente | REAPROVEITAR COM REFATORACAO LEVE | Inventario confirma fila operacional/gestao de casos | Necessaria para V2 minima | Fila nao priorizar risco, SLA e bloqueios | Evoluir para fila inteligente por status, prioridade, modulo e pendencia |
| `src/core/clientPortal.js` | REAPROVEITAR COM REFATORACAO PROFUNDA | Contem `PUBLIC_RESULT_FIELDS`, `sanitizeCaseForClient`, `resolveClientCaseView`, `getReportAvailability` | Ja tenta proteger visao cliente | Duplicacao com backend e drift de whitelist | Extrair contrato cliente-safe compartilhado/testado |
| `src/core/firebase/firestoreService.js` | REAPROVEITAR COM REFATORACAO LEVE | Camada de acesso Firestore ja usada pelo frontend | Util para transicao | Service crescer com dominio misturado | Criar services especificos: cases, subjects, reports, client projections |
| `functions/index.js` | MANTER TEMPORARIAMENTE E DEPRECAR DEPOIS | Inventario identifica monolito com functions de solicitacao, enriquecimento, conclusao, publicacao e relatorio | Necessario para producao atual | Acoplamento alto e risco de regressao | Criar modulos internos em `functions/domain/*` e mover handlers gradualmente |
| `functions/index.js:concludeCaseByAnalyst` | REAPROVEITAR COM REFATORACAO PROFUNDA | Funcao central de conclusao | Ponto ideal para criar `Decision` e `ReportSnapshot` | Corrida entre conclusao/publicacao/relatorio | Tornar conclusao transacional/idempotente e gerar decisao antes de publicar |
| `functions/index.js:publishResultOnCaseDone` | REAPROVEITAR COM REFATORACAO PROFUNDA | Fluxo atual sincroniza resultado para cliente | Base para materializacao | Publicar dados incompletos se snapshot nao estiver pronto | Publicar somente a partir de `Decision` aprovada e `ReportSnapshot` pronto |
| `functions/index.js:syncPublicResultLatest` | MANTER TEMPORARIAMENTE E DEPRECAR DEPOIS | Atualiza `publicResult/latest` | Mantem contrato existente | Virar fonte da verdade indevida | Rebaixar para projection transicional |
| `functions/index.js:createClientPublicReport` | REAPROVEITAR COM REFATORACAO PROFUNDA | Gera relatorio para cliente | Funcionalidade comercial critica | Relatorio vazio/incompleto se ler snapshot errado | Fazer gerar de `ReportSnapshot`, com validacao de completude |
| `functions/index.js:createAnalystPublicReport` | REAPROVEITAR COM REFATORACAO PROFUNDA | Gera relatorio por analista | Util para revisao/compartilhamento | Divergir do relatorio cliente | Unificar pipeline de report snapshot e diferenciar somente permissao/projecao |
| `functions/index.js:buildCanonicalReportHtml` | REAPROVEITAR COM REFATORACAO PROFUNDA | Monta HTML canonico | Base do output comercial | HTML depender de dados dinamicos mutaveis | Entrada deve ser `ReportSnapshot` validado |
| `functions/reportBuilder.cjs` | SUBSTITUIR DUPLICACAO | Inventario aponta divergencia com `src/core/reportBuilder.js` | Builder backend e necessario | Drift entre frontend/backend | Criar contrato e testes golden; backend nao pode ser mais pobre que frontend |
| `src/core/reportBuilder.js` | SUBSTITUIR DUPLICACAO | Builder frontend existe e renderiza secoes | Contem logica reaproveitavel | Duplicacao com backend | Consolidar modelo de secoes e snapshots; manter preview frontend |
| `functions/adapters/bigdatacorp.js` | REAPROVEITAR COM REFATORACAO PROFUNDA | Adapter existente com chamada e tratamento | Ativo principal para V2 BigDataCorp-first | Acoplar dominio ao payload do provider | Envolver em `ProviderConnector` com request ledger, retry e raw snapshot |
| `functions/normalizers/bigdatacorp.js` | REAPROVEITAR COM REFATORACAO PROFUNDA | Normalizador existente | Base para ProviderRecord/Evidence | Normalizar direto para campos de caso | Emitir `ProviderRecord`, `EvidenceItem`, `Fact` e `Relationship` |
| Adapters Judit/Escavador/FonteData/DJEN | REAPROVEITAR COM REFATORACAO LEVE | Inventario aponta enriquecimentos adicionais | Uteis como fontes complementares | Contratos diferentes por provider | Adaptar ao mesmo provider contract quando forem mantidos |
| `publicResult/latest` | MANTER TEMPORARIAMENTE E DEPRECAR DEPOIS | Parte do fluxo `cases -> publicResult -> clientCases -> publicReports` | Necessario para compatibilidade | Confusao entre dominio e projection | Usar apenas como projection cliente-safe |
| `clientCases` | MANTER TEMPORARIAMENTE E DEPRECAR DEPOIS | Portal cliente depende desta collection/projecao | Mantem UX atual | Duplicacao e stale data | Passar a ser projection derivada de `Decision`/`ReportSnapshot` |
| `publicReports` | REAPROVEITAR COM REFATORACAO PROFUNDA | Relatorio publico por token existe | Entrega comercial essencial | Relatorio orfao, vazio ou stale | Token deve apontar para report snapshot imutavel e valido |
| Auditoria backend `functions/audit/*` | REAPROVEITAR COM REFATORACAO LEVE | Inventario cita `auditCatalog.js` e `writeAuditEvent.js` | Base boa para trilha | Eventos nao cobrirem novas entidades | Expandir catalogo para ProviderRequest, Evidence, Decision, ReportSnapshot |
| Auditoria frontend | REAPROVEITAR COM REFATORACAO LEVE | Paginas de auditoria ja existem | Valor comercial e governanca | Auditoria apenas operacional | Adicionar filtros por case, subject, report, decision |
| Auth/RBAC/contexto | REAPROVEITAR COM REFATORACAO LEVE | Inventario aponta Auth, tenant/franquia/contexto | Essencial para multi-cliente | Permissao insuficiente para evidencias sensiveis | Adicionar escopos: evidence.raw, decision.approve, report.publish |
| Firestore rules | REAPROVEITAR COM REFATORACAO PROFUNDA | Regras existem para V1 | Base de seguranca | Novas colecoes podem vazar dados | Criar regras por camada: raw interno, canonical interno, projection cliente |
| Testes atuais | REAPROVEITAR COM REFATORACAO LEVE | Inventario menciona Vitest/Testing Library/Playwright | Base para nao regressao | Pouca cobertura de contratos de publicacao | Adicionar golden tests e E2E de conclusao-relatorio |
| `results/report-*.html` | MANTER COMO ARTEFATO DE VALIDACAO | Relatorios gerados existem | Uteis para comparar saida | Nao devem virar fonte de verdade | Usar como fixtures/golden samples quando aplicavel |
| Scripts de leitura/reparo | REAPROVEITAR COM REFATORACAO LEVE | Inventario cita scripts e utilitarios | Uteis para backfill | Scripts destrutivos sem dry-run | Padronizar dry-run, logs e rollback logico |

## 4. Nova responsabilidade de `cases`

### Hoje

**Confirmado nos inventarios:** `cases` concentra solicitacao, dados de enriquecimento, revisao, resultado final e publicacao.

### V2

`cases` deve virar envelope operacional:

- status;
- prioridade;
- tenant/cliente;
- solicitante;
- subjectId;
- modulos solicitados;
- tarefas/revisoes;
- decisionId atual;
- reportSnapshotId atual;
- clientProjectionId atual.

Nao deve ser deposito principal de:

- payload bruto;
- evidencias completas;
- entidades canonicas;
- relacoes;
- historico de consultas;
- relatorios renderizados como fonte de verdade.

## 5. Nova responsabilidade de `publicResult/latest`

### Hoje

Parte do contrato de publicacao e leitura cliente.

### V2

Projection transicional para compatibilidade.

Deve conter apenas:

- resumo cliente-safe;
- veredito;
- score/risco permitido;
- highlights permitidos;
- link/token de relatorio valido;
- status de publicacao;
- referencias a snapshot quando seguro.

Nao deve conter:

- payload bruto;
- nomes de APIs;
- metadados internos;
- analise sensivel;
- dados de custo;
- campos de auditoria interna;
- evidencias restritas.

## 6. Nova responsabilidade de `publicReports`

### Hoje

Documento/token para abrir relatorio publico.

### V2

Representacao publica de um `ReportSnapshot`.

Regras:

- nunca gerar sem `Decision` aprovada;
- nunca gerar sem snapshot preenchido;
- nunca apontar para dados mutaveis;
- guardar `reportSnapshotId`, `decisionId`, `caseId`, `subjectId`, `tenantId`;
- guardar hash do conteudo ou versao;
- permitir invalidacao/revogacao sem apagar historico interno.

## 7. Estrategia de migracao por onda

### Onda 1: blindar publicacao

- estabilizar `concludeCaseByAnalyst`;
- criar `Decision` minimo;
- criar `ReportSnapshot` minimo;
- gerar relatorio a partir do snapshot;
- manter `publicResult/latest` como projection.

### Onda 2: encapsular BigDataCorp

- criar `ProviderRequest`;
- persistir `RawSnapshot`;
- versionar normalizador;
- gerar `ProviderRecord`;
- criar `EvidenceItem`.

### Onda 3: introduzir subject/dossie

- criar `Subject`;
- ligar casos ao subject;
- extrair identidade PF/PJ basica;
- reaproveitar snapshots recentes por politica.

### Onda 4: refatorar cockpit

- quebrar `CasoPage.jsx`;
- introduzir paineis de dossie/evidencia/sinais/decisao;
- manter fluxo atual por feature flag.

### Onda 5: portal cliente V2

- ler `ClientProjection`;
- abrir relatorio apenas quando snapshot valido;
- mostrar detalhe sem campos internos;
- auditar visualizacao.

## 8. O que nao fazer

- Nao apagar `cases` no curto prazo.
- Nao transformar `publicResult/latest` em nova fonte de verdade.
- Nao criar builder de relatorio novo sem testes contra builders existentes.
- Nao consultar BigDataCorp diretamente a partir de telas.
- Nao expor payload bruto ao cliente.
- Nao criar grafo antes de ter relacionamentos canonicos confiaveis.
- Nao migrar banco antes de estabilizar modelo.

## 9. Conclusao

A V1 tem valor real: portais, fluxo de caso, conclusao, relatorio, auditoria, providers e operacao. O problema nao e jogar fora; e impedir que os mesmos objetos continuem acumulando responsabilidades.

A estrategia correta e:

> **preservar a operacao, criar contratos mais fortes e mover gradualmente a inteligencia investigativa para entidades canonicas e snapshots auditaveis.**

