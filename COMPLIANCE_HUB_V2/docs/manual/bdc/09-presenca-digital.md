# 09 — Presença Digital

Endpoints BDC nesta macroárea: **9**.

Hidratados: 2 · Stubs: 7

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 15 | Presença Online | `online_presence` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 16 | Presença Online Familiar | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 17 | Passagens pela Web | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 18 | Propensão à Aposta Online | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 42 | Anúncios Online | `online_ads` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 43 | Dados de Sites | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |

## Subject: pj

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 89 | Anúncios Online | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 90 | Dados de Sites | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 91 | Marketplaces | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |

## Detalhe hidratado

### 15. Presença Online
- **Slug:** `pessoas-presenca-online` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-presenca-online
- **Dataset:** `online_presence` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Dataset da API de Pessoas que retorna indicadores e classificações relacionadas à presença online, intensidade de atividade digital e uso geral da internet. Nome técnico: online_presence.

### 42. Anúncios Online
- **Slug:** `pessoas-anuncios-online` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-anuncios-online
- **Dataset:** `online_ads` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Filtros:** `activeads`, `totalads`, `admaxvalue`, `adminvalue`, `portal`, `category`
- **Resumo:** Tema principal explicitado pelo título da página: “Anúncios Online”. Categoria no consolidado anterior: Presença Digital. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta pas

## Stubs (aguardando hidratação WebFetch)

- **#16 Presença Online Familiar** — slug `pessoas-presenca-online-familiar` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-presenca-online-familiar
  - Tema principal explicitado pelo título da página: “Presença Online Familiar”. Categoria no consolidado anterior: Comportamento. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo c
- **#17 Passagens pela Web** — slug `pessoas-passagens-pela-web` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-passagens-pela-web
  - Tema principal explicitado pelo título da página: “Passagens pela Web”. Categoria no consolidado anterior: Comportamento. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo complet
- **#18 Propensão à Aposta Online** — slug `pessoas-propensao-a-aposta-online` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-propensao-a-aposta-online
  - Tema principal explicitado pelo título da página: “Propensão à Aposta Online”. Categoria no consolidado anterior: Comportamento. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo 
- **#43 Dados de Sites** — slug `pessoas-dados-de-sites` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-de-sites
  - Tema principal explicitado pelo título da página: “Dados de Sites”. Categoria no consolidado anterior: Presença Digital. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo
- **#89 Anúncios Online** — slug `empresas-anuncios-online` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-anuncios-online
  - Tema principal explicitado pelo título da página: “Anúncios Online”. Categoria no consolidado anterior: Presença Digital. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo complet
- **#90 Dados de Sites** — slug `empresas-dados-de-sites` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-sites
  - Tema principal explicitado pelo título da página: “Dados de Sites”. Categoria no consolidado anterior: Presença Digital. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo
- **#91 Marketplaces** — slug `empresas-marketplaces` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-marketplaces
  - Tema principal explicitado pelo título da página: “Marketplaces”. Categoria no consolidado anterior: Presença Digital. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo n
