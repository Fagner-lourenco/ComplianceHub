# 04 — Financeiro & Crédito

Endpoints BDC nesta macroárea: **21**.

Hidratados: 4 · Stubs: 17

## Subject: nfe

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 168 | CTe | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/ondemand | … | — | pending_hydration |
| 169 | NFe | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/ondemand | … | — | pending_hydration |

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 29 | Informações Financeiras | `financial_data` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 30 | Informações Financeiras de Familiares | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 31 | Programas de Benefícios e Assistência Social | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 32 | Programas de Benefícios e Assistência Social de Familiares | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 33 | Propriedades Industriais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 34 | Devedores do Governo | `government_debtors` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |

## Subject: pj

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 79 | Evolução da Empresa | `company_evolution` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.050 | gap |
| 80 | Indicadores de Atividade | `activity_indicators` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.050 | gap |
| 103 | Dados de Fundos de Investimento | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 104 | Dados de Obras Civis | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 105 | Mercado Financeiro | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 181 | Consulta SCR | Score Positivo | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 182 | Dados Restritivos | Birô de Crédito | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 183 | Dados Restritivos | Quod | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 184 | Flags Negativos | Quod | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 185 | Score de Crédito Multidados | Birô de Crédito | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 186 | Score de Crédito | Murabei | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 187 | Score de Crédito | Quantum | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 188 | Score de Crédito | Quod | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |

## Detalhe hidratado

### 29. Informações Financeiras
- **Slug:** `pessoas-informacoes-financeiras` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-informacoes-financeiras
- **Dataset:** `financial_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Informações Financeiras”. Categoria no consolidado anterior: Econômicos e Financeiros. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automatic

### 34. Devedores do Governo
- **Slug:** `pessoas-devedores-do-governo` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-devedores-do-governo
- **Dataset:** `government_debtors` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Devedores do Governo”. Categoria no consolidado anterior: Econômicos e Financeiros. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticame

### 79. Evolução da Empresa
- **Slug:** `empresas-evolucao-da-empresa` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-evolucao-da-empresa
- **Dataset:** `company_evolution` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k+`: R$19000 fixo
- **Resumo:** Dataset da API de Empresas com histórico temporal de capital social, funcionários e número de sócios. Nome técnico: company_evolution. A página também traz tabela de preços.

### 80. Indicadores de Atividade
- **Slug:** `empresas-indicadores-de-atividade` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-indicadores-de-atividade
- **Dataset:** `activity_indicators` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Indicadores de Atividade”. Categoria no consolidado anterior: Econômicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta 

## Stubs (aguardando hidratação WebFetch)

- **#30 Informações Financeiras de Familiares** — slug `pessoas-informacoes-financeiras-de-familiares` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-informacoes-financeiras-de-familiares
  - Tema principal explicitado pelo título da página: “Informações Financeiras de Familiares”. Categoria no consolidado anterior: Econômicos e Financeiros. Esta entrada foi mantida para consulta direta pe
- **#31 Programas de Benefícios e Assistência Social** — slug `pessoas-programas-de-beneficios` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-programas-de-beneficios
  - Tema principal explicitado pelo título da página: “Programas de Benefícios e Assistência Social”. Categoria no consolidado anterior: Econômicos e Financeiros. Esta entrada foi mantida para consulta di
- **#32 Programas de Benefícios e Assistência Social de Familiares** — slug `pessoas-programas-de-beneficios-de-familiares` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-programas-de-beneficios-de-familiares
  - Tema principal explicitado pelo título da página: “Programas de Benefícios e Assistência Social de Familiares”. Categoria no consolidado anterior: Econômicos e Financeiros. Esta entrada foi mantida pa
- **#33 Propriedades Industriais** — slug `pessoas-propriedades-industriais` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-propriedades-industriais
  - Tema principal explicitado pelo título da página: “Propriedades Industriais”. Categoria no consolidado anterior: Econômicos e Financeiros. Esta entrada foi mantida para consulta direta pela URL, mas o
- **#103 Dados de Fundos de Investimento** — slug `empresas-dados-de-fundos-de-investimento` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-fundos-de-investimento
  - Tema principal explicitado pelo título da página: “Dados de Fundos de Investimento”. Categoria no consolidado anterior: Setoriais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúd
- **#104 Dados de Obras Civis** — slug `empresas-dados-de-obras-civis` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-obras-civis
  - Tema principal explicitado pelo título da página: “Dados de Obras Civis”. Categoria no consolidado anterior: Setoriais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo 
- **#105 Mercado Financeiro** — slug `empresas-mercado-financeiro` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-mercado-financeiro
  - Tema principal explicitado pelo título da página: “Mercado Financeiro”. Categoria no consolidado anterior: Setoriais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo nã
- **#168 CTe** — slug `ondemand-consultas-de-notas-fiscais-cte` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-notas-fiscais-cte
  - Tema principal explicitado pelo título da página: “CTe”. Categoria no consolidado anterior: Consultas de Notas Fiscais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo 
- **#169 NFe** — slug `ondemand-consultas-de-notas-fiscais-nfe` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-notas-fiscais-nfe
  - Tema principal explicitado pelo título da página: “NFe”. Categoria no consolidado anterior: Consultas de Notas Fiscais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo 
- **#181 Consulta SCR | Score Positivo** — slug `marketplace-consulta-scr-score-positivo` · https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-consulta-scr-score-positivo
  - Tema principal explicitado pelo título da página: “Consulta SCR | Score Positivo”. Categoria no consolidado anterior: Crédito | Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o 
- **#182 Dados Restritivos | Birô de Crédito** — slug `marketplace-dados-restritivos-biro-de-credito` · https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-dados-restritivos-biro-de-credito
  - Tema principal explicitado pelo título da página: “Dados Restritivos | Birô de Crédito”. Categoria no consolidado anterior: Crédito | Empresas. Esta entrada foi mantida para consulta direta pela URL, 
- **#183 Dados Restritivos | Quod** — slug `marketplace-dados-restritivos-quod` · https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-dados-restritivos-quod
  - Tema principal explicitado pelo título da página: “Dados Restritivos | Quod”. Categoria no consolidado anterior: Crédito | Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conte
- **#184 Flags Negativos | Quod** — slug `marketplace-flags-negativos-quod` · https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-flags-negativos-quod
  - Tema principal explicitado pelo título da página: “Flags Negativos | Quod”. Categoria no consolidado anterior: Crédito | Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúd
- **#185 Score de Crédito Multidados | Birô de Crédito** — slug `marketplace-score-de-credito-multidados-biro-de-credito` · https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-score-de-credito-multidados-biro-de-credito
  - Tema principal explicitado pelo título da página: “Score de Crédito Multidados | Birô de Crédito”. Categoria no consolidado anterior: Crédito | Empresas. Esta entrada foi mantida para consulta direta 
- **#186 Score de Crédito | Murabei** — slug `marketplace-score-de-credito-murabei` · https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-score-de-credito-murabei
  - Tema principal explicitado pelo título da página: “Score de Crédito | Murabei”. Categoria no consolidado anterior: Crédito | Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o con
- **#187 Score de Crédito | Quantum** — slug `marketplace-score-de-credito-quantum` · https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-score-de-credito-quantum
  - Tema principal explicitado pelo título da página: “Score de Crédito | Quantum”. Categoria no consolidado anterior: Crédito | Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o con
- **#188 Score de Crédito | Quod** — slug `marketplace-score-de-credito-quod` · https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-score-de-credito-quod
  - Tema principal explicitado pelo título da página: “Score de Crédito | Quod”. Categoria no consolidado anterior: Crédito | Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteú
