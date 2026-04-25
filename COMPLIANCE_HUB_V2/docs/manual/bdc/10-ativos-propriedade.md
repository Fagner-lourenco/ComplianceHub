# 10 — Ativos & Propriedade

Endpoints BDC nesta macroárea: **11**.

Hidratados: 2 · Stubs: 9

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 61 | Veículos Associados à Pessoa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |

## Subject: pj

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 62 | Propriedades Industriais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 63 | Propriedades Industriais de Funcionários | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 64 | Propriedades Industriais de Sócios | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 96 | Relacionamentos | `relationships` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.030 | gap |
| 97 | Relacionamentos do Grupo Econômico | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 98 | QSA de Recência Configurável | `dynamic_qsa_data` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.090 | gap |

## Subject: product

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 108 | Produtos Relacionados | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/produtos | … | — | pending_hydration |

## Subject: vehicle

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 126 | Dados Históricos de Placa de Veículo | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/veiculos | … | — | pending_hydration |
| 179 | DETRAN - Chassi e RENAVAM | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/veiculos | … | — | pending_hydration |
| 180 | RNTRC - Transportadores | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/veiculos | … | — | pending_hydration |

## Detalhe hidratado

### 96. Relacionamentos
- **Slug:** `empresas-relacionamentos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-relacionamentos
- **Dataset:** `relationships` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.030 · `10k-50k`: R$ 0.028 · `50k-100k`: R$ 0.027 · `100k-500k`: R$ 0.026 · `500k-1M`: R$ 0.025 · `1M-5M`: R$21000 fixo
- **Chaves complementares:** `useHeadQuartersData`
- **Filtros:** `relatedentitytaxidtype`, `relationshiplevel`, `relationshiptype`
- **Resumo:** Tema principal explicitado pelo título da página: “Relacionamentos”. Categoria no consolidado anterior: Relacionamentos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta pass

### 98. QSA de Recência Configurável
- **Slug:** `empresas-qsa-de-recencia-configuravel` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-qsa-de-recencia-configuravel
- **Dataset:** `dynamic_qsa_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.090 · `10k-50k`: R$ 0.085 · `50k-100k`: R$ 0.081 · `100k-500k`: R$ 0.077 · `500k-1M`: R$ 0.073 · `1M-5M`: R$ 0.069 · `5M-10M`: R$ 0.066 · `10M-50M`: R$ 0.063 · `50M+`: R$ 0.060
- **Chaves complementares:** `recency`
- **Resumo:** Tema principal explicitado pelo título da página: “QSA de Recência Configurável”. Categoria no consolidado anterior: Relacionamentos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamen

## Stubs (aguardando hidratação WebFetch)

- **#61 Veículos Associados à Pessoa** — slug `pessoas-veiculos-associados-a-pessoa` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-veiculos-associados-a-pessoa
  - Tema principal explicitado pelo título da página: “Veículos Associados à Pessoa”. Categoria no consolidado anterior: Veículos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo co
- **#62 Propriedades Industriais** — slug `empresas-propriedades-industriais` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-propriedades-industriais
  - Tema principal explicitado pelo título da página: “Propriedades Industriais”. Categoria no consolidado anterior: Ativos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo
- **#63 Propriedades Industriais de Funcionários** — slug `empresas-propriedades-industriais-de-funcionarios` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-propriedades-industriais-de-funcionarios
  - Tema principal explicitado pelo título da página: “Propriedades Industriais de Funcionários”. Categoria no consolidado anterior: Ativos. Esta entrada foi mantida para consulta direta pela URL, mas o c
- **#64 Propriedades Industriais de Sócios** — slug `empresas-propriedades-industriais-de-socios` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-propriedades-industriais-de-socios
  - Tema principal explicitado pelo título da página: “Propriedades Industriais de Sócios”. Categoria no consolidado anterior: Ativos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúd
- **#97 Relacionamentos do Grupo Econômico** — slug `empresas-relacionamentos-do-grupo-economico` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-relacionamentos-do-grupo-economico
  - Tema principal explicitado pelo título da página: “Relacionamentos do Grupo Econômico”. Categoria no consolidado anterior: Relacionamentos. Esta entrada foi mantida para consulta direta pela URL, mas 
- **#108 Produtos Relacionados** — slug `produtos-produtos-relacionados` · https://docs.bigdatacorp.com.br/plataforma/reference/produtos-produtos-relacionados
  - Tema principal explicitado pelo título da página: “Produtos Relacionados”. Categoria no consolidado anterior: Relacionamentos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo co
- **#126 Dados Históricos de Placa de Veículo** — slug `veiculos-dados-historicos-de-placa-de-veiculo` · https://docs.bigdatacorp.com.br/plataforma/reference/veiculos-dados-historicos-de-placa-de-veiculo
  - Tema principal explicitado pelo título da página: “Dados Históricos de Placa de Veículo”. Categoria no consolidado anterior: API de Veículos. Esta entrada foi mantida para consulta direta pela URL, ma
- **#179 DETRAN - Chassi e RENAVAM** — slug `ondemand-consultas-de-veiculos-detran-chassi-e-renavam` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-veiculos-detran-chassi-e-renavam
  - Tema principal explicitado pelo título da página: “DETRAN - Chassi e RENAVAM”. Categoria no consolidado anterior: Consultas de Veículos. Esta entrada foi mantida para consulta direta pela URL, mas o c
- **#180 RNTRC - Transportadores** — slug `ondemand-consultas-de-veiculos-rntrc-transportadores` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-veiculos-rntrc-transportadores
  - Tema principal explicitado pelo título da página: “RNTRC - Transportadores”. Categoria no consolidado anterior: Consultas de Veículos. Esta entrada foi mantida para consulta direta pela URL, mas o con
