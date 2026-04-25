# Plano de Execução V2 — Simplificado

> Baseado nas referências da upMiner. Foco: o cliente coloca o CPF/CNPJ (ou nome + data de nascimento se não tiver documento) e o sistema consulta tudo automaticamente.

---

## 1. Visão Geral do Novo Fluxo

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Tela Inicial   │────▶│  Tela de Resultado   │────▶│ Análise Conclusiva  │────▶│ Aprovar/Reprovar│
│  (Busca Simples)│     │  (Analítica/Detalhada)│    │   (textarea)        │     │                 │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘     └─────────────────┘
```

**Eliminado:**
- Wizard de 4 passos (perfil → critérios → tag → parâmetros)
- Escolha de preset no momento da criação (usa perfil padrão "Compliance")
- Tags obrigatórias
- Parâmetros avançados
- Pipeline complexo de intake

**Mantido (igual upMiner):**
- Lista de dossiês com filtros
- Header do dossiê com CPF, nome, idade, nº dossiê, fontes com/sem resultados
- Duas views: **Analítica** (dashboard/resumo) e **Detalhada** (fonte por fonte)
- Macro áreas como accordions/sections
- Painel lateral com "Fontes com Resultados" / "Fontes sem Resultados"
- Comentários por fonte
- Análise conclusiva no final
- Botões Aprovar / Reprovar

---

## 2. Telas

### 2.1 Tela Inicial — Busca Simples

**Layout:** Centralizado, limpo, tipo Google.

```
┌─────────────────────────────────────────────┐
│  [Logo CH]                                  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  CPF ou CNPJ                        │   │
│  │  [ ___ . ___ . ___ - __ ]  [🔍]    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Não tem o documento? Buscar por nome]    │
│                                             │
└─────────────────────────────────────────────┘
```

**Quando clica "Não tem o documento":**
```
┌─────────────────────────────────────────────┐
│  Nome completo: [_______________________]   │
│  Data de nascimento: [__/__/____]           │
│                                             │
│  [🔍 Consultar]                             │
└─────────────────────────────────────────────┘
```

**Regras:**
- CPF/CNPJ com máscara automática e validação
- Se nome + data de nascimento: backend faz fuzzy match ou consulta BDC com dados parciais
- Ao clicar "Consultar": cria dossiê com preset padrão "compliance" → dispara trigger BDC → redireciona para tela de resultado

### 2.2 Tela de Lista de Dossiês

**Igual upMiner (006/012):**
- Filtros: Período, Responsável, Status, + Filtros
- Botão "Criar novo dossiê" (leva para busca simples)
- Tabela: Nº dossiê | Criação | Tag | Critério (nome do sujeito) | Progresso | Status | Ações
- Status: Pendente, Em processamento, Com exceções, Concluído

### 2.3 Tela de Resultado — Header

**Igual upMiner (003/004):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Dossié 111.347    [Analítico] [Detalhado]           [Início] [Análise]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Jurídico] [Mídia] [Financeiro] [Cadastro] [Reguladores] [Bens] [Listas] │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌──────────┐ ┌─────────────┐ ┌────────┐ ┌───────────────┐ │
│  │050.232.903-│ │Nº Dossié │ │Data Criação │ │Usuário │ │Fontes com Res.│ │
│  │36          │ │111.347   │ │23/04/2026   │ │FAGNER  │ │06  📋         │ │
│  │FRANCISCO   │ │Perfil: RH│ │Último proc. │ │LOURENCO│ │Fontes sem Res.│ │
│  │TACIANO     │ │          │ │23/04/2026   │ │Homônim.│ │11  📋         │ │
│  │34 anos     │ │          │ │             │ │Único   │ │               │ │
│  └────────────┘ └──────────┘ └─────────────┘ └────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tabs de macro área:** Jurídico, Mídia/Internet, Financeiro, Cadastro, Reguladores, Bens e Imóveis, Listas Restritivas, Profissional, Socioambiental

### 2.4 Tela de Resultado — View Analítica

**Igual upMiner (003/011/094):**
- Cada macro área é um **accordion** expansível
- Dentro: cards com estatísticas, gráficos, contagens
- Exemplo Jurídico: "7 processos", "2 como autor", "5 como réu", gráfico de status, donut por tribunal, etc.
- Exemplo Cadastro: "3 fontes", lista com badges (Com resultado / Sem resultado / Indisponível)
- Badge de status por fonte:
  - 🟢 "Com resultado" — encontrou dados
  - 🟡 "Sem resultado" — consultou, não achou nada
  - 🔴 "Indisponível" — erro na fonte

### 2.5 Tela de Resultado — View Detalhada

**Igual upMiner (012/095):**
- Cada fonte é um **accordion expansível**
- Dentro: tabela com dados brutos da fonte
- Ex: "Infosimples: Situação Cadastral do CPF" → tabela com CPF, Nome, Data Nascimento, Idade, Situação na Receita Federal (REGULAR)
- Ex: "Processos Judiciais" → lista de processos com número, classe, tribunal, valor
- Cada fonte tem: ícone de comentário (💬), ícone de download (⬇️), ícone de expandir (📄)
- Seção "Comentários finais" por fonte: "Sem comentários até o momento" + [Adicionar +]

### 2.6 Painel Lateral — Fontes

**Igual upMiner (003/004):**
- Painel deslizante à direita
- Duas abas: "Fontes com Resultados" (X) | "Fontes sem Resultados" (Y)
- Lista simples com nome da fonte

### 2.7 Análise Conclusiva + Aprovação

**Igual upMiner (003/004/012):**
```
┌─────────────────────────────────────────────┐
│  📝 Análise conclusiva do dossié            │
│  Análise                                    │
│  ┌─────────────────────────────────────┐   │
│  │ Escreva sua análise aqui...         │   │
│  │                                     │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                              [👍 Aprovar]  │
│                              [👎 Reprovar] │
├─────────────────────────────────────────────┤
│  💬 Comentários finais                      │
│  Escreva um comentário                      │
│  ┌─────────────────────────────────────┐   │
│  │ Digite aqui...                      │   │
│  └─────────────────────────────────────┘   │
│                    [⭐ Marcar como relevante]│
│                                     [Enviar]│
└─────────────────────────────────────────────┘
```

---

## 3. Backend — O que Precisa Funcionar

### 3.1 Pipeline de Criação Simplificado

```
POST /api/v1/dossiers
{
  "document": "05023290336",     // CPF/CNPJ
  "name": "FRANCISCO TACIANO DE SOUSA",  // opcional
  "birthDate": "1991-08-16",     // opcional, para fuzzy match
  "presetKey": "compliance",     // sempre padrão, usuário não escolhe
  "autoProcess": true            // sempre true
}
```

### 3.2 BDC — Prioridade de Correções

**CRÍTICO (precisa funcionar para o MVP):**
1. `queryCombined` hardcoded `/pessoas` → passar endpoint como parâmetro
2. `callPost` não exportado → exportar
3. `collections_pj` sobrescreve `collections` → renomear chave
4. `capitalizeFirst` gera chaves erradas → mapeamento explícito dataset→resultKey
5. `SECTION_REGISTRY` só tem 4 datasets → adicionar os 40 datasets ou usar catalog direto
6. Trigger `onCaseCreated` usar `endpoint` computado

**Schema de mapeamento correto:**
```javascript
const DATASET_RESULT_KEYS = {
  basic_data: 'BasicData',
  processes: 'Processes',
  kyc: 'KycData',
  occupation_data: 'ProfessionData',
  collections: 'Collections',
  // ... todos os 40
};
```

### 3.3 API Endpoints Necessários

| Endpoint | Uso |
|----------|-----|
| `POST /api/v1/dossiers` | Criar dossiê (CPF/CNPJ ou nome+data) |
| `GET /api/v1/dossiers` | Listar com filtros |
| `GET /api/v1/dossiers/:id` | Detalhe completo |
| `PATCH /api/v1/dossiers/:id` | Salvar análise conclusiva, aprovar/reprovar |
| `GET /api/v1/profiles` | Listar presets (para config admin) |

### 3.4 Dados Retornados no Detalhe

```json
{
  "id": "abc123",
  "dossierNumber": "111.347",
  "subjectName": "FRANCISCO TACIANO DE SOUSA",
  "document": "050.232.903-36",
  "age": 34,
  "presetTitle": "Recursos Humanos",
  "createdAt": "2026-04-23T19:29:02Z",
  "updatedAt": "2026-04-23T19:29:02Z",
  "analystName": "FAGNER LOURENCO",
  "status": "completed",
  "sourcesWithResults": 6,
  "sourcesWithoutResults": 11,
  "macroAreas": [
    {
      "key": "judicial",
      "title": "Jurídico",
      "icon": "Scale",
      "sourceCount": 2,
      "sourcesWithResults": 1,
      "sources": [
        {
          "sourceKey": "bigdatacorp_processes",
          "title": "Processos Judiciais",
          "status": "has_results",
          "resultCount": 7,
          "data": { ... }
        }
      ]
    }
  ],
  "analysis": {
    "conclusion": "",
    "conclusive": null,
    "approvedAt": null,
    "approvedBy": null
  }
}
```

---

## 4. Frontend — Componentes Necessários

### 4.1 Nova Estrutura de Páginas

```
src/
  dossie/
    pages/
      DossierSearchPage.jsx      ← NOVO: busca simples CPF/CNPJ ou nome
      DossierListPage.jsx        ← REFATORAR: igual upMiner
      DossierDetailPage.jsx      ← REFATORAR: analítica/detallhada
    components/
      DossierHeader.jsx          ← NOVO: header com CPF, nome, stats
      MacroAreaTabs.jsx          ← NOVO: tabs de macro área
      AnalyticView.jsx           ← NOVO: view analítica (accordions)
      DetailedView.jsx           ← NOVO: view detalhada (fonte por fonte)
      SourcePanel.jsx            ← NOVO: painel lateral fontes com/sem resultados
      SourceAccordion.jsx        ← NOVO: accordion de fonte com tabela
      ConclusionPanel.jsx        ← NOVO: análise conclusiva + aprovar/reprovar
      CommentPanel.jsx           ← NOVO: comentários por fonte
      ProcessList.jsx            ← NOVO: lista de processos judiciais
