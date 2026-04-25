# 01 — Identidade & Cadastro

Endpoints BDC nesta macroárea: **70**.

Hidratados: 9 · Stubs: 61

## Subject: address

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 113 | Dados de Propriedades Rurais SICAR | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/enderecos | … | — | pending_hydration |

## Subject: pf

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 19 | E-mails | `emails_extended` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 20 | E-mails de Pessoas Relacionadas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 21 | Telefones | `phones_extended` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 22 | Telefones de Pessoas Relacionadas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 23 | Endereços | `addresses_extended` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.050 | gap |
| 24 | Endereços de Pessoas Relacionadas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 25 | Dados de Registro | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 26 | Dados Cadastrais Básicos | `basic_data` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.030 | consumed |
| 27 | Dados Cadastrais de Recência Configurável | `basic_data_with_configurable_recency` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.090 | gap |
| 28 | Histórico de Dados Básicos | `historical_basic_data` | POST https://plataforma.bigdatacorp.com.br/pessoas | ✓ | R$ 0.030 | gap |
| 60 | Informações Sócio-Demográficas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 71 | E-mails de Pessoas Relacionadas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 73 | Telefones de Pessoas Relacionadas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 75 | Endereços de Pessoas Relacionadas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 143 | Ações Judiciais - Nada Consta | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 144 | Ações Trabalhistas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 145 | CGU - Correcional Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 146 | CNJ - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 149 | IBAMA - Embargos | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 150 | IBAMA - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 151 | IBAMA - Regularidade | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 152 | IRT | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 153 | Licenças Sanitárias | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 154 | PGFN | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 155 | Polícia Civil - Antecedentes Criminais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 156 | Polícia Federal - Antecedentes Criminais | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 157 | TSE - Quitação Eleitoral | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 170 | BACEN - Sanções Administrativas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 171 | COMPROT - Processos | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 172 | DETRAN - Multas de Trânsito | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 173 | Polícia Civil - Boletim de Ocorrência | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 174 | Receita Federal - Restituição do Imposto de Renda | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 175 | Receita Federal - Status do CPF | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 176 | SINTEGRA | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 177 | SUS - Cartão | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |
| 178 | TSE - Local de Votação | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/pessoas | … | — | pending_hydration |

## Subject: pj

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 69 | Dados de Registro | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 70 | E-mails | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 72 | Telefones | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 74 | Endereços | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 76 | Dados Cadastrais Básicos | `basic_data` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.020 | consumed |
| 77 | Histórico de Dados Básicos | `history_basic_data` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.050 | gap |
| 78 | Dados de Categoria Comercial - MCC | `merchant_category_data` | POST https://plataforma.bigdatacorp.com.br/empresas | ✓ | R$ 0.050 | gap |
| 111 | Dados de Empresas nas Proximidades | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 127 | Ações Trabalhistas | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 128 | Contratação de Pessoas com Deficiência e Beneficiários Reabilitados da Previdência Social | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 129 | CGU - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 130 | CNJ - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 133 | FGTS | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 134 | Habilitação COMEX | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 135 | IBAMA - Embargos | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 136 | IBAMA - Negativa | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 137 | IBAMA - Regulatória | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 138 | IRT | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 139 | Licenças Sanitárias | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 140 | PGFN | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 141 | SIPROQUIM | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 158 | Arrecadação Simples Nacional - MEI | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 159 | COMPROT - Processos | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 160 | Escrituração Contábil Digital | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 161 | Inscrição Municipal | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 162 | Optante Simples | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 163 | Projetos Públicos | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 164 | Receita Federal - QSA | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 165 | Receita Federal - Representante Legal | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 166 | Receita Federal - Situação CNPJ | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |
| 167 | SINTEGRA | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/empresas | … | — | pending_hydration |

## Subject: product

| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |
|---|---|---|---|---|---|---|
| 106 | Ficha Técnica | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/produtos | … | — | pending_hydration |
| 107 | Imagens do Produto | _[a coletar]_ | POST https://plataforma.bigdatacorp.com.br/produtos | … | — | pending_hydration |

