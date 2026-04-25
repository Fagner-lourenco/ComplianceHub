# Auditoria: Integração Frontend ↔ Backend

> Data: 2026-04-24
> Versão do sistema: ComplianceHub V2
> Status: Build passando ✅ | Dev server rodando em :5174 ✅

---

## 1. RESUMO EXECUTIVO

O frontend está **funcionalmente integrado** com o backend via REST API. Os hooks `useDossier` e `useDossierList` já chamam a API real (não há mais mocks ativos nos hooks principais). O build de produção passa sem erros.

**No entanto, existem 5 problemas críticos** que impedem o máximo aproveitamento de dados e podem causar bugs em produção:

| # | Problema | Severidade | Impacto |
|---|----------|------------|---------|
| 1 | Paginação quebrada (frontend espera `total`, backend retorna cursor) | 🔴 Crítico | Listagem não mostra total, paginação não funciona |
| 2 | Analytics dos gráficos Recharts não recebem dados reais | 🟡 Alto | Gráficos sempre vazios ou com dados genéricos |
| 3 | Estatísticas de polo (autor/réu/envolvido) sempre zero | 🟡 Alto | Cards de estatísticas judiciais não refletem realidade |
| 4 | BDC Integration incompleta (outro agente trabalhando) | 🟡 Alto | Apenas 4/40 datasets PF funcionam; PJ quebrado |
| 5 | Bundle size 658KB (recharts no chunk principal) | 🟢 Médio | Performance de carregamento |

---

## 2. O QUE ESTÁ FUNCIONANDO ✅

### 2.1 API REST — Endpoints Verificados

| Endpoint | Status | Observação |
|----------|--------|------------|
| `GET /api/v1/dossiers` | ✅ Funcionando | Cursor-based pagination |
| `GET /api/v1/dossiers/:id` | ✅ Funcionando | Retorna formato flat correto |
| `POST /api/v1/dossiers` | ✅ Funcionando | Criação com auto-processamento |
| `PATCH /api/v1/dossiers/:id` | ✅ Funcionando | Aceita `{analysis: {conclusive}}` |
| `POST /api/v1/dossiers/:id/approve` | ✅ Funcionando | Aprovação de análise |
| `POST /api/v1/dossiers/:id/reject` | ✅ Funcionando | Reprovação de análise |
| `POST /api/v1/dossiers/:id/comments` | ✅ Funcionando | Comentários |

### 2.2 Frontend Features Implementadas

- ✅ Criação de dossiê (CPF/CNPJ + preset)
- ✅ Listagem com filtros (período, responsável, status)
- ✅ Detalhe com tabs de macro áreas
- ✅ Toggle Analítico/Detalhado
- ✅ Filtros judiciais (Tribunal, Status, Participação, UF)
- ✅ Conclusão editável + Aprovar/Reprovar
- ✅ Comentários por fonte e globais
- ✅ Painel lateral "Fontes com/Sem Resultados"
- ✅ Download JSON por fonte
- ✅ Header com Score, Workflow, Monitoria
- ✅ Responsividade mobile (ajustes aplicados)
- ✅ Recharts instalados e componentes criados

---

## 3. PROBLEMAS CRÍTICOS 🔴

### 3.1 Paginação Quebrada

**Frontend** (`useDossierList.js`):
```js
setPagination((prev) => ({
  ...prev,
  total: result.meta?.total || 0,  // ← SEMPRE 0
}));
```

**Backend** (`pagination.js` → `buildPaginatedResponse`):
```js
meta: {
  hasMore,      // ← bool
  nextCursor,   // ← string base64
  perPage,      // ← number
  returned,     // ← number
  // total: NÃO EXISTE ← cursor-based pagination não tem total
}
```

**Impacto:** A listagem mostra "0 resultados" no contador de total, e não há navegação para próxima página usando cursor.

**Correção recomendada:**
- **Opção A (rápida):** Adicionar contador `total` no backend via `count()` agregado (custo: 1 read extra por listagem)
- **Opção B (correta):** Implementar cursor-based pagination no frontend (botão "Carregar mais" usando `nextCursor`)

### 3.2 Analytics/Gráficos Sem Dados Reais

O backend retorna `analytics` no modo analítico (linha 365-368 do controller):
```js
if (mode === 'analitico') {
  analytics = buildAnalytics(evidenceItems, moduleRuns);
}
```

**Porém:** O frontend NÃO usa esse campo. O `buildMacroAreas` no `DossierDetailPage.jsx` reconstrói analytics localmente a partir de `moduleRuns`, mas:

1. **`tribunalChart`** e **`subjects`** sempre são arrays vazios
2. **`statusChart`** só preenche "arquivamento" vs "emTramitacao" (não mapeia todos os status)
3. **Não há mapeamento de polo** (autor/réu/envolvido) — sempre retorna 0

**Impacto:** Os gráficos Recharts aparecem vazios ou com dados genéricos.

