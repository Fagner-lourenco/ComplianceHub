# 06 — Profissional & Laboral

Endpoints BDC nesta macroárea: **8**.

Hidratados: 5 · Stubs: 3

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 48 | Conselhos de Classe | `class_organization` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 49 | Dados Profissionais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 50 | Histórico Escolar e Acadêmico | `university_student_data` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 51 | Licenças e Autorizações | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 52 | Prêmios e Certificações | `awards_and_certifications` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.090 | gap |
| 53 | Servidores Públicos | `profession_data` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 54 | Turnover Profissional | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 55 | Exposição Esportiva | `sports_exposure` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.070 | gap |

## Detalhe hidratado

### 48. Conselhos de Classe
- **Slug:** `pessoas-conselhos-de-classe` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-conselhos-de-classe
- **Dataset:** `class_organization` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Filtros:** `organizationname`, `organizationtype`, `organizationchapter`, `status`, `category`
- **Resumo:** Tema principal explicitado pelo título da página: “Conselhos de Classe”. Categoria no consolidado anterior: Profissionais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta pa

### 50. Histórico Escolar e Acadêmico
- **Slug:** `pessoas-historico-escolar-e-academico` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-historico-escolar-e-academico
- **Dataset:** `university_student_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Filtros:** `level`, `institution`, `specializationarea`
- **Resumo:** Tema principal explicitado pelo título da página: “Histórico Escolar e Acadêmico”. Categoria no consolidado anterior: Profissionais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticament

### 52. Prêmios e Certificações
- **Slug:** `pessoas-premios-e-certificacoes` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-premios-e-certificacoes
- **Dataset:** `awards_and_certifications` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.090 · `10k-50k`: R$ 0.085 · `50k-100k`: R$ 0.081 · `100k-500k`: R$ 0.077 · `500k-1M`: R$ 0.073 · `1M-5M`: R$61000 fixo
- **Filtros:** `awardname`, `awardingorganizationname`, `certificationname`, `certifyingentity`, `certificationstatus`
- **Resumo:** Tema principal explicitado pelo título da página: “Prêmios e Certificações”. Categoria no consolidado anterior: Profissionais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nest

### 53. Servidores Públicos
- **Slug:** `pessoas-servidores-publicos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-servidores-publicos
- **Dataset:** `profession_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Filtros:** `sector`, `companyname`, `area`, `level`, `status`
- **Resumo:** Tema principal explicitado pelo título da página: “Servidores Públicos”. Categoria no consolidado anterior: Profissionais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta pa

### 55. Exposição Esportiva
- **Slug:** `pessoas-exposicao-esportiva` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-exposicao-esportiva
- **Dataset:** `sports_exposure` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.070 · `10k-50k`: R$ 0.066 · `50k-100k`: R$ 0.063 · `100k-500k`: R$ 0.060 · `500k-1M`: R$ 0.057 · `1M-5M`: R$46000 fixo
- **Filtros:** `relationshiplevel`, `role`, `isactive`
- **Resumo:** Tema principal explicitado pelo título da página: “Exposição Esportiva”. Categoria no consolidado anterior: Profissionais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta pa

## Stubs (aguardando hidratação WebFetch)

- **#49 Dados Profissionais** — slug `pessoas-dados-profissionais` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-profissionais
  - Tema principal explicitado pelo título da página: “Dados Profissionais”. Categoria no consolidado anterior: Profissionais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo comple
- **#51 Licenças e Autorizações** — slug `pessoas-licencas-e-autorizacoes` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-licencas-e-autorizacoes
  - Tema principal explicitado pelo título da página: “Licenças e Autorizações”. Categoria no consolidado anterior: Profissionais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo co
- **#54 Turnover Profissional** — slug `pessoas-turnover-profissional` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-turnover-profissional
  - Tema principal explicitado pelo título da página: “Turnover Profissional”. Categoria no consolidado anterior: Profissionais. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo comp
