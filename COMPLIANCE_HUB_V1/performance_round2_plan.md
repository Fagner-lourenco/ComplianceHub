# Performance Round 2 - Plano De Correcoes

Data: 2026-05-15
Status: Plano tecnico incremental. Nenhuma implementacao feita nesta rodada.

## 1. Prioridade Executiva

Ordem recomendada:
1. Rodada 2.1 - Contextos e hooks para reduzir re-render global.
2. Rodada 2.2 - Componentes compartilhados criticos (`SlaBadge`, `MobileDataCardList`, `KpiCard`).
3. Rodada 2.3 - CSS barato e seguro (`transition: all`, blur, height animation).
4. Rodada 2.4 - Paginas cliente P0 (`SolicitacoesPage`, `NovaSolicitacaoPanel`, `DashboardClientePage`).
5. Rodada 2.5 - Relatorios e `CasoPage`.

## 2. Fase A - Correcoes Quase Sem Risco

| Item | Prioridade | Arquivo(s) | Evidencia | Solucao proposta | Risco | Testes | Criterio de aceite |
|---|---|---|---|---|---|---|---|
| [ ] A1 | P0 | `src/core/auth/AuthContext.jsx` | Provider `value` literal novo; funcoes novas | `useCallback` para `login`, `logout`, `refreshProfile`; `useMemo` para `value` | Baixo/medio | Login, logout, perfil, rotas protegidas | Consumers nao re-renderizam sem mudanca real de auth |
| [ ] A2 | P0 | `src/core/contexts/TenantContext.jsx` | Provider `value` literal novo; `selectTenant` novo | `useCallback` em `selectTenant`; `useMemo` em `value` | Baixo/medio | Troca de tenant, client/ops routes | Tenant continua correto sem re-render global desnecessario |
| [ ] A3 | P0 | `src/hooks/useCases.js` | Retorno objeto novo | `useMemo` para retorno; memoizar mock filter | Baixo | Dashboard, solicitacoes, fila, casos | Listas continuam carregando sem flicker |
| [ ] A4 | P1 | `src/hooks/useCandidates.js` | Mesmo padrao de `useCases` | `useMemo` para retorno; revisar deps | Baixo | Paginas que usam candidates | Sem mudanca funcional |
| [ ] A5 | P1 | `src/hooks/useAuditLogs.js` | Retorno objeto novo; mock filter por render | `useMemo` no retorno e demo logs | Baixo | Auditoria ops | Filtros continuam corretos |
| [ ] A6 | P1 | `src/hooks/useTenantAuditLogs.js` | Retorno objeto novo; mock filter por render | `useMemo` no retorno e demo logs | Baixo | Auditoria cliente | Logs continuam corretos |
| [ ] A7 | P1 | `src/portals/client/NovaSolicitacaoPanel.jsx` | Array literal de redes sociais criado no render | Extrair para constante de modulo | Baixo | Nova solicitacao desktop/mobile | Campos continuam iguais |
| [ ] A8 | P1 | `src/portals/client/DashboardClientePage.jsx` | `actionItems` array literal por render | `useMemo` para `actionItems` | Baixo | Dashboard cliente | KPIs/acoes corretos |
| [ ] A9 | P1 | `src/portals/ops/TenantSettingsPage.jsx` | `computeEstimatedCost` inline | `useMemo` para custo estimado | Baixo | Tenant settings | Custo exibido igual |
| [ ] A10 | P1 | `src/core/firebase/firestoreService.js` | Import dinamico repetido | Cachear promise/import de `firebase/functions` | Medio | Todas chamadas callable | Nenhuma chamada falha |

## 3. Fase B - Correcoes De Baixo/Medio Risco

