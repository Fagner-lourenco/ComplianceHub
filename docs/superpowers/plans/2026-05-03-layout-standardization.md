# Layout Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `PageShell` + `PageHeader` components, clean up `Topbar`, and migrate all 20 authenticated pages so every page has a consistent max-width, a standardized card header, and no page-level `max-width`/`margin: 0 auto` in individual CSS files.

**Architecture:** Four independent commits — (1) infra: tokens + new components + Topbar cleanup, (2) client portal migration, (3) ops portal migration, (4) CSS cleanup. Each commit is independently deployable. `PageShell` owns max-width and centering; `PageHeader` owns the card header visual; individual page CSS retains only grid/layout logic below the header.

**Tech Stack:** React 18, React Router v6, plain CSS custom properties, Vite

---

## File Map

### New files
- `src/ui/layouts/PageShell.jsx` — size-variant shell wrapper (`default|narrow|form|report|full`)
- `src/ui/layouts/PageShell.css` — max-width tokens + flex column + gap
- `src/ui/components/PageHeader/PageHeader.jsx` — eyebrow/title/description/actions/metric/backAction
- `src/ui/components/PageHeader/PageHeader.css` — card style matching existing hero gradient pattern

### Modified files (commit 1 — infra)
- `src/index.css` — add 5 page layout tokens to `:root`
- `src/ui/layouts/Topbar.jsx` — remove `title` prop, show portal badge only
- `src/ui/layouts/AppLayout.jsx` — remove `title` prop + stop passing it to Topbar

### Modified files (commit 2 — client portal)
- `src/portals/client/DashboardClientePage.jsx` + `.css`
- `src/portals/client/SolicitacoesPage.jsx` + `.css`
- `src/portals/client/ExportacoesPage.jsx` + `.css`
- `src/portals/client/RelatoriosClientePage.jsx` + `.css`
- `src/portals/client/EquipePage.jsx` + `.css`
- `src/portals/client/AuditoriaClientePage.jsx` + `.css`
- `src/pages/PerfilPage.jsx` + `.css`
- `src/portals/client/ClientReportPage.jsx` + `.css`
- `src/portals/client/NovaSolicitacaoPage.jsx` — **SKIP** (renders `<NovaSolicitacaoPanel>` directly, no visible page container; panel has its own layout)

### Modified files (commit 3 — ops portal)
- `src/portals/ops/FilaPage.jsx` + `.css`
- `src/portals/ops/CasosPage.jsx` + `.css`
- `src/portals/ops/CasoPage.jsx` + `.css`
- `src/portals/ops/ClientesPage.jsx` + `.css`
- `src/portals/ops/EquipeOpsPage.jsx` — JSX only (uses client EquipePage.css, CSS refactor deferred)
- `src/portals/ops/AuditoriaPage.jsx` + `.css`
- `src/portals/ops/MetricasIAPage.jsx` + `.css`
- `src/portals/ops/RelatoriosPage.jsx` + `.css`
- `src/portals/ops/SaudePage.jsx` + `.css`
- `src/portals/ops/TenantSettingsPage.jsx` + `.css`

### Modified files (commit 4 — CSS cleanup)
- All CSS files above: remove orphaned `margin-bottom` from replaced hero/header classes

---

## Task 1: Infra — tokens, PageShell, PageHeader, Topbar

**Files:**
- Create: `src/ui/layouts/PageShell.jsx`
- Create: `src/ui/layouts/PageShell.css`
- Create: `src/ui/components/PageHeader/PageHeader.jsx`
- Create: `src/ui/components/PageHeader/PageHeader.css`
- Modify: `src/index.css`
- Modify: `src/ui/layouts/Topbar.jsx`
- Modify: `src/ui/layouts/AppLayout.jsx`

---

- [ ] **Step 1: Add page layout tokens to `src/index.css`**

Find the last token in the `:root` block (currently `--z-tooltip: 85;`) and insert immediately before the closing `}` of `:root`:

```css
  /* Page layout */
  --page-max-default: 1240px;
  --page-max-narrow:  1040px;
  --page-max-form:    960px;
  --page-max-report:  1440px;
  --page-gap:         var(--space-5);
```

---

- [ ] **Step 2: Create `src/ui/layouts/PageShell.jsx`**

```jsx
import './PageShell.css';

export default function PageShell({
    children,
    size = 'default',
    className = '',
    as: Component = 'div',
}) {
    const classes = ['page-shell', `page-shell--${size}`, className]
        .filter(Boolean)
        .join(' ');
    return <Component className={classes}>{children}</Component>;
}
```

---

- [ ] **Step 3: Create `src/ui/layouts/PageShell.css`**

```css
.page-shell {
    width: 100%;
    max-width: var(--page-shell-max-width, var(--page-max-default));
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    gap: var(--page-gap);
    min-width: 0;
}

.page-shell--default { --page-shell-max-width: var(--page-max-default); }
.page-shell--narrow  { --page-shell-max-width: var(--page-max-narrow); }
.page-shell--form    { --page-shell-max-width: var(--page-max-form); }
.page-shell--report  { --page-shell-max-width: var(--page-max-report); }
.page-shell--full    { --page-shell-max-width: 100%; }
```