## Detalhe hidratado

### 19. E-mails
- **Slug:** `pessoas-e-mails` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-e-mails
- **Dataset:** `emails_extended` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Chaves complementares:** `email`, `returnonlydifferentemails`, `returnonlyvalidemails`
- **Filtros:** `type`, `isactive`, `isrecent`, `ismain`, `validationstatus`, `domain`
- **Resumo:** Tema principal explicitado pelo título da página: “E-mails”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta passada.

### 21. Telefones
- **Slug:** `pessoas-telefones` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-telefones
- **Dataset:** `phones_extended` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Chaves complementares:** `phone`, `returnonlydifferentphones`, `withmatchrate`
- **Filtros:** `type`, `isactive`, `isrecent`, `ismain`, `isindonotcalllist`, `areacode`
- **Resumo:** Tema principal explicitado pelo título da página: “Telefones”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta passada.

### 23. Endereços
- **Slug:** `pessoas-enderecos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-enderecos
- **Dataset:** `addresses_extended` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Chaves complementares:** `zipcode`, `addressnumber`, `address`, `returnonlydifferentaddresses`, `withmatchrate`
- **Filtros:** `Type`, `isratified`, `isactive`, `isrecent`, `ismain`, `isindirect`, `state`, `zipcode`
- **Resumo:** Tema principal explicitado pelo título da página: “Endereços”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nesta passada.

### 26. Dados Cadastrais Básicos
- **Slug:** `pessoas-dados-cadastrais-basicos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-cadastrais-basicos
- **Dataset:** `basic_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `consumed`
- **Preços:** `1-10k`: R$ 0.030 · `10k-50k`: R$ 0.028 · `50k-100k`: R$ 0.027 · `100k-500k`: R$ 0.026 · `500k-1M`: R$ 0.025 · `1M-5M`: R$21000 fixo
- **Chaves complementares:** `name`, `mothername`, `fathername`
- **Resumo:** Tema principal explicitado pelo título da página: “Dados Cadastrais Básicos”. Categoria no consolidado anterior: Dados Básicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nes

### 27. Dados Cadastrais de Recência Configurável
- **Slug:** `pessoas-dados-cadastrais-de-recencia-configuravel` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-cadastrais-de-recencia-configuravel
- **Dataset:** `basic_data_with_configurable_recency` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.090 · `10k-50k`: R$ 0.085 · `50k-100k`: R$ 0.081 · `100k-500k`: R$ 0.077 · `500k-1M`: R$ 0.073
- **Chaves complementares:** `max_days_since_update`, `name`, `mothername`, `fathername`
- **Resumo:** Tema principal explicitado pelo título da página: “Dados Cadastrais de Recência Configurável”. Categoria no consolidado anterior: Dados Básicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido au

### 28. Histórico de Dados Básicos
- **Slug:** `pessoas-historico-de-dados-basicos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-historico-de-dados-basicos
- **Dataset:** `historical_basic_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Subject:** `pf` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.030 · `10k-50k`: R$ 0.028 · `50k-100k`: R$ 0.027 · `100k-500k`: R$ 0.026 · `500k-1M`: R$ 0.025 · `1M-5M`: R$21000 fixo
- **Chaves complementares:** `name`, `mothername`, `birthdate`, `dateformat`
- **Resumo:** Tema principal explicitado pelo título da página: “Histórico de Dados Básicos”. Categoria no consolidado anterior: Dados Básicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente n

### 76. Dados Cadastrais Básicos
- **Slug:** `empresas-dados-cadastrais-basicos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-cadastrais-basicos
- **Dataset:** `basic_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `consumed`
- **Preços:** `1-10k`: R$ 0.020 · `10k-50k`: R$ 0.019 · `50k-100k`: R$ 0.018 · `100k-500k`: R$ 0.017 · `500k-1M`: R$ 0.016 · `1M-5M`: R$14000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Dados Cadastrais Básicos”. Categoria no consolidado anterior: Dados Básicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente nes

### 77. Histórico de Dados Básicos
- **Slug:** `empresas-historico-de-dados-basicos` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-historico-de-dados-basicos
- **Dataset:** `history_basic_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Histórico de Dados Básicos”. Categoria no consolidado anterior: Dados Básicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automaticamente n

