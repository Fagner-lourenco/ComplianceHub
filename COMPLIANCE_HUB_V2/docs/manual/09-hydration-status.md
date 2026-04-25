# 09 — Status de Hidratação BDC + Plano de Execução

> **Propósito:** Running log do progresso de hidratação dos 199 endpoints BDC. Atualizado em 2026-04-24.

## Estado atual

- **Total endpoints:** 199
- **Hidratados:** 109 (preços + chaves + filtros extraídos via processamento automatizado dos arquivos `bdg_scraped/`)
- **Pendentes:** 90
- **Slugs quebrados / removidos da doc pública:** 6 standard
- **Artefatos derivados criados:** `10-source-catalog.json` (SSoT 199 entradas) + `11-preset-registry.md` (9 presets) + `bdc/*.md` (12 arquivos por macroárea) + `06-cost-matrix.md` expandido

## Hidratados — distribuição por macroárea (109)

| Macroárea | # Hidratados |
|---|---|
| Identidade & Cadastro | 52 |
| Financeiro & Crédito | 16 |
| Jurídico & Processual | 8 |
| Compliance & Sanções | 9 |
| Profissional & Laboral | 8 |
| Risco | 4 |
| Político & Eleitoral | 3 |
| Presença Digital | 2 |
| Ativos & Propriedade | 2 |
| ESG & Socioambiental | 2 |
| Mídia & Reputação | 1 |
| Meta | 0 |
| OnDemand | 0 |
| Marketplace | 0 |

## Pendentes — 90 stubs

### Standard com slugs quebrados (6) — endpoints removidos da documentação pública

| # | Título | Slug | Status |
|---|---|---|---|
| 13 | KYC e Compliance dos Familiares de Primeiro Nível | `pessoas-kyc-e-compliance-dos-familiares` | 404 — removido da doc |
| 14 | Compliance de Casas de Apostas | `pessoas-compliance-de-casas-de-apostas` | 404 — removido da doc |
| 18 | Propensão à Aposta Online | `pessoas-propensao-a-aposta-online` | 404 — removido da doc |
| 31 | Programas de Benefícios e Assistência Social | `pessoas-programas-de-beneficios` | 404 — removido da doc |
| 32 | Programas de Benefícios e Assistência Social de Familiares | `pessoas-programas-de-beneficios-de-familiares` | 404 — removido da doc |
| 45 | Processos Judiciais e Administrativos de Familiares | `pessoas-processos-judiciais-familiares` | 404 — removido da doc |

> **Nota:** Esses 6 endpoints provavelmente foram descontinuados, renomeados ou movidos para documentação privada pela BDC. Não há slugs alternativos disponíveis nos arquivos scrapeados.

### OnDemand — 54 stubs (certidões, consultas específicas)

Estes endpoints operam com fluxo assíncrono diferente do standard (geram um job, retornam um ID de requisição). Requerem documentação separada.

**Empresas (15):** Ações Trabalhistas, Contratação PCD, CGU Negativa, CNJ Negativa, Débitos Estaduais, Débitos Trabalhistas, FGTS, Habilitação COMEX, IBAMA Embargos/Negativa/Regulatória, IRT, Licenças Sanitárias, PGFN, SIPROQUIM.

**Endereços (1):** SICAR.

**Pessoas (17):** Ações Judiciais Nada Consta, Ações Trabalhistas, CGU Correcional, CNJ Negativa, Débitos Estaduais, Débitos Trabalhistas, IBAMA Embargos/Negativa/Regularidade, IRT, Licenças Sanitárias, PGFN, Polícia Civil Antecedentes, Polícia Federal Antecedentes, TSE Quitação Eleitoral.

**Consultas Empresas (10):** Arrecadação Simples Nacional MEI, COMPROT Processos, Escrituração Contábil Digital, Inscrição Municipal, Optante Simples, Projetos Públicos, Receita Federal QSA/Representante Legal/Situação CNPJ, SINTEGRA.

**Notas Fiscais (2):** CTe, NFe.

**Consultas Pessoas (9):** BACEN Sanções, COMPROT Processos, DETRAN Multas, Polícia Civil BO, Receita Federal Restituição IR/Status CPF, SINTEGRA, SUS Cartão, TSE Local de Votação.

**Veículos (2):** DETRAN Chassi/RENAVAM, RNTRC Transportadores.

### Marketplace — 8 stubs (dados de crédito)

Estes endpoints requerem contrato específico com parceiros de crédito (Quod, Birô, Quantum, Murabei). Slugs quebrados na documentação pública.

| # | Título | Slug |
|---|---|---|
| 181 | Consulta SCR / Score Positivo | `marketplace-consulta-scr-score-positivo` |
| 182 | Dados Restritivos / Birô de Crédito | `marketplace-dados-restritivos-biro-de-credito` |
| 183 | Dados Restritivos / Quod | `marketplace-dados-restritivos-quod` |
| 184 | Flags Negativos / Quod | `marketplace-flags-negativos-quod` |
| 185 | Score de Crédito Multidados / Birô | `marketplace-score-de-credito-multidados-biro-de-credito` |
| 186 | Score de Crédito / Murabei | `marketplace-score-de-credito-murabei` |
| 187 | Score de Crédito / Quantum | `marketplace-score-de-credito-quantum` |
| 188 | Score de Crédito / Quod | `marketplace-score-de-credito-quod` |

### Meta — 22 stubs (documentação técnica, não endpoints de dados)

Páginas de onboarding, autenticação, guias de uso. Não requerem hidratação de preços/dataset.

## Decisões já tomadas (não re-discutir)

1. **Taxonomia aprovada** — 11 macroáreas conforme `08-taxonomy-proposal.md`.
2. **Formato de entrada padronizado** — template do `05b-bigdatacorp-hydrated.md`.
3. **JSON Response** — não extraímos via WebFetch (impossível); inferimos de descrição.
4. **Presets** — 7 Upminer + 2 propostos (Due Diligence PJ, ESG).
5. **cost-matrix** — uma linha por (dataset, endpoint, subject kind).
6. **Endpoints removidos** — 6 standard com 404 documentados como indisponíveis.
