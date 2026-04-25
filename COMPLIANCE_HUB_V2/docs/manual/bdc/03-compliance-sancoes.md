# 03 — Compliance & Sanções

Endpoints BDC nesta macroárea: **11**.

Hidratados: 5 · Stubs: 6

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 12 | KYC e Compliance | `kyc` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | consumed |
| 13 | KYC e Compliance dos Familiares de Primeiro Nível | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 14 | Compliance de Casas de Apostas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 147 | Débitos Estaduais - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 148 | Débitos Trabalhistas - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |

## Subject: pj

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 65 | KYC e Compliance | `kyc` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.050 | gap |
| 66 | KYC e Compliance dos Sócios | `owners_kyc` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.090 | gap |
| 67 | KYC e Compliance dos Funcionários | `employees_kyc` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.410 | gap |
| 68 | KYC e Compliance do Grupo Econômico | `economic_group_kyc` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.410 | gap |
| 131 | Débitos Estaduais - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 132 | Débitos Trabalhistas - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |

## Detalhe hidratado

### 12. KYC e Compliance
- **Slug:** `pessoas-kyc-e-compliance` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-kyc-e-compliance
- **Dataset:** `kyc` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `consumed`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo · `5M+`: contato
- **Chaves complementares:** `minmatch`, `considerexpandedpep`, `name`
- **Filtros:** `pep_level`, `pep_job`, `pep_motive`, `sanctions_source`, `sanctions_type`, `type`, `standardized_sanction_type`, `standardized_type`
- **Resumo:** Dataset da API de Pessoas com endpoint POST https://plataforma.bigdatacorp.com.br/pessoas. Retorna informações de KYC e Compliance, incluindo PEP, sanções e restrições em escopo nacional e internacional. Nome técnico: kyc. Também documenta tabela de 

### 65. KYC e Compliance
- **Slug:** `empresas-kyc-e-compliance` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-kyc-e-compliance
- **Dataset:** `kyc` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Chaves complementares:** `minmatch`, `name`
- **Filtros:** `pep_level`, `pep_job`, `pep_motive`, `sanctions_source`, `sanctions_type`
- **Resumo:** Tema principal explicitado pelo título da página: “KYC e Compliance”. Categoria no consolidado anterior: Compliance Regulatório. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente ne

### 66. KYC e Compliance dos Sócios
- **Slug:** `empresas-kyc-e-compliance-dos-socios` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-kyc-e-compliance-dos-socios
- **Dataset:** `owners_kyc` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.090 · `10k-50k`: R$ 0.085 · `50k-100k`: R$ 0.081 · `100k-500k`: R$ 0.077 · `500k-1M`: R$ 0.073 · `1M-5M`: R$61000 fixo
- **Chaves complementares:** `minmatch`
- **Filtros:** `pep_level`, `pep_job`, `pep_motive`, `sanctions_source`, `sanctions_type`
- **Resumo:** Tema principal explicitado pelo título da página: “KYC e Compliance dos Sócios”. Categoria no consolidado anterior: Compliance Regulatório. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automat

### 67. KYC e Compliance dos Funcionários
- **Slug:** `empresas-kyc-e-compliance-dos-funcionarios` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-kyc-e-compliance-dos-funcionarios
- **Dataset:** `employees_kyc` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.410 · `10k-50k`: R$ 0.389 · `50k-100k`: R$ 0.370 · `100k-500k`: R$ 0.352 · `500k-1M`: R$ 0.334 · `1M-5M`: R$277000 fixo
- **Chaves complementares:** `minmatch`
- **Filtros:** `pep_level`, `pep_job`, `pep_motive`, `sanctions_source`, `sanctions_type`
- **Resumo:** Tema principal explicitado pelo título da página: “KYC e Compliance dos Funcionários”. Categoria no consolidado anterior: Compliance Regulatório. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido a

### 68. KYC e Compliance do Grupo Econômico
- **Slug:** `empresas-kyc-e-compliance-do-grupo-economico` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-kyc-e-compliance-do-grupo-economico
- **Dataset:** `economic_group_kyc` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.410 · `10k-50k`: R$ 0.389 · `50k-100k`: R$ 0.370 · `100k-500k`: R$ 0.352 · `500k-1M`: R$ 0.334 · `1M-5M`: R$277000 fixo
- **Chaves complementares:** `minmatch`
- **Filtros:** `pep_level`, `pep_job`, `pep_motive`, `sanctions_source`, `sanctions_type`
- **Resumo:** Tema principal explicitado pelo título da página: “KYC e Compliance do Grupo Econômico”. Categoria no consolidado anterior: Compliance Regulatório. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido

## Stubs (aguardando hidratação WebFetch)

- **#13 KYC e Compliance dos Familiares de Primeiro Nível** — slug `pessoas-kyc-e-compliance-dos-familiares` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-kyc-e-compliance-dos-familiares
  - Tema principal explicitado pelo título da página: “KYC e Compliance dos Familiares de Primeiro Nível”. Categoria no consolidado anterior: Compliance Regulatório. Esta entrada foi mantida para consulta
- **#14 Compliance de Casas de Apostas** — slug `pessoas-compliance-de-casas-de-apostas` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-compliance-de-casas-de-apostas
  - Tema principal explicitado pelo título da página: “Compliance de Casas de Apostas”. Categoria no consolidado anterior: Compliance Regulatório. Esta entrada foi mantida para consulta direta pela URL, m
- **#131 Débitos Estaduais - Negativa** — slug `ondemand-empresas-debitos-estaduais-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-debitos-estaduais-negativa
  - Tema principal explicitado pelo título da página: “Débitos Estaduais - Negativa”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas 
- **#132 Débitos Trabalhistas - Negativa** — slug `ondemand-empresas-debitos-trabalhistas-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-debitos-trabalhistas-negativa
  - Tema principal explicitado pelo título da página: “Débitos Trabalhistas - Negativa”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, m
- **#147 Débitos Estaduais - Negativa** — slug `ondemand-pessoas-debitos-estaduais-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-debitos-estaduais-negativa
  - Tema principal explicitado pelo título da página: “Débitos Estaduais - Negativa”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o
- **#148 Débitos Trabalhistas - Negativa** — slug `ondemand-pessoas-debitos-trabalhistas-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-debitos-trabalhistas-negativa
  - Tema principal explicitado pelo título da página: “Débitos Trabalhistas - Negativa”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, ma
