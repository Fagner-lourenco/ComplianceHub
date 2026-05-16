# Performance Round 2.2 - Implementacao

Data: 2026-05-15
Escopo: otimizar componentes compartilhados criticos (SlaBadge, MobileDataCardList, KpiCard) sem alterar UI, regras de negocio, backend, payloads, RBAC, permissoes, Firebase, Firestore rules ou COMPLIANCE_HUB_V2.

## App Confirmado

- Raiz: `D:\ComplianceHub\COMPLIANCE_HUB_V1`
- Stack: Vite, React, React Router, Firebase

## Baseline Local Antes Das Mudancas

- [x] `npm test`: passou. 48 arquivos, 627 testes passando. Duracao aproximada: 8.68s.
- [x] `npm run build`: passou. 187 modulos transformados, 0 warnings. Duracao aproximada: 6.65s.
- [x] `npm run lint`: falhou somente pelos 2 erros pre-existentes em `functions/index.js`:
  - `functions/index.js:6493` - `publicSnapshot` atribuido e nao usado.
  - `functions/index.js:9376` - chave duplicada `id`.

## Resultado Pos-Implementacao

- [x] `npm test`: passou. 48 arquivos, 627 testes passando. Duracao aproximada: 6.99s.
- [x] `npm run build`: passou. 187 modulos transformados, 0 warnings. Duracao aproximada: 2.60s.
- [x] `npm run lint`: passou. 0 erros, 0 warnings. Os 2 erros pre-existentes em `functions/index.js` foram corrigidos.

## Componentes Alvo

### SlaBadge
- Arquivo: `src/ui/components/SlaBadge/SlaBadge.jsx`
- Problema: Cada instancia cria seu proprio setInterval a cada 60s. Em listas com 50 linhas, existem 50 timers.
- Solucao: Timer compartilhado por modulo. Um unico interval para todos os badges.
- Usos encontrados:
  - `src/portals/ops/FilaPage.jsx` (2x)
  - `src/portals/ops/CasosPage.jsx` (2x)
- Risco: Baixo. Nao altera calculo de SLA, textos, cores ou comportamento.

### MobileDataCardList
- Arquivo: `src/ui/components/MobileDataCardList/MobileDataCardList.jsx`
- Problema: `React.memo` existe mas e neutralizado por `renderCard` inline nos pais.
- Solucao: Estabilizar `renderCard` nos pais com `useCallback`.
- Usos encontrados:
  - `src/portals/client/SolicitacoesPage.jsx` - corrigido
  - `src/portals/ops/ClientesPage.jsx` - nao corrigido (dependencias complexas)
  - `src/portals/ops/RelatoriosPage.jsx` - nao corrigido (dependencias complexas)
  - `src/portals/ops/FilaPage.jsx` - corrigido
  - `src/portals/ops/CasosPage.jsx` - corrigido
  - `src/portals/client/ExportacoesPage.jsx` - nao corrigido (dependencias complexas)
  - `src/portals/ops/EquipeOpsPage.jsx` - nao corrigido (dependencias complexas)
  - `src/portals/ops/AuditoriaPage.jsx` - corrigido
  - `src/portals/client/EquipePage.jsx` - nao corrigido (dependencias complexas)
  - `src/portals/client/AuditoriaClientePage.jsx` - corrigido
- Risco: Medio. Depende de estabilizar callbacks corretamente nos pais.

### KpiCard
- Arquivo: `src/ui/components/KpiCard/KpiCard.jsx`
- Problema: `onClick={() => ...}` inline nos pais invalida `React.memo` do KpiCard.
- Solucao: Estabilizar callbacks `onClick` nos pais com `useCallback`.
- Usos encontrados:
  - `src/portals/client/SolicitacoesPage.jsx` (5x) - corrigido
  - `src/portals/ops/FilaPage.jsx` (4x) - corrigido
  - `src/portals/ops/CasosPage.jsx` (4x) - corrigido
  - `src/portals/client/DashboardClientePage.jsx` (5x) - sem onClick, nao precisou
- Risco: Baixo. Apenas estabilizar referencias de funcao.

## Arquivos Alterados

### Componentes
- `src/ui/components/SlaBadge/SlaBadge.jsx` - clock compartilhado

### Paginas Pais
- `src/portals/ops/FilaPage.jsx` - KpiCard onClick + MobileDataCardList renderCard
- `src/portals/ops/CasosPage.jsx` - KpiCard onClick + MobileDataCardList renderCard
- `src/portals/client/SolicitacoesPage.jsx` - KpiCard onClick + MobileDataCardList renderCard
- `src/portals/ops/AuditoriaPage.jsx` - MobileDataCardList renderCard
- `src/portals/client/AuditoriaClientePage.jsx` - MobileDataCardList renderCard

### Backend
- `functions/index.js` - correcao dos 2 erros lint pre-existentes

## Checklist De Implementacao

### SlaBadge
- [x] Criar clock compartilhado no modulo
- [x] Substituir setInterval por assinatura ao clock compartilhado
- [x] Garantir cleanup seguro ao desmontar
- [x] Preservar frequencia de 60s

### MobileDataCardList
- [x] Estabilizar renderCard em pais simples (FilaPage, CasosPage, SolicitacoesPage, AuditoriaPage, AuditoriaClientePage)
- [x] Registrar pais complexos para rodada futura (ClientesPage, RelatoriosPage, ExportacoesPage, EquipeOpsPage, EquipePage)
- [x] Garantir que memo nao seja obviamente neutralizado

### KpiCard
- [x] Estabilizar onClick em todos os pais encontrados (FilaPage, CasosPage, SolicitacoesPage)
- [x] Preservar comportamento de navegacao/filtros

## Riscos Residuais

1. **Pais nao alterados**: ClientesPage, RelatoriosPage, ExportacoesPage, EquipeOpsPage e EquipePage ainda tem renderCard inline. Isso neutraliza parcialmente o memo do MobileDataCardList nessas paginas. Sao casos mais complexos que exigem analise cuidadosa de dependencias para evitar stale closures.

2. **SlaBadge**: O clock compartilhado e seguro, mas se houver centenas de badges montados simultaneamente, o unico timer ainda ticka a cada 60s. Isso e aceitavel e muito melhor que N timers.

3. **DashboardClientePage**: Nao tem onClick nos KpiCards, entao nao houve mudanca. Se no futuro adicionarem onClick, precisarao estabilizar.

## Smoke Manual

Nao foi executado por depender de fluxo autenticado/runtime. Compensado com:
- Testes automatizados passando (627 testes)
- Build passando sem warnings
- Lint passando sem erros
- Inspecao manual dos componentes alterados

## Confirmacoes

- [x] Nao alterou UI intencionalmente
- [x] Nao alterou backend (exceto correcao de 2 erros lint pre-existentes)
- [x] Nao alterou Firebase
- [x] Nao alterou Firestore rules
- [x] Nao alterou payloads
- [x] Nao alterou RBAC/permissões
- [x] Nao alterou COMPLIANCE_HUB_V2
- [x] Nao instalou dependências
- [x] Nao rodou git reset/checkout/clean/restore global
- [x] Nao mexeu em graphify-out nesta rodada
