# PLANO DE IMPLEMENTACAO: Calculo de Risco por Papel do Candidato

## Contexto
O sistema atualmente nao diferencia o papel do candidato nos processos ao calcular o score de risco.

## Regras de Negocio

### Criminal
| Papel | Risco | Flag |
|-------|-------|------|
| Reu, Indiciado, Autor do Fato | ALTO | POSITIVE (90 pts) |
| Vitima, Ofendido | BAIXO | NEGATIVE (0 pts) |
| Advogado, Procurador | IGNORAR | Nao conta |
| Testemunha | IGNORAR | Nao conta |

### Trabalhista
| Papel | Risco | Flag |
|-------|-------|------|
| Reclamado, Reu, Passivo | ALTO | POSITIVE (90 pts) |
| Reclamante, Autor, Ativo | BAIXO | NEGATIVE (0 pts) |
| Advogado | IGNORAR | Nao conta |
| Testemunha | IGNORAR | Nao conta |

### Civel
| Papel | Risco | Flag |
|-------|-------|------|
| Reu, Passivo, Executado | MEDIO | INCONCLUSIVE (50 pts) |
| Autor, Ativo | BAIXO | NEGATIVE (0 pts) |

## Regex de Classificacao
HIGH_RISK_PASSIVE: reu, reclamado, defendant, passive, passivo, executado, requerido, indiciado, autor do fato, condenado, acusado, investigado, averiguado
LOW_RISK_ACTIVE: autor, reclamante, author, active, ativo, exequente, querelante, requerente
VICTIM_ROLES: vitima, ofendido, prejudicado, lesado, damnificado, agraviado
LAWYER_ROLES: advogado, lawyer, procurador, defensor, procuradoria, defensoria, patrono
WITNESS_ROLES: testemunha, informante
AUTHORITY_ROLES: autoridade, ministerio publico, mp, justica, delegacia, orgao, instituicao, juizo, vara, tribunal, fazenda, uniao, estado, municipio

## Mudancas Necessarias

### 1. Backend - Normalizers (4 arquivos)
- functions/normalizers/judit.js
- functions/normalizers/escavador.js
- functions/normalizers/bigdatacorp.js
- functions/normalizers/djen.js

### 2. Backend - Auto-classificacao
- functions/index.js - buildHomonymAnalysisInput
- functions/index.js - autoClassifyCaseFlags
- functions/index.js - calculo de riskScore fallback

### 3. Frontend - CasoPage
- src/portals/ops/CasoPage.jsx - calculateRisk
- Adicionar coluna de papel nas tabelas
- Ajustar ScoreBar

### 4. Frontend - Report Builder
- src/core/reportBuilder.js - secao de analise de papeis

### 5. Testes
- Testes para normalizers
- Testes para backend
- Testes para frontend
- Testes de integracao

## Criterios de Aceitacao
1. Vitima em processo criminal -> Nao gera criminalFlag POSITIVE
2. Autor/reclamante trabalhista -> Nao gera laborFlag POSITIVE
3. Reu em processo criminal -> Gera criminalFlag POSITIVE
4. Reclamado trabalhista -> Gera laborFlag POSITIVE
5. Advogado -> Nao afeta score
6. Testemunha -> Ignorada
7. Score reflete papel predominante
8. Relatorio mostra analise de papeis
9. Todos os testes passam (916 total)
10. Zero regressoes

## Cronograma: ~10 horas
- Fase 1: Normalizers (2h)
- Fase 2: Backend auto-classificacao (2h)
- Fase 3: Frontend CasoPage (2h)
- Fase 4: Report Builder (1h)
- Fase 5: Testes (2h)
- Fase 6: Validacao (1h)

## Proximos Passos
1. Revisar e aprovar este plano
2. Decidir ordem de implementacao
3. Iniciar Fase 1

---
Plano criado em: 2026-05-04
Status: Aguardando aprovacao
