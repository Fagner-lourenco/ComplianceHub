# 05 — BigDataCorp API (catálogo completo)

Referência oficial: https://docs.bigdatacorp.com.br/plataforma/reference/

**Total de endpoints mapeados:** 199
**Hidratados:** 1 (`kyc`)
**Aguardando hidratação:** 198

> Cada entrada segue o formato padrão da documentação oficial: descrição + dataset técnico + tabela de preços + chaves complementares + filtros + body params + response + cURL + exemplo de response 200. Entradas ainda não hidratadas mantêm URL + resumo prévio vindo de `BigDataCorp_API_Consolidada_Expandida.docx`.

## Autenticação (aplica-se a todos os endpoints)

- Base URL: `https://plataforma.bigdatacorp.com.br`
- Headers obrigatórios:
  - `AccessToken: <ACCESSTOKEN>` (secret `BIGDATACORP_ACCESS_TOKEN`)
  - `TokenId: <TOKENID>` (secret `BIGDATACORP_TOKEN_ID`)
  - `accept: application/json`
  - `content-type: application/json`

## Famílias de endpoint (POST)

| Família | Path | Exemplo `doc`/`q` |
|---|---|---|
| Pessoas | `POST /pessoas` | `doc{<CPF>}` |
| Empresas | `POST /empresas` | `doc{<CNPJ>}` |
| Endereços | `POST /enderecos` | `zipcode{...}` ou `latitude{...} longitude{...}` |
| Processos | `POST /processos` | `numeroprocesso{...}` |
| Veículos | `POST /veiculos` | `placa{XXX0000}` |
| Produtos | `POST /produtos` | `ean{...}` |
| OnDemand | varia | consultas pontuais |
| Marketplace | varia | parceiros (Quod, Murabei, Quantum, Birô de Crédito) |
| Certidões | varia | geração de PDF/JSON |

---

## Índice por categoria