| Item | Prioridade | Arquivo(s) | Evidencia | Solucao proposta | Risco | Testes | Criterio de aceite |
|---|---|---|---|---|---|---|---|
| [ ] B1 | P0 | `src/ui/components/SlaBadge/SlaBadge.jsx` | 1 interval por badge; animacao infinita | Timer compartilhado ou hook global; limitar/remover pulse em massa | Medio | Fila, Casos, Solicitações com muitas linhas | Sem dezenas de timers simultaneos |
| [ ] B2 | P0 | `src/ui/components/MobileDataCardList/MobileDataCardList.jsx` e pais | `renderCard` inline invalida memo | Estabilizar `renderCard` nos pais ou remover `memo` enganoso | Medio | Todas listas mobile | Filtro mobile sem lag evidente |
| [ ] B3 | P0 | `src/ui/components/KpiCard/KpiCard.jsx`, `DashboardClientePage.jsx` | `onClick` inline invalida memo | Estabilizar callbacks com `useCallback` | Baixo | Dashboard | KPIs continuam clicaveis |
| [ ] B4 | P0 | `src/portals/client/SolicitacoesPage.jsx` | `drawerTabs` contem JSX pesado e muitas deps | Extrair tabs para componentes filhos (`ResumoTab`, `DetalhesTab`, etc.) | Medio | Drawer de solicitacao | Abre sem lag; conteudo igual |
| [ ] B5 | P1 | `src/portals/ops/CasoPage.jsx` | Tabelas dentro de `<details>` montadas fechadas | Lazy render por estado `open`/`onToggle` | Medio | CasoPage com dados reais | Tabelas aparecem ao abrir |
| [ ] B6 | P1 | `src/portals/ops/CasoPage.jsx` | `checklist` nao memoizado | `useMemo` | Baixo | Checklist visual | Sem mudanca de regras |
| [ ] B7 | P1 | CSS de cliente e componentes | 41 `transition: all` | Trocar por propriedades especificas | Baixo/medio visual | Hover/focus/tabs | Visual preservado |
| [ ] B8 | P1 | `src/pages/LoginPage.css` | `backdrop-filter: blur(20px)` | Reduzir para blur menor ou background solido | Medio visual | Login desktop/mobile | Visual aceitavel sem blur caro |
| [ ] B9 | P1 | `src/portals/client/NovaSolicitacaoPage.css` | `blur(14px)` footer/sticky | Reduzir/remover blur | Medio visual | Offcanvas nova solicitacao | Sem regressao visual |
| [ ] B10 | P1 | `src/portals/client/DashboardClientePage.css` | `transition: height` | Trocar por `transform: scaleY()` ou remover transicao | Medio visual | Grafico dashboard | Grafico correto |
| [ ] B11 | P1 | `src/pages/PublicReportPage.jsx` | `DOMParser` no main thread | Avaliar backend-only sanitization ou lazy sanitize | Medio | Relatorio publico | Sem regressao de seguranca |

## 4. Fase C - Correcoes Estruturais

| Item | Prioridade | Arquivo(s) | Evidencia | Solucao proposta | Risco | Testes | Criterio de aceite |
|---|---|---|---|---|---|---|---|
| [ ] C1 | P1 | `src/portals/client/NovaSolicitacaoPanel.jsx` | Steps mobile usam `display: none` | Unmount condicional por step | Medio | Wizard completo mobile | Dados preservados ao trocar step |
| [ ] C2 | P1 | `src/portals/ops/CasoPage.jsx` | Arquivo monolitico ~3291 linhas | Dividir por secoes sem mudar regra | Alto | CasoPage completo | Funcionalidade igual |
| [ ] C3 | P2 | `src/core/auth/AuthContext.jsx` | Context mistura dados, UI state e acoes | Separar contextos data/actions | Alto | App completo | Sem regressao global |
| [ ] C4 | P2 | CSS listas/cards | `contain` ausente | Adicionar `contain: layout paint` onde seguro | Medio visual/layout | Listas/tabelas/drawers | Sem clipping indesejado |
| [ ] C5 | P2 | CSS listas longas | `content-visibility` ausente | Adicionar em listas/secoes longas com cuidado | Medio | Scroll desktop/mobile | Sem bugs de altura/scroll |
| [ ] C6 | P2 | `vite.config.js` | `firebase-shared` 429.79 kB | Avaliar split mais granular | Medio | Build/runtime Firebase | Sem quebra de auth/functions |
| [ ] C7 | P2 | `RelatoriosClientePage.jsx`, `EquipePage.jsx` | Modais customizados | Padronizar com `Modal` reutilizavel | Medio | Modais | Acessibilidade e UX preservadas |

## 5. Fase D - Futuro / Backend (Nao Implementar Agora)

| Item | Prioridade | Area | Motivo |
|---|---|---|---|
| [ ] D1 | P2 | Firestore queries | Paginação real se listas crescerem alem de 50/100 registros |
| [ ] D2 | P2 | Cache de aplicacao | Reduzir chamadas duplicadas entre paginas |
| [ ] D3 | P2 | Virtualizacao | Apenas se dados reais justificarem >100 linhas visiveis |
| [ ] D4 | P3 | Indices Firestore | Somente se query backend indicar gargalo |

## 6. Plano De Execucao Recomendado

### Rodada 2.1 - Contextos e hooks

Objetivo: reduzir re-render global sem alterar UI.

Arquivos:
- `src/core/auth/AuthContext.jsx`
- `src/core/contexts/TenantContext.jsx`
- `src/hooks/useCases.js`
- `src/hooks/useCandidates.js`
- `src/hooks/useAuditLogs.js`
- `src/hooks/useTenantAuditLogs.js`
- `src/core/firebase/firestoreService.js`

Critério de aceite:
- Testes passando.
- Build passando.
- Login, tenant, dashboard e solicitacoes funcionando.
- Nenhum contrato publico alterado.

### Rodada 2.2 - Componentes compartilhados criticos

Objetivo: remover hotspots de listas e mobile.

Arquivos:
- `SlaBadge.jsx`
- `MobileDataCardList.jsx`
- `KpiCard.jsx`
- pais que passam props instaveis.

Critério de aceite:
- Listas com 50 linhas sem timer por badge.
- Mobile cards nao re-renderizam sem necessidade.
- KPIs continuam clicaveis.

