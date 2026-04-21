# Matriz comparativa ultradetalhada

## Leitura executiva

ComplianceHub, Marble e Ballerine nao competem exatamente na mesma categoria:

- ComplianceHub atual: due diligence operacional, enriquecimento, revisao humana, portal cliente e relatorio.
- Marble: motor de decisao, AML/screening, case management, continuous screening e data model.
- Ballerine: workflow/KYC/KYB, collection flow, documentos, manual review e backoffice.

Recomendacao central: ComplianceHub V2 deve ser arquitetura propria, BigDataCorp-first, inspirada por Marble e Ballerine.

## Matriz

| Criterio | ComplianceHub atual | Marble | Ballerine | Gap | Risco | Recomendacao | Prioridade | Evidencias |
|---|---|---|---|---|---|---|---|---|
| Visao de produto | Due diligence operacional com relatorio | Decisioning/AML/screening | KYC/KYB/workflow/manual review | Falta plataforma investigativa entidade-centrica | Produto ficar preso em CRUD/caso | V2 como plataforma investigativa PF/PJ | Alta | `src/App.jsx`, `functions/index.js`, Marble README/routes, Ballerine README |
| Publico-alvo | Clientes/franquias/analistas | Fintechs/compliance/AML ops | Fintechs/marketplaces/KYC/KYB | ComplianceHub precisa mercado brasileiro investigativo | Copiar foco errado | Posicionar para due diligence, risco e investigacao corporativa | Alta | Portais client/ops; Marble/Ballerine READMEs |
| Case management | Existe caso, status, fila e revisao | Forte: cases, inboxes, events, decisions | Forte via workflow/case-management | Falta eventos/decisoes como dominios separados | Caso continuar documento universal | Criar `InvestigationCase`, `CaseEvent`, `Decision` | Alta | `functions/index.js`, `models/case.go`, `workflowRuntimeData` |
| Workflow | Linear por status e triggers | Workflows ligados a decisions/scenarios | Workflow runtime forte | Falta workflow formal versionado | Conclusao/publicacao driftarem | Criar workflow simples por caso e revisao | Alta | `functions/index.js`, `models/workflows.go`, `workflow.service.ts` |
| Rules/decisioning | Score/veredito calculado na tela/backend | Forte, versionado, explicado | Rules engine + workflow | Falta decision model auditavel | Score opaco | Criar `RiskSignal` e `Decision` antes de rule builder | Alta | `CasoPage.jsx`, `decision_usecase.go`, `rule-engine` |
| Entities/dossier | Nao confirmado como dominio proprio | Client360/data model/pivots | Entities/business/end-user | Falta dossie PF/PJ | Reconsultas e duplicacao | Criar `Subject`, `Person`, `Company`, `Dossier` | Alta | `clientPortal`, Marble Client360, Ballerine schema |
| Evidencias/proveniencia | Auditoria existe; `_source` parcial | Decisions/screening/rules persistidos | Workflow logs/documentos | Falta evidence store por fato | Baixa defensabilidade | Criar `SourceSnapshot`, `ProviderRecord`, `Evidence` | Alta | `normalizers/bigdatacorp.js`, Marble screening, Ballerine Document |
| Screening | Criminal/trabalhista/mandado por provedores | Forte screening/sanctions | AML/KYC plugins | Falta screening canonico provider-agnostic | Vendor lock-in | Normalizar screening como sinais/evidencias | Media | adapters ComplianceHub, Marble screenings |
| Monitoramento continuo | Nao confirmado | Forte continuous-screenings | Alertas/transaction monitoring | Falta watchlist/monitoring | Prometer antes de suportar | Fundacao na V2, produto na V3 | Media | Marble continuous, Ballerine alerts |
| Relatorios | Diferencial forte | Nao foco central | Business reports existem | Relatorio precisa snapshot imutavel | Relatorio divergente do revisado | Report snapshot versionado | Alta | `reportBuilder`, `publicReports`, Ballerine BusinessReport |
| Portal cliente | Forte e simples | Nao foco igual | Collection flow forte | Falta coleta/correcao mais estruturada | Expor demais | Manter simples; adicionar pendencias/documentos | Alta | `SolicitacoesPage`, `NovaSolicitacaoPage`, Ballerine collection-flow |
| UX operacional | CasoPage poderosa, mas grande | Workspace por case/pivot/decision | Backoffice por entidade/workflow | Falta cockpit investigativo | Analista perder produtividade | Cockpit com dossie, timeline, evidencias, grafo | Alta | `CasoPage.jsx`, Marble CaseManager, Ballerine backoffice |
| Multi-tenant | Firestore rules e tenantId | Organizacoes/permissions | Projects/customers | Falta politicas por modulo/plano | Vazamento/custo | Centralizar tenant policy e quotas | Alta | `firestore.rules`, `permissions.js` |
| Integracoes | Adapters por provider | Screening providers | Plugin providers | Falta provider contract unico | Acoplamento a payload | Criar provider SDK interno | Alta | `functions/adapters`, Ballerine plugins |
| Escalabilidade | Serverless/Firestore | Go/Postgres/Redis/River | Nest/Prisma/Redis/BullMQ | Falta jobs formais e camadas de dados | Reprocessamento caro | Evoluir incrementalmente com filas e snapshots | Media | `functions/index.js`, Marble/Ballerine deps |
| Mercado brasileiro | Forte em CPF/processos/mandados | Nao confirmado | Nao confirmado | Diferencial do ComplianceHub | Copiar produto estrangeiro | Criar dominio brasileiro proprio | Alta | adapters Judit/Escavador/FonteData/BigDataCorp |

## Conclusao da matriz

ComplianceHub ja tem o melhor encaixe comercial para o mercado alvo. Marble e Ballerine tem maturidade arquitetural em areas diferentes, mas nenhum dos dois resolve sozinho o problema de uma plataforma investigativa brasileira BigDataCorp-first.

