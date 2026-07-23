# Fila UX + Auto-Expiração de Correções — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sidebar recolhível, retorno automático à fila após conclusão de caso, auto-conclusão de casos em CORRECTION_NEEDED após 48h sem correção do cliente, e ordenação da fila por urgência (mais urgente primeiro).

**Architecture:** Frontend React (Vite, src/) + Firebase Functions v2 CJS (functions/). O colapso da sidebar é uma classe no root do AppLayout que redefine a var CSS `--sidebar-width` (única fonte de largura). A auto-expiração é uma scheduled function nova seguindo o padrão de `backupWorker.js`, com a lógica de seleção extraída em função pura testável. A ordenação por urgência entra como novo `sortField` no `compareOpsCases` (caminho V1 in-memory que a fila já usa), com rank calculado por função pura no backend.

**Tech Stack:** React 18 + react-router, vitest (root e functions), Firebase Functions v2 (`onSchedule`/`onCall`, região `southamerica-east1`), Firestore.

## Global Constraints

- Backend functions/ é CommonJS (`require`/`module.exports`); testes usam vitest com `createRequire` (ver `functions/helpers/criminalMateriality.test.js`).
- Frontend src/ é ESM; testes vitest rodam da raiz.
- Strings de UI em pt-BR sem acento nos identificadores/status (padrão do repo: "Correcao", "Atencao").
- TDD: todo passo de código produtivo tem teste falhando antes.
- Nenhuma publicação de relatório público no fluxo de auto-expiração (publicação é exclusiva de `concludeCaseByAnalyst`).
- Rodar `npx vitest run <arquivo>` após cada GREEN; suíte completa ao final de cada task.

## Decisões de produto embutidas (validadas no código atual)

1. **Caso expirado vira `status: 'DONE'` com `conclusionType: 'AUTO_EXPIRED_CORRECTION'`** — NÃO cria status novo. Motivo: dezenas de checks `status !== 'DONE'` tratam qualquer outro status como ativo (fila `queueOnly` exclui só DONE em `caseQueriesAssignments.js:895`); um status novo vazaria para a fila e para todos os triggers de enriquecimento. `finalVerdict` fica null — o `conclusionType` distingue expiração de conclusão analisada.
2. **Janela de 48h conta a partir de `correctionRequestedAt`**, com fallback `updatedAt` → `createdAt` para os ~32 casos legados. O caminho do identity gate (`functions/index.js:278`, `returnCaseForIdentityGateBlock`) hoje NÃO seta `correctionRequestedAt` — a Task 3 corrige isso; o fallback cobre o estoque existente.
3. **Janela configurável por tenant**: campo opcional `correctionAutoExpireHours` no doc do tenant (default 48). Alinha com o plano futuro de fases plugáveis por tenant.
4. **Ordenação padrão da fila: urgência** — vencidos primeiro (mais vencido no topo), depois em alerta, depois no prazo por menor tempo restante; `priority === 'HIGH'` desempata dentro do mesmo estado; empate final por `createdAt` asc (mais antigo primeiro).

---

### Task 1: Sidebar recolhível (desktop)

**Files:**
- Modify: `src/ui/layouts/AppLayout.jsx` (estado collapsed + classe root + persistência)
- Modify: `src/ui/layouts/AppLayout.css` (var `--sidebar-width` colapsada)
- Modify: `src/ui/layouts/Sidebar.jsx` (botão toggle + prop `collapsed`)
- Modify: `src/ui/layouts/Sidebar.css` (estilos colapsados: esconder labels, centralizar ícones)
- Test: `src/ui/layouts/Sidebar.test.jsx` (já existe — adicionar casos)

**Interfaces:**
- Consumes: `Sidebar({ isOpen, onClose })` existente; `--sidebar-width` definida no CSS global.
- Produces: `Sidebar({ isOpen, onClose, collapsed, onToggleCollapse })`; classe `app-layout--sidebar-collapsed` no root; chave localStorage `ch.sidebar.collapsed` (valores `'1'`/`'0'`).

- [ ] **Step 1: Teste falhando — toggle renderiza e dispara callback**

