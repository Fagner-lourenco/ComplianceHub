# 11 — Preset Registry (9 perfis)

> 7 perfis padronizados inspirados Upminer + 2 novos. Cada preset liga `sourceKeys` reais de [`10-source-catalog.json`](./10-source-catalog.json).

## Schema

```ts
interface DossierPreset {
  presetKey: string;              // "rh_pf" etc
  displayName: string;            // "Recursos Humanos"
  version: string;                // "v1-2026-04-24"
  subjectKind: "pf" | "pj" | "both";
  audience: "ops_internal" | "client_corporate" | "both";
  objective: string;              // descrição comercial
  defaultSchemaKey: string;       // liga dossierSchema
  sourceKeys: string[];           // bdc_* + outros providers
  lockedSourceKeys: string[];     // não removíveis via custom
  optionalSourceKeys: string[];   // sugeridas, removíveis
  parameterDefaults: Record<string, any>;
  autoProcessDefault: boolean;
  taggingPolicy: "required" | "optional" | "disabled";
  estimatedCostBrl: { min: number; max: number; };  // computado da matriz
}
```

---

## Preset 1 — Compliance

```yaml
presetKey: compliance_pf
displayName: Compliance
version: v1-2026-04-24
subjectKind: pf
audience: both
objective: >
  Reúne fontes essenciais para manter sua empresa segura contra riscos
  regulatórios e dentro das normas exigidas pelo setor.
defaultSchemaKey: schema_pf_compliance_v1
sourceKeys:
  - bdc_pessoas_kyc_e_compliance              # #12 kyc
  - bdc_pessoas_processos_judiciais_e_administrativos   # #44 processes
  - fontedata_antecedentes_criminais          # FonteData PF
  - fontedata_cnj_mandados_prisao             # FonteData PF
  - fontedata_cadastro_pf_basica              # FonteData identidade
  - bdc_pessoas_conselhos_de_classe           # #48 class_organization
  - djen_comunicacoes_por_nome                # DJEN
lockedSourceKeys:
  - bdc_pessoas_kyc_e_compliance
optionalSourceKeys:
  - bdc_pessoas_nivel_de_envolvimento_politico # #35
  - bdc_pessoas_conselhos_de_classe
parameterDefaults:
  autoMarkRelevant: true
autoProcessDefault: false
taggingPolicy: optional
estimatedCostBrl: { min: 0.50, max: 1.20 }
```

---

## Preset 2 — Compliance Internacional

```yaml
presetKey: compliance_internacional
displayName: Compliance Internacional
version: v1-2026-04-24
subjectKind: both
audience: both
objective: >
  Perfil voltado a checagens internacionais, listas restritivas, empresas
  offshore e fontes globais de reputação e integridade.
defaultSchemaKey: schema_compliance_intl_v1
sourceKeys:
  - bdc_pessoas_kyc_e_compliance              # #12 kyc (filter sanctions_source=ofac,eu,uk,interpol,unsc)
  - bdc_empresas_kyc_e_compliance             # #65 kyc PJ
  - bdc_empresas_kyc_e_compliance_do_grupo_economico  # #68
lockedSourceKeys:
  - bdc_pessoas_kyc_e_compliance
  - bdc_empresas_kyc_e_compliance
parameterDefaults:
  sanctions_source: ["ofac","eu","uk","interpol","unsc","ddtc","ca-sanctions"]
  minmatch: 80
  considerexpandedpep: true
autoProcessDefault: false
taggingPolicy: optional
estimatedCostBrl: { min: 0.10, max: 0.50 }
```

---

## Preset 3 — Financeiro

```yaml
presetKey: financeiro_pf
displayName: Financeiro
version: v1-2026-04-24
subjectKind: pf
audience: both
objective: >
  Checagem financeira, inadimplência, regularidade fiscal e histórico cadastral.
defaultSchemaKey: schema_pf_financeiro_v1
sourceKeys:
  - bdc_pessoas_dados_cadastrais_basicos       # #26 basic_data PF
  - bdc_pessoas_informacoes_financeiras        # #29 financial_data
  - bdc_pessoas_devedores_do_governo           # #34 government_debtors
  - bdc_pessoas_risco_financeiro               # #56 financial_risk
  - bdc_pessoas_presenca_em_cobranca           # #58 collections
  - bdc_pessoas_probabilidade_de_negativacao   # #59 indebtedness_question
  - bdc_marketplace_dados_restritivos_biro_de_credito  # #182
  - fontedata_receita_federal_pf               # FonteData
lockedSourceKeys:
  - bdc_pessoas_dados_cadastrais_basicos
optionalSourceKeys:
  - bdc_marketplace_score_de_credito_quod      # #188
  - bdc_marketplace_score_de_credito_multidados_biro_de_credito  # #185
parameterDefaults: {}
autoProcessDefault: false
taggingPolicy: optional
estimatedCostBrl: { min: 0.40, max: 2.50 }
```

