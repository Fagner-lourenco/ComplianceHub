# 05 — Risco

Endpoints BDC nesta macroárea: **6**.

Hidratados: 4 · Stubs: 2

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 56 | Risco Financeiro | `financial_risk` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 57 | Risco Financeiro Familiar | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 58 | Presença em Cobrança | `collections` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.070 | gap |
| 59 | Probabilidade de Negativação | `indebtedness_question` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.090 | gap |

## Subject: pj

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 101 | Presença em Cobrança | `collections` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.070 | gap |
| 102 | Devedores do Governo | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |

## Detalhe hidratado

### 56. Risco Financeiro
- **Slug:** `pessoas-risco-financeiro` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-risco-financeiro
- **Dataset:** `financial_risk` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Risco Financeiro”. Categoria no consolidado anterior: Risco. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta passada.

### 58. Presença em Cobrança
- **Slug:** `pessoas-presenca-em-cobranca` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-presenca-em-cobranca
- **Dataset:** `collections` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.070 · `10k-50k`: R$ 0.066 · `50k-100k`: R$ 0.063 · `100k-500k`: R$ 0.060 · `500k-1M`: R$ 0.057 · `1M-5M`: R$46000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Presença em Cobrança”. Categoria no consolidado anterior: Risco. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta passada.

### 59. Probabilidade de Negativação
- **Slug:** `pessoas-probabilidade-de-negativacao` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-probabilidade-de-negativacao
- **Dataset:** `indebtedness_question` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.090 · `10k-50k`: R$ 0.085 · `50k-100k`: R$ 0.081 · `100k-500k`: R$ 0.077 · `500k-1M`: R$ 0.073 · `1M-5M`: R$ 0.069 · `5M-10M`: R$ 0.066 · `10M-50M`: R$ 0.063 · `50M+`: R$ 0.060
- **Resumo:** Tema principal explicitado pelo título da página: “Probabilidade de Negativação”. Categoria no consolidado anterior: Risco. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta p

### 101. Presença em Cobrança
- **Slug:** `empresas-presenca-em-cobranca` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-presenca-em-cobranca
- **Dataset:** `collections` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.070 · `10k-50k`: R$ 0.066 · `50k-100k`: R$ 0.063 · `100k-500k`: R$ 0.060 · `500k-1M`: R$ 0.057 · `1M-5M`: R$46000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Presença em Cobrança”. Categoria no consolidado anterior: Risco. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta passada.

## Stubs (aguardando hidratação WebFetch)

- **#57 Risco Financeiro Familiar** — slug `pessoas-risco-financeiro-familiar` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-risco-financeiro-familiar
  - Tema principal explicitado pelo título da página: “Risco Financeiro Familiar”. Categoria no consolidado anterior: Risco. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo
- **#102 Devedores do Governo** — slug `empresas-devedores-do-governo` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-devedores-do-governo
  - Tema principal explicitado pelo título da página: “Devedores do Governo”. Categoria no consolidado anterior: Risco. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não 
