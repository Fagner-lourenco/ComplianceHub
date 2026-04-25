# Auditoria Completa: Navegação, Produtos e Organização da UI

> Data: 2026-04-24
> Escopo: Frontend + Backend (produtos, schemas, rotas, navegação)

---

## 1. Páginas Existentes no APP (16 páginas principais)

| # | Página | Rota | Layout | Descrição atual |
|---|--------|------|--------|-----------------|
| 1 | **DossierListPage** | `/dossie` | DossierLayout | Listagem de dossiês/análises |
| 2 | **DossierSearchPage** | `/dossie/create` | DossierLayout | Tela de busca/criação de dossiê |
| 3 | **CustomProfilePage** | `/dossie/custom-profile` | DossierLayout | Configurador de perfil customizado |
| 4 | **DossierDetailPage** | `/dossie/:id` | DossierLayout | Visualização detalhada do dossiê |
| 5 | **DossierProcessingPage** | `/dossie/:id/processing` | DossierLayout | Tela de acompanhamento de processamento |
| 6 | **ProductHubPage** | `/client/hub` | DossierLayout | Hub de produtos (catálogo de análises) |
| 7 | **ProductPipelinePage** | `/client/pipeline/:productKey` | *(sem layout)* | Wizard de criação do dossiê |
| 8 | **EntityGraphPage** | `/explore/:entityId?` | DossierLayout | Grafo de vínculos (LinkMap) |
| 9 | **WatchlistPage** | `/watchlists` | DossierLayout | Monitoramento contínuo |
| 10 | **SeniorReviewPage** | `/senior-review` | DossierLayout | Fila de revisão senior |
| 11 | **ReportsPage** | `/reports` | DossierLayout | Publicação de relatórios |
| 12 | **BillingPage** | `/billing` | DossierLayout | Consumo e créditos |
| 13 | **TenantSettingsPage** | `/settings/tenant` | DossierLayout | Configurações do tenant |
| 14 | **UserManagementPage** | `/settings/users` | DossierLayout | Gestão de usuários |
| 15 | **AuthLayout** | `/login` | AuthLayout | Login/Cadastro |
| 16 | **NotFoundPage** | `*` | AppShell | 404 |

**✅ VERIFICADO:** A `ProductPipelinePage` (wizard de criação) **já usa `DossierLayout`**. O TopProductHeader está presente durante a criação.

---

## 2. Produtos / Pipelines (frontend)

Existem **11 produtos** definidos em `core/productPipelines.js`:

| Produto | Família | Tipo | Schema Backend | Status |
|---------|---------|------|----------------|--------|
| `dossier_pf_basic` | dossie | PF | ✅ `dossier_pf_basic` | OK |
| `dossier_pf_full` | dossie | PF | ✅ `dossier_pf_full` | OK |
| `dossier_pj` | dossie | PJ | ✅ `dossier_pj` | OK |
| `kyc_individual` | compliance | PF | ✅ `kyc_individual` | OK |
| `kyb_business` | compliance | PJ | ✅ `kyb_business` | OK |
| `kye_employee` | compliance | PF | ✅ `kye_employee` | OK |
| `kys_supplier` | compliance | PJ | ⚠️ Mapeado para `dossier_pj` | Inconsistente |
| `tpr_third_party` | third_party | Hybrid | ⚠️ Mapeado para `dossier_pj` | Inconsistente |
| `reputational_risk` | risk | PF | ✅ `reputational_risk` | OK |
| `ongoing_monitoring` | monitoring | PF | ❌ **Não existe schema** | Quebrado |
| `report_secure` | output | PF | ❌ **Não existe schema** | Quebrado |

### Produtos sem Schema Backend
- `ongoing_monitoring` → Não há `DOSSIER_SCHEMA_REGISTRY['ongoing_monitoring']`
- `report_secure` → Não há `DOSSIER_SCHEMA_REGISTRY['report_secure']`
- `kys_supplier` / `tpr_third_party` → Mapeados para `dossier_pj` genérico (perdem a identidade do produto)