---

- [ ] **Step 4: Create `src/ui/components/PageHeader/PageHeader.jsx`**

```jsx
import { Link } from 'react-router-dom';
import './PageHeader.css';

export default function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    metric,
    backAction,
    compact = false,
    className = '',
}) {
    return (
        <header
            className={['page-header', compact && 'page-header--compact', className]
                .filter(Boolean)
                .join(' ')}
        >
            <div className="page-header__content">
                {eyebrow && (
                    <span className="page-header__eyebrow">{eyebrow}</span>
                )}
                <div className="page-header__title-row">
                    {backAction && (
                        <Link className="page-header__back" to={backAction.to}>
                            {backAction.label ?? 'Voltar'}
                        </Link>
                    )}
                    <h1 className="page-header__title">{title}</h1>
                </div>
                {description && (
                    <p className="page-header__description">{description}</p>
                )}
            </div>

            {(actions || metric) && (
                <div className="page-header__aside">
                    {metric && (
                        <div className="page-header__metric">
                            <strong>{metric.value}</strong>
                            <span>{metric.label}</span>
                        </div>
                    )}
                    {actions && (
                        <div className="page-header__actions">{actions}</div>
                    )}
                </div>
            )}
        </header>
    );
}
```

---

- [ ] **Step 5: Create `src/ui/components/PageHeader/PageHeader.css`**

```css
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-5);
    padding: var(--space-5);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-default);
    background:
        radial-gradient(circle at top right, rgba(29, 111, 229, 0.08), transparent 32%),
        linear-gradient(135deg, var(--bg-card), var(--gray-50));
    box-shadow: var(--shadow-xs);
    min-width: 0;
}

.page-header--compact {
    padding: var(--space-4);
}

.page-header__content {
    min-width: 0;
    max-width: 760px;
}

.page-header__eyebrow {
    display: inline-flex;
    margin-bottom: 8px;
    color: var(--text-tertiary);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.page-header__title-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.page-header__title {
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.2;
    margin: 0;
    color: var(--text-primary);
}

.page-header__description {
    margin: 6px 0 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--text-secondary);
}

.page-header__aside {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    flex-wrap: wrap;
    flex-shrink: 0;
    min-width: 0;
}

.page-header__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
}

.page-header__metric {
    min-width: 120px;
    padding: 10px 12px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-light);
    background: rgba(255, 255, 255, 0.64);
    text-align: right;
}

.page-header__metric strong {
    display: block;
    font-size: 1.25rem;
    line-height: 1.1;
    color: var(--text-primary);
}

.page-header__metric span {
    display: block;
    margin-top: 3px;
    font-size: 0.76rem;
    color: var(--text-secondary);
}

.page-header__back {
    width: fit-content;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--brand-700);
    text-decoration: none;
}

.page-header__back:hover {
    text-decoration: underline;
}

@media (max-width: 768px) {
    .page-header {
        padding: var(--space-4);
        flex-direction: column;
    }

    .page-header__aside {
        width: 100%;
        justify-content: flex-start;
    }

    .page-header__actions {
        width: 100%;
    }

    .page-header__title {
        font-size: 1.25rem;
    }

    .page-header__metric {
        text-align: left;
    }
}
```

---

- [ ] **Step 6: Update `src/ui/layouts/Topbar.jsx` — remove `title` prop, show portal badge only**

Replace the entire file content with:

```jsx
import { useLocation } from 'react-router-dom';
import useTheme from '../../hooks/useTheme';
import NotificationBell from '../components/NotificationBell/NotificationBell';
import './Topbar.css';

export default function Topbar({ onMenuClick, topbarRef }) {
    const location = useLocation();
    const isOpsPortal = location.pathname.startsWith('/ops') || location.pathname.startsWith('/demo/ops');
    const { resolved: resolvedTheme, toggleTheme } = useTheme();

    return (
        <header ref={topbarRef} className="topbar">
            <div className="topbar__left">
                <button
                    className="topbar__menu-btn"
                    onClick={onMenuClick}
                    aria-label="Abrir menu de navegação"
                >
                    ☰
                </button>
                <div className="topbar__title-group">
                    <span className="topbar__subtitle">
                        {isOpsPortal ? 'Painel operacional' : 'Portal do cliente'}
                    </span>
                </div>

                <div className="topbar__right">
                    <NotificationBell />
                    <button
                        className="topbar__theme-toggle"
                        onClick={toggleTheme}
                        title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                        aria-label="Alternar tema"
                    >
                        {resolvedTheme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>
            </div>
        </header>
    );
}
```

---

- [ ] **Step 7: Update `src/ui/layouts/AppLayout.jsx` — remove `title` prop**

Change line 8 from:
```jsx
export default function AppLayout({ title = 'ComplianceHub' }) {
```
to:
```jsx
export default function AppLayout() {
```

