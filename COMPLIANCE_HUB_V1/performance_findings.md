# Findings de Performance - ComplianceHub V1

## Contexto Confirmado
- Gargalo percebido de fluidez esta no frontend React/CSS, nao em Vercel/backend.
- Backend e consultas Firestore ficam fora de escopo nesta rodada.
- Repositorio esta muito sujo; alteracoes precisam ser cirurgicas e limitadas ao V1.

## Descobertas Registradas

| Arquivo | Trecho/Componente | Problema | Risco | Correcao Proposta | Criterio de Teste |
|---|---|---|---|---|---|
| `src/ui/components/Modal/Modal.jsx` | render inline em `return` | Modal participa da arvore do pai e pode ficar preso em stacking context | Medio | Usar `createPortal(..., document.body)` preservando API/foco/ESC | Testar abrir/fechar, ESC, overlay, role dialog |
| `src/ui/components/Drawer/Drawer.jsx` | render inline em `return` | Drawer participa da arvore do pai e pode gerar z-index/re-render desnecessario | Medio | Usar `createPortal(..., document.body)` preservando tabs/foco/ESC | Testar abrir/fechar, ESC, overlay, role dialog |
| `src/ui/components/Drawer/Drawer.css` | `.drawer-overlay` com `backdrop-filter: blur(3px)` | Blur em overlay custa compositing em mobile | Baixo | Reduzir blur e desativar em mobile | Smoke mobile abrindo drawer |
| `src/ui/components/Modal/Modal.css` | `.app-modal__overlay` com `backdrop-filter: blur(4px)` | Blur em overlay custa compositing em mobile | Baixo | Reduzir blur e desativar em mobile | Smoke mobile abrindo modal |
| `src/index.css` | varios `transition: all` e sem `contain` | Transicoes amplas e falta de isolamento prejudicam paint/layout | Baixo | Trocar por propriedades especificas e adicionar contain em containers seguros | Build/lint e smoke visual |
| `src/portals/ops/FilaPage.jsx` | `stats` linhas 97-102 | Quatro `filter` em `cases` a cada render | Baixo | `useMemo` com single-pass reduce | Contagens iguais nos KPIs |
| `src/portals/client/SolicitacoesPage.jsx` | `drawerTabs` linhas 255-446 | JSX grande recriado a cada render | Medio | Envolver em `useMemo` com dependencias corretas | Drawer mostra mesmas tabs e acoes |
| `src/portals/ops/RelatoriosPage.jsx` | `filtered`, contadores | Filtragem/contagens recriadas a cada render | Baixo | `useMemo` | Busca e contadores preservados |
| `src/portals/ops/ClientesPage.jsx` | enabled phases mobile/desktop | Computacao duplicada por row | Baixo | Preparar rows derivados ou helper memoizado simples | Cards/tabela iguais |
| `src/portals/ops/FilaPage.jsx` | `queue.map` desktop e mobile | Renderiza todos os itens filtrados | Medio | Paginar depois dos filtros, 50 por pagina | Paginacao, bulk e acoes funcionando |
| `src/portals/ops/CasosPage.jsx` | `filtered.map` | Renderiza todos os casos filtrados | Medio | Paginar depois dos filtros, 50 por pagina | Filtros e abrir caso funcionando |
| `src/portals/client/SolicitacoesPage.jsx` | `filteredCases.map` | Renderiza todos os casos filtrados | Medio | Paginar depois dos filtros/ordenacao, 50 por pagina | Busca, ordenacao e drawer funcionando |
| `src/portals/ops/RelatoriosPage.jsx` | `filtered.map` | Renderiza todos os relatorios filtrados | Baixo | Paginar depois da busca, 50 por pagina | Revogar/copiar/abrir item correto |
| `src/portals/ops/ClientesPage.jsx` | `filtered.map` | Renderiza todos os clientes filtrados | Baixo | Paginar depois da busca/filtro, 50 por pagina | Configurar tenant correto |
| `vite.config.js` | `manualChunks` sem `react-router-dom`/vendor | Bundle compartilhado pode ficar menos eficiente | Baixo | Adicionar chunk simples para router e fallback vendor | Build sem erro, rotas lazy ok |

## Componentes Memoizados
| Componente | Por que e puro | Props relevantes | Risco de stale render | Teste |
|---|---|---|---|---|
| `KpiCard` | Renderiza somente props e evento recebido | `label`, `value`, `color`, `onClick` | Baixo; callback novo ainda re-renderiza quando necessario | Testes de paginas focadas |
| `StatusBadge` | Mapeia `status/audience` para label/classe | `status`, `audience` | Baixo; sem estado interno | Testes de paginas focadas |
| `RiskChip` | Mapeia valor para label/classe | `value`, `size`, `showIcon`, `bold`, `audience` | Baixo; sem estado interno | Testes de paginas focadas |
| `ScoreBar` | Renderiza score clamped | `score`, `audience` | Baixo; sem estado interno | Testes de paginas focadas |
| `SlaBadge` | Estado interno apenas para tick de SLA; props imutaveis por snapshot | `caseData`, `size`, `audience` | Medio baixo se `caseData` fosse mutado in-place; Firestore gera objetos novos | Testes de paginas focadas |
| `PageHeader` | Renderiza conteudo de props | `eyebrow`, `title`, `description`, `actions`, `metric`, `backAction` | Baixo; props JSX novas re-renderizam quando necessario | Testes de paginas focadas |
| `MobileDataCardList` | Renderiza por props e media query | `items`, `renderCard`, `children`, `loading` | Baixo; hook de media query continua interno | Testes de paginas focadas |

## Resultado Fase 7
- Tentativa de chunk `react-router` + `vendor` gerou warning de build: chunk circular `vendor -> react-dom -> vendor` e chunk vazio `react-router`.
- Mudanca foi removida por seguranca. Nenhuma alteracao final em `vite.config.js` deve permanecer nesta fase.

## Pendencias de Confirmacao Via Teste
- Confirmado: `npx eslint src` passou sem output.
- Confirmado: `npm test` passou com 48 arquivos e 627 testes.
- Confirmado: `npm run build` passou em 2.28s, sem warning de chunk apos revert do Vite.
- Confirmado: `npm run lint` completo segue falhando somente nos 2 erros pre-existentes em `functions/index.js`, fora do escopo.
- Confirmado: smoke local em rotas demo P0 principais nao apresentou erros de console.
- Pendente residual: `/demo/ops/clientes` redireciona para `/`; validacao ficou por teste focado/build, nao por smoke visual direto.

## Correcao de Lint React Compiler
- `src/portals/ops/CasosPage.jsx`, `FilaPage.jsx`, `RelatoriosPage.jsx`, `ClientesPage.jsx` e `src/portals/client/SolicitacoesPage.jsx` foram ajustados para evitar `setState` sincronico em `useEffect` de paginacao.
- A pagina exibida agora e derivada por `safeCurrentPage = Math.min(currentPage, totalPages)`, preservando a navegacao e evitando render extra.
- Dependencias desnecessarias de `useCallback` em `SolicitacoesPage.jsx` foram removidas conforme lint.
