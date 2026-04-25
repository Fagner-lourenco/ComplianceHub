# 02 — Jurídico & Processual

Endpoints BDC nesta macroárea: **9**.

Hidratados: 5 · Stubs: 4

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 44 | Processos Judiciais e Administrativos | `processes` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.070 | consumed |
| 45 | Processos Judiciais e Administrativos de Familiares de Primeiro Nível | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 46 | Dados de Distribuição de Processos Judiciais | `lawsuits_distribution_data` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 47 | Dados de Distribuição de Processos Judiciais Familiares | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |

## Subject: pj

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 92 | Processos Judiciais e Administrativos | `processes` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.070 | gap |
| 93 | Processos Judiciais dos Sócios | `owners_lawsuits` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.130 | gap |
| 94 | Dados de Distribuição de Processos Judiciais | `lawsuits_distribution_data` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.050 | gap |
| 95 | Dados de Distribuição de Processos dos Sócios | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |

## Subject: process

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 125 | Processos do CADE | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/processos | … | — | pending_hydration |

## Detalhe hidratado

### 44. Processos Judiciais e Administrativos
- **Slug:** `pessoas-processos-judiciais-e-administrativos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-processos-judiciais-e-administrativos
- **Dataset:** `processes` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `consumed`
- **Preços:** `1-10k`: R$ 0.070 · `10k-50k`: R$ 0.066 · `50k-100k`: R$ 0.063 · `100k-500k`: R$ 0.060 · `500k-1M`: R$ 0.057 · `1M-5M`: R$46000 fixo
- **Chaves complementares:** `returnupdates`, `applyFiltersToStats`, `returncvmprocesses`, `updateslimit`, `extendednamematch`
- **Filtros:** `capturedate`, `closedate`, `cnjsubject`, `cnjproceduretype`, `courtlevel`, `courtname`, `courttype`, `partypolarity`, `partytype`, `noticedate`, `state`, `status`, `resjudicatadate`, `value`
- **Resumo:** Tema principal explicitado pelo título da página: “Processos Judiciais e Administrativos”. Categoria no consolidado anterior: Processos Judiciais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido 

### 46. Dados de Distribuição de Processos Judiciais
- **Slug:** `pessoas-dados-de-distribuicao-de-processos-judiciais` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-de-distribuicao-de-processos-judiciais
- **Dataset:** `lawsuits_distribution_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Chaves complementares:** `alternativedistributionparameter`
- **Filtros:** `capturedate`, `closedate`, `cnjsubject`, `cnjproceduretype`, `courtlevel`, `courtname`, `courttype`, `partypolarity`, `partytype`, `noticedate`, `state`, `status`, `resjudicatadate`, `value`
- **Resumo:** Tema principal explicitado pelo título da página: “Dados de Distribuição de Processos Judiciais”. Categoria no consolidado anterior: Processos Judiciais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser exp

### 92. Processos Judiciais e Administrativos
- **Slug:** `empresas-processos-judiciais-e-administrativos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-processos-judiciais-e-administrativos
- **Dataset:** `processes` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.070 · `10k-50k`: R$ 0.066 · `50k-100k`: R$ 0.063 · `100k-500k`: R$ 0.060 · `500k-1M`: R$ 0.057 · `1M-5M`: R$46000 fixo
- **Chaves complementares:** `returnupdates`, `applyFiltersToStats`, `returncvmprocesses`, `updateslimit`
- **Filtros:** `capturedate`, `closedate`, `cnjsubject`, `cnjproceduretype`, `courtlevel`, `courtname`, `courttype`, `partypolarity`, `partytype`, `noticedate`, `state`, `status`, `resjudicatadate`, `value`
- **Resumo:** Tema principal explicitado pelo título da página: “Processos Judiciais e Administrativos”. Categoria no consolidado anterior: Processos Judiciais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido 

### 93. Processos Judiciais dos Sócios
- **Slug:** `empresas-processos-judiciais-dos-socios` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-processos-judiciais-dos-socios
- **Dataset:** `owners_lawsuits` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.130 · `10k-50k`: R$ 0.124 · `50k-100k`: R$ 0.118 · `100k-500k`: R$ 0.112 · `500k-1M`: R$ 0.106 · `1M-5M`: R$86000 fixo
- **Chaves complementares:** `returnupdates`, `applyFiltersToStats`, `returncvmprocesses`, `updateslimit`
- **Filtros:** `capturedate`, `closedate`, `cnjsubject`, `cnjproceduretype`, `courtlevel`, `courtname`, `courttype`, `partypolarity`, `partytype`, `noticedate`, `state`, `status`, `resjudicatadate`, `value`
- **Resumo:** Tema principal explicitado pelo título da página: “Processos Judiciais dos Sócios”. Categoria no consolidado anterior: Processos Judiciais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automat

### 94. Dados de Distribuição de Processos Judiciais
- **Slug:** `empresas-dados-de-distribuicao-de-processos-judiciais` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-distribuicao-de-processos-judiciais
- **Dataset:** `lawsuits_distribution_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Chaves complementares:** `alternativedistributionparameter`
- **Filtros:** `capturedate`, `closedate`, `cnjsubject`, `cnjproceduretype`, `courtlevel`, `courtname`, `courttype`, `partypolarity`, `partytype`, `noticedate`, `state`, `status`, `resjudicatadate`, `value`
- **Resumo:** Tema principal explicitado pelo título da página: “Dados de Distribuição de Processos Judiciais”. Categoria no consolidado anterior: Processos Judiciais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser exp

## Stubs (aguardando hidratação WebFetch)

- **#45 Processos Judiciais e Administrativos de Familiares de Primeiro Nível** — slug `pessoas-processos-judiciais-familiares` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-processos-judiciais-familiares
  - Tema principal explicitado pelo título da página: “Processos Judiciais e Administrativos de Familiares de Primeiro Nível”. Categoria no consolidado anterior: Processos Judiciais. Esta entrada foi mant
- **#47 Dados de Distribuição de Processos Judiciais Familiares** — slug `pessoas-dados-de-distribuicao-de-processos-judiciais-familiares` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-de-distribuicao-de-processos-judiciais-familiares
  - Tema principal explicitado pelo título da página: “Dados de Distribuição de Processos Judiciais Familiares”. Categoria no consolidado anterior: Processos Judiciais. Esta entrada foi mantida para consu
- **#95 Dados de Distribuição de Processos dos Sócios** — slug `empresas-dados-de-distribuicao-de-processos-dos-socios` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-distribuicao-de-processos-dos-socios
  - Tema principal explicitado pelo título da página: “Dados de Distribuição de Processos dos Sócios”. Categoria no consolidado anterior: Processos Judiciais. Esta entrada foi mantida para consulta direta
- **#125 Processos do CADE** — slug `processos-processos-do-cade` · https://docs.bigdatacorp.com.br/plataforma/reference/processos-processos-do-cade
  - Tema principal explicitado pelo título da página: “Processos do CADE”. Categoria no consolidado anterior: API de Processos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo compl