Change the Topbar usage from:
```jsx
<Topbar topbarRef={topbarRef} title={title} onMenuClick={() => setIsSidebarOpen(true)} />
```
to:
```jsx
<Topbar topbarRef={topbarRef} onMenuClick={() => setIsSidebarOpen(true)} />
```

---

- [ ] **Step 8: Remove unused `.topbar__title` styles from `src/ui/layouts/Topbar.css`**

Remove these lines:
```css
.topbar__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
}
```

And in the `@media (max-width: 768px)` block, remove:
```css
    .topbar__title {
        font-size: 1.0625rem;
        flex: 1;
        min-width: 0;
    }
```

And in `@media (max-width: 480px)` block, remove:
```css
    .topbar__title {
        font-size: 1rem;
    }
```

---

- [ ] **Step 9: Run build to verify infra compiles**

```bash
cd D:\ComplianceHub\COMPLIANCE_HUB_V1 && npm run build
```

Expected: build succeeds. If it fails, fix the error before committing.

---

- [ ] **Step 10: Commit infra**

```bash
git add src/index.css src/ui/layouts/PageShell.jsx src/ui/layouts/PageShell.css src/ui/components/PageHeader/PageHeader.jsx src/ui/components/PageHeader/PageHeader.css src/ui/layouts/Topbar.jsx src/ui/layouts/Topbar.css src/ui/layouts/AppLayout.jsx
git commit -m "feat: add PageShell + PageHeader, clean Topbar title"
```

---

## Task 2: Client portal migration

**Files:** 8 pages — JSX + CSS each

