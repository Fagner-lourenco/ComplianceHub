# Design – Fechamento Matriz ComplianceHub V2 (2026-04-22)

## Visão Geral
Objetivo: transformar todos os itens da matriz classificados como `IMPLEMENTADO PARCIALMENTE`, `IMPLEMENTADO MAS DIVERGENTE DO PLANO` ou `NÃO IMPLEMENTADO` em **`IMPLEMENTADO E ALINHADO`**. Estratégia divide em blocos de dependência, garante consistência de dados, elimina fallbacks legados e adiciona cobertura de testes.

## Blocos de Execução
1. **Infraestrutura Base** – Firestore rules, índices, buckets para `payloadRef`.
2. **Publicação/Relatório (Epic 0)** – Refatorar `ReportSectionResolver` para usar somente `ReportSnapshot.sectionsV2`; remover fallback otimista. Atualizar `ClientProjection.reportAvailability` para fonte única. Ajustar UI (`RelatoriosClientePage.jsx`, `SolicitacoesPage.jsx`). Testes contrato goldens.
3. **Provider Ledger (Epic 1)** – Transação idempotente usando `requestId`; gravar `payloadRef` no Cloud Storage; garantir consistência entre ledger, rawSnapshot e providerRecord.
4. **Raw Snapshots / Provider Records (Epic 2)** – Unificar escrita em mesma transação; eliminar fallback legado.
5. **Evidence Store (Epic 3)** – Persistir `evidenceItems` em Firestore, remover armazenamento em memória; atualizar consumidores.
6. **Risk Signals / Decisioning (Epic 4)** – Unificar cálculo em `riskSignals.computeScore`; remover `scoreLegacy`; atualizar `Decision`.
7. **Cockpit Mínimo (Epic 5)** – UI consome apenas V2 entitlements; substituir mocks de timeline/divergências por consultas reais.
8. **Admin Tenant / Contrato (Epic 6.1)** – Centralizar escrita de contrato em `tenantService.saveContract`; audit trail em `tenantAudit`.
9. **Subject/Dossiê (Epic 7)** – Persistir `subjects`, `persons`, `companies`, `facts`; histórico em `subjectHistory`.
10. **Timeline / Divergências (Epic 8)** – Persistir `timelineEvents` e `providerDivergences`; UI exibe divergências não resolvidas.
11. **Portal Cliente V2 (Epic 9)** – Migrar todas as chamadas para `/api/v2/*`; remover fallback de abertura de relatório.
12. **Billing / Consumo (Epic 10)** – Migrar relatórios para usar somente `usageMeters`; desativar `billingEntries` nas telas, mantê‑los só como camada de migração.
13. **Freshness Policy (W1.2)** – Integrar `v2FreshnessPolicy` no pipeline de ingestão.
14. **Billing Resolver + Presets (W1.3)** – Refatorar `v2BillingResolver` para usar apenas `usageMeters` e novos presets.
15. **Comparativo Histórico (W2.2)** – Utilizar `ReportSnapshot` V2 para comparação.
16. **Senior Approval UI/Workflow (W2.3)** – UI persiste estado em `approvalRequests`; gate verifica `approvedBySenior`.
17. **Dashboards Operacionais (W2.4)** – Fontes de dados V2 (usage, casos, senior approvals).
18. **Exportação de Auditoria (W2.5)** – Export CSV/JSON com filtros; RBAC aplicado.
19. **Premium / Épico 11** – Implementar serviços básicos: `watchlistService`, `monitoring`, `alerts`, `graphAnalytics`; persistência em Firestore; endpoints CRUD.

## Dependências entre Blocos
- Bloco 1 antes de todos.
- Blocos 2‑4 dependem de infraestrutura (1).
- Bloco 5 depende de 2‑4.
- Bloco 6 depende de 5.
- Bloco 7‑9 dependem de 5 para UI.
- Bloco 10 depende de 2‑4.
- Blocos 11‑13 dependem de 9‑10.
- Blocos 14‑18 dependem de 11‑13.
- Bloco 19 pode iniciar após 1 e 3 (bucket disponível).

## Estratégia de Testes
- **Unit**: cada função backend (`providerLedger`, `riskSignals.computeScore`, `v2FreshnessPolicy`).
- **Integration**: fluxo completo de publicação (snapshot → relatório → cliente). Usa Firestore emulator.
- **UI**: React Testing Library para páginas críticas (`CasoPage`, `RelatoriosClientePage`, `TenantSettingsPage`).
- **Contract / Golden**: snapshots JSON de relatórios comparados com esperado.
- **Security**: testes de acesso cross‑tenant, privilégio escalado.

## Atualização do Plano
Ao final de cada bloco, atualizar `COMPLIANCE_HUB_V2/12_plano_execucao/PLANO_EXECUCAO_V2_MASTER.md` com seção *Status* e *Observações*.

## Próximos Passos
- Revisar design internamente.
- Usuário revisar documento.
- Após aprovação, invocar `writing-plans` skill para gerar plano de implementação detalhado.