### 78. Dados de Categoria Comercial - MCC
- **Slug:** `empresas-dados-de-categoria-comercial-mcc` · **URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-categoria-comercial-mcc
- **Dataset:** `merchant_category_data` · **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
- **Subject:** `pj` · **Delivery mode:** `standard` · **V2:** `gap`
- **Preços:** `1-10k`: R$ 0.050 · `10k-50k`: R$ 0.048 · `50k-100k`: R$ 0.046 · `100k-500k`: R$ 0.044 · `500k-1M`: R$ 0.042 · `1M-5M`: R$34000 fixo
- **Resumo:** Tema principal explicitado pelo título da página: “Dados de Categoria Comercial - MCC”. Categoria no consolidado anterior: Dados Básicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser expandido automatic

## Stubs (aguardando hidratação WebFetch)

- **#20 E-mails de Pessoas Relacionadas** — slug `pessoas-emails-de-pessoas-relacionadas` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-emails-de-pessoas-relacionadas
  - Tema principal explicitado pelo título da página: “E-mails de Pessoas Relacionadas”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo
- **#22 Telefones de Pessoas Relacionadas** — slug `pessoas-telefones-de-pessoas-relacionadas` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-telefones-de-pessoas-relacionadas
  - Tema principal explicitado pelo título da página: “Telefones de Pessoas Relacionadas”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteú
- **#24 Endereços de Pessoas Relacionadas** — slug `pessoas-enderecos-de-pessoas-relacionadas` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-enderecos-de-pessoas-relacionadas
  - Tema principal explicitado pelo título da página: “Endereços de Pessoas Relacionadas”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteú
- **#25 Dados de Registro** — slug `pessoas-dados-de-registro` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-de-registro
  - Tema principal explicitado pelo título da página: “Dados de Registro”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não 
- **#60 Informações Sócio-Demográficas** — slug `pessoas-informacoes-socio-demograficas` · https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-informacoes-socio-demograficas
  - Tema principal explicitado pelo título da página: “Informações Sócio-Demográficas”. Categoria no consolidado anterior: Sócio-Demográficos. Esta entrada foi mantida para consulta direta pela URL, mas o
- **#69 Dados de Registro** — slug `empresas-dados-de-registro` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-registro
  - Tema principal explicitado pelo título da página: “Dados de Registro”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não 
- **#70 E-mails** — slug `empresas-e-mails` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-e-mails
  - Tema principal explicitado pelo título da página: “E-mails”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser e
- **#71 E-mails de Pessoas Relacionadas** — slug `empresas-e-mails-de-pessoas-relacionadas` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-e-mails-de-pessoas-relacionadas
  - Tema principal explicitado pelo título da página: “E-mails de Pessoas Relacionadas”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo
- **#72 Telefones** — slug `empresas-telefones` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-telefones
  - Tema principal explicitado pelo título da página: “Telefones”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser
- **#73 Telefones de Pessoas Relacionadas** — slug `empresas-telefones-de-pessoas-relacionadas` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-telefones-de-pessoas-relacionadas
  - Tema principal explicitado pelo título da página: “Telefones de Pessoas Relacionadas”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteú
- **#74 Endereços** — slug `empresas-enderecos` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-enderecos
  - Tema principal explicitado pelo título da página: “Endereços”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pôde ser
- **#75 Endereços de Pessoas Relacionadas** — slug `empresas-enderecos-de-pessoas-relacionadas` · https://docs.bigdatacorp.com.br/plataforma/reference/empresas-enderecos-de-pessoas-relacionadas
  - Tema principal explicitado pelo título da página: “Endereços de Pessoas Relacionadas”. Categoria no consolidado anterior: Contatos. Esta entrada foi mantida para consulta direta pela URL, mas o conteú
