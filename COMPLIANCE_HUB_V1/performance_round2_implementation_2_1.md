# Performance Round 2.1 - Implementacao

Data: 2026-05-15
Escopo: reduzir re-render global por contextos, hooks e servico Firebase sem alterar UI, contratos publicos, backend, payloads, RBAC, permissões ou Firestore rules.

## App Confirmado

- Raiz: `D:\ComplianceHub\COMPLIANCE_HUB_V1`
- `package.json`: `D:\ComplianceHub\COMPLIANCE_HUB_V1\package.json`
- Stack: Vite, React, React Router, Firebase

## Arquivos Permitidos

- [x] `src/core/auth/AuthContext.jsx`
- [x] `src/core/contexts/TenantContext.jsx`
- [x] `src/hooks/useCases.js`
- [x] `src/hooks/useCandidates.js`
- [x] `src/hooks/useAuditLogs.js`
- [x] `src/hooks/useTenantAuditLogs.js`
- [x] `src/core/firebase/firestoreService.js`

## Baseline Conhecido

- `npm test`: 627 testes passando.
- `npm run build`: passando, 0 warnings.
- `npm run lint`: falhando por 2 erros pre-existentes em `functions/index.js`.

## Baseline Local Antes Das Mudancas

- [x] `npm test`: passou. 48 arquivos, 627 testes passando. Duracao aproximada: 9.27s.
- [x] `npm run build`: passou. 187 modulos transformados, 0 warnings. Duracao aproximada: 9.80s.
- [x] `npm run lint`: falhou somente pelos 2 erros pre-existentes em `functions/index.js`:
  - `functions/index.js:6493` - `publicSnapshot` atribuido e nao usado.
  - `functions/index.js:9376` - chave duplicada `id`.

## Checklist De Implementacao

- [x] AuthContext: estabilizar `login`, `logout`, `refreshProfile` com `useCallback`.
- [x] AuthContext: memoizar `value` do provider com `useMemo`.
- [x] TenantContext: estabilizar `selectTenant` com `useCallback`.
- [x] TenantContext: memoizar `selectedTenantLabel` se necessario.
- [x] TenantContext: memoizar `value` do provider com `useMemo`.
- [x] useCases: memoizar retorno e filtros demo/mock.
- [x] useCandidates: memoizar retorno.
- [x] useAuditLogs: memoizar retorno e filtros demo/mock.
- [x] useTenantAuditLogs: memoizar retorno e filtros demo/mock.
- [x] firestoreService: cachear import dinamico de `firebase/functions`.
- [x] firestoreService: corrigir `withFirestoreTimeout` com cleanup de timer se isolado e seguro.

## Checklist De Testes

- [x] `npm test`: passou. 48 arquivos, 627 testes passando. Duracao aproximada: 7.39s.
- [x] `npm run build`: passou. 187 modulos transformados, build em ~5.54s.
- [x] `npm run lint`: falhou somente pelos 2 erros pre-existentes em `functions/index.js`:
  - `functions/index.js:6493` - `publicSnapshot` atribuido e nao usado.
  - `functions/index.js:9376` - chave duplicada `id`.
- [ ] Smoke cliente: login, dashboard, solicitacoes, drawer, nova solicitacao, auditoria, relatorios, exportacoes, perfil.
- [ ] Smoke ops: login, fila, casos, caso, clientes, relatorios.

## Resultado Pos-Implementacao

- Rodada 2.1 implementada nos arquivos permitidos.
- Contextos globais agora estabilizam funcoes e valores do provider para reduzir re-renders por identidade de objeto/funcoes.
- Hooks de dados agora retornam objetos/arrays estabilizados para estados demo, espera, skip e live sem alterar queries.
- `firestoreService` agora reutiliza o import dinamico de `firebase/functions` e limpa timers de timeout quando a promise resolve/rejeita.
- Validacao automatizada: testes e build passando; lint permanece bloqueado apenas por erros pre-existentes fora do escopo.