### Rodada 2.3 - CSS barato e seguro

Objetivo: reduzir custo de composicao/paint.

Arquivos:
- `NovaSolicitacaoPage.css`
- `LoginPage.css`
- `PublicReportPage.css`
- `Modal.css`
- `Drawer.css`
- `shared-tables.css`
- CSS de cliente com `transition: all`.

Critério de aceite:
- Sem regressao visual essencial.
- Hover/focus preservados.
- Mobile sem blur caro.

### Rodada 2.4 - Paginas cliente P0

Objetivo: melhorar Solicitacoes e NovaSolicitacao.

Arquivos:
- `SolicitacoesPage.jsx`
- `NovaSolicitacaoPanel.jsx`
- `DashboardClientePage.jsx`

Critério de aceite:
- Drawer abre sem travamento perceptivel.
- Formulario digita fluido.
- Dashboard carrega igual.

### Rodada 2.5 - Relatorios e CasoPage

Objetivo: reduzir DOM inicial pesado em relatorios/tabelas.

Arquivos:
- `CasoPage.jsx`
- `PublicReportPage.jsx`
- `ClientReportPage.jsx`
- `reportBuilder.js` se necessario.

Critério de aceite:
- Tabelas pesadas renderizam ao abrir.
- Relatorio publico preserva seguranca.
- PDF/print continuam funcionando.

## 7. Estrategia Antirregressao

Baseline:
- `npm test`: 627 testes passando.
- `npm run build`: passando, 0 warnings.
- `npm run lint`: 2 erros pre-existentes em backend.

Regras por fase:
- Uma fase pequena por vez.
- Evitar refatoracao ampla.
- Nao alterar backend, Firebase, regras, RBAC ou modelo de dados.
- Nao instalar dependencia nova sem nova decisao.
- Nao tocar `COMPLIANCE_HUB_V2`.
- Nao usar `git reset --hard`, `git clean`, `git restore` global.

Comandos minimos por fase:
- `npm test`
- `npm run build`
- `npm run lint` apenas para confirmar status; falha atual deve ser registrada como pre-existente se permanecer igual.

Smoke manual obrigatorio:
- Login cliente.
- Dashboard cliente.
- Solicitacoes cliente.
- Drawer de detalhes de solicitacao.
- Nova solicitacao desktop.
- Nova solicitacao mobile.
- Relatorio cliente.
- Relatorios publicos cliente.
- Exportacoes cliente.
- Equipe cliente.
- Auditoria cliente.
- Login ops.
- Fila ops.
- CasoPage.
- Relatorios ops.
- Modais/drawers.
- Console sem erros.
- Network sem chamadas duplicadas obvias.

Rollback seguro:
- Reverter commit especifico da fase com `git revert <sha>`.
- Nao limpar worktree global.
- Nao desfazer alteracoes nao relacionadas.

## 8. O Que Nao Fazer Agora

- Nao trocar stack para Next.js/Remix.
- Nao migrar para TypeScript.
- Nao instalar Redux/Zustand apenas para resolver re-render.
- Nao virtualizar listas sem evidencia de dados reais grandes.
- Nao refatorar `CasoPage` inteiro em uma unica rodada.
- Nao mexer em Cloud Functions, Firestore rules, auth, RBAC ou payloads.
- Nao rodar lint fix global.
- Nao formatar o projeto inteiro.
- Nao alterar `COMPLIANCE_HUB_V2`.

## 9. Proximo Prompt De Implementacao

```text
Implemente apenas a Rodada 2.1 do plano de performance do ComplianceHub V1.

Objetivo: reduzir re-render global sem alterar comportamento funcional.

Arquivos permitidos:
- src/core/auth/AuthContext.jsx
- src/core/contexts/TenantContext.jsx
- src/hooks/useCases.js
- src/hooks/useCandidates.js
- src/hooks/useAuditLogs.js
- src/hooks/useTenantAuditLogs.js
- src/core/firebase/firestoreService.js

Tarefas:
1. Memoizar o value do AuthContext com useMemo.
2. Estabilizar login, logout e refreshProfile com useCallback.
3. Memoizar o value do TenantContext com useMemo.
4. Estabilizar selectTenant com useCallback.
5. Memoizar os objetos de retorno dos hooks de dados.
6. Memoizar filtros de mock data em demo mode quando houver.
7. Cachear o import dinamico de firebase/functions em firestoreService.js, sem mudar o contrato de callBackendFunction.

Regras:
- Nao alterar UI.
- Nao alterar payloads.
- Nao alterar backend.
- Nao instalar dependencias.
- Nao tocar COMPLIANCE_HUB_V2.
- Fazer mudancas pequenas.
- Rodar npm test e npm run build.
- Registrar qualquer falha pre-existente sem corrigir fora do escopo.

Critérios de aceite:
- Testes passam.
- Build passa.
- Login/logout continuam funcionando.
- Troca de tenant continua funcionando.
- Dashboard cliente, solicitacoes e auditoria continuam carregando.
```