**Correção recomendada:**
- Usar o objeto `analytics` que o backend já computa (se estiver populado)
- Ou enriquecer o `buildMacroAreas` no frontend para extrair tribunal, assuntos e polo dos dados reais

### 3.3 BDC Integration — Status

Outro agente está trabalhando nos 10 bugs críticos do backend BDC. Status atual:
- PF: 4/40 datasets funcionam end-to-end
- PJ: completamente quebrado (query hardcoded para `/pessoas`, collections_pj sobrescreve PF)

**Impacto:** A maioria dos dossiês retorna "Sem resultado" nas fontes BDC.

---

## 4. OPORTUNIDADES DE MELHORIA 🟡

### 4.1 Maior Aproveitamento de Dados

| Oportunidade | Dado Disponível | Como Usar |
|--------------|-----------------|-----------|
| **Retry de fonte** | API `POST /:id/retry-source` | Adicionar botão "Reprocessar" em fontes com erro |
| **Risk signals** | Backend busca `riskSignals` | Mostrar alertas de risco no header |
| **Subject enrichment** | Backend busca `subject` | Mostrar foto, endereço, telefone do subject |
| **Evidence items** | `evidenceItems.content` | Popular tabelas e parágrafos com dados reais |
| **Module run progress** | `moduleRuns.progress` | Mostrar barra de progresso por fonte |
| **Analytics do backend** | `buildAnalytics()` | Usar diretamente em vez de reconstruir no frontend |

### 4.2 Performance

- Bundle principal: **658KB** (gzip: 198KB)
- Recharts está no chunk principal — deveria ser lazy-loaded
- `firebase-shared`: 430KB — já é chunk separado ✅

**Recomendação:**
```js
// Lazy load recharts apenas na página de detalhe
const AnalyticsCharts = lazy(() => import('./AnalyticsCharts'));
```

### 4.3 Type Safety

O projeto usa JavaScript puro. Muitos acessos a propriedades aninhadas (`dossier.analysis.conclusive`) podem quebrar se o backend mudar o formato.

---

## 5. PLANO DE AÇÃO RECOMENDADO

### Fase 1: Correções Críticas (1-2h)
1. [ ] **Corrigir paginação** — Adicionar `total` no backend OU implementar cursor no frontend
2. [ ] **Conectar analytics reais** — Usar `analytics` do backend se disponível
3. [ ] **Adicionar retry de fonte** — Botão "Reprocessar" conectado à API

### Fase 2: Enriquecimento de Dados (2-3h)
4. [ ] **Popular subject info** — Foto, endereço, telefone do subject
5. [ ] **Mostrar risk signals** — Alertas no header do dossiê
6. [ ] **Mapear polo processual** — Autor/Réu/Envolvido a partir dos dados BDC
7. [ ] **Gráficos com dados reais** — TribunalPieChart e SubjectsPieChart populados

### Fase 3: Otimização (1-2h)
8. [ ] **Lazy load Recharts** — Reduzir bundle inicial
9. [ ] **Code splitting por rota** — Diminuir TTI
10. [ ] **Validação visual** — Screenshots de todas as telas

### Fase 4: BDC Backend (outro agente)
11. [ ] Aguardar/validar correções do agente BDC
12. [ ] Testar end-to-end com dados reais BDC

---

## 6. FORMATO DE DADOS — REFERÊNCIA

### Backend GET /:id (resposta.data)
```json
{
  "id": "caseId",
  "subjectName": "Nome",
  "document": "000.000.000-00",
  "status": "Concluído",
  "riskScore": "85",
  "riskLevel": "—",
  "finalVerdict": "Pendente",
  "monitoringEnabled": false,
  "workflow": "Manual",
  "sourceSections": [{ "id": "cadastro", "title": "Cadastro", "count": 2, "rows": [...] }],
  "detailGroups": [{ "id": "det-cadastro", "title": "Cadastro", "entries": [...] }],
  "macroAreas": [{ "key": "cadastro", "label": "Cadastro", "icon": "Database", "active": true }],
  "moduleRuns": [{ "id": "sourceKey", "moduleKey": "...", "status": "completed", "progress": 100 }],
  "comments": [{ "id": "...", "text": "...", "authorName": "...", "createdAt": "..." }],
  "analysis": { "conclusion": "", "conclusive": "", "status": "pending" }
}
```

### Backend GET / (resposta.meta)
```json
{
  "hasMore": true,
  "nextCursor": "eyJpZCI6Li4ufQ==",
  "perPage": 20,
  "returned": 20
}
```

---

## 7. CONCLUSÃO

O sistema está **funcional e integrado**, mas há **gaps de dados** que impedem o aproveitamento máximo da informação que já existe no backend. As correções prioritárias são:

1. **Paginação** — Sem isso, a listagem é inutilizável para muitos registros
2. **Analytics reais** — Sem isso, a view analítica é meramente decorativa
3. **Retry de fonte** — Essencial para operação (fontes falham frequentemente)

Todas as três são **correções rápidas** (1-2 horas no total) que teriam impacto imediato na usabilidade.
