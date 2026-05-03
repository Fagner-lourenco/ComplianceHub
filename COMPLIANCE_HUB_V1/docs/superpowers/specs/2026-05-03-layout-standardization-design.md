# Layout Standardization Design
**Date:** 2026-05-03  
**Status:** Approved — ready for implementation

---

## Problem

Each page defines its own max-width and header pattern. Result: every page has a different width, different header style, and some ops pages (FilaPage, CasosPage) start directly with KPIs — no header at all. The Topbar currently shows a dynamic `title` prop that duplicates the in-page header.

**Max-widths found in the wild:** 1240px, 1180px, 1100px, 1040px, 960px, and `none`.

---

## Solution

Four-layer contract:

```
AppLayout (unchanged structurally)
├── Sidebar
├── Topbar  ← portal-badge + utilities only (no dynamic title)
└── .app-layout__content  ← responsive padding, no max-width
    └── PageShell[size]  ← owns max-width + centering
        ├── PageHeader  ← eyebrow + title + description + actions
        └── page content (KPIs, tables, forms…)
```

---

## Tokens

Add to `:root` in `src/index.css`:

```css
--page-max-default: 1240px;
--page-max-narrow:  1040px;
--page-max-form:    960px;
--page-max-report:  1440px;
--page-gap:         var(--space-5);
```

---

## AppLayout.css changes

Add responsive padding breakpoints to `.app-layout__content` (structure already correct):

```css
@media (max-width: 1080px) { .app-layout__content { padding: var(--space-5); } }
@media (max-width: 768px)  { .app-layout__content { padding: var(--space-4); } }
```

---

## Topbar changes

- Remove `title` prop from `Topbar.jsx` and from wherever it's passed in `AppLayout.jsx`
- `.topbar__title-group` becomes portal-only context: "Painel operacional" / "Portal do cliente"
- Utilities stay: hamburger (mobile), NotificationBell, theme toggle
- No structural changes to layout

---

## New files

### `src/ui/layouts/PageShell.jsx` + `PageShell.css`

Props: `size` (`default` | `narrow` | `form` | `report` | `full`), `className`, `as`

CSS: `max-width` via `--page-shell-max-width` custom prop per size variant. `margin-inline: auto`. `display: flex; flex-direction: column; gap: var(--page-gap)`.

### `src/ui/components/PageHeader/PageHeader.jsx` + `PageHeader.css`

Props: `eyebrow`, `title`, `description`, `actions`, `metric`, `backAction`, `compact`

Visual: card with border, radial+linear gradient background (matches existing hero pattern), `--shadow-xs`.

---

## Shell assignments

| Size | Pages |
|------|-------|
| `default` | DashboardClientePage, SolicitacoesPage, ExportacoesPage, RelatoriosClientePage, EquipePage (client), AuditoriaClientePage, FilaPage, CasosPage, CasoPage, ClientesPage, EquipeOpsPage, AuditoriaPage, MetricasIAPage, RelatoriosPage, SaudePage |
| `narrow` | NovaSolicitacaoPage, TenantSettingsPage |
| `form` | PerfilPage |
| `report` | ClientReportPage |

---

## EquipeOpsPage

Currently imports CSS from client portal (`.equipe-*` classes). This round: add PageShell + PageHeader only, no CSS refactor. Shared component extraction is a separate cycle.

---

## Header texts (humanized)

**Client portal:**
- Dashboard → eyebrow: "Portal cliente" / title: "Início"
- Solicitações → "Minhas solicitações"
- Nova Solicitação → eyebrow: "Nova análise" / title: "Enviar nova solicitação"
- Exportações → eyebrow: "Arquivos" / title: "Exportar solicitações"
- Relatórios → eyebrow: "Compartilhamento" / title: "Links de relatório"
- Equipe → eyebrow: "Usuários" / title: "Equipe da empresa"
- Auditoria → eyebrow: "Histórico" / title: "Atividades da empresa"
- Perfil → eyebrow: "Minha conta" / title: "Perfil"
- ClientReport → eyebrow: "Relatório" / title: "Relatório da análise" / compact

**Ops portal:**
- Fila → eyebrow: "Operacional" / title: "Fila de análise"
- Casos → eyebrow: "Operacional" / title: "Casos"
- Caso → eyebrow: "Detalhe da análise" / title: (person name or fallback)
- Clientes → eyebrow: "Administração" / title: "Clientes"
- Equipe → eyebrow: "Equipe operacional" / title: "Usuários internos"
- Auditoria → eyebrow: "Histórico" / title: "Auditoria operacional"
- Métricas → eyebrow: "Qualidade da análise" / title: "Métricas da análise automática"
- Relatórios → eyebrow: "Compartilhamento" / title: "Relatórios compartilhados"
- Saúde → eyebrow: "Integrações" / title: "Saúde das integrações"
- TenantSettings → eyebrow: "Configurações da empresa" / title: (company name or "Empresa")
- Perfil → eyebrow: "Minha conta" / title: "Perfil"

Banned from header UI: tenant, case, token, provider, pipeline, API, Firestore, Firebase, userProfiles.

---

## Migration strategy

4 commits, each independently deployable:

1. **Infra** — tokens + AppLayout breakpoints + Topbar cleanup + PageShell + PageHeader
2. **Client portal** — all 9 client pages migrated, legacy hero CSS removed from those pages
3. **Ops portal** — all 11 ops pages migrated, legacy header CSS removed from those pages
4. **CSS cleanup** — remove orphaned `.{page}__hero` / `.{page}__header` declarations confirmed unused

---

## Constraints

- No backend changes
- No Firestore rule changes
- No route changes
- No internal data name changes
- No business logic changes
- No functionality removed
- Drawers, modals, tables, filters, forms: untouched
- iframe in ClientReportPage: preserved
- EquipeOpsPage CSS coupling: deferred
