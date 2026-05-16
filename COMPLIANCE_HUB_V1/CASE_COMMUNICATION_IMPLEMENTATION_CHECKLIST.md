# CASE_COMMUNICATION_IMPLEMENTATION_CHECKLIST

## 0. Arquitetura Confirmada
- [x] Projeto: ComplianceHub V1 (React + Firebase Functions + Firestore)
- [x] Frontend: React 19 + Vite, ES modules
- [x] Backend: Firebase Functions Gen2, Node 22, CommonJS
- [x] Database: Firestore (NoSQL documental)
- [x] Auth: Firebase Auth + custom claims

## 1. Rotas Reais
### Portal Cliente
- [x] Lista: /client/solicitacoes → SolicitacoesPage.jsx
- [x] Detalhe: Drawer dentro de SolicitacoesPage

### Portal Operacional
- [x] Lista: /ops/fila → FilaPage.jsx, /ops/casos → CasosPage.jsx
- [x] Detalhe: /ops/caso/:id → CasoPage.jsx

## 2. Arquivos de UI
- [x] Cliente: SolicitacoesPage.jsx (com drawer/abas)
- [x] Ops: CasoPage.jsx (página única grande)
- [x] Componente comentários: DossierFinalComments (não existe no V1, usa outro)

## 3. Funções Backend Reais
- [x] createClientSolicitation (functions/index.js)
- [x] returnCaseToClient (functions/index.js:6813)
- [x] submitClientCorrection (functions/index.js:5716)
- [x] concludeCaseByAnalyst (functions/index.js)
- [x] getOpsUserProfile, getClientUserProfile
- [x] assertOpsCanAccessCase
- [x] writeAuditEvent (functions/audit/writeAuditEvent.js)
- [x] writeClientCaseMirror, buildClientCasePayload (functions/index.js:4794)

## 4. Sistema de Notificações Existente
- [x] Coleção: notifications (top-level)
- [x] Tipos: CASE_COMPLETED, NEW_CLIENT_SOLICITATION
- [x] Frontend: NotificationProvider, notificationService
- [x] Backend: createNotification, findClientNotificationRecipientsForCase, findOpsNotificationRecipientsForTenant
- [x] Funções callable: markNotificationAsRead, markAllNotificationsAsRead
- [x] Som: notificationSoundService.js

## 5. Campos Reais do Documento de Caso
- [x] cases/{caseId}: tenantId, status, candidateName, cpf, socialProfiles, etc.
- [x] clientCases/{caseId}: mirror controlado com buildClientCasePayload

## 6. Roles Reais
- [x] Cliente: client_viewer, client_operator, client_manager (CLIENT_VIEW_ROLES)
- [x] Ops: analyst, supervisor, admin, owner (OPS_ROLES)
- [x] Legacy: CLIENT

## 7. Regras Firestore
- [x] firestore.rules existe (~206 linhas)
- [x] firestore.indexes.json existe (14 índices compostos)

## Plano de Implementação
1. [ ] Criar coleção caseMessages
2. [ ] Criar sendCaseMessage callable
3. [ ] Criar markCaseCommunicationRead callable
4. [ ] Atualizar returnCaseToClient com mensagem automática
5. [ ] Atualizar submitClientCorrection com mensagem automática
6. [ ] Atualizar buildClientCasePayload com campos de comunicação
7. [ ] Adicionar regras Firestore para caseMessages
8. [ ] Adicionar índices para caseMessages
9. [ ] Criar serviço frontend subscribeToCaseMessages
10. [ ] Criar componente CaseCommunicationPanel
11. [ ] Integrar em SolicitacoesPage (aba Comunicação)
12. [ ] Integrar em CasoPage (painel/bloco Comunicação)
13. [ ] Adicionar tipos de notificação CASE_MESSAGE_FROM_CLIENT, CASE_MESSAGE_FROM_OPS
14. [ ] Integrar notificações no sendCaseMessage
15. [ ] Testar e validar