- **#106 Ficha Técnica** — slug `produtos-ficha-tecnica` · https://docs.bigdatacorp.com.br/plataforma/reference/produtos-ficha-tecnica
  - Tema principal explicitado pelo título da página: “Ficha Técnica”. Categoria no consolidado anterior: Dados Básicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não
- **#107 Imagens do Produto** — slug `produtos-imagens-do-produto` · https://docs.bigdatacorp.com.br/plataforma/reference/produtos-imagens-do-produto
  - Tema principal explicitado pelo título da página: “Imagens do Produto”. Categoria no consolidado anterior: Dados Básicos. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo complet
- **#111 Dados de Empresas nas Proximidades** — slug `enderecos-dados-de-empresas-nas-proximidades` · https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-dados-de-empresas-nas-proximidades
  - Tema principal explicitado pelo título da página: “Dados de Empresas nas Proximidades”. Categoria no consolidado anterior: API de Endereços. Esta entrada foi mantida para consulta direta pela URL, mas
- **#113 Dados de Propriedades Rurais SICAR** — slug `enderecos-dados-de-propriedades-rurais-sicar` · https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-dados-de-propriedades-rurais-sicar
  - Tema principal explicitado pelo título da página: “Dados de Propriedades Rurais SICAR”. Categoria no consolidado anterior: API de Endereços. Esta entrada foi mantida para consulta direta pela URL, mas
- **#127 Ações Trabalhistas** — slug `ondemand-empresas-acoes-trabalhistas` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-acoes-trabalhistas
  - Tema principal explicitado pelo título da página: “Ações Trabalhistas”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo
- **#128 Contratação de Pessoas com Deficiência e Beneficiários Reabilitados da Previdência Social** — slug `ondemand-empresas-contratacao-de-pcd` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-contratacao-de-pcd
  - Tema principal explicitado pelo título da página: “Contratação de Pessoas com Deficiência e Beneficiários Reabilitados da Previdência Social”. Categoria no consolidado anterior: Certidões de Empresas.
- **#129 CGU - Negativa** — slug `ondemand-empresas-cgu-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-cgu-negativa
  - Tema principal explicitado pelo título da página: “CGU - Negativa”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo com
- **#130 CNJ - Negativa** — slug `ondemand-empresas-cnj-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-cnj-negativa
  - Tema principal explicitado pelo título da página: “CNJ - Negativa”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo com
- **#133 FGTS** — slug `ondemand-empresas-fgts` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-fgts
  - Tema principal explicitado pelo título da página: “FGTS”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não 
- **#134 Habilitação COMEX** — slug `ondemand-empresas-habilitacao-comex` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-habilitacao-comex
  - Tema principal explicitado pelo título da página: “Habilitação COMEX”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo 
- **#135 IBAMA - Embargos** — slug `ondemand-empresas-ibama-embargos` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-ibama-embargos
  - Tema principal explicitado pelo título da página: “IBAMA - Embargos”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo c
- **#136 IBAMA - Negativa** — slug `ondemand-empresas-ibama-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-ibama-negativa
  - Tema principal explicitado pelo título da página: “IBAMA - Negativa”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo c
- **#137 IBAMA - Regulatória** — slug `ondemand-empresas-ibama-regulatoria` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-ibama-regulatoria
  - Tema principal explicitado pelo título da página: “IBAMA - Regulatória”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúd
- **#138 IRT** — slug `ondemand-empresas-irt` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-irt
  - Tema principal explicitado pelo título da página: “IRT”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não p
- **#139 Licenças Sanitárias** — slug `ondemand-empresas-licencas-sanitarias` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-licencas-sanitarias
  - Tema principal explicitado pelo título da página: “Licenças Sanitárias”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúd
- **#140 PGFN** — slug `ondemand-empresas-pgfn` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-pgfn
  - Tema principal explicitado pelo título da página: “PGFN”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não 