- **Visão geral** (3 endpoints)
  - [1. Boas-vindas](#1-boas-vindas) — aguardando
  - [2. Autenticação e segurança](#2-autenticação-e-segurança) — aguardando
  - [3. Códigos e descrições de status](#3-códigos-e-descrições-de-status) — aguardando
- **Primeiros passos** (8 endpoints)
  - [4. Primeiros passos](#4-primeiros-passos) — aguardando
  - [5. Pré-requisitos](#5-pré-requisitos) — aguardando
  - [6. Primeira consulta](#6-primeira-consulta) — aguardando
  - [7. Estrutura da consulta](#7-estrutura-da-consulta) — aguardando
  - [8. Parâmetros de consulta](#8-parametros-de-consulta) — aguardando
  - [9. Personalizar retorno](#9-personalizar-retorno) — aguardando
  - [10. Recursos adicionais](#10-recustos-adicionais) — aguardando
  - [11. Dicas e boas práticas](#11-dicas-e-boas-praticas) — aguardando
- **Compliance Regulatório** (7 endpoints)
  - [12. KYC e Compliance](#12-pessoas-kyc-e-compliance) — ✓ hidratado
  - [13. KYC e Compliance dos Familiares de Primeiro Nível](#13-pessoas-kyc-e-compliance-dos-familiares) — aguardando
  - [14. Compliance de Casas de Apostas](#14-pessoas-compliance-de-casas-de-apostas) — aguardando
  - [65. KYC e Compliance (Empresas)](#65-empresas-kyc-e-compliance) — aguardando
  - [66. KYC e Compliance dos Sócios](#66-empresas-kyc-e-compliance-dos-socios) — aguardando
  - [67. KYC e Compliance dos Funcionários](#67-empresas-kyc-e-compliance-dos-funcionarios) — aguardando
  - [68. KYC e Compliance do Grupo Econômico](#68-empresas-kyc-e-compliance-do-grupo-economico) — aguardando
- **Demais 30 categorias** — ver entradas abaixo por seção

_(O índice completo com 199 links é extenso; navegar pelos títulos `### N. Título` usando Ctrl+F ou o TOC do editor.)_

---

## ✓ Entrada hidratada: KYC e Compliance

### 12. KYC e Compliance
<!-- slug: pessoas-kyc-e-compliance -->

- **URL (doc):** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-kyc-e-compliance
- **Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
- **Categoria:** Compliance Regulatório
- **Nome técnico do dataset:** `kyc`

#### Descrição

Dataset que retorna informações relacionadas a KYC e Compliance da pessoa consultada, incluindo classificações de Pessoa Politicamente Exposta (PEP), sanções e restrições, bem como seus respectivos registros históricos, em escopo nacional e internacional. O retorno contempla indicadores de status atual e histórico das ocorrências, permitindo análises técnicas e automatizadas das informações associadas ao indivíduo.

Para mais informações sobre contexto regulatório, aplicações e casos de uso, consulte a documentação de Compliance Regulatório.

#### Tabela de preços

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,050 |
| 10.001 – 50.000 | R$ 0,048 |
| 50.001 – 100.000 | R$ 0,046 |
| 100.001 – 500.000 | R$ 0,044 |
| 500.001 – 1.000.000 | R$ 0,042 |
| 1.000.001 – 5.000.000 | R$ 34.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

#### Chaves complementares relevantes

| Chave | Descrição | Valores Possíveis |
|---|---|---|
| `minmatch` | Percentual mínimo de similaridade entre o nome da entidade consultada e o nome presente no registro de sanção a partir do qual o registro será considerado para determinar indicadores como `IsCurrentlySanctioned`, `WasPreviouslySanctioned` e contagens por período. Esta chave **não restringe** os registros retornados pelo dataset. | Inteiro 0–100 (padrão: 70) |
| `considerexpandedpep` | Indica se devem ser considerados como PEP indivíduos que exercem cargos como político suplente, promotor, defensor público ou juiz da esfera estadual. | `true` / `false` (padrão: `false`) |
| `name` | Permite realizar a consulta a partir do nome da entidade quando o documento não é informado, sendo especialmente útil em análises envolvendo pessoas estrangeiras. | Qualquer texto |

Para conhecer todas as chaves disponíveis e entender como combiná-las, consulte a seção "Parâmetros de Consulta" da Plataforma de Dados.

#### Filtros

| Campo | Descrição do filtro | Tipo | Valores Possíveis |
|---|---|---|---|
| `pep_level` | Nível de Pessoa Politicamente Exposta (PEP) | Igual | Qualquer um dos níveis definidos |
| `pep_job` | Cargo público que a pessoa ocupa | Igual | Nome do cargo (ex. `PRESIDENTE`) |
| `pep_motive` | Motivo pelo qual a pessoa foi classificada como PEP | Igual | Descrição do motivo (ex. `RELACIONAMENTO`) |
| `sanctions_source` | Fonte da sanção | Igual | `interpol`, `fbi`, `ofac`, `uk`, `eu`, `unsc`, `CEAF`, `CNEP`, `MTE`, `United Nations Security Council`, `Conselho Nacional de Justiça`, `Tribunal de Contas da União`, `Bank Hindered Suppliers`, `Ibama`, `Tribunal de Contas do Estado de São Paulo`, `Banco Central do Brasil`, `Comissao de Valores Mobiliarios`, `seape-df`, `ca-sanctions`, `DDTC` |
| `sanctions_type` | Tipo da sanção | Igual | Tipo da restrição (ex. `Money Laundering`) |
| `type` | Alias de `sanction_type` | Igual | Tipo da restrição (ex. `Money Laundering`) |
| `standardized_sanction_type` | Tipo padronizado da sanção | Igual / Lista | `arrest warrants`, `financial crimes`, `terrorism`, `financial infractions`, `environmental infractions`, `corruption`, `slavery crimes` |
| `standardized_type` | Alias de `standardized_sanction_type` | Igual / Lista | Mesmos valores de `standardized_sanction_type` |

Tradução curta dos tipos padronizados:
- `arrest warrants` — mandados de prisão emitidos
- `financial crimes` — lavagem de dinheiro do crime organizado, tráfico de drogas
- `terrorism` — associação com entidades/atividades terroristas
- `financial infractions` — infrações no mercado financeiro
- `environmental infractions` — crimes ao meio ambiente
- `corruption` — improbidade administrativa
- `slavery crimes` — trabalho escravo

#### Consulta por nome

Quando a consulta é feita **exclusivamente** pelo nome (chave `name{XXXX}`), a verificação de PEP **não é executada** e a análise de sanções é limitada às seguintes fontes:

- EU
- FBI
- UK
- INTERPOL
- OFAC
- SEAPE-DF
- Canada Sanctions
- DDTC
- UNSC
- CEAF

Se mais chaves forem enviadas na consulta ou outros datasets incluídos à requisição, o processamento completo do dataset será aplicado.

#### Interpretação das flags

- **`IsCurrentlyPresentOnSource`** — sanção está atualmente presente na fonte, considerando `EndDate` e última captura da fonte.
- **`WasRecentlyPresentOnSource`** — sanção esteve presente recentemente (registros com `EndDate` ou `LastUpdateDate` até 40 dias antes da consulta).
- **`IsCurrentlySanctioned`** — indivíduo possui ao menos uma sanção atualmente ativa considerando o critério de similaridade `minmatch`.
- **`WasPreviouslySanctioned`** — indivíduo já possuiu alguma sanção que atenda ao critério de similaridade `minmatch`.

#### Body Params

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|---|---|---|---|---|
| `q` | string | sim | Parâmetros de entrada (identificadores e filtros) | `doc{CPF}` |
| `Datasets` | string | sim | Nomes técnicos dos datasets | `kyc` |
| `Limit` | number | não | Máximo de entidades retornadas sem chave principal (máx. 80) | `1` |

#### Response 200

```
Result: array of { KycData }
  KycData:
    QueryId: string
    ElapsedMilliseconds: number
    QueryDate: string
    Status: object (por dataset)
    Evidences: object (por dataset)
    PEPHistory: [{ Level, JobTitle, Department, Motive, Source, TaxId, StartDate, EndDate, CreationDate, LastUpdateDate }]
    ... demais campos de sanções com flags acima
```

#### cURL Request

```bash
curl --request POST \
     --url https://plataforma.bigdatacorp.com.br/pessoas \
     --header 'AccessToken: ACCESSTOKEN' \
     --header 'TokenId: TOKENID' \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '
{
  "Datasets": "kyc",
  "q": "doc{CPF}",
  "Limit": 1
}
'
```

#### Exemplo de Response 200

```json
{
  "Result": [
    {
      "MatchKeys": "doc**********91}",
      "KycData": {
        "PEPHistory": [
          {
            "Level": "1",
            "JobTitle": "PRESIDENTE DA REPUBLICA",
            "Department": "PRESIDENCIA DA REPUBLICA",
            "Motive": "FEDERAL EMPLOYEE",
            "Source": "PEP_PORTAL",
            "TaxId": "453*****791",
            "StartDate": "2019-01-01T00:00:00Z",
            "EndDate": "2028-01-01T00:00:00Z"
          },
          {
            "Level": "1",
            "JobTitle": "PRESIDENTE",
            "Department": "PRESIDENCIA DA REPUBLICA",
            "Motive": "FEDERAL EMPLOYEE",
            "Source": "http://divulgacandcontas.tse.jus.br/divulga/rest/v1/...",
            "TaxId": "453*****791",
            "StartDate": "2019-01-01T00:00:00Z",
            "EndDate": "2027-12-31T00:00:00Z",
            "CreationDate": "2019-01-17T17:03:24.64Z",
            "LastUpdateDate": "2020-06-17T14:39:43.318Z"
          }
          /* ... demais itens de PEP/Sanções com flags IsCurrentlyPresentOnSource etc. ... */
        ]
      }
    }
  ]
}
```

#### Status V2 (consumo interno)

- **Consumido por:** `adapters/bigdatacorp.js::queryKyc(cpf, credentials)` e `queryCombined` (concatenado em `basic_data,processes,kyc,occupation_data`).
- **Integrado em:** `v2EnrichBigDataCorpOnCase` (trigger `cases/{caseId}` onCreate).
- **Normalizador:** `normalizers/bigdatacorp.js::normalizeBigDataCorpKyc`.
- **Custo unitário registrado:** R$ 0,050 (faixa 1–10 mil) — anotar em `usageMeters.unitCost` para billing.

---

## Entradas aguardando hidratação

> Cada stub contém URL oficial + resumo breve. Para hidratar um stub, seguir o mesmo formato da entrada #12 acima (Descrição → Preços → Chaves → Filtros → Body → Response → cURL → Exemplo). Conteúdo deve ser copiado da página `docs.bigdatacorp.com.br/plataforma/reference/<slug>`.

_As 198 entradas restantes estão organizadas em [`05a-bigdatacorp-stubs.md`](./05a-bigdatacorp-stubs.md) para manter este arquivo navegável. Cada stub lista URL + categoria + slug técnico + resumo + placeholders padronizados prontos para substituição._