---

## 3. Navegação Atual — TopProductHeader

### 3.1 Barra de Categorias (6 categorias)
```
Background Check | Cibersegurança | Due Diligence | Estrutura Societária | Jurídico | Recuperação de Ativos
```

**Problemas:**
- **Cibersegurança**, **Recuperação de Ativos**, **Estrutura Societária** → produtos NÃO EXISTEM no sistema (são placeholders)
- **Jurídico** → redireciona para `/dossie`, mas não distingue do "Background Check"
- As descrições dos cards são genéricas e repetidas

### 3.2 Catálogo de Produtos (PRODUCT_CATALOG)

| Categoria | Produto | Path | Status |
|-----------|---------|------|--------|
| Background Check | Dossiês | `/dossie` | ✅ Funciona |
| Background Check | LinkMap | `/explore` | ✅ Funciona |
| Background Check | FlagHub | `/watchlists` | ✅ Funciona |
| Background Check | SearchHub | `/client/hub` | ✅ Funciona |
| Background Check | Certidões | *(sem path)* | ❌ Placeholder |
| Cibersegurança | Leak Search | *(sem path)* | ❌ Placeholder |
| Cibersegurança | Domínios | *(sem path)* | ❌ Placeholder |
| Due Diligence | Dossiês | `/dossie` | ✅ Funciona |
| Due Diligence | Senior Review | `/senior-review` | ✅ Funciona |
| Due Diligence | Relatórios | `/reports` | ✅ Funciona |
| Estrutura Societária | QSA | *(sem path)* | ❌ Placeholder |
| Estrutura Societária | LinkHub | `/client/hub` | ✅ Funciona |
| Jurídico | Dossiês | `/dossie` | ✅ Funciona |
| Jurídico | Processos | *(sem path)* | ❌ Placeholder |
| Recuperação de Ativos | Bens e imóveis | *(sem path)* | ❌ Placeholder |
| Recuperação de Ativos | Cobrança estratégica | *(sem path)* | ❌ Placeholder |

**Resultado:** 10 produtos listados no menu, apenas 6 funcionam. Os outros 4 categorias são inteiramente placeholders.

### 3.3 Menu "Aplicativos"
```
Dossiês (Background Check)
LinkMap (Background Check)
Watchlists (Monitoramento)
Senior Review (Due Diligence)
Relatórios (Due Diligence)
Billing (Administração)
Usuários (Administração)
Configurações (Administração)
```

**Problemas:**
- Não inclui `/client/hub` (ProductHub)
- Não inclui `/dossie/custom-profile`
- Categorias inconsistentes com as reais ("Monitoramento" não existe como categoria no catálogo)
- "Dossiês" está marcado como `active` hardcoded

### 3.4 Botões do Header (que não funcionam)

| Botão | Ação atual | Esperado |
|-------|-----------|----------|
| "Dicionário de fontes" | ❌ Sem `onClick` | Deveria abrir modal/página de fontes |
| Mensagens | ❌ Sem `onClick` | Deveria abrir inbox/notificações |
| Academia | ❌ Sem `onClick` | Deveria abrir documentação/help |
| Envios | ❌ Sem `onClick` | Deveria abrir uploads/batch |
| Notificações | ❌ Sem `onClick` | Deveria abrir painel de alertas |

---

## 4. Inconsistências de Rotas e Nomenclatura

| Problema | Local | Descrição |
|----------|-------|-----------|
| `/dossie/create` carrega `DossierSearchPage` | AppRoutes.jsx | Rota diz "create" mas é tela de busca |
| `ProductPipelinePage` sem layout | AppRoutes.jsx | Wizard de criação fica sem navegação |
| `DossierSearchPage` vs `DossierCreatePage` | Arquivos | O arquivo se chama `DossierSearchPage` mas a rota é `/create` |
| Rotas de settings não agrupadas | AppRoutes.jsx | `/settings/tenant` e `/settings/users` estão soltas, não há `/settings` index |
| `/client/hub` vs `/client/pipeline` | AppRoutes.jsx | Namespace `client` não tem página raiz (`/client`) |