Adicionar em `src/ui/layouts/Sidebar.test.jsx` (seguir os mocks/render helpers já presentes no arquivo):

```jsx
it('renderiza botao de recolher e chama onToggleCollapse', async () => {
    const onToggleCollapse = vi.fn();
    renderSidebar({ collapsed: false, onToggleCollapse });
    const toggle = screen.getByRole('button', { name: /recolher menu/i });
    await userEvent.click(toggle);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
});

it('em modo recolhido, aside recebe classe sidebar--collapsed e botao vira "Expandir menu"', () => {
    renderSidebar({ collapsed: true, onToggleCollapse: vi.fn() });
    expect(document.querySelector('.sidebar')).toHaveClass('sidebar--collapsed');
    expect(screen.getByRole('button', { name: /expandir menu/i })).toBeInTheDocument();
});
```

(`renderSidebar` = helper existente do arquivo; se ele não aceitar props extras, estender a assinatura repassando `...props` para `<Sidebar />`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/layouts/Sidebar.test.jsx`
Expected: FAIL — botão "recolher menu" não existe.

- [ ] **Step 3: Implementar no Sidebar.jsx**

```jsx
export default function Sidebar({ isOpen, onClose, collapsed = false, onToggleCollapse }) {
    // ...código existente...
    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''} ${collapsed ? 'sidebar--collapsed' : ''}`}>
            <div className="sidebar__brand">
                <div className="sidebar__logo">CH</div>
                {!collapsed && <span className="sidebar__title">ComplianceHub</span>}
                {onToggleCollapse && (
                    <button
                        type="button"
                        className="sidebar__collapse-toggle"
                        onClick={onToggleCollapse}
                        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                    >
                        {collapsed ? '»' : '«'}
                    </button>
                )}
            </div>
            {/* nav: quando collapsed, NavLink ganha title={item.label} e esconde o span do label */}
```

No `.map` dos navItems: `<span className="sidebar__label">{item.label}</span>` permanece no DOM (CSS esconde) e o `NavLink` ganha `title={item.label}` para tooltip quando colapsado. Footer (contexto de tenant + usuário) permanece no DOM; CSS colapsado o esconde (`display: none`) — o select de tenant não é usável colapsado, comportamento aceito.

- [ ] **Step 4: CSS**

`Sidebar.css` (append):

```css
.sidebar__collapse-toggle {
    margin-left: auto;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.12);
    color: rgba(255,255,255,.7);
    border-radius: var(--radius-md);
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
}
.sidebar--collapsed .sidebar__label,
.sidebar--collapsed .sidebar__footer,
.sidebar--collapsed .sidebar__title { display: none; }
.sidebar--collapsed .sidebar__brand { justify-content: center; padding: var(--space-4) var(--space-2); }
.sidebar--collapsed .sidebar__collapse-toggle { margin-left: 0; }
.sidebar--collapsed .sidebar__link { justify-content: center; padding-left: 0; padding-right: 0; }
@media (max-width: 768px) {
    /* colapso é desktop-only; mobile mantém drawer isOpen */
    .sidebar__collapse-toggle { display: none; }
}
```

`AppLayout.css` (append):

```css
.app-layout--sidebar-collapsed { --sidebar-width: 68px; }
```

(Como `.sidebar` e `.app-layout__main` derivam tudo de `--sidebar-width`, nada mais muda.)

- [ ] **Step 5: AppLayout.jsx — estado + persistência**

```jsx
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('ch.sidebar.collapsed') === '1'; } catch { return false; }
});
const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((current) => {
        const next = !current;
        try { window.localStorage.setItem('ch.sidebar.collapsed', next ? '1' : '0'); } catch { /* storage indisponivel */ }
        return next;
    });
};
```

Root: `className={`app-layout ${isSidebarOpen ? 'app-layout--sidebar-open' : ''} ${isSidebarCollapsed ? 'app-layout--sidebar-collapsed' : ''}`}` e `<Sidebar isOpen={isSidebarOpen} onClose={...} collapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebarCollapsed} />`.

- [ ] **Step 6: Rodar testes**

Run: `npx vitest run src/ui/layouts/Sidebar.test.jsx src/App.test.jsx`
Expected: PASS (novos + existentes).

- [ ] **Step 7: Verificação visual** — `npm run dev`, conferir colapso/expansão, tooltip dos ícones, persistência após reload, mobile intacto (drawer).

- [ ] **Step 8: Commit**

```bash
git add src/ui/layouts/
git commit -m "feat: sidebar recolhivel com persistencia em localStorage"
```

---

### Task 2: Retorno automático à fila após conclusão

**Files:**
- Modify: `src/portals/ops/CasoPage.jsx:1757-1770` (tela de sucesso `if (concluded)`)
- Test: `src/portals/ops/CasoPage.test.jsx` (adicionar caso)

**Interfaces:**
- Consumes: estado `concluded` (CasoPage.jsx:830), `navigate`, `isDemoMode`.
- Produces: redirect automático para `/ops/fila` (ou `/demo/ops/fila`) 5s após conclusão, com contagem visível e botão "Ficar nesta página" que cancela.

- [ ] **Step 1: Teste falhando**

Em `CasoPage.test.jsx` (usar helpers de render existentes; mockar timers):

```jsx
it('apos conclusao, mostra contagem e redireciona para a fila em 5s', async () => {
    vi.useFakeTimers();
    // renderizar CasoPage em estado concluded (drive: concluir via fluxo mockado existente
    // ou expor cenário: render com caso DONE recém-concluído conforme padrão do arquivo)
    // Asserções:
    expect(screen.getByText(/retornando para a fila em 5s/i)).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(mockNavigate).toHaveBeenCalledWith('/ops/fila');
    vi.useRealTimers();
});

it('botao "Ficar nesta pagina" cancela o retorno automatico', async () => {
    vi.useFakeTimers();
    // ...mesmo setup...
    await userEvent.click(screen.getByRole('button', { name: /ficar nesta pagina/i }));
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(mockNavigate).not.toHaveBeenCalledWith('/ops/fila');
    vi.useRealTimers();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/portals/ops/CasoPage.test.jsx`
Expected: FAIL — texto de contagem inexistente.

- [ ] **Step 3: Implementar**

Novo estado + efeito perto de `concluded` (linha ~830):

```jsx
const [autoReturnSeconds, setAutoReturnSeconds] = useState(null);
useEffect(() => {
    if (!concluded) { setAutoReturnSeconds(null); return undefined; }
    setAutoReturnSeconds(5);
    const interval = setInterval(() => {
        setAutoReturnSeconds((current) => {
            if (current === null) { clearInterval(interval); return null; }
            if (current <= 1) {
                clearInterval(interval);
                navigate(isDemoMode ? '/demo/ops/fila' : '/ops/fila');
                return 0;
            }
            return current - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
}, [concluded, isDemoMode, navigate]);
```

Tela de sucesso (1757-1770) ganha:

```jsx
{autoReturnSeconds !== null && autoReturnSeconds > 0 && (
    <p className="caso-success__countdown">Retornando para a fila em {autoReturnSeconds}s…</p>
)}
<button className="caso-btn caso-btn--primary" onClick={() => navigate(isDemoMode ? '/demo/ops/fila' : '/ops/fila')}>
    Voltar para a fila agora
</button>
{autoReturnSeconds !== null && (
    <button className="caso-btn caso-btn--secondary" onClick={() => setAutoReturnSeconds(null)}>
        Ficar nesta página
    </button>
)}
```

- [ ] **Step 4: Rodar testes** — `npx vitest run src/portals/ops/CasoPage.test.jsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/portals/ops/CasoPage.jsx src/portals/ops/CasoPage.test.jsx
git commit -m "feat: retorno automatico a fila apos conclusao do caso"
```

---

### Task 3: `correctionRequestedAt` no caminho do identity gate

**Files:**
- Modify: `functions/index.js:278-292` (`returnCaseForIdentityGateBlock`)
- Test: `functions/identityGate.test.js` (caso existente na linha ~137 valida o payload — estender)

**Interfaces:**
- Consumes: `returnCaseForIdentityGateBlock({ caseRef, caseId, provider, providerLabel, gateReason, updateFields })`.
- Produces: todo caso bloqueado pelo gate passa a ter `correctionRequestedAt` (ISO string), mesmo campo que o fluxo ops (`caseQueriesAssignments.js:1433`). A Task 4 depende deste campo.

- [ ] **Step 1: Teste falhando** — no teste existente "updates case with CORRECTION_NEEDED and blocked fields" (identityGate.test.js:137), adicionar:

```js
expect(typeof updateCall.correctionRequestedAt).toBe('string');
expect(new Date(updateCall.correctionRequestedAt).toString()).not.toBe('Invalid Date');
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run identityGate.test.js` (cwd `functions/`) → FAIL, campo undefined.

- [ ] **Step 3: Implementar** — em `returnCaseForIdentityGateBlock`:

```js
const updatePayload = {
    status: 'CORRECTION_NEEDED',
    correctionReason: 'identity_gate_blocked',
    correctionNotes: gateReason || 'Gate de identidade bloqueado',
    correctionRequestedBy: 'system_gate',
    correctionRequestedAt: new Date().toISOString(),
    ...(updateFields || {}),
};
```

- [ ] **Step 4: Rodar testes** — `npx vitest run identityGate.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js functions/identityGate.test.js
git commit -m "fix: identity gate registra correctionRequestedAt"
```

---

### Task 4: Auto-expiração de correções pendentes (scheduled, 48h)

**Files:**
- Create: `functions/modules/correctionExpiry.js` (lógica pura + scheduled factory)
- Create: `functions/modules/correctionExpiry.test.js`
- Modify: `functions/index.js` (registrar export da scheduled function, seguindo o padrão de `backupWorker`)

**Interfaces:**
- Consumes: `correctionRequestedAt` (Task 3), padrão `onSchedule` de `functions/modules/backupWorker.js:81`, `createSystemCaseMessage`/`caseComm.createNotification`/`writeAuditEvent` já injetados em outros módulos (ver as factories em `caseQueriesAssignments.js:1400-1407` para a lista de dependências injetáveis).
- Produces:
  - `selectExpiredCorrectionCases(cases, { now, defaultHours = 48 })` → `[{ id, expiredSinceMs }]` (pura).
  - `selectCorrectionReminderCases(cases, { now, defaultHours = 48 })` → casos na metade da janela sem `correctionReminderSentAt` (pura).
  - `createAutoExpireCorrectionsScheduler({ db, createSystemCaseMessage, createNotification, writeAuditEvent })` → `onSchedule('every 60 minutes', ...)`.
  - Campos escritos no caso expirado: `status: 'DONE'`, `conclusionType: 'AUTO_EXPIRED_CORRECTION'`, `concludedAt` (ISO), `turnaroundHours` (mesma fórmula de `opsReviewHandlers.js:285` — horas entre createdAt e concludedAt), `autoExpiredAt`, `updatedAt`. NÃO escreve `finalVerdict`, NÃO publica relatório.

- [ ] **Step 1: Testes falhando (lógica pura)**

`functions/modules/correctionExpiry.test.js`:

```js
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
const require = createRequire(import.meta.url);
const { selectExpiredCorrectionCases, selectCorrectionReminderCases } = require('./correctionExpiry');

const NOW = new Date('2026-07-23T12:00:00.000Z');

describe('selectExpiredCorrectionCases', () => {
    it('seleciona caso CORRECTION_NEEDED com correctionRequestedAt > 48h', () => {
        const cases = [{ id: 'a', status: 'CORRECTION_NEEDED', correctionRequestedAt: '2026-07-21T11:00:00.000Z' }];
        expect(selectExpiredCorrectionCases(cases, { now: NOW })).toEqual([
            expect.objectContaining({ id: 'a' }),
        ]);
    });

    it('nao seleciona caso dentro da janela', () => {
        const cases = [{ id: 'a', status: 'CORRECTION_NEEDED', correctionRequestedAt: '2026-07-22T13:00:00.000Z' }];
        expect(selectExpiredCorrectionCases(cases, { now: NOW })).toEqual([]);
    });

    it('usa fallback updatedAt e depois createdAt quando correctionRequestedAt ausente (casos legados)', () => {
        const cases = [
            { id: 'legacy-upd', status: 'CORRECTION_NEEDED', updatedAt: '2026-07-19T00:00:00.000Z' },
            { id: 'legacy-created', status: 'CORRECTION_NEEDED', createdAt: '2026-07-18T00:00:00.000Z' },
        ];
        expect(selectExpiredCorrectionCases(cases, { now: NOW }).map((c) => c.id)).toEqual(['legacy-upd', 'legacy-created']);
    });

    it('respeita override por tenant via tenantAutoExpireHours no proprio caso enriquecido', () => {
        const cases = [{ id: 'a', status: 'CORRECTION_NEEDED', correctionRequestedAt: '2026-07-21T11:00:00.000Z', tenantAutoExpireHours: 96 }];
        expect(selectExpiredCorrectionCases(cases, { now: NOW })).toEqual([]);
    });

    it('ignora status diferente de CORRECTION_NEEDED', () => {
        expect(selectExpiredCorrectionCases([{ id: 'a', status: 'PENDING', createdAt: '2026-07-01T00:00:00.000Z' }], { now: NOW })).toEqual([]);
    });
});

describe('selectCorrectionReminderCases', () => {
    it('seleciona caso na metade da janela sem lembrete enviado', () => {
        const cases = [{ id: 'a', status: 'CORRECTION_NEEDED', correctionRequestedAt: '2026-07-22T10:00:00.000Z' }];
        expect(selectCorrectionReminderCases(cases, { now: NOW }).map((c) => c.id)).toEqual(['a']);
    });

    it('nao repete lembrete', () => {
        const cases = [{ id: 'a', status: 'CORRECTION_NEEDED', correctionRequestedAt: '2026-07-22T10:00:00.000Z', correctionReminderSentAt: '2026-07-23T00:00:00.000Z' }];
        expect(selectCorrectionReminderCases(cases, { now: NOW })).toEqual([]);
    });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run modules/correctionExpiry.test.js` → FAIL, módulo inexistente.

- [ ] **Step 3: Implementar lógica pura** em `functions/modules/correctionExpiry.js`:

```js
const DEFAULT_AUTO_EXPIRE_HOURS = 48;

function parseWhen(caseData) {
    const raw = caseData.correctionRequestedAt || caseData.updatedAt || caseData.createdAt || null;
    if (!raw) return null;
    if (typeof raw?.toDate === 'function') return raw.toDate();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function windowHours(caseData, defaultHours) {
    const override = Number(caseData.tenantAutoExpireHours);
    return Number.isFinite(override) && override > 0 ? override : defaultHours;
}

function selectExpiredCorrectionCases(cases = [], { now = new Date(), defaultHours = DEFAULT_AUTO_EXPIRE_HOURS } = {}) {
    return cases.filter((caseData) => {
        if (caseData.status !== 'CORRECTION_NEEDED') return false;
        const since = parseWhen(caseData);
        if (!since) return false;
        const elapsedMs = now.getTime() - since.getTime();
        return elapsedMs >= windowHours(caseData, defaultHours) * 3600000;
    }).map((caseData) => ({ ...caseData, expiredSinceMs: now.getTime() - parseWhen(caseData).getTime() }));
}

function selectCorrectionReminderCases(cases = [], { now = new Date(), defaultHours = DEFAULT_AUTO_EXPIRE_HOURS } = {}) {
    return cases.filter((caseData) => {
        if (caseData.status !== 'CORRECTION_NEEDED') return false;
        if (caseData.correctionReminderSentAt) return false;
        const since = parseWhen(caseData);
        if (!since) return false;
        const elapsedMs = now.getTime() - since.getTime();
        const totalMs = windowHours(caseData, defaultHours) * 3600000;
        return elapsedMs >= totalMs / 2 && elapsedMs < totalMs;
    });
}

module.exports = {
    DEFAULT_AUTO_EXPIRE_HOURS,
    selectExpiredCorrectionCases,
    selectCorrectionReminderCases,
};
```

- [ ] **Step 4: Rodar testes** — PASS.

- [ ] **Step 5: Scheduled factory (mesma file), teste depois implementação**

Teste adicional (mock de db com collection().where().get() no padrão dos mocks de `caseQueriesAssignments.test.js`):

```js
describe('createAutoExpireCorrectionsScheduler handler', () => {
    it('expira caso vencido: DONE + AUTO_EXPIRED_CORRECTION, sem finalVerdict, com mensagens', async () => {
        // db mock: query status==CORRECTION_NEEDED retorna 1 caso vencido; capturar update()
        // executar handler interno exportado como runAutoExpireCorrections({ db, ... }, now)
        // asserts: update payload contem status DONE, conclusionType AUTO_EXPIRED_CORRECTION,
        //          concludedAt ISO, turnaroundHours number, NAO contem finalVerdict;
        //          createSystemCaseMessage chamado com systemType 'CORRECTION_EXPIRED';
        //          writeAuditEvent chamado.
    });
});
```

Implementação: exportar `runAutoExpireCorrections({ db, createSystemCaseMessage, createNotification, writeAuditEvent }, now)` que:
1. `db.collection('cases').where('status', '==', 'CORRECTION_NEEDED').get()` (estoque é pequeno; sem paginação por ora — anotar limite de 500/execução com `slice`).
2. Busca `correctionAutoExpireHours` dos tenants envolvidos (um `get` por tenantId único) e anexa como `tenantAutoExpireHours` em cada caso.
3. `selectCorrectionReminderCases` → para cada: `createSystemCaseMessage` `systemType: 'CORRECTION_REMINDER'` + update `correctionReminderSentAt`.
4. `selectExpiredCorrectionCases` → para cada, em transaction (re-checar status no snapshot da transaction para não competir com correção do cliente chegando):

```js
const concludedAt = now.toISOString();
const createdAt = caseData.createdAt ? new Date(caseData.createdAt) : null;
transaction.update(caseRef, {
    status: 'DONE',
    conclusionType: 'AUTO_EXPIRED_CORRECTION',
    concludedAt,
    autoExpiredAt: concludedAt,
    turnaroundHours: createdAt ? Math.round(((now - createdAt) / 3600000) * 10) / 10 : null,
    updatedAt: FieldValue.serverTimestamp(),
});
```

Depois da transaction: `createSystemCaseMessage` (`systemType: 'CORRECTION_EXPIRED'`, corpo: "A solicitação foi encerrada automaticamente após N horas sem a correção solicitada. Motivo original: {correctionReason}."), notificação ao cliente via `caseComm`, `writeAuditEvent` com actor system.
E `createAutoExpireCorrectionsScheduler(deps)` = `onSchedule({ schedule: 'every 60 minutes', region: 'southamerica-east1', timeZone: 'America/Sao_Paulo' }, () => runAutoExpireCorrections(deps, new Date()))` — espelhar opções exatas de `backupWorker.js:81`.

- [ ] **Step 6: Registrar em `functions/index.js`** — junto aos exports de scheduled existentes:

```js
const { createAutoExpireCorrectionsScheduler } = require('./modules/correctionExpiry');
exports.autoExpireCorrections = createAutoExpireCorrectionsScheduler({
    db,
    createSystemCaseMessage,
    createNotification: caseComm.createNotification,
    writeAuditEvent,
});
```

(Conferir os nomes reais no index — `createSystemCaseMessage`/`writeAuditEvent` já são passados às factories em `caseQueriesAssignments`; importar dos mesmos lugares.)

- [ ] **Step 7: UI mínima do estado expirado** — `src/core/copy/status.js`: se houver mapa de `conclusionType`, adicionar rótulo "Expirado sem correcao"; no portal do cliente o caso DONE + `conclusionType === 'AUTO_EXPIRED_CORRECTION'` NÃO deve exibir botão de relatório (checar `src/core/clientPortal.js` onde o relatório é habilitado e adicionar guarda + teste).

- [ ] **Step 8: Suíte completa** — `npx vitest run` → tudo verde.

- [ ] **Step 9: Commit**

```bash
git add functions/modules/correctionExpiry.js functions/modules/correctionExpiry.test.js functions/index.js src/core/copy/status.js src/core/clientPortal.js
git commit -m "feat: auto-expiracao de casos em correcao apos 48h com lembrete na metade da janela"
```

---

### Task 5: Ordenação por urgência — backend

**Files:**
- Modify: `functions/modules/caseQueriesAssignments.js:248-260` (`compareOpsCases`) + nova função pura `computeUrgencyRank`
- Modify: `functions/modules/caseQueriesAssignments.js:940` (caminho V2 cursor: `sortField === 'urgency'` deve cair no caminho in-memory — tratar como filtro não suportado/fallback)
- Test: `functions/modules/caseQueriesAssignments.test.js`

**Interfaces:**
- Consumes: shape do caso da fila (`createdAt`, `slaHours` default 48, `priority`, `status`).
- Produces: `computeUrgencyRank(caseData, now)` → número (menor = mais urgente); `compareOpsCases(left, right, 'urgency', dir)` ordena por esse rank; `sortField: 'urgency'` aceito pelo listOpsCases V1.

- [ ] **Step 1: Testes falhando**

```js
describe('compareOpsCases urgency', () => {
    const NOW = new Date('2026-07-23T12:00:00.000Z');
    const mk = (id, createdAt, priority = 'NORMAL', slaHours = 48) => ({ id, createdAt, priority, slaHours, status: 'PENDING' });

    it('vencido ha mais tempo vem primeiro', () => {
        const older = mk('older', '2026-07-19T12:00:00.000Z'); // vencido ha 48h
        const newer = mk('newer', '2026-07-20T12:00:00.000Z'); // vencido ha 24h
        const sorted = [newer, older].sort((a, b) => compareOpsCases(a, b, 'urgency', 'desc', NOW));
        expect(sorted.map((c) => c.id)).toEqual(['older', 'newer']);
    });

    it('vencido vem antes de dentro do prazo', () => {
        const overdue = mk('overdue', '2026-07-20T12:00:00.000Z');
        const onTime = mk('ontime', '2026-07-23T00:00:00.000Z');
        const sorted = [onTime, overdue].sort((a, b) => compareOpsCases(a, b, 'urgency', 'desc', NOW));
        expect(sorted[0].id).toBe('overdue');
    });

    it('priority HIGH desempata dentro do mesmo estado', () => {
        const normal = mk('normal', '2026-07-23T00:00:00.000Z');
        const high = { ...mk('high', '2026-07-23T00:00:00.000Z'), priority: 'HIGH' };
        const sorted = [normal, high].sort((a, b) => compareOpsCases(a, b, 'urgency', 'desc', NOW));
        expect(sorted[0].id).toBe('high');
    });
});
```

(Assinatura de `compareOpsCases` ganha 5º parâmetro opcional `now` para teste determinístico; produção usa default `new Date()` capturado UMA vez por request, não por comparação.)

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run modules/caseQueriesAssignments.test.js` → FAIL.

- [ ] **Step 3: Implementar**

```js
function computeUrgencyRank(caseData, now = new Date()) {
    const created = caseData.createdAt ? new Date(caseData.createdAt) : null;
    if (!created || Number.isNaN(created.getTime())) return Number.MAX_SAFE_INTEGER;
    const slaHours = Number(caseData.slaHours) > 0 ? Number(caseData.slaHours) : 48;
    const remainingMs = created.getTime() + slaHours * 3600000 - now.getTime();
    const highBoost = caseData.priority === 'HIGH' ? -1 : 0;
    // remainingMs negativo (vencido) ordena naturalmente antes; boost HIGH desloca meio degrau
    return remainingMs + highBoost * 1800000;
}

function compareOpsCases(left, right, sortField, sortDir, now = new Date()) {
    if (sortField === 'urgency') {
        const diff = computeUrgencyRank(left, now) - computeUrgencyRank(right, now);
        if (diff !== 0) return diff;
        return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
    }
    // ...whitelist existente inalterada...
}
```

No handler V1 (linhas ~731 e ~898): aceitar `'urgency'` (hoje o whitelist interno derrubaria para `createdAt` — o branch novo roda antes do whitelist). No V2 (linha ~940): `if (sortField === 'urgency')` → tratar como não suportado no caminho cursor (mesmo mecanismo de `unsupportedFilters`/`fallbackToV1`), pois é campo computado que o Firestore não ordena.

- [ ] **Step 4: Rodar testes** — PASS + suíte de functions completa.

- [ ] **Step 5: Commit**

```bash
git add functions/modules/caseQueriesAssignments.js functions/modules/caseQueriesAssignments.test.js
git commit -m "feat: sortField urgency na listagem ops (vencidos primeiro)"
```

---

### Task 6: Ordenação por urgência — frontend (fila)

**Files:**
- Modify: `src/portals/ops/FilaPage.jsx:82-91` (passar `sortField: 'urgency'`, `sortDir: 'asc'`)
- Modify: `src/hooks/useOpsCasesQuery.js:69` (demo sort espelha urgência)
- Test: `src/portals/ops/FilaPage.test.jsx`

**Interfaces:**
- Consumes: `useOpsCasesQuery({ ..., sortField, sortDir })` (já repassa ao backend — linha 89) e Task 5.
- Produces: fila ordenada por urgência por padrão; seletor de ordenação com opções "Mais urgentes" (default) e "Mais recentes".

- [ ] **Step 1: Teste falhando** — em `FilaPage.test.jsx`, assertar que `callListOpsCases` (mock) recebe `sortField: 'urgency'` no primeiro load, e que o select "Ordenar" com valor "Mais recentes" muda para `sortField: 'createdAt'`.

```jsx
expect(mockCallListOpsCases).toHaveBeenCalledWith(expect.objectContaining({ sortField: 'urgency', sortDir: 'asc' }));
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** — estado `const [sort, setSort] = useState('urgency');` mapeado para `{ sortField: sort, sortDir: sort === 'urgency' ? 'asc' : 'desc' }` no `useOpsCasesQuery`; select nos filtros:

```jsx
<select className="fila-filter-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
    <option value="urgency">Mais urgentes primeiro</option>
    <option value="createdAt">Mais recentes primeiro</option>
</select>
```

Demo path em `useOpsCasesQuery.js:69`: replicar `computeUrgencyRank` simplificado usando `getSlaStatus` de `src/core/caseSla.js` (já importado no arquivo) quando `sortField === 'urgency'`; manter localeCompare por data caso contrário.

- [ ] **Step 4: Rodar testes** — `npx vitest run src/portals/ops/FilaPage.test.jsx src/hooks/useCases.test.jsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/portals/ops/FilaPage.jsx src/hooks/useOpsCasesQuery.js src/portals/ops/FilaPage.test.jsx
git commit -m "feat: fila ordenada por urgencia por padrao"
```

---

### Task 7 (extras de baixo custo, opcionais — cada um independente)

1. **Linha da fila clicável**: em `FilaPage.jsx`, `onClick` na `<tr>` navegando para o caso (com `stopPropagation` nos botões/checkbox), `cursor: pointer` no CSS. Teste: click na linha chama navigate.
2. **Coluna "Aguardando há"**: quando filtro `CORRECTION_NEEDED` ativo, exibir tempo desde `correctionRequestedAt` e o restante até a auto-expiração (reusa a janela da Task 4 — expor `DEFAULT_AUTO_EXPIRE_HOURS` também num módulo compartilhável ou constante local no front).
3. **KPI com aviso de expiração**: subtexto no card "Correcao Pendente": "N expiram em menos de 24h" (cálculo client-side com os stats já retornados exigiria novo stat no backend — adicionar `stats.correctionsExpiringSoon` em `buildOpsCaseStats`).

---

## Verificação final (após todas as tasks)

- [ ] `npx vitest run` na raiz — suíte completa verde (base atual: 1905 testes).
- [ ] Smoke manual: colapsar sidebar → navegar → reload (persistência); concluir caso demo → contagem → retorno à fila; fila com casos vencidos no topo.
- [ ] Deploy das functions inclui a scheduled nova (`firebase deploy --only functions:autoExpireCorrections` primeiro em staging, se houver).
- [ ] Observar primeira execução do scheduler nos logs antes de considerar os 32 casos resolvidos (eles serão expirados na primeira rodada pós-deploy — comunicar ao time ANTES do deploy, pois é ação em massa irreversível sem intervenção).
