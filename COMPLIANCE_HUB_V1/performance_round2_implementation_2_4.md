# Performance Round 2.4 - Implementacao

Data: 2026-05-16
Escopo: otimizar paginas cliente P0 (SolicitacoesPage, NovaSolicitacaoPanel, DashboardClientePage) sem regressao.

## App Confirmado

- Raiz: `D:\ComplianceHub\COMPLIANCE_HUB_V1`
- Stack: Vite, React, React Router, Firebase

## Baseline Local Antes Das Mudancas

- `npm test`: 627/627 passando
- `npm run build`: ok
- `npm run lint`: 0/0

## Arquivos Alvo

1. `src/portals/client/SolicitacoesPage.jsx`
2. `src/portals/client/NovaSolicitacaoPanel.jsx`
3. `src/portals/client/DashboardClientePage.jsx`
4. `src/portals/client/NovaSolicitacaoPage.jsx` (wrapper)

## Achados Confirmados

### SolicitacoesPage.jsx
- `renderCard` ja esta com `useCallback` (Rodada 2.2)
- KPI callbacks ja estao com `useCallback` (Rodada 2.2)
- `drawerTabs` em `useMemo` mas com JSX pesado inline e muitas dependencias
- Drawer monta conteudo pesado mesmo quando `selectedCase` muda
- Formulario de correcao dentro do drawer

### NovaSolicitacaoPanel.jsx
- Constantes de modulo ja existem: `STEP_LABELS`, `INITIAL_FORM`, `BRAZIL_UF_OPTIONS`
- Steps mobile usam `style={display: 'none'}` - conteudo continua no DOM
- `SOCIAL_FIELDS` recriada a cada render (pode ser movida para fora)
- Formulario controlado grande

### DashboardClientePage.jsx
- `metrics` ja memoizado
- `actionItems` array literal recriado a cada render
- `navigateToCases` nao memoizado

### NovaSolicitacaoPage.jsx
- Apenas wrapper do painel, simples

## Checklist De Implementacao

### FASE 3: SolicitacoesPage.jsx
- [x] Extrair tabs do drawer para componentes memoizados (6 componentes React.memo)
- [x] Reduzir custo de drawerTabs (usa componentes memoizados via props)
- [x] Evitar render drawer quando nao ha selectedCase (ja existia)

### FASE 4: NovaSolicitacaoPanel.jsx
- [x] Implementar render condicional dos steps mobile (3 secoes)
- [x] Mover SOCIAL_FIELDS para constante de modulo
- [x] Preservar estado ao trocar steps (form state preservado)

### FASE 5: DashboardClientePage.jsx
- [x] Memoizar actionItems (useMemo antes dos early returns)
- [x] Memoizar navigateToCases (useCallback)

### FASE 6: NovaSolicitacaoPage.jsx
- [x] Verificar se precisa de otimizacao (wrapper simples, nao necessario)

### FASE 7: Corrigir teste pre-existente
- [x] CasoPage.test.jsx - prefillNarratives (passou no baseline, nao precisou correcao)

## Resultado Pos-Implementacao

- `npm test`: 627/627 passando (48 test files)
- `npm run build`: ok (2.34s)
- `npm run lint`: 0/0

### Mudancas Aplicadas

**SolicitacoesPage.jsx:**
- 6 componentes de tab do drawer extraidos como `React.memo`: `DrawerResumoTab`, `DrawerDetalhesTab`, `DrawerSocialTab`, `DrawerComunicacaoTab`, `DrawerTimelineTab`, `DrawerDossieTab`
- `drawerTabs` reescrito para usar componentes memoizados via props
- Removida prop `has` nao utilizada do `DrawerDetalhesTab`

**NovaSolicitacaoPanel.jsx:**
- Secao 1 (Identidade): render condicional `{(!isMobile || step === 0) && (...)}`
- Secao 2 (Fontes digitais): render condicional `{showSocialSection && (!isMobile || step === 1) && (...)}`
- Secao 3 (Contexto): render condicional `{(!isMobile || step === 2) && (...)}`
- `SOCIAL_FIELDS` movida para constante de modulo
- 3 usos inline do array de redes sociais substituidos por `SOCIAL_FIELDS`

**DashboardClientePage.jsx:**
- `navigateToCases` envolvido em `useCallback`
- `actionItems` envolvido em `useMemo` e movido para antes dos early returns (correcao de lint)

**NovaSolicitacaoPage.jsx:**
- Nenhuma alteracao necessaria (wrapper simples de 25 linhas)
