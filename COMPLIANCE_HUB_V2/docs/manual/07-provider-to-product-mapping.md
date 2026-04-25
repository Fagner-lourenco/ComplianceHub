# 07 — Provider ↔ Module ↔ Preset/Profile

Mapa que liga cada endpoint externo (seja BDG, Judit, Escavador, FonteData, DJEN) a:
1. **Módulo V2** que o consome (`PRODUCT_REGISTRY` em `v2Modules.cjs`)
2. **Área/macroárea** onde aparece no dossiê (`dossierSchema.cjs`)
3. **Preset/Perfil** recomendado (Compliance, Financeiro, RH, Jurídico, PLD, Investigativo, Compliance Internacional, Custom)

Objetivo: suportar criação de **perfis customizados** no APP (stepper Perfil→Critérios→Tag→Parâmetros) selecionando fontes por área.

---

## A. Perfis BigDataCorp (padronizados Upminer/Uplexis)

Baseado nas observações do audit 2026-04-23.

| Perfil | Macroáreas ativas | Datasets BDG sugeridos |
|---|---|---|
| **Compliance** | Compliance Regulatório, Listas Restritivas, Profissional, Jurídico | `kyc`, `processos`, `licencas`, `trabalhistas` (_a mapear para slugs BDG reais_) |
| **Compliance Internacional** | Listas Restritivas internacionais, Sanctions | `kyc` (com filtros `sanctions_source={ofac,unsc,eu,uk,interpol,fbi,...}`) |
| **Financeiro** | Financeiro, Crédito, Cadastro, Imóveis | `financeiro`, `credito` (marketplace), `bens_imoveis`, `basic_data` |
| **Investigativo** | Jurídico, Cadastro, Mídia, Relacionamentos | `processos`, `basic_data`, `kyc`, `presenca_online`, `relacionamentos` |
| **Jurídico** | Jurídico, Mandados, Listas Restritivas | `processos` (Pessoas + Empresas), `kyc` |
| **PLD** (Prevenção à Lavagem) | Compliance Regulatório, Listas Restritivas, PEP, Cadastro | `kyc` com `considerexpandedpep=true`, `basic_data` |
| **Recursos Humanos** | Cadastro, Profissional, Listas Restritivas, Jurídico (antecedentes) | `basic_data`, `qsa`, `situacao_cpf`, `antecedentes_criminais` (via FonteData), `tse_situacao_eleitoral`, `tst`, `processos`, `trabalho_escravo`, `listas_onu`, `qgi_bacen`, `ibama_cnd` |

Cada stub em [`05a-bigdatacorp-stubs.md`](./05a-bigdatacorp-stubs.md) deve, ao ser hidratado, incluir linha "Status V2" indicando presets em que pode ser incluído.

---

## B. Módulos V2 técnicos → Provedores

Baseado em `v2Modules.cjs::PRODUCT_REGISTRY` e `PROVIDER_SOURCE_SPECS`.

| Módulo V2 | Provedor(es) | Endpoint (resumo) |
|---|---|---|
| `basic_data_pf` | BigDataCorp | POST /pessoas datasets=`basic_data` |
| `basic_data_pj` | BigDataCorp | POST /empresas datasets=`basic_data` |
| `identity_pj` | BigDataCorp | POST /empresas datasets=`basic_data,qsa` |
| `kyc_compliance` | BigDataCorp | POST /pessoas datasets=`kyc` |
| `judicial_processes` | Judit + Escavador + BigDataCorp | ver adapters |
| `criminal_records` | FonteData | `antecedentes-criminais` |
| `warrants` | Judit async + FonteData | ver adapters |
| `labor` | FonteData + DJEN | `trt-consulta` + filtrado DJEN |
| `receita_federal_pf` | FonteData | `receita-federal-pf` |
| `djen_comunicacoes` | DJEN | `/api/v1/comunicacao` |
| `ai_analysis` | OpenAI | `chat.completions` |

---

## C. Gap Analysis — datasets BDG não consumidos

> Lista preliminar baseada em `bdc_catalog.json` (199 entradas). Expandirá conforme hidratamos.

**Categorias onde o V2 atualmente tem consumo ≥ 1 dataset:**
- Compliance Regulatório (consumido: `kyc`)
- Dados Básicos (consumido: `basic_data`, `occupation_data`)
- Processos Judiciais (consumido: `processes`)

**Categorias onde o V2 atualmente tem consumo = 0:**
- Comportamento (4)
- Contatos (14)
- Econômicos / Econômicos e Financeiros (8)
- Envolvimento Político (9)
- Exposição Pública (4)
- Presença Digital (5)
- Profissionais (8)
- Risco (6)
- Sócio-Demográficos (1)
- Veículos (2)
- Ativos (3)
- ESG (2)
- Relacionamentos (4)
- Reputação (3)
- Setoriais (3)
- Consultas de Pessoas OnDemand (9)
- Consultas de Empresas OnDemand (10)
- Consultas de Notas Fiscais (2)
- Consultas de Veículos (2)
- Crédito Marketplace (8)
- API de Endereços (15)
- API de Processos (1)
- API de Veículos (1)
- Certidões de Pessoas (15)
- Certidões de Empresas (15)
- Certidões de Endereços (1)
- Serviços auxiliares (11)

**Total de datasets BDG a potencialmente integrar:** ~165 dos 199 entradas ainda não são mapeadas em módulos V2.

---

## D. Próximos passos de wiring

1. Hidratar [`05-bigdatacorp-api.md`](./05-bigdatacorp-api.md) e [`05a-bigdatacorp-stubs.md`](./05a-bigdatacorp-stubs.md) com conteúdo oficial.
2. Para cada entrada hidratada, preencher campo **Status V2**:
   - "Consumido por `<adapter/função>`" — se já integrado
   - "GAP — sugerir adapter `<nome>` e preset `<lista>`" — se novo
3. Consolidar [`06-cost-matrix.md`](./06-cost-matrix.md) com preços extraídos.
4. Propor refactor do adapter BigDataCorp para tornar datasets parametrizáveis por preset (`dossierPreset.dataSetsBdg = [...]`) ao invés de hardcoded em `queryCombined`.
5. Expandir `PROVIDER_SOURCE_SPECS` com entradas para cada novo dataset BDG integrado, ligando a `sectionGroupKey`/`sectionKey` do `dossierSchema.cjs` (audit 2026-04-23 §6.2/6.4).
