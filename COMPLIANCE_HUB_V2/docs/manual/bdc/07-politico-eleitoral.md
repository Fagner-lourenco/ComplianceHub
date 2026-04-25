# 07 — Político & Eleitoral

Endpoints BDC nesta macroárea: **9**.

Hidratados: 3 · Stubs: 6

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 35 | Nível de Envolvimento Político | `political_involvement` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 36 | Candidatos Eleitorais | `election_candidate_data` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 37 | Doações Eleitorais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 38 | Histórico Político Familiar | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 39 | Prestadores de Serviços Eleitorais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |

## Subject: pj

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 81 | Envolvimento Político | `political_involvement` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.050 | gap |
| 82 | Doações Eleitorais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 83 | Doações Eleitorais de Sócios | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 84 | Prestadores de Serviços Eleitorais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |

## Detalhe hidratado

### 35. Nível de Envolvimento Político
- **Slug:** `pessoas-nivel-de-envolvimento-politico` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-nivel-de-envolvimento-politico
- **Dataset:** `political_involvement` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Nível de Envolvimento Político”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido autom

### 36. Candidatos Eleitorais
- **Slug:** `pessoas-candidatos-eleitorais` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-candidatos-eleitorais
- **Dataset:** `election_candidate_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Candidatos Eleitorais”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticament

### 81. Envolvimento Político
- **Slug:** `empresas-envolvimento-politico` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-envolvimento-politico
- **Dataset:** `political_involvement` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Envolvimento Político”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticament

## Stubs (aguardando hidratação WebFetch)

- **#37 Doações Eleitorais** — slug `pessoas-doacoes-eleitorais` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-doacoes-eleitorais
  - Tema principal explicitado pelo título da página: “Doações Eleitorais”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo
- **#38 Histórico Político Familiar** — slug `pessoas-historico-politico-familiar` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-historico-politico-familiar
  - Tema principal explicitado pelo título da página: “Histórico Político Familiar”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL, mas o
- **#39 Prestadores de Serviços Eleitorais** — slug `pessoas-prestadores-de-servicos-eleitorais` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-prestadores-de-servicos-eleitorais
  - Tema principal explicitado pelo título da página: “Prestadores de Serviços Eleitorais”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL
- **#82 Doações Eleitorais** — slug `empresas-doacoes-eleitorais` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-doacoes-eleitorais
  - Tema principal explicitado pelo título da página: “Doações Eleitorais”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo
- **#83 Doações Eleitorais de Sócios** — slug `empresas-doacoes-eleitorais-de-socios` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-doacoes-eleitorais-de-socios
  - Tema principal explicitado pelo título da página: “Doações Eleitorais de Sócios”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL, mas 
- **#84 Prestadores de Serviços Eleitorais** — slug `empresas-prestadores-de-servicos-eleitorais` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-prestadores-de-servicos-eleitorais
  - Tema principal explicitado pelo título da página: “Prestadores de Serviços Eleitorais”. Categoria no consolidado anterior: Envolvimento Político. Esta entrada foi mantida para consulta direta pela URL
