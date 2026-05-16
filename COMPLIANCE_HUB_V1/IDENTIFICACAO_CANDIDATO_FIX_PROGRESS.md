# IDENTIFICACAO_CANDIDATO_FIX_PROGRESS

## Objetivo
Melhorar a seção "Identificação do Candidato" usando dados úteis de BigDataCorp, sem densidade excessiva e sem inventar validação de RG.

## Checklist
- [x] 1. Auditar campos disponíveis no backend
- [x] 2. Auditar campos espelhados em client/public result
- [x] 3. Atualizar functions/index.js com campos seguros
- [x] 4. Atualizar src/core/clientPortal.js com os mesmos campos
- [x] 5. Atualizar functions/reportBuilder.cjs
- [x] 6. Atualizar src/core/reportBuilder.js
- [x] 7. Incrementar REPORT_BUILD_VERSION em ambos (3 → 4)
- [ ] 8. Testar relatório interno
- [ ] 9. Testar relatório público novo
- [ ] 10. Testar caso antigo sem campos BDC
- [ ] 11. Testar alerta de óbito
- [ ] 12. Rodar build/check

## Arquivos alterados
| Arquivo | Mudança |
|---------|---------|
| `functions/index.js` | IDENTITY_FIELDS: +7 campos BDC |
| `src/core/clientPortal.js` | PUBLIC_RESULT_FIELDS: +7 campos BDC |
| `functions/reportBuilder.cjs` | REPORT_BUILD_VERSION 3→4; novos helpers; idFields reescrito |
| `src/core/reportBuilder.js` | REPORT_BUILD_VERSION 3→4; novos helpers; idFields reescrito |
| `IDENTIFICACAO_CANDIDATO_FIX_PROGRESS.md` | Este arquivo |

## Funções alteradas
| Arquivo | Função | Mudança |
|---------|--------|---------|
| `functions/reportBuilder.cjs` | `buildCaseBody` | idFields reescrito com CPF status, nome confirmado, nascimento/idade, sexo, filiação, alerta óbito |
| `functions/reportBuilder.cjs` | (novas) | `normalizeTextForCompare`, `isMeaningfullyDifferentName`, `formatCpfStatus`, `formatGender`, `formatBirthAndAge` |
| `src/core/reportBuilder.js` | `buildCaseBody` | idFields reescrito com mesma lógica + fallback cd (canonicalData) |
| `src/core/reportBuilder.js` | (novas) | `normalizeTextForCompare`, `isMeaningfullyDifferentName`, `formatCpfStatus`, `formatGender`, `formatBirthAndAge` |

## Campos adicionados aos snapshots
- `bigdatacorpName`
- `bigdatacorpCpfStatus`
- `bigdatacorpBirthDate`
- `bigdatacorpAge`
- `bigdatacorpGender`
- `bigdatacorpMotherName`
- `bigdatacorpHasDeathRecord`

## Nova seção "Identificação do Candidato"
1. Nome completo
2. Nome confirmado na base (apenas se diferente do informado)
3. CPF · Situação cadastral (ex: "***.***.***-00 · CPF regular")
4. Nascimento / idade (ex: "15/03/1985 · 39 anos")
5. Sexo (Masculino/Feminino)
6. Filiação materna
7. Cargo
8. Departamento
9. E-mail
10. Telefone
11. Data da solicitação
12. Prioridade
13. Solicitado por
14. Alerta cadastral: Indicativo de óbito localizado (apenas se hasDeathRecord === true)

## Testes executados
- [ ] `node --check functions/reportBuilder.cjs`
- [ ] `node --check functions/index.js`
- [ ] `npm run build` (frontend)
- [ ] Testes unitários

## Observação sobre relatórios públicos antigos
Relatórios públicos já gerados em `publicReports/{token}` permanecem com HTML antigo.
O bump de REPORT_BUILD_VERSION (3→4) força regeneração de novos links públicos.
Relatórios antigos precisam ser regenerados manualmente (script `scripts/regenerate-reports.cjs`) se desejado.

## Pendências
- Deploy functions (Firebase)
- Deploy frontend (Vercel)
- Teste manual em ambiente de produção