---

## 5. Problemas de Permissões (RBAC)

| Rota | Permissão | Problema |
|------|-----------|----------|
| `/billing` | `BILLING_VIEW_INTERNAL_COST` | Apenas admins veem, mas billing deveria ser visível ao tenant owner |
| `/senior-review` | `DECISION_APPROVE` | Correto |
| `/reports` | `REPORT_PUBLISH` | Correto |
| `/settings/users` | `USERS_MANAGE` | Correto |
| `/settings/tenant` | `SETTINGS_MANAGE` | Correto |
| `/explore`, `/watchlists`, `/client/hub` | Apenas `ProtectedRoute` | Qualquer usuário logado acessa — pode estar correto |

---

## 6. Análise dos Schemas vs Produtos

### Schemas existentes no backend (dossierSchema.js)
```
dossier_pf_basic, dossier_pf_full, dossier_pj, kyc_individual,
kyb_business, kye_employee, reputational_risk, custom
```

### Presets existentes
```
compliance, financeiro, investigativo, juridico, pld, rh, internacional
```

### Produtos do frontend que não têm schema próprio
- `kys_supplier` → cai em `dossier_pj` (perde identidade)
- `tpr_third_party` → cai em `dossier_pj` (perde identidade)
- `ongoing_monitoring` → ❌ **não existe**
- `report_secure` → ❌ **não existe**

---

## 7. Proposta de Reorganização

### 7.1 Estrutura de Navegação (Sidebar + Header)

```
┌─────────────────────────────────────────────────────────────┐
│  ⌘ ComplianceHub®    [Global Search]    [Notif] [Perfil]   │  ← Header minimalista
├────────┬────────────────────────────────────────────────────┤
│        │                                                    │
│  📁    │  CONTEÚDO                                          │
│ NAV    │                                                    │
│        │                                                    │
└────────┴────────────────────────────────────────────────────┘
```

**Sidebar persistente** (visível em todas as páginas autenticadas):

```
📊 ANÁLISES
  ├─ 🚀 Nova Análise          → /analyse/new  (redirect /client/hub)
  ├─ 📋 Meus Dossiês          → /dossie
  ├─ ⚡ Express (recentes)    → /dossie?filter=recent
  └─ 🔧 Perfis Customizados   → /dossie/custom-profile

🔍 EXPLORAÇÃO
  ├─ 🕸️ LinkMap (Grafo)      → /explore
  └─ 🔎 Hub de Produtos       → /client/hub

📈 MONITORAMENTO
  ├─ 🔔 Watchlists            → /watchlists
  └─ 📊 Alertas               → /alerts  (futuro)

✅ REVISÃO
  ├─ 👁️ Senior Review         → /senior-review
  └─ 📄 Relatórios            → /reports

⚙️ ADMIN
  ├─ 👥 Usuários              → /settings/users
  ├─ 🏢 Tenant                → /settings/tenant
  └─ 💳 Billing               → /billing
```

### 7.2 Reestruturação de Rotas

```
/                          → redirect /dossie
/login                     → AuthLayout

/analyse
  /new                     → ProductHubPage (hub de produtos)
  /pipeline/:productKey    → ProductPipelinePage (wizard)

/dossie
  /                        → DossierListPage
  /:id                     → DossierDetailPage
  /:id/processing          → DossierProcessingPage
  /custom-profile          → CustomProfilePage

/explore/:entityId?        → EntityGraphPage
/hub                       → ProductHubPage (alias)

/watchlists                → WatchlistPage
/senior-review             → SeniorReviewPage
/reports                   → ReportsPage

/settings
  /                        → redirect /settings/tenant
  /tenant                  → TenantSettingsPage
  /users                   → UserManagementPage

/billing                   → BillingPage
```