**Migration pattern per page:**
1. Add imports for `PageShell` and `PageHeader` at top of JSX
2. Change root `<div className="page-class">` → `<PageShell size="..." className="page-class">`  and `</div>` → `</PageShell>`
3. Replace the hero/header section with `<PageHeader ...props />`
4. In CSS: remove `max-width` and `margin: 0 auto` from root class
5. In CSS: remove `margin-bottom` from the replaced hero/header class (it's now handled by PageShell `gap`)

---

### 2.1 DashboardClientePage

- [ ] **Step 1: Migrate `src/portals/client/DashboardClientePage.jsx`**

Add imports after existing imports (before `'./DashboardClientePage.css'`):
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change root element from `<div className="dashboard-cliente">` to:
```jsx
<PageShell size="default" className="dashboard-cliente">
```

Change closing `</div>` (last line of return) to `</PageShell>`.

Replace the entire `.dashboard-cliente__hero` block:
```jsx
<div className="dashboard-cliente__hero">
    <div>
        <h2 className="dashboard-cliente__title">Acompanhamento das solicitações</h2>
        <p className="dashboard-cliente__subtitle">
            Acompanhe o andamento, os resultados e os principais pontos de atenção das suas análises.
        </p>
    </div>
    <div className="dashboard-cliente__hero-badge">
        <span className="dashboard-cliente__hero-badge-label">Concluídos</span>
        <strong>{metrics.done}</strong>
    </div>
</div>
```

with:
```jsx
<PageHeader
    eyebrow="Portal cliente"
    title="Início"
    description="Acompanhe suas solicitações, pendências e análises concluídas."
    metric={{ value: metrics.done, label: 'Concluídos' }}
/>
```

---

- [ ] **Step 2: Update `src/portals/client/DashboardClientePage.css`**

In `.dashboard-cliente`:
- Remove `max-width: 1180px;`
- Remove `margin: 0 auto;`

Remove the entire `.dashboard-cliente__hero` block and all of these classes (they're replaced by PageHeader):
- `.dashboard-cliente__hero`
- `.dashboard-cliente__title`
- `.dashboard-cliente__subtitle`
- `.dashboard-cliente__hero-badge`
- `.dashboard-cliente__hero-badge-label`

---

### 2.2 SolicitacoesPage

- [ ] **Step 3: Migrate `src/portals/client/SolicitacoesPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="solicitacoes-page">` to:
```jsx
<PageShell size="default" className="solicitacoes-page">
```
Change closing `</div>` to `</PageShell>`.

Replace the `.solicitacoes-page__header` block:
```jsx
<div className="solicitacoes-page__header">
    <div>
        <h2 className="solicitacoes-page__title">Minhas solicitações</h2>
        <p className="solicitacoes-page__subtitle">Acompanhe o andamento e os resultados das suas análises.</p>
    </div>
    <button className="solicitacoes-page__cta" onClick={() => setNovaPanelOpen(true)}>
        + Nova solicitação
    </button>
</div>
```

with:
```jsx
<PageHeader
    eyebrow="Solicitações"
    title="Minhas solicitações"
    description="Veja o andamento das análises enviadas e acesse os resultados disponíveis."
    actions={
        <button className="btn-primary" onClick={() => setNovaPanelOpen(true)}>
            + Nova solicitação
        </button>
    }
/>
```

---

- [ ] **Step 4: Update `src/portals/client/SolicitacoesPage.css`**

In `.solicitacoes-page`: there is no `max-width` to remove (already `none`). No change needed to root class.

Remove (or repurpose if still used internally) the `.solicitacoes-page__header` block and child classes:
- `.solicitacoes-page__header`
- `.solicitacoes-page__title`
- `.solicitacoes-page__subtitle`
- `.solicitacoes-page__cta`

---

### 2.3 ExportacoesPage

- [ ] **Step 5: Migrate `src/portals/client/ExportacoesPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="export-page">` to:
```jsx
<PageShell size="default" className="export-page">
```
Change closing `</div>` to `</PageShell>`.

Replace the `<section className="export-hero" ...>` block (which contains eyebrow, h2, p, and metric div) with:
```jsx
<PageHeader
    eyebrow="Arquivos"
    title="Exportar solicitações"
    description="Gere arquivos com os dados permitidos para acompanhamento e conferência."
    metric={{ value: cases.length, label: 'Casos carregados' }}
/>
```

---

- [ ] **Step 6: Update `src/portals/client/ExportacoesPage.css`**

In `.export-page`: no `max-width` to remove (was `none`).

Remove the entire `.export-hero` block and child classes:
- `.export-hero`
- `.export-hero__eyebrow`
- `.export-hero__metric`

---

### 2.4 RelatoriosClientePage

- [ ] **Step 7: Migrate `src/portals/client/RelatoriosClientePage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="client-public-reports">` to:
```jsx
<PageShell size="default" className="client-public-reports">
```
Change closing `</div>` to `</PageShell>`.

Replace the `<section className="client-public-reports__hero">` block with:
```jsx
<PageHeader
    eyebrow="Compartilhamento"
    title="Links de relatório"
    description="Gerencie os links criados para compartilhar resultados com segurança."
    metric={{ value: summary.total, label: 'relatório(s)' }}
/>
```

---

- [ ] **Step 8: Update `src/portals/client/RelatoriosClientePage.css`**

In `.client-public-reports`: no `max-width` to remove (was `none`).

Remove the `.client-public-reports__hero` block and child classes:
- `.client-public-reports__hero`
- `.client-public-reports__hero-copy`
- `.client-public-reports__hero-count`

---

### 2.5 EquipePage

- [ ] **Step 9: Migrate `src/portals/client/EquipePage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="equipe-page">` to:
```jsx
<PageShell size="default" className="equipe-page">
```
Change closing `</div>` to `</PageShell>`.

Replace the `.equipe-hero` block:
```jsx
<div className="equipe-hero">
    <div className="equipe-hero__info">
        <h2>Equipe</h2>
        <p className="equipe-hero__sub">Gerencie os usuários da sua franquia</p>
    </div>
    <div className="equipe-hero__actions">
        <button className="equipe-btn equipe-btn--primary" onClick={handleOpenModal}>Adicionar usuário</button>
    </div>
</div>
```

with:
```jsx
<PageHeader
    eyebrow="Usuários"
    title="Equipe da empresa"
    description="Gerencie quem pode acessar o portal da sua empresa."
    actions={
        <button className="btn-primary" onClick={handleOpenModal}>Adicionar usuário</button>
    }
/>
```

---

- [ ] **Step 10: Update `src/portals/client/EquipePage.css`**

In `.equipe-page`:
- Remove `max-width: 1240px;`
- Remove `margin: 0 auto;`

Remove the `.equipe-hero` block and child classes:
- `.equipe-hero`
- `.equipe-hero__info`
- `.equipe-hero__sub`
- `.equipe-hero__actions`

---

### 2.6 AuditoriaClientePage

- [ ] **Step 11: Migrate `src/portals/client/AuditoriaClientePage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="auditoria-cliente-page">` to:
```jsx
<PageShell size="default" className="auditoria-cliente-page">
```
Change closing `</div>` to `</PageShell>`.

Replace the `<section className="auditoria-cliente-header" ...>` block:
```jsx
<section className="auditoria-cliente-header" aria-labelledby="auditoria-cliente-title">
    <div>
        <span className="auditoria-cliente-header__eyebrow">Ledger do cliente</span>
        <h2 id="auditoria-cliente-title" className="auditoria-cliente-header__title">Histórico de atividades</h2>
        <p className="auditoria-cliente-header__subtitle">
            Histórico de eventos da empresa {tenantName}.
        </p>
    </div>
    <div className="auditoria-cliente-header__badge" aria-label={`${visibleCountLabel} registros carregados`}>
        <span className="auditoria-cliente-header__badge-label">Registros carregados</span>
        <strong>{visibleCountLabel}</strong>
    </div>
</section>
```

with:
```jsx
<PageHeader
    eyebrow="Histórico"
    title="Atividades da empresa"
    description={`Acompanhe os principais registros de acesso e ações realizadas por ${tenantName}.`}
    metric={{ value: visibleCountLabel, label: 'Registros carregados' }}
/>
```

---

- [ ] **Step 12: Update `src/portals/client/AuditoriaClientePage.css`**

In `.auditoria-cliente-page`: no `max-width` to remove (was `none`).

Remove the `.auditoria-cliente-header` block and child classes:
- `.auditoria-cliente-header`
- `.auditoria-cliente-header__eyebrow`
- `.auditoria-cliente-header__title`
- `.auditoria-cliente-header__subtitle`
- `.auditoria-cliente-header__badge`
- `.auditoria-cliente-header__badge-label`

---

### 2.7 PerfilPage

- [ ] **Step 13: Migrate `src/pages/PerfilPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../ui/layouts/PageShell';
import PageHeader from '../ui/components/PageHeader/PageHeader';
```

Change `<div className="perfil-page">` to:
```jsx
<PageShell size="form" className="perfil-page">
```
Change closing `</div>` to `</PageShell>`.

Replace the `.perfil-hero` block:
```jsx
<div className="perfil-hero">
    <div className="perfil-hero__avatar">{initials}</div>
    <div className="perfil-hero__info">
        <h2 className="perfil-hero__name">{displayName}</h2>
        <p className="perfil-hero__email">{displayEmail}</p>
        <div className="perfil-hero__badges">
            <span className="perfil-badge perfil-badge--role">{displayRole}</span>
            <span className="perfil-badge perfil-badge--tenant">{displayTenant}</span>
            <span className="perfil-badge perfil-badge--portal">{portalLabel}</span>
        </div>
    </div>
</div>
```

with:
```jsx
<PageHeader
    eyebrow="Minha conta"
    title="Perfil"
    description="Consulte seus dados de acesso e preferências."
/>
```

Keep the `.perfil-hero` avatar + badge section as a separate info card below PageHeader by wrapping it in a new `<div className="perfil-identity">`:
```jsx
<div className="perfil-identity">
    <div className="perfil-hero__avatar">{initials}</div>
    <div className="perfil-hero__info">
        <h2 className="perfil-hero__name">{displayName}</h2>
        <p className="perfil-hero__email">{displayEmail}</p>
        <div className="perfil-hero__badges">
            <span className="perfil-badge perfil-badge--role">{displayRole}</span>
            <span className="perfil-badge perfil-badge--tenant">{displayTenant}</span>
            <span className="perfil-badge perfil-badge--portal">{portalLabel}</span>
        </div>
    </div>
</div>
```

---

- [ ] **Step 14: Update `src/pages/PerfilPage.css`**

In `.perfil-page`:
- Remove `max-width: 960px;`
- Remove `margin: 0 auto;`

Change `.perfil-hero` to `.perfil-identity` (rename the class, keep its display/border/background styles intact so the identity card still looks correct):
```css
.perfil-identity {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-6);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-default);
    background: radial-gradient(circle at top right, rgba(29, 111, 229, 0.08), transparent 30%),
                linear-gradient(135deg, var(--bg-card), var(--gray-50));
    box-shadow: var(--shadow-xs);
}
```

Remove `margin-bottom` from this class (now handled by PageShell `gap`).

Update child selectors that referenced `.perfil-hero` to `.perfil-identity` if any exist.

---

### 2.8 ClientReportPage

- [ ] **Step 15: Migrate `src/portals/client/ClientReportPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="crp">` to:
```jsx
<PageShell size="report" className="crp">
```
Change closing `</div>` to `</PageShell>`.

Replace the `.crp__actions` block with a compact PageHeader that includes the actions:

Before the existing `<div className="crp__actions">`, insert:
```jsx
<PageHeader
    compact
    eyebrow="Relatório"
    title={`Relatório — ${caseView?.candidateName ?? 'Candidato'}`}
    description="Visualize, imprima ou gere o PDF desta análise."
    backAction={{ to: buildClientPortalPath('solicitacoes'), label: '← Solicitações' }}
    actions={
        <div className="crp__actions-right">
            {publicResultError && (
                <span className="crp__warn" role="alert" title="Conteúdo sanitizado indisponível — exibindo dados locais">
                    ⚠ Dados parciais
                </span>
            )}
            {pdfState.message && (
                <span
                    role={pdfState.status === 'error' ? 'alert' : 'status'}
                    className={`crp__pdf-msg crp__pdf-msg--${pdfState.status}`}
                >
                    {pdfState.message}
                </span>
            )}
            {reportAvailability.available && (
                <>
                    <button
                        type="button"
                        className="crp-btn crp-btn--primary"
                        onClick={handleDownloadPdf}
                        disabled={pdfState.status === 'loading'}
                    >
                        {pdfState.status === 'loading' ? 'Gerando PDF...' : 'Baixar PDF'}
                    </button>
                    <button type="button" className="crp-btn crp-btn--secondary" onClick={handlePrint}>
                        Imprimir
                    </button>
                </>
            )}
            <button
                type="button"
                className="crp-btn crp-btn--primary"
                onClick={() => setShareModalOpen(true)}
                disabled={!reportAvailability.available}
            >
                Gerar link público
            </button>
        </div>
    }
/>
```

Then remove the original `<div className="crp__actions">` block entirely (it's now inside PageHeader `actions`).

---

- [ ] **Step 16: Update `src/portals/client/ClientReportPage.css`**

In `.crp`: no `max-width` to remove (was `none`).

Remove the `.crp__actions` wrapper class (the inner `.crp__actions-right` and button classes remain because they're now inside PageHeader `actions`).

---

- [ ] **Step 17: Run build to verify client portal compiles**

```bash
cd D:\ComplianceHub\COMPLIANCE_HUB_V1 && npm run build
```

Expected: build succeeds. Fix any import path errors before committing.

---

- [ ] **Step 18: Commit client portal migration**

```bash
git add src/portals/client/ src/pages/PerfilPage.jsx src/pages/PerfilPage.css
git commit -m "feat: migrate client portal pages to PageShell + PageHeader"
```

---

## Task 3: Ops portal migration

**Files:** 10 ops pages — JSX + CSS each

---

### 3.1 FilaPage

- [ ] **Step 1: Migrate `src/portals/ops/FilaPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="fila-page">` to:
```jsx
<PageShell size="default" className="fila-page">
```
Change closing `</div>` to `</PageShell>`.

Insert `<PageHeader>` as the FIRST child (before the existing `<div className="fila-page__kpis">`):
```jsx
<PageHeader
    eyebrow="Operacional"
    title="Fila de análise"
    description="Priorize solicitações pendentes, casos próximos do prazo e análises aguardando responsável."
/>
```

---

- [ ] **Step 2: Update `src/portals/ops/FilaPage.css`**

In `.fila-page`: no `max-width` to remove (was `none`), no `margin: 0 auto`.

No other CSS changes needed — the page had no hero to remove.

---

### 3.2 CasosPage

- [ ] **Step 3: Migrate `src/portals/ops/CasosPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="casos-page">` to:
```jsx
<PageShell size="default" className="casos-page">
```
Change closing `</div>` to `</PageShell>`.

Insert `<PageHeader>` as the FIRST child (before `<div className="casos-page__kpis">`):
```jsx
<PageHeader
    eyebrow="Operacional"
    title="Casos"
    description="Consulte todas as análises, filtre por situação e acompanhe os resultados."
/>
```

---

- [ ] **Step 4: Update `src/portals/ops/CasosPage.css`**

In `.casos-page`: no `max-width` to remove (was `none`).

No other CSS changes needed.

---

### 3.3 CasoPage

- [ ] **Step 5: Migrate `src/portals/ops/CasoPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Near the top of the component (after hooks), identify where `candidateName` is derived. It's likely `caseData?.candidateName`. Add:
```jsx
const candidateName = caseData?.candidateName ?? 'Análise';
```

Change `<div className="caso-page">` to:
```jsx
<PageShell size="default" className="caso-page">
```
Change closing `</div>` to `</PageShell>`.

The `.caso-header` contains candidate info, status badges, CPF, and action buttons. Replace the entire `.caso-header` block with a PageHeader + a `.caso-meta` section:

```jsx
<PageHeader
    eyebrow="Detalhe da análise"
    title={candidateName}
    description="Revise as informações, registre a decisão e conclua a análise."
    backAction={{ to: '/ops/fila', label: '← Fila' }}
    actions={
        <div className="caso-header__actions">
            {/* Keep existing action buttons here — copy them from the original .caso-header */}
        </div>
    }
/>
```

Keep all remaining meta content from `.caso-header` (CPF, tenant, assignee, status badges, risk chips) in a new `<div className="caso-meta">` placed after PageHeader:
```jsx
<div className="caso-meta">
    {/* Move the status badges, CPF, tenant, assignee rows here from the original .caso-header */}
</div>
```

**Important:** Do not remove any existing UI elements — only reorganize the `.caso-header` children into `PageHeader actions` + `caso-meta`.

---

- [ ] **Step 6: Update `src/portals/ops/CasoPage.css`**

In `.caso-page`:
- Remove `max-width: 1240px;`
- Remove `margin: 0 auto;`

Rename `.caso-header` to `.caso-meta` (for the remaining meta block). Keep all its styles. Remove `margin-bottom` from `.caso-header` (now handled by PageShell gap). Copy:
```css
.caso-meta {
    /* keep all styles that were on .caso-header */
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    flex-wrap: wrap;
    padding: var(--space-5);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-default);
    background: radial-gradient(circle at top right, rgba(29, 111, 229, 0.08), transparent 32%),
                linear-gradient(135deg, var(--bg-card), var(--gray-50));
}
```

---

### 3.4 ClientesPage

- [ ] **Step 7: Migrate `src/portals/ops/ClientesPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="clientes-page">` to:
```jsx
<PageShell size="default" className="clientes-page">
```
Change closing `</div>` to `</PageShell>`.

Replace the `.clientes-header` block — which contains title, search bar, and "Novo gestor" button — with:
```jsx
<PageHeader
    eyebrow="Administração"
    title="Clientes"
    description="Cadastre empresas, gestores e acompanhe configurações de acesso."
    actions={
        <button className="btn-primary" onClick={() => setShowModal(true)}>
            Novo gestor
        </button>
    }
/>
```

Move the search bar to below the PageHeader (keep it as a standalone filter row, it was part of `.clientes-header` before):
```jsx
<div className="clientes-toolbar">
    {/* the existing search input */}
</div>
```

Adapt variable names (`setShowModal`) to match the actual state setter name in the file.

---

- [ ] **Step 8: Update `src/portals/ops/ClientesPage.css`**

In `.clientes-page`:
- Remove `max-width: 1240px;`
- Remove `margin: 0 auto;`

Remove `.clientes-header` block (replaced by PageHeader). Keep `.clientes-toolbar` or rename from `.clientes-header` search part.

---

### 3.5 EquipeOpsPage

- [ ] **Step 9: Migrate `src/portals/ops/EquipeOpsPage.jsx`**

Add imports after existing imports (note: uses `../client/EquipePage.css` — CSS coupling deferred):
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="equipe-page">` to:
```jsx
<PageShell size="default" className="equipe-page">
```
Change closing `</div>` to `</PageShell>`.

Replace `.equipe-hero` block (same pattern as client EquipePage, replace hero with PageHeader):
```jsx
<PageHeader
    eyebrow="Equipe operacional"
    title="Usuários internos"
    description="Gerencie analistas, supervisores e administradores da operação."
    actions={
        <button className="equipe-btn equipe-btn--primary" onClick={handleOpenModal}>
            Adicionar usuário
        </button>
    }
/>
```

No CSS changes — CSS refactor for EquipeOpsPage is deferred.

---

### 3.6 AuditoriaPage

- [ ] **Step 10: Migrate `src/portals/ops/AuditoriaPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="auditoria-page">` to:
```jsx
<PageShell size="default" className="auditoria-page">
```
Change closing `</div>` to `</PageShell>`.

Replace the `.auditoria-header` block with:
```jsx
<PageHeader
    eyebrow="Histórico"
    title="Auditoria operacional"
    description="Acompanhe ações relevantes executadas no sistema."
/>
```

---

- [ ] **Step 11: Update `src/portals/ops/AuditoriaPage.css`**

In `.auditoria-page`: no `max-width` to remove (was `none`).

Remove `.auditoria-header` block and child classes.

---

### 3.7 MetricasIAPage

- [ ] **Step 12: Migrate `src/portals/ops/MetricasIAPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="ops-dash">` to:
```jsx
<PageShell size="default" className="ops-dash">
```
Change closing `</div>` to `</PageShell>`.

Replace the `.ops-dash__header` block — which has title + period filter tabs — with:
```jsx
<PageHeader
    eyebrow="Qualidade da análise"
    title="Métricas da análise automática"
    description="Acompanhe desempenho, divergências e pontos de atenção da análise automática."
    actions={
        <div className="ops-dash__period-tabs">
            {/* Move existing period tab buttons here */}
        </div>
    }
/>
```

---

- [ ] **Step 13: Update `src/portals/ops/MetricasIAPage.css`**

In `.ops-dash`:
- Remove `max-width: 1240px;`
- Remove `margin: 0 auto;`

Remove `.ops-dash__header` block.

---

### 3.8 RelatoriosPage

- [ ] **Step 14: Migrate `src/portals/ops/RelatoriosPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="relatorios-page">` to:
```jsx
<PageShell size="default" className="relatorios-page">
```
Change closing `</div>` to `</PageShell>`.

Replace `.relatorios-header` block with:
```jsx
<PageHeader
    eyebrow="Compartilhamento"
    title="Relatórios compartilhados"
    description="Gerencie links de acesso gerados para relatórios concluídos."
/>
```

---

- [ ] **Step 15: Update `src/portals/ops/RelatoriosPage.css`**

In `.relatorios-page`: no `max-width` (was `none`).

Remove `.relatorios-header` block and child classes.

---

### 3.9 SaudePage

- [ ] **Step 16: Migrate `src/portals/ops/SaudePage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Change `<div className="saude-page">` to:
```jsx
<PageShell size="default" className="saude-page">
```
Change closing `</div>` to `</PageShell>`.

Replace `.saude-header` block — which has title + refresh button — with:
```jsx
<PageHeader
    eyebrow="Integrações"
    title="Saúde das integrações"
    description="Verifique se as fontes de consulta estão disponíveis para uso."
    actions={
        <button className="btn-secondary" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Verificando…' : 'Atualizar'}
        </button>
    }
/>
```

Adapt `handleRefresh` and `loading` to match actual variable names in the file.

---

- [ ] **Step 17: Update `src/portals/ops/SaudePage.css`**

In `.saude-page`: no `max-width` (was `none`).

Remove `.saude-header` block and child classes.

---

### 3.10 TenantSettingsPage

- [ ] **Step 18: Migrate `src/portals/ops/TenantSettingsPage.jsx`**

Add imports after existing imports:
```jsx
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
```

Identify where tenant name comes from in the component state/data. It's likely `settings?.name` or `tenantData?.name`. Add fallback:
```jsx
const tenantDisplayName = settings?.name ?? 'Empresa';
```

Change `<div className="ts-page">` to:
```jsx
<PageShell size="narrow" className="ts-page">
```
Change closing `</div>` to `</PageShell>`.

Replace `.ts-page__header` block — which has back button, title, and save button — with:
```jsx
<PageHeader
    eyebrow="Configurações da empresa"
    title={tenantDisplayName}
    description="Ajuste etapas da análise, limites de uso e fontes de consulta."
    backAction={{ to: '/ops/clientes', label: '← Clientes' }}
    actions={
        <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
        >
            {saving ? 'Salvando…' : 'Salvar'}
        </button>
    }
/>
```

Adapt `handleSave` and `saving` to match actual variable names in the file.

---

- [ ] **Step 19: Update `src/portals/ops/TenantSettingsPage.css`**

In `.ts-page`:
- Remove `max-width: 1100px;`
- Remove `margin: 0 auto;`

Remove `.ts-page__header` block and child classes.

---

- [ ] **Step 20: Run build to verify ops portal compiles**

```bash
cd D:\ComplianceHub\COMPLIANCE_HUB_V1 && npm run build
```

Expected: build succeeds. Fix any variable name mismatches before committing.

---

- [ ] **Step 21: Commit ops portal migration**

```bash
git add src/portals/ops/
git commit -m "feat: migrate ops portal pages to PageShell + PageHeader"
```

---

## Task 4: CSS cleanup

**Goal:** Remove orphaned `margin-bottom` on replaced hero/header classes, and clean up any remaining `max-width`/`margin: 0 auto` in page roots.

---

- [ ] **Step 1: Grep for remaining page-level max-width declarations**

```bash
cd D:\ComplianceHub\COMPLIANCE_HUB_V1 && grep -r "max-width:" src/portals/ src/pages/ --include="*.css" -l
```

Review each result. For any root page class that still has `max-width`, check if it's a:
- Root page wrapper → remove (PageShell handles it now)
- Internal component (card, modal, table cell) → keep

---

- [ ] **Step 2: Grep for remaining margin: 0 auto in page CSS**

```bash
cd D:\ComplianceHub\COMPLIANCE_HUB_V1 && grep -rn "margin:.*0.*auto\|margin-inline:.*auto" src/portals/ src/pages/ --include="*.css"
```

Same logic: root wrapper → remove, internal component → keep.

---

- [ ] **Step 3: Grep for orphaned hero/header class references**

```bash
cd D:\ComplianceHub\COMPLIANCE_HUB_V1 && grep -rn "dashboard-cliente__hero\|equipe-hero\|export-hero\|auditoria-cliente-header\|client-public-reports__hero\|solicitacoes-page__header\|caso-header\|clientes-header\|auditoria-header\|ops-dash__header\|relatorios-header\|saude-header\|ts-page__header\|perfil-hero" src/ --include="*.jsx" --include="*.js"
```

Any class that appears in JSX but not in its own CSS file is orphaned. Remove the CSS declaration for it. Any class that still appears in JSX → keep.

---

- [ ] **Step 4: Run full build + lint + tests**

```bash
cd D:\ComplianceHub\COMPLIANCE_HUB_V1 && npm run build && npm run lint && npm test -- --run
```

Document any pre-existing failures vs new failures introduced by these changes.

---

- [ ] **Step 5: Commit CSS cleanup**

```bash
git add src/portals/ src/pages/
git commit -m "chore: remove orphaned hero/header CSS after PageHeader migration"
```

---

## Acceptance Checklist

- [ ] `PageShell` created and used as root wrapper on all 19 migrated pages
- [ ] `PageHeader` created and used as first child on all 19 migrated pages
- [ ] `AppLayout` no longer passes `title` to `Topbar`
- [ ] `Topbar` shows portal context badge only (no dynamic page title)
- [ ] `app-layout__content` has no `max-width` (already correct before this plan)
- [ ] All pages: `max-width` removed from root CSS class
- [ ] FilaPage and CasosPage now start with PageHeader before KPIs
- [ ] Hero/header CSS removed from migrated pages
- [ ] No technical terms (tenant, case, token, API, Firestore) in header `eyebrow`/`title`/`description`
- [ ] Build passes
- [ ] NovaSolicitacaoPage intentionally skipped (panel wrapper, no page container)
- [ ] EquipeOpsPage CSS coupling deferred (marked as separate cycle)

---

## Known Skips / Deferred

| Item | Reason | Next step |
|------|--------|-----------|
| `NovaSolicitacaoPage` PageShell/PageHeader | Page renders `<NovaSolicitacaoPanel>` directly, no root container | Panel has own layout — no action needed |
| `EquipeOpsPage` CSS refactor | Currently imports `../client/EquipePage.css` | Separate cycle: extract `UserManagementPanel` shared component |