---

## Preset 4 — Investigativo

```yaml
presetKey: investigativo_pf
displayName: Investigativo
version: v1-2026-04-24
subjectKind: pf
audience: ops_internal
objective: >
  Busca ampliada de vínculos, registros, cadastros e indícios relevantes
  para investigação e análise de contexto.
defaultSchemaKey: schema_pf_investigativo_v1
sourceKeys:
  - bdc_pessoas_dados_cadastrais_basicos
  - bdc_pessoas_historico_de_dados_basicos
  - bdc_pessoas_kyc_e_compliance
  - bdc_pessoas_processos_judiciais_e_administrativos
  - bdc_pessoas_presenca_online                # #15
  - bdc_pessoas_emails                         # #19
  - bdc_pessoas_telefones                      # #21
  - bdc_pessoas_enderecos                      # #23
  - bdc_pessoas_nivel_de_envolvimento_politico
  - fontedata_antecedentes_criminais
  - judit_lawsuits_async
  - djen_comunicacoes_por_nome
optionalSourceKeys:
  - bdc_pessoas_exposicao_esportiva            # #55
  - bdc_pessoas_anuncios_online                # #42
parameterDefaults:
  returnupdates: true
  extendednamematch: true
autoProcessDefault: false
taggingPolicy: optional
estimatedCostBrl: { min: 1.00, max: 3.00 }
```

---

## Preset 5 — Jurídico

```yaml
presetKey: juridico_pf
displayName: Jurídico
version: v1-2026-04-24
subjectKind: both
audience: both
objective: >
  Conjunto de fontes para análise jurídica, processos, certidões e consultas
  em bases judiciais e administrativas.
defaultSchemaKey: schema_juridico_v1
sourceKeys:
  - bdc_pessoas_processos_judiciais_e_administrativos
  - bdc_pessoas_dados_de_distribuicao_de_processos_judiciais    # #46
  - bdc_empresas_processos_judiciais_e_administrativos          # #92
  - bdc_empresas_processos_judiciais_dos_socios                 # #93
  - bdc_empresas_dados_de_distribuicao_de_processos_judiciais   # #94
  - judit_lawsuits_async
  - judit_warrant_async
  - escavador_processos_por_pessoa
  - djen_comunicacoes_por_nome
  - bdc_pessoas_kyc_e_compliance                                # filter sanctions_type=tribunais
parameterDefaults:
  returnupdates: true
  returncvmprocesses: true
autoProcessDefault: false
taggingPolicy: optional
estimatedCostBrl: { min: 0.60, max: 2.00 }
```

---

## Preset 6 — PLD (Prevenção à Lavagem de Dinheiro)

```yaml
presetKey: pld
displayName: PLD
version: v1-2026-04-24
subjectKind: both
audience: both
objective: >
  Prevenção à lavagem de dinheiro, identificação de riscos, listas restritivas
  e exposição política.
defaultSchemaKey: schema_pld_v1
sourceKeys:
  - bdc_pessoas_kyc_e_compliance
  - bdc_pessoas_nivel_de_envolvimento_politico                 # #35
  - bdc_pessoas_candidatos_eleitorais                          # #36
  - bdc_empresas_kyc_e_compliance
  - bdc_empresas_kyc_e_compliance_dos_socios                   # #66
  - bdc_empresas_kyc_e_compliance_do_grupo_economico           # #68
  - bdc_empresas_envolvimento_politico                         # #81
parameterDefaults:
  considerexpandedpep: true
  minmatch: 75
  sanctions_source:
    - interpol
    - ofac
    - unsc
    - eu
    - uk
    - ddtc
autoProcessDefault: true
taggingPolicy: required
estimatedCostBrl: { min: 0.60, max: 1.50 }
```

---

## Preset 7 — Recursos Humanos

```yaml
presetKey: rh_pf
displayName: Recursos Humanos
version: v1-2026-04-24
subjectKind: pf
audience: client_corporate
objective: >
  Fortalecer poder de recrutamento e assegurar seleção de talentos precisa.
defaultSchemaKey: schema_pf_rh_v1
sourceKeys:
  - bdc_pessoas_dados_cadastrais_basicos
  - bdc_pessoas_kyc_e_compliance
  - bdc_pessoas_processos_judiciais_e_administrativos
  - bdc_pessoas_conselhos_de_classe                 # #48
  - bdc_pessoas_dados_profissionais                 # #49
  - bdc_pessoas_historico_escolar_e_academico       # #50
  - bdc_pessoas_servidores_publicos                 # #53
  - fontedata_antecedentes_criminais
  - fontedata_cnj_mandados_prisao
  - fontedata_trt_consulta_trabalhista
lockedSourceKeys:
  - bdc_pessoas_dados_cadastrais_basicos
  - fontedata_antecedentes_criminais
optionalSourceKeys:
  - bdc_pessoas_premios_e_certificacoes             # #52
  - bdc_pessoas_exposicao_esportiva                 # #55
parameterDefaults: {}
autoProcessDefault: true
taggingPolicy: required
estimatedCostBrl: { min: 0.80, max: 2.20 }
```