```

### 4.2 DossierSearchPage.jsx

```jsx
// Estado simples
const [document, setDocument] = useState('');
const [mode, setMode] = useState('document'); // 'document' | 'name'
const [fullName, setFullName] = useState('');
const [birthDate, setBirthDate] = useState('');
const [loading, setLoading] = useState(false);

// Fluxo:
// 1. Valida CPF/CNPJ ou preenchimento de nome+data
// 2. Chama POST /api/v1/dossiers
// 3. Redireciona para /dossiers/:id
```

### 4.3 DossierDetailPage.jsx

```jsx
// Estado
const [viewMode, setViewMode] = useState('analytic'); // 'analytic' | 'detailed'
const [activeMacroTab, setActiveMacroTab] = useState('judicial');
const [expandedSources, setExpandedSources] = useState({});
const [sidePanelOpen, setSidePanelOpen] = useState(false);
const [sidePanelTab, setSidePanelTab] = useState('withResults');
const [conclusionText, setConclusionText] = useState('');

// Estrutura:
// <DossierHeader dossier={dossier} />
// <ViewToggle analytic={...} detailed={...} />
// <MacroAreaTabs active={...} onChange={...} />
// {viewMode === 'analytic' ? <AnalyticView ... /> : <DetailedView ... />}
// <ConclusionPanel ... />
// <SourcePanel open={...} ... />
```

---

## 5. Roadmap de Implementação

### Fase 1: Backend Crítico (2-3 dias)
- [ ] Corrigir `queryCombined` para aceitar endpoint
- [ ] Exportar `callPost`
- [ ] Corrigir `collections_pj` key collision
- [ ] Criar mapeamento explícito dataset→resultKey
- [ ] Trigger usar endpoint correto por subjectType
- [ ] Adicionar todos os 40 datasets ao SECTION_REGISTRY (ou usar catalog)
- [ ] Testar PF end-to-end
- [ ] Testar PJ end-to-end

### Fase 2: Frontend — Busca Simples (1 dia)
- [ ] Criar `DossierSearchPage.jsx`
- [ ] Criar componente de busca com máscara CPF/CNPJ
- [ ] Modo alternativo nome + data de nascimento
- [ ] Integrar com POST /api/v1/dossiers
- [ ] Redirecionar para detalhe após criação

### Fase 3: Frontend — Lista de Dossiês (1 dia)
- [ ] Refatorar `DossierListPage.jsx`
- [ ] Adicionar filtros funcionais (período, responsável, status)
- [ ] Tabela com progresso e status
- [ ] Botão "Criar novo dossiê" → /dossiers/search

### Fase 4: Frontend — Header + Tabs (1 dia)
- [ ] Criar `DossierHeader.jsx`
- [ ] Criar `MacroAreaTabs.jsx`
- [ ] Integrar com dados do backend

### Fase 5: Frontend — View Analítica (2 dias)
- [ ] Criar `AnalyticView.jsx`
- [ ] Criar accordions por macro área
- [ ] Cards de estatísticas por macro área
- [ ] Badges de status por fonte

### Fase 6: Frontend — View Detalhada (2 dias)
- [ ] Criar `DetailedView.jsx`
- [ ] Criar `SourceAccordion.jsx` com tabelas
- [ ] Renderizar dados brutos de cada fonte
- [ ] Comentários por fonte

### Fase 7: Frontend — Painel Lateral + Conclusão (1 dia)
- [ ] Criar `SourcePanel.jsx`
- [ ] Abas "Fontes com Resultados" / "Sem Resultados"
- [ ] `ConclusionPanel.jsx` com textarea
- [ ] Botões Aprovar/Reprovar
- [ ] Integrar PATCH /api/v1/dossiers/:id

### Fase 8: Polimento (1 dia)
- [ ] Loading states
- [ ] Estados vazios
- [ ] Responsividade
- [ ] Testes E2E

**Total estimado: 11-12 dias**

---

## 6. Decisões de Produto

| Decisão | Justificativa |
|---------|---------------|
| Preset sempre "compliance" | Usuário não precisa escolher no momento da busca. Pode mudar nas configurações. |
| Busca por nome + data nascimento | Casos onde o candidato ainda não tem CPF na mão (ex: processo seletivo inicial) |
| Duas views (Analítica/Detalhada) | upMiner provou que é o padrão da indústria. Analista vê o resumo primeiro, depois entra no detalhe. |
| Macro áreas como tabs | Navegação rápida entre categorias. upMiner usa tabs fixas no topo. |
| Fontes com/sem resultados no painel lateral | Visibilidade imediata do que encontrou vs. o que não encontrou. |
| Badge de status por fonte | upMiner usa "Com resultado" / "Sem resultado" / "Indisponível". Clara e útil. |
| Análise conclusiva no final | O analista precisa escrever um parecer antes de aprovar/reprovar. |
| Comentários por fonte | Permite anotar achados específicos em cada fonte. |