- **#141 SIPROQUIM** — slug `ondemand-empresas-siproquim` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-empresas-siproquim
  - Tema principal explicitado pelo título da página: “SIPROQUIM”. Categoria no consolidado anterior: Certidões de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo
- **#143 Ações Judiciais - Nada Consta** — slug `ondemand-pessoas-acoes-judiciais-nada-consta` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-acoes-judiciais-nada-consta
  - Tema principal explicitado pelo título da página: “Ações Judiciais - Nada Consta”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas 
- **#144 Ações Trabalhistas** — slug `ondemand-pessoas-acoes-trabalhistas` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-acoes-trabalhistas
  - Tema principal explicitado pelo título da página: “Ações Trabalhistas”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo 
- **#145 CGU - Correcional Negativa** — slug `ondemand-pessoas-cgu-correcional-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-cgu-correcional-negativa
  - Tema principal explicitado pelo título da página: “CGU - Correcional Negativa”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o c
- **#146 CNJ - Negativa** — slug `ondemand-pessoas-cnj-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-cnj-negativa
  - Tema principal explicitado pelo título da página: “CNJ - Negativa”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo comp
- **#149 IBAMA - Embargos** — slug `ondemand-pessoas-ibama-embargos` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-ibama-embargos
  - Tema principal explicitado pelo título da página: “IBAMA - Embargos”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo co
- **#150 IBAMA - Negativa** — slug `ondemand-pessoas-ibama-negativa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-ibama-negativa
  - Tema principal explicitado pelo título da página: “IBAMA - Negativa”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo co
- **#151 IBAMA - Regularidade** — slug `ondemand-pessoas-ibama-regularidade` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-ibama-regularidade
  - Tema principal explicitado pelo título da página: “IBAMA - Regularidade”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúd
- **#152 IRT** — slug `ondemand-pessoas-irt` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-irt
  - Tema principal explicitado pelo título da página: “IRT”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não pô
- **#153 Licenças Sanitárias** — slug `ondemand-pessoas-licencas-sanitarias` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-licencas-sanitarias
  - Tema principal explicitado pelo título da página: “Licenças Sanitárias”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo
- **#154 PGFN** — slug `ondemand-pessoas-pgfn` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-pgfn
  - Tema principal explicitado pelo título da página: “PGFN”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo não p
- **#155 Polícia Civil - Antecedentes Criminais** — slug `ondemand-pessoas-policia-civil-antecedentes-criminais` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-policia-civil-antecedentes-criminais
  - Tema principal explicitado pelo título da página: “Polícia Civil - Antecedentes Criminais”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela 
- **#156 Polícia Federal - Antecedentes Criminais** — slug `ondemand-pessoas-policia-federal-antecedentes-criminais` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-policia-federal-antecedentes-criminais
  - Tema principal explicitado pelo título da página: “Polícia Federal - Antecedentes Criminais”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pel
- **#157 TSE - Quitação Eleitoral** — slug `ondemand-pessoas-tse-quitacao-eleitoral` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-pessoas-tse-quitacao-eleitoral
  - Tema principal explicitado pelo título da página: “TSE - Quitação Eleitoral”. Categoria no consolidado anterior: Certidões de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o con
- **#158 Arrecadação Simples Nacional - MEI** — slug `ondemand-consultas-de-empresas-arrecadacao-simples-nacional-mei` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-arrecadacao-simples-nacional-mei
  - Tema principal explicitado pelo título da página: “Arrecadação Simples Nacional - MEI”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL
- **#159 COMPROT - Processos** — slug `ondemand-consultas-de-empresas-comprot-processos` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-comprot-processos
  - Tema principal explicitado pelo título da página: “COMPROT - Processos”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúd
- **#160 Escrituração Contábil Digital** — slug `ondemand-consultas-de-empresas-escrituracao-contabil-digital` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-escrituracao-contabil-digital
  - Tema principal explicitado pelo título da página: “Escrituração Contábil Digital”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas
- **#161 Inscrição Municipal** — slug `ondemand-consultas-de-empresas-inscricao-municipal` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-inscricao-municipal
  - Tema principal explicitado pelo título da página: “Inscrição Municipal”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúd
- **#162 Optante Simples** — slug `ondemand-consultas-de-empresas-optante-simples` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-optante-simples
  - Tema principal explicitado pelo título da página: “Optante Simples”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo co
- **#163 Projetos Públicos** — slug `ondemand-consultas-de-empresas-projetos-publicos` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-projetos-publicos
  - Tema principal explicitado pelo título da página: “Projetos Públicos”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo 
- **#164 Receita Federal - QSA** — slug `ondemand-consultas-de-empresas-receita-federal-qsa` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-receita-federal-qsa
  - Tema principal explicitado pelo título da página: “Receita Federal - QSA”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conte
- **#165 Receita Federal - Representante Legal** — slug `ondemand-consultas-de-empresas-receita-federal-representante-legal` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-receita-federal-representante-legal
  - Tema principal explicitado pelo título da página: “Receita Federal - Representante Legal”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela 
- **#166 Receita Federal - Situação CNPJ** — slug `ondemand-consultas-de-empresas-receita-federal-situacao-cnpj` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-receita-federal-situacao-cnpj
  - Tema principal explicitado pelo título da página: “Receita Federal - Situação CNPJ”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL, m
- **#167 SINTEGRA** — slug `ondemand-consultas-de-empresas-sintegra` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-empresas-sintegra
  - Tema principal explicitado pelo título da página: “SINTEGRA”. Categoria no consolidado anterior: Consultas de Empresas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo 
- **#170 BACEN - Sanções Administrativas** — slug `ondemand-consultas-de-pessoas-bacen-sancoes-administrativas` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-bacen-sancoes-administrativas
  - Tema principal explicitado pelo título da página: “BACEN - Sanções Administrativas”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta direta pela URL, ma
- **#171 COMPROT - Processos** — slug `ondemand-consultas-de-pessoas-comprot-processos` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-comprot-processos
  - Tema principal explicitado pelo título da página: “COMPROT - Processos”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo
- **#172 DETRAN - Multas de Trânsito** — slug `ondemand-consultas-de-pessoas-detran-multas-de-transito` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-detran-multas-de-transito
  - Tema principal explicitado pelo título da página: “DETRAN - Multas de Trânsito”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o 
- **#173 Polícia Civil - Boletim de Ocorrência** — slug `ondemand-consultas-de-pessoas-policia-civil-boletim-de-ocorrencia` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-policia-civil-boletim-de-ocorrencia
  - Tema principal explicitado pelo título da página: “Polícia Civil - Boletim de Ocorrência”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta direta pela U
- **#174 Receita Federal - Restituição do Imposto de Renda** — slug `ondemand-consultas-de-pessoas-receita-federal-restituicao-do-imposto-de-renda` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-receita-federal-restituicao-do-imposto-de-renda
  - Tema principal explicitado pelo título da página: “Receita Federal - Restituição do Imposto de Renda”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta d
- **#175 Receita Federal - Status do CPF** — slug `ondemand-consultas-de-pessoas-receita-federal-status-do-cpf` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-receita-federal-status-do-cpf
  - Tema principal explicitado pelo título da página: “Receita Federal - Status do CPF”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta direta pela URL, ma
- **#176 SINTEGRA** — slug `ondemand-consultas-de-pessoas-sintegra` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-sintegra
  - Tema principal explicitado pelo título da página: “SINTEGRA”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo completo n
- **#177 SUS - Cartão** — slug `ondemand-consultas-de-pessoas-sus-cartao` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-sus-cartao
  - Tema principal explicitado pelo título da página: “SUS - Cartão”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conteúdo comple
- **#178 TSE - Local de Votação** — slug `ondemand-consultas-de-pessoas-tse-local-de-votacao` · https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-consultas-de-pessoas-tse-local-de-votacao
  - Tema principal explicitado pelo título da página: “TSE - Local de Votação”. Categoria no consolidado anterior: Consultas de Pessoas. Esta entrada foi mantida para consulta direta pela URL, mas o conte