---

## Preset 8 — Due Diligence PJ (NOVO)

```yaml
presetKey: due_diligence_pj
displayName: Due Diligence PJ
version: v1-2026-04-24
subjectKind: pj
audience: both
objective: >
  Análise reputacional e regulatória completa para fornecedores, parceiros
  e investimentos. Cobre compliance agregado + processos + estrutura + ESG.
defaultSchemaKey: schema_pj_due_diligence_v1
sourceKeys:
  - bdc_empresas_dados_cadastrais_basicos           # #76
  - bdc_empresas_historico_de_dados_basicos         # #77
  - bdc_empresas_kyc_e_compliance                   # #65
  - bdc_empresas_kyc_e_compliance_dos_socios        # #66
  - bdc_empresas_kyc_e_compliance_do_grupo_economico # #68
  - bdc_empresas_processos_judiciais_e_administrativos  # #92
  - bdc_empresas_processos_judiciais_dos_socios     # #93
  - bdc_empresas_relacionamentos                    # #96
  - bdc_empresas_qsa_de_recencia_configuravel       # #98
  - bdc_empresas_evolucao_da_empresa                # #79
  - bdc_empresas_indicadores_de_atividade           # #80
  - bdc_empresas_envolvimento_politico              # #81
  - bdc_empresas_presenca_em_cobranca               # #101
parameterDefaults: {}
autoProcessDefault: false
taggingPolicy: required
estimatedCostBrl: { min: 1.20, max: 4.50 }
```

---

## Preset 9 — ESG & Socioambiental (NOVO)

```yaml
presetKey: esg_pj
displayName: ESG & Socioambiental
version: v1-2026-04-24
subjectKind: pj
audience: both
objective: >
  Análise ambiental, social e de governança para contratação sustentável,
  licenciamento e monitoramento de responsabilidade corporativa.
defaultSchemaKey: schema_pj_esg_v1
sourceKeys:
  - bdc_empresas_acordos_sindicais                  # #85
  - bdc_empresas_consciencia_social                 # #86
  - bdc_pessoas_kyc_e_compliance                    # filter sanctions_source=Ibama
  - # Certidões e on-demand ambientais (ver 05a stubs para slugs certidão)
  - bdc_ondemand_empresas_ibama_embargos            # #135
  - bdc_ondemand_empresas_ibama_negativa            # #136
  - bdc_ondemand_empresas_ibama_regulatoria         # #137
  - bdc_enderecos_areas_de_protecao_ambiental       # #115
  - bdc_enderecos_amazonia_legal                    # #114
  - bdc_enderecos_unidades_de_conservacao           # #121
  - bdc_enderecos_terras_indigenas                  # #120
  - bdc_enderecos_consulta_de_areas_embargadas_icmbio # #117
  - bdc_ondemand_pessoas_ibama_embargos             # #149
  - bdc_ondemand_pessoas_ibama_negativa             # #150
parameterDefaults: {}
autoProcessDefault: false
taggingPolicy: required
estimatedCostBrl: { min: 0.80, max: 3.00 }
```

---

## Matriz preset × macroárea

| Preset | Identidade | Jurídico | Compliance | Financeiro | Risco | Profissional | Político | Mídia | Digital | Ativos | ESG |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Compliance | · | ● | ●●● | · | · | ● | · | · | · | · | · |
| Compliance Internacional | · | · | ●●● | · | · | · | · | · | · | · | · |
| Financeiro | ● | · | · | ●●● | ●● | · | · | · | · | · | · |
| Investigativo | ●● | ● | ● | · | · | · | ● | · | ●● | ● | · |
| Jurídico | · | ●●● | ● | · | · | · | · | · | · | · | · |
| PLD | · | · | ●●● | · | · | · | ●● | · | · | ● | · |
| Recursos Humanos | ●● | ● | ●● | · | · | ●●● | · | · | · | · | · |
| Due Diligence PJ | ●● | ●● | ●●● | ● | ● | · | ● | · | · | ●● | · |
| ESG & Socioambiental | · | · | ● | · | · | · | · | · | · | · | ●●● |

Legenda: ●●● forte · ●● moderada · ● complementar · · não consome.

---

## Próximas ações

1. Expandir `PROVIDER_SOURCE_SPECS` em `v2Modules.cjs` com `sourceKey` + `macroarea` + `preset_default_keys`.
2. Criar coleção `dossierPresets/{presetKey_version}` com estes 9 documentos.
3. Atualizar `v2CreateClientSolicitation` para aceitar `dossierPresetKey`.
4. Implementar custom profile builder usando este catálogo + presets como templates.
