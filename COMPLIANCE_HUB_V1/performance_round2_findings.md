# Performance Round 2 - Findings

Data: 2026-05-15
Escopo: ComplianceHub V1 frontend React/Vite, com foco nas paginas do cliente, relatorios, formularios, drawers/modais, listas, CSS e hooks/contextos.
Status: Auditoria e planejamento apenas. Nenhuma correcao de performance foi implementada nesta rodada.

## 1. Localizacao Do App Correto

Raiz confirmada: `D:\ComplianceHub\COMPLIANCE_HUB_V1`

`package.json` correto: `D:\ComplianceHub\COMPLIANCE_HUB_V1\package.json`

Stack confirmada:
- Vite: script `dev` usa `vite`
- React: dependencia `react` e `react-dom`
- React Router: dependencia `react-router-dom`
- Firebase: dependencia `firebase`
- Estrutura `src/` presente com `App.jsx`, `main.jsx`, `core/`, `hooks/`, `pages/`, `portals/`, `ui/`

Scripts disponiveis:
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`
- `npm test`

Principais pastas de paginas:
- `src/pages`
- `src/portals/client`
- `src/portals/ops`

Principais pastas de componentes:
- `src/ui/components`
- `src/ui/layouts`
- `src/ui/styles`

Arquivo de roteamento principal:
- `src/App.jsx`

## 2. Baseline Sem Alterar Codigo

Baseline coletado por comandos seguros.

### Testes

Comando: `npm test`

Resultado observado:
- 48 arquivos de teste
- 627 testes
- 627 passando
- duracao aproximada: 8.99s

### Lint

Comando: `npm run lint`

Resultado observado:
- Falha com 2 erros pre-existentes em backend/functions
- `functions/index.js:6493` - `publicSnapshot` atribuido e nao usado
- `functions/index.js:9376` - chave duplicada `id`

Observacao: falhas nao impedem auditoria frontend, mas bloqueiam criterio de lint limpo ate serem tratadas em rodada separada.

### Build

Comando: `npm run build`

Resultado observado:
- Build passou
- 187 modulos transformados
- tempo aproximado: 2.33s
- 0 warnings de bundle

Chunks JS maiores:

| Chunk | Tamanho | Gzip | Risco |
|---|---:|---:|---|
| `firebase-shared` | 429.79 kB | 131.66 kB | Alto |
| `index` | 184.17 kB | 55.51 kB | Medio |
| `react-dom` | 184.06 kB | 57.64 kB | Esperado |
| `CasoPage` | 123.09 kB | 24.05 kB | Alto |
| `ExportacoesPage` | 30.99 kB | 9.34 kB | Baixo |
| `NovaSolicitacaoPanel` | 27.65 kB | 7.78 kB | Medio |
| `SolicitacoesPage` | 27.99 kB | 8.05 kB | Medio |

Maior CSS:
- `index.css` gerado: ~40.53 kB, gzip ~8.47 kB

## 3. Inventario De Paginas E Rotas

### Portal Cliente

| Rota | Arquivo | Tipo | Lista/Tabela | Formulario | Drawer/Modal | Relatorio | Dados remotos | Risco | Prioridade |
|---|---|---|---|---|---|---|---|---|---|
| `/client/dashboard` | `src/portals/client/DashboardClientePage.jsx` | cliente | Nao | Nao | Nao | Nao | Sim | Medio | P0 |
| `/client/solicitacoes` | `src/portals/client/SolicitacoesPage.jsx` | cliente | Sim | Sim | Sim | Nao | Sim | Alto | P0 |
| `/client/nova-solicitacao` | `src/portals/client/NovaSolicitacaoPage.jsx`, `NovaSolicitacaoPanel.jsx` | cliente | Nao | Sim | Sim | Nao | Sim | Alto | P0 |
| `/client/relatorio/:caseId` | `src/portals/client/ClientReportPage.jsx` | cliente | Nao | Nao | Sim | Sim | Sim | Medio | P1 |
| `/client/exportacoes` | `src/portals/client/ExportacoesPage.jsx` | cliente | Sim | Sim | Nao | Sim | Sim | Medio | P1 |
| `/client/relatorios` | `src/portals/client/RelatoriosClientePage.jsx` | cliente | Sim | Nao | Sim | Nao | Sim | Medio | P1 |
| `/client/equipe` | `src/portals/client/EquipePage.jsx` | cliente | Sim | Sim | Sim | Nao | Sim | Medio | P1 |
| `/client/auditoria` | `src/portals/client/AuditoriaClientePage.jsx` | cliente | Sim | Nao | Nao | Nao | Sim | Medio | P1 |
| `/client/perfil` | `src/pages/PerfilPage.jsx` | compartilhada | Nao | Sim | Nao | Nao | Sim | Baixo | P2 |

### Portal Operacional

| Rota | Arquivo | Tipo | Lista/Tabela | Formulario | Drawer/Modal | Relatorio | Dados remotos | Risco | Prioridade |
|---|---|---|---|---|---|---|---|---|---|
| `/ops/fila` | `src/portals/ops/FilaPage.jsx` | operacao | Sim | Nao | Sim | Nao | Sim | Alto | P0 |
| `/ops/caso/:caseId` | `src/portals/ops/CasoPage.jsx` | operacao | Sim | Sim | Sim | Sim | Sim | Alto | P0 |
| `/ops/casos` | `src/portals/ops/CasosPage.jsx` | operacao | Sim | Nao | Nao | Nao | Sim | Medio | P1 |
| `/ops/clientes` | `src/portals/ops/ClientesPage.jsx` | operacao | Sim | Sim | Sim | Nao | Sim | Medio | P1 |
| `/ops/relatorios` | `src/portals/ops/RelatoriosPage.jsx` | operacao | Sim | Nao | Sim | Nao | Sim | Medio | P1 |
| `/ops/equipe` | `src/portals/ops/EquipeOpsPage.jsx` | operacao | Sim | Sim | Sim | Nao | Sim | Medio | P1 |
| `/ops/auditoria` | `src/portals/ops/AuditoriaPage.jsx` | operacao | Sim | Nao | Nao | Nao | Sim | Medio | P2 |
| `/ops/metricas-ia` | `src/portals/ops/MetricasIAPage.jsx` | operacao | Sim | Nao | Nao | Nao | Sim | Medio | P2 |
| `/ops/tenant-settings/:tenantId` | `src/portals/ops/TenantSettingsPage.jsx` | operacao/admin | Nao | Sim | Nao | Nao | Sim | Medio | P2 |
| `/ops/saude` | `src/portals/ops/SaudePage.jsx` | operacao/admin | Nao | Nao | Nao | Nao | Sim | Baixo | P2 |

### Publicas E Auth

| Rota | Arquivo | Tipo | Relatorio | Dados remotos | Risco | Prioridade |
|---|---|---|---|---|---|---|
| `/login` | `src/pages/LoginPage.jsx` | auth | Nao | Sim | Baixo | P2 |
| `/r/:token` | `src/pages/PublicReportPage.jsx` | publica | Sim | Sim | Medio | P1 |
| `/demo/r/:caseId` | `src/pages/PublicReportPage.jsx` | demo | Sim | Nao | Baixo | P2 |

## 4. Achados - Paginas Do Cliente

### 4.1 `DashboardClientePage.jsx`

Evidencias:
- Usa `useCases(clientTenantId)` e `callGetClientQuotaStatus()`.
- `metrics` e memoizado via `useMemo`.
- `actionItems` e array de objetos recriado a cada render.
- Grafico usa altura dinamica por inline style e CSS com `transition: height`.

Impacto provavel:
- Baixo/medio em desktop.
- Em mobile ou devices fracos, animar `height` pode causar reflow.
- `KpiCard` tem `React.memo`, mas callbacks inline no pai podem invalidar memo.

Prioridade: P0 por ser primeira pagina cliente e afetar percepcao inicial.

### 4.2 `SolicitacoesPage.jsx`

Evidencias:
- Usa `useCases`, `getTenantSettings`, `callGetClientQuotaStatus`, `getCasePublicResult`.
- Tabela desktop com `paginatedCases.map(...)` e `PAGE_SIZE = 50`.
- `MobileDataCardList` recebe `renderCard` inline grande.
- `Drawer` montado com `open={Boolean(selectedCase)}` e `tabs={drawerTabs}`.
- `drawerTabs` e `useMemo`, mas contem JSX pesado e muitas dependencias.
- Formulario de correcao controlado dentro do drawer.

Impacto provavel:
- Alto em listas reais grandes.
- Digitacao em busca/filtros pode re-renderizar tabela, mobile cards e drawer memoizado.
- Drawer pode abrir com custo alto por montagem de conteudo pesado.

Prioridade: P0.

### 4.3 `NovaSolicitacaoPage.jsx` e `NovaSolicitacaoPanel.jsx`

Evidencias:
- Wrapper `NovaSolicitacaoPage.jsx` apenas abre `NovaSolicitacaoPanel`.
- `NovaSolicitacaoPanel` usa `createPortal` no body.
- Formulario controlado grande com ~15 campos.
- Usa `useMediaQuery`, `useAuth`, `getTenantSettings`, `callGetClientQuotaStatus`.
- Lista de redes sociais e array literal recriado no render.
- Steps mobile usam `display: none`, mantendo conteudo no DOM.
- CSS do painel tem `backdrop-filter`, shadow grande e varias transicoes `all`.

Impacto provavel:
- Alto em mobile.
- O painel pode abrir com custo alto.
- Digitacao pode re-renderizar muitas secoes mesmo invisiveis.

Prioridade: P0.

### 4.4 `ClientReportPage.jsx`

Evidencias:
- Usa `useCases(clientTenantId)` para achar `caseData` via `cases.find(...)`.
- Busca `getCasePublicResult(caseData.id)` e `getClientCaseReportHtml(caseData.id)`.
- Relatorio renderizado via iframe `srcDoc`.
- `caseData`, `caseView`, `reportAvailability`, `reportHtml` e `iframeHtml` estao memoizados.

Impacto provavel:
- Medio se tenant tiver muitos casos, por `cases.find` em array completo.
- Custo principal e parse/render do iframe HTML.

Prioridade: P1.

### 4.5 `ExportacoesPage.jsx`

Evidencias:
- Usa `useCases()` e `subscribeToExports`.
- Usa `filteredCases` com `useMemo`.
- Historico renderizado em tabela/mobile cards.
- `buildPrintableHtml` gera string grande de HTML/CSS para exportacao, mas nao e renderizado como DOM React durante idle.

Impacto provavel:
- Medio em tenants com muitos casos/exportacoes.
- Baixo no render normal.

Prioridade: P1.

### 4.6 `RelatoriosClientePage.jsx`

Evidencias:
- Usa `fetchClientPublicReports(cursor, 50)`.
- Tem `hasMore` e cursor, portanto ja possui paginacao remota basica.
- Filtros client-side sobre registros carregados.
- Modal de revogacao e implementado manualmente com overlay customizado.

Impacto provavel:
- Medio.
- CSS overlay com `backdrop-filter` e `z-index: 1000`.

Prioridade: P1.

### 4.7 `EquipePage.jsx`

Evidencias:
- Usa `callListTenantUsers`, tabela, mobile cards e modais.
- Modal de criacao customizado inline mais tres modais reutilizaveis.
- Formulario controlado para criacao de usuario.
- `MobileDataCardList` recebe renderCard inline.

Impacto provavel:
- Medio para listas grandes de usuarios.
- Baixo/medio para modal.

Prioridade: P1.

### 4.8 `AuditoriaClientePage.jsx`

Evidencias:
- Usa `useTenantAuditLogs(tenantId, categoryFilter)`.
- Filtra logs com `useMemo`.
- Tabela e mobile cards.
- Inline style em badges de acao/categoria.

Impacto provavel:
- Medio se logs crescerem.
- Filtros client-side podem ficar caros.

Prioridade: P1.

## 5. Achados - Componentes Compartilhados

### 5.1 `SlaBadge.jsx`

Problema critico:
- Cada instancia cria `setInterval`.
- Em tabelas com 50 linhas, pode haver 50 timers.
- Dot tem animacao CSS infinita.
- Recebe `caseData` objeto, que pode invalidar `memo`.

Impacto: alto em `FilaPage`, `CasosPage`, `SolicitacoesPage`.

### 5.2 `MobileDataCardList.jsx`

Problema alto:
- `React.memo` existe, mas e neutralizado por `renderCard` inline e `children` inline vindos dos pais.
- Usado em paginas com listas mobile.

### 5.3 `KpiCard.jsx`

Problema alto:
- `React.memo` existe.
- `onClick={() => ...}` inline no pai invalida memo.

### 5.4 `PageHeader.jsx`

Problema medio:
- `React.memo` existe.
- Props como `actions`, `metric`, `backAction` tendem a ser objetos/JSX inline.

### 5.5 `Modal.jsx` e `Drawer.jsx`

Observacao:
- Nao sao puros por side effects corretos de foco, body scroll e portal.
- CSS tem backdrop-filter e shadows.
- Como sao instancias unicas por pagina, risco e medio, nao P0.

## 6. Achados - Contextos, Hooks E Services

### 6.1 `AuthContext.jsx`

Evidencia:
- Provider `value` e objeto literal novo.
- `login`, `logout`, `refreshProfile` nao estabilizados.

Risco: re-render global.

### 6.2 `TenantContext.jsx`

Evidencia:
- Provider `value` e objeto literal novo.
- `selectTenant` e funcao nova.
- `selectedTenantLabel` calculado dentro do value.

Risco: re-render global.

### 6.3 Hooks de dados

Arquivos:
- `src/hooks/useCases.js`
- `src/hooks/useCandidates.js`
- `src/hooks/useAuditLogs.js`
- `src/hooks/useTenantAuditLogs.js`

Evidencias:
- Retornam objetos literais novos.
- Demo mode filtra mocks a cada render.
- `useCases` e `useCandidates` podem recriar subscriptions por dependencia `userProfile?.role`.

### 6.4 `firestoreService.js`

Evidencias:
- `callBackendFunction` importa `firebase/functions` dinamicamente a cada chamada.
- `withFirestoreTimeout` usa `Promise.race` com timer que nao e limpo quando promise principal resolve.

## 7. Achados - CSS

Principais ocorrencias:
- 41 ocorrencias de `transition: all`
- 22 ocorrencias de `backdrop-filter`
- 12 sombras grandes/pesadas
- 1 animacao de `height`
- z-index arbitrarios (`9999`, `1000`, `100`)
- `content-visibility` ausente
- `contain` presente apenas em poucos componentes

Arquivos mais relevantes:
- `src/portals/client/NovaSolicitacaoPage.css`
- `src/pages/LoginPage.css`
- `src/pages/PublicReportPage.css`
- `src/ui/components/Modal/Modal.css`
- `src/ui/components/Drawer/Drawer.css`
- `src/ui/styles/shared-tables.css`
- `src/portals/ops/CasoPage.css`

## 8. Achados - Relatorios

### 8.1 `PublicReportPage.jsx`

Evidencia:
- `stripActiveContent` usa `DOMParser`, percorre todos os elementos e atributos no main thread.
- Relatorio inteiro entra em iframe `srcDoc` de uma vez.

Risco: medio em relatorios grandes.

### 8.2 `ClientReportPage.jsx`

Evidencia:
- Busca HTML canonico no backend.
- Renderiza iframe.
- Memoizacao razoavel ja presente.

Risco: medio, principalmente por dados e HTML grandes.

### 8.3 `CasoPage.jsx`

Evidencia:
- Tabelas de Escavador, Judit, BigDataCorp e DJEN ficam dentro de `<details>`, mas montadas mesmo quando fechadas.
- `checklist` reconstruido sem `useMemo`.
- Arquivo grande: ~3291 linhas.

Risco: alto.

### 8.4 `reportBuilder.js`

Evidencia:
- Gera HTML string completa sincrona.
- Batch pode repetir CSS por pagina/caso.

Risco: baixo/medio.

## 9. Achados - Formularios

### 9.1 `NovaSolicitacaoPanel.jsx`

Evidencias:
- Formulario controlado grande.
- Steps mobile invisiveis continuam montados com `display: none`.
- Array de redes sociais recriado.
- Validacao principal no submit.

Risco: alto em mobile.

### 9.2 `PerfilPage.jsx`

Evidencias:
- Formulario leve, estados locais.
- Derivados com `useMemo`.

Risco: baixo.

### 9.3 `TenantSettingsPage.jsx`

Evidencia:
- `computeEstimatedCost(enrichment)` recalculado inline durante render.
- Estado de formulario complexo/aninhado.

Risco: medio.
