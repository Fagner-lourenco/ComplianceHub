# Plano de Performance Frontend - ComplianceHub V1

## Objetivo
Implementar uma rodada incremental de otimizacao de performance e fluidez do frontend sem regressao funcional, visual, de dados, RBAC, Firebase, Firestore, payloads, rotas, permissoes ou UX critica.

## Escopo Permitido
- `src/` do ComplianceHub V1.
- `vite.config.js` do ComplianceHub V1, se a alteracao for segura.
- Testes diretamente relacionados as alteracoes.
- Arquivos de controle desta rodada: `performance_task_plan.md`, `performance_findings.md`, `performance_progress.md`.

## Fora de Escopo
- Backend Firebase/Cloud Functions.
- Regras Firestore.
- Deploy.
- Dados reais.
- `COMPLIANCE_HUB_V2`.
- Mudancas de regra de negocio, payload, RBAC ou permissoes.
- Redesign ou troca de linguagem visual.

## Restricoes Operacionais
- Nao usar `git reset`, `git checkout`, `git clean` ou `git restore`.
- Nao rodar formatacao global nem lint fix global.
- Nao alterar arquivos fora do escopo.
- Toda alteracao deve ser precedida por leitura do arquivo e registro em `performance_findings.md`.

## Decisoes Seguras
- Listas grandes: usar paginacao client-side, sem dependencia nova, 50 itens por pagina.
- Blur/backdrop: reduzir/remover blur pesado em mobile; desktop com blur leve no maximo.
- Planejamento: manter arquivos separados desta rodada.

## Rotas e Paginas Descobertas

### P0 - Criticas
- [x] `/ops/fila` - `src/portals/ops/FilaPage.jsx` - lista grande, modal, filtros, bulk actions.
- [x] `/ops/casos` - `src/portals/ops/CasosPage.jsx` - lista grande, filtros, busca.
- [x] `/client/solicitacoes` - `src/portals/client/SolicitacoesPage.jsx` - lista grande, drawer com tabs, filtros, busca.
- [x] `/ops/clientes` - `src/portals/ops/ClientesPage.jsx` - lista, modal, configuracoes por tenant. Validacao visual direta ficou parcial porque `/demo/ops/clientes` redireciona.
- [x] `/ops/relatorios` - `src/portals/ops/RelatoriosPage.jsx` - lista, modal de revogacao, acoes.
- [x] `/client/nova-solicitacao` - `src/portals/client/NovaSolicitacaoPage.jsx` e `NovaSolicitacaoPanel.jsx` - painel/offcanvas e formulario.

### P1 - Demais Paginas Autenticadas
- [ ] `/ops/caso/:id` - `src/portals/ops/CasoPage.jsx`.
- [ ] `/ops/equipe` - `src/portals/ops/EquipeOpsPage.jsx`.
- [ ] `/ops/auditoria` - `src/portals/ops/AuditoriaPage.jsx`.
- [ ] `/ops/metricas-ia` - `src/portals/ops/MetricasIAPage.jsx`.
- [ ] `/ops/saude` - `src/portals/ops/SaudePage.jsx`.
- [ ] `/ops/tenant-settings/:tenantId` - `src/portals/ops/TenantSettingsPage.jsx`.
- [ ] `/client/dashboard` - `src/portals/client/DashboardClientePage.jsx`.
- [ ] `/client/equipe` - `src/portals/client/EquipePage.jsx`.
- [ ] `/client/exportacoes` - `src/portals/client/ExportacoesPage.jsx`.
- [ ] `/client/relatorios` - `src/portals/client/RelatoriosClientePage.jsx`.
- [ ] `/client/auditoria` - `src/portals/client/AuditoriaClientePage.jsx`.
- [ ] `/client/report/:id` - `src/portals/client/ClientReportPage.jsx`.
- [ ] `/perfil` - `src/pages/PerfilPage.jsx`.

### P2 - Publicas / Shell
- [ ] `/login` - `src/pages/LoginPage.jsx`.
- [ ] `/r/:token` - `src/pages/PublicReportPage.jsx`.
- [ ] `App/router` - `src/App.jsx`.
- [ ] Layouts compartilhados - `src/ui/layouts/*.jsx`.

## Fases
- [x] Fase 0 - Descoberta, escopo e arquivos de controle.
- [x] Fase 1 - Baseline antes de alteracoes funcionais.
- [x] Fase 2 - CSS seguro e barato.
- [x] Fase 3 - Portalizar Modal e Drawer sem quebrar API.
- [x] Fase 4 - Memoizacao de componentes puros.
- [x] Fase 5 - Memoizacao por pagina.
- [x] Fase 6 - Paginacao client-side segura em listas grandes.
- [x] Fase 7 - Vite/bundle.
- [x] Fase 8 - Auditoria de paginas criticas e verificacao por lint/test/build.
- [x] Fase 9 - Testes finais e relatorio.

## Criterios de Aceite
- Nenhuma falha nova em relacao ao baseline.
- Build, lint e testes nao podem piorar por alteracao desta rodada.
- Modais/drawers continuam fechando por ESC, botao e overlay quando aplicavel.
- Body scroll e foco sao restaurados apos fechar overlays.
- Filtros, busca, ordenacao, acoes, empty/loading/error states e responsividade preservados.
- Nenhum arquivo em `COMPLIANCE_HUB_V2`, backend, Firebase, Firestore rules, payloads ou RBAC alterado.

## Erros Encontrados
| Erro | Tentativa | Resolucao |
|---|---|---|
| Nenhum ate agora | - | - |
| `npm test` falhou antes de alteracoes funcionais | Baseline | Falha registrada como pre-existente em `CasoPage.test.jsx`; nao corrigir fora do escopo |
| `npm run lint` falhou antes de alteracoes funcionais | Baseline | Falha registrada como pre-existente em `functions/index.js`; backend fora do escopo |
| `vite.config.js` gerou warning de chunk circular | Build intermediario apos tentativa de chunk vendor/router | Alteracao de chunk removida por seguranca; fase 7 marcada como pulada sem mudanca final de Vite |
| React Compiler bloqueou `setState` em effect | `npx eslint src` apos paginacao | Corrigido usando pagina derivada/clampada sem effects sincronicos |