**Mudanças:**
- `/dossie/create` → `/analyse/new` (remove a ambiguidade "create" vs "search")
- `/client/hub` → `/analyse/new` ou `/hub` (remove namespace `client` vazio)
- `/client/pipeline/:productKey` → `/analyse/pipeline/:productKey`
- Adiciona `/settings` como redirect
- TODAS as páginas usam AppShell com Sidebar persistente

### 7.3 Estrutura de Produtos (catálogo real)

**Remover do menu:** Cibersegurança, Recuperação de Ativos, Estrutura Societária (não existem).

**Menu consolidado em 3 categorias:**

```
🎯 ANÁLISES
  ├─ Dossiê PF — Essencial     (dossier_pf_basic)
  ├─ Dossiê PF — Completo      (dossier_pf_full)
  ├─ Dossiê PJ                 (dossier_pj)
  └─ Relatório Seguro          (report_secure)

🔒 COMPLIANCE
  ├─ KYC Individual            (kyc_individual)
  ├─ KYB — Know Your Business  (kyb_business)
  ├─ KYE — Background Check    (kye_employee)
  ├─ KYS — Fornecedor          (kys_supplier)
  └─ TPR — Terceiros           (tpr_third_party)

🌐 RISCO & MONITORAMENTO
  ├─ Risco Reputacional        (reputational_risk)
  └─ Monitoramento Contínuo    (ongoing_monitoring)
```

### 7.4 Schemas Backend necessários

Para alinhar frontend + backend, precisamos criar:

| Schema | Baseado em | Seções |
|--------|-----------|--------|
| `kys_supplier` | `dossier_pj` + PF dos sócios | `identity_pj`, `identity_pf`, `criminal`, `kyc`, `relationship` |
| `tpr_third_party` | `dossier_pf_full` + PJ | `identity_pf`, `identity_pj`, `criminal`, `kyc`, `labor`, `relationship` |
| `ongoing_monitoring` | `dossier_pf_basic` light | `identity_pf`, `kyc`, `criminal` |
| `report_secure` | `dossier_pf_full` | `identity_pf`, `criminal`, `labor`, `kyc`, `decision` |

---

## 8. Checklist de Ações Imediatas

### 🔴 Crítico (bugs de navegação)
- [ ] **ProductPipelinePage** deve usar DossierLayout (ou o novo AppShell com sidebar)
- [ ] **Botões do header** sem ação devem ser removidos ou implementados
- [ ] **Menu de categorias** deve mostrar apenas produtos que existem

### 🟡 Alto (organização)
- [ ] Criar **Sidebar persistente** no AppShell (substituir o menu de categorias)
- [ ] Consolidar rotas: `/analyse/new`, `/analyse/pipeline/:key`
- [ ] Renomear `DossierSearchPage` → `DossierCreatePage` (ou ajustar rota)
- [ ] Criar schemas backend para `kys_supplier`, `tpr_third_party`, `ongoing_monitoring`, `report_secure`

### 🟢 Médio (melhorias)
- [ ] Adicionar breadcrumbs em todas as páginas
- [ ] Criar página `/settings` como dashboard de admin
- [ ] Implementar notificações reais no header
- [ ] Adicionar "Nova Análise" como botão primário persistente no sidebar

---

## 9. Resumo dos Problemas Encontrados

| Categoria | Quantidade | Severidade |
|-----------|-----------|------------|
| Produtos fantasmas no menu | 10 placeholders | 🔴 Alta |
| Páginas sem navegação | 1 (pipeline) | 🔴 Alta |
| Botões sem ação | 5 | 🔴 Alta |
| Produtos sem schema backend | 4 | 🟡 Alta |
| Rotas mal nomeadas | 3 | 🟡 Média |
| Inconsistência nomenclatura | 5+ | 🟢 Baixa |
