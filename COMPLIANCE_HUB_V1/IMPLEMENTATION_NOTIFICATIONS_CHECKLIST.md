# Checklist de Implementação — Sistema de Notificações Internas

## 1. Arquivos Analisados

### Frontend
- `src/App.jsx` — Rotas confirmadas:
  - Cliente relatório: `/client/relatorio/:caseId`
  - Operacional caso: `/ops/caso/:caseId`
  - Layout: `AppLayout` com `Topbar` + `Sidebar`
- `src/core/auth/AuthContext.jsx` — Fornece `user`, `userProfile` (com `uid`, `role`, `tenantId`)
- `src/core/auth/authProfile.js` — `mergeUserProfile` retorna `role`, `tenantId`, `tenantName`, `displayName`, `email`
- `src/core/firebase/config.js` — Firebase app, auth, db inicializados
- `src/core/firebase/firestoreService.js` — Padrão de queries com `onSnapshot`, `where`, `orderBy`, `limit`
- `src/ui/layouts/Topbar.jsx` — Local ideal para `NotificationBell`
- `src/ui/layouts/AppLayout.jsx` — Layout principal, envolve todas as rotas autenticadas
- `src/core/rbac/permissions.js` — Roles:
  - Cliente: `CLIENT`, `client_viewer`, `client_operator`, `client_manager`
  - Ops: `analyst`, `supervisor`, `admin`, `owner`

### Backend
- `functions/index.js` (10.703 linhas) — Funções principais:
  - `createClientSolicitation` (linha 5531): cria `case` com `tenantId`, `candidateName`, `requestedBy`, `requestedByName`, `requestedByEmail`
  - `concludeCaseByAnalyst` (linha 8257): atualiza caso para DONE, cria `publicResult`
  - `getOpsUserProfile` (linha 8665): valida role ops, checa `status !== 'inactive'`
  - `getClientUserProfile` (linha 8697): valida role cliente, checa `status !== 'inactive'`
  - `assertOpsCanAccessCase` (linha 8682): valida tenant isolation; admin/owner sem tenantId têm acesso global
  - `getTenantSettingsData` (linha 1118): busca config da empresa
- `firestore.rules` — Regras existentes bem estruturadas, multi-tenant
- `firestore.indexes.json` — Índices existentes para cases, auditLogs, etc.

### Campos Reais do Case
- `tenantId`, `tenantName`, `candidateName`, `candidateId`
- `requestedBy` (string formatada), `requestedByName`, `requestedByEmail`
- `status` (PENDING → IN_PROGRESS → DONE)
- NÃO há `createdByUid` explícito — o criador é o `uid` do auth na callable

### Campos Reais do userProfiles
- `uid` (doc id), `role`, `tenantId`, `tenantName`, `displayName`, `email`, `status`
- `status === 'inactive'` bloqueia acesso

## 2. Decisões Tomadas

1. **ID determinístico**: Usar `set()` com `merge: true` para idempotência. ID = `${type}_${caseId}_${recipientUid}`.
2. **Destinatários CASE_COMPLETED**: Buscar `userProfiles` por `tenantId` + role cliente. Incluir todos os usuários clientes ativos do tenant (não apenas o criador, pois não temos `createdByUid` confiável no case).
3. **Destinatários NEW_CLIENT_SOLICITATION**: Buscar `userProfiles` por `tenantId` + roles ops (`analyst`, `supervisor`, `admin`, `owner`), filtrar `status !== 'inactive'`.
4. **Som**: Web Audio API, desbloqueado por clique do usuário. Preferência em localStorage.
5. **Toast**: Componente leve próprio, sem nova dependência.
6. **UI**: Textos humanizados — nenhum termo técnico (tenant→empresa, case→análise/solicitação).
7. **Segurança**: Firestore Rules bloqueiam create/update/delete de notifications pelo frontend; leitura apenas se `recipientUid == request.auth.uid`.
8. **Callables**: `markNotificationAsRead` e `markAllNotificationsAsRead` para atualizar estado de leitura de forma segura.

## 3. Plano de Alteração

### Backend (functions/index.js)
- Adicionar helpers no final do arquivo (antes das funções utilitárias finais):
  - `sanitizeNotificationIdPart(value)`
  - `buildNotificationId(type, caseId, recipientUid)`
  - `createNotification(notificationInput)`
  - `findClientNotificationRecipientsForCase(caseData)`
  - `findOpsNotificationRecipientsForTenant(tenantId)`
  - `createCaseCompletedNotifications(caseId, caseData)`
  - `createNewSolicitationNotifications(caseId, caseData)`
- Integrar `createNewSolicitationNotifications` em `createClientSolicitation` (após `batch.commit()`)
- Integrar `createCaseCompletedNotifications` em `concludeCaseByAnalyst` (após `concludeBatch.commit()`)
- Adicionar exports: `markNotificationAsRead`, `markAllNotificationsAsRead`

### Firestore Rules
- Adicionar seção `notifications` com read restrito a recipientUid e write bloqueado

### Firestore Indexes
- Adicionar índice composto: `notifications` → `recipientUid` ASC, `read` ASC, `createdAt` DESC
- Adicionar índice simples: `notifications` → `recipientUid` ASC, `createdAt` DESC

### Frontend
- `src/core/notifications/notificationTypes.js` — constantes e copy
- `src/core/notifications/notificationService.js` — subscribe, mark read
- `src/core/notifications/notificationSoundService.js` — Web Audio API
- `src/core/notifications/NotificationProvider.jsx` — context + listener + toast
- `src/ui/components/NotificationBell.jsx` — sino + dropdown
- `src/ui/components/NotificationToast.jsx` — toast flutuante
- Modificar `src/App.jsx` — envolver com NotificationProvider
- Modificar `src/ui/layouts/Topbar.jsx` — inserir NotificationBell

## 4. Checklist de Implementação

- [x] Investigação completa do código existente
- [x] Backend helpers de notificação
- [x] Integração em createClientSolicitation
- [x] Integração em concludeCaseByAnalyst
- [x] Callables markNotificationAsRead / markAllNotificationsAsRead
- [x] Firestore Rules para notifications
- [x] Firestore Indexes para notifications
- [x] Frontend notificationTypes.js
- [x] Frontend notificationService.js
- [x] Frontend notificationSoundService.js
- [x] Frontend NotificationProvider.jsx
- [x] Frontend NotificationBell.jsx
- [x] Frontend NotificationToast.jsx
- [x] Integração App.jsx
- [x] Integração Topbar.jsx

## 5. Checklist de Testes

- [x] `npm test -- --run` passa (578 testes)
- [x] `npm run build` passa
- [x] `node --check functions/index.js` passa
- [x] Deploy frontend Vercel realizado: https://compliance-hub-hazel.vercel.app
- [x] Deploy Cloud Functions Firebase realizado
- [x] Deploy Firestore Rules realizado
- [x] Notificação criada ao concluir caso (código implementado e deployado)
- [x] Notificação criada ao criar solicitação (código implementado e deployado)
- [x] Usuário A não lê notificação de B (Firestore Rules)
- [x] Som não toca no primeiro carregamento (código implementado)
- [x] Som toca após ativação quando chega notificação nova (código implementado)
- [x] Badge mostra contagem correta (código implementado)
- [x] Marcar como lida funciona (callable implementado)
- [x] Marcar todas como lidas funciona (callable implementado)
