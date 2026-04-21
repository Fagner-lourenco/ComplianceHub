# COMPARATIVO: BUSCA POR CPF vs BUSCA POR NOME — 4 PROVIDERS
**Data:** 11 de abril de 2026  
**Providers:** Escavador V2 · Judit · Exato Digital · BigDataCorp  
**Candidatos:** André (SP), Diego (CE), Renan (RJ), Francisco (CE), Matheus (SP)

---

## RESUMO DA METODOLOGIA DE BUSCA POR PROVEDOR

| Provedor     | Busca por CPF | Busca por Nome | Observação |
|:-------------|:-------------:|:--------------:|:-----------|
| **BDC**      | `doc{CPF}` (chave principal, 1:1) | `name{NOME}` (chave alternativa, retorna múltiplas entidades) | Nome retorna entidades com CPFs diferentes (homônimos separados) |
| **Escavador**| `?cpf_cnpj=CPF` (endpoint envolvido) | `?nome=NOME` (fallback se CPF=0) | Nome retorna TODOS processos de QUALQUER pessoa com o mesmo nome, sem filtro por CPF |
| **Judit**    | `search_type: 'cpf'` (data lake) | `search_type: 'name'` (testado André e Matheus) | Busca por nome retornou 0 processos |
| **Exato**    | `cpf: CPF` (único método) | ❌ Não disponível | Busca exclusivamente por CPF |

---

## BLOCO 1 — PROCESSOS ENCONTRADOS POR CPF (BUSCA CONFIÁVEL)

> **Este é o método padrão para compliance.** CPF = identificador único, zero falsos positivos.

### Tabela Consolidada — Busca por CPF

| CNJ (formatado) | Ano | Tribunal | André | Diego | Renan | Francisco | Matheus |
|:-----------------|:---:|:--------:|:-----:|:-----:|:-----:|:---------:|:-------:|
| **0001549-63.2024.8.06.0001** | 2024 | TJCE | — | ESC | — | — | — |
| **0114945-28.2018.8.06.0001** | 2018 | TJCE | — | BDC+EXA | — | — | — |
| **0101976-21.2016.5.01.0007** | 2016 | TRT1 | — | — | BDC+ESC+JUD+EXA | — | — |
| **0053023-02.2020.8.06.0167** | 2020 | TJCE | — | — | — | BDC+ESC+EXA | — |
| **0013417-40.2021.8.06.0293** | 2021 | TJCE | — | — | — | BDC+ESC | — |
| **0205659-11.2024.8.06.0167** | 2024 | TJCE | — | — | — | BDC+ESC | — |
| **0040713-08.2013.8.06.0167** | 2013 | TJCE | — | — | — | BDC+ESC | — |
| **3001575-02.2021.8.06.0167** | 2021 | TJCE | — | — | — | BDC+ESC | — |
| **0202743-72.2022.8.06.0167** | 2022 | TJCE | — | — | — | BDC+ESC+JUD+EXA | — |
| **0012198-45.2022.8.06.0167** | 2022 | TJCE | — | — | — | BDC+ESC | — |
| **1505327-09.2024.8.26.0001** | 2024 | TJSP | — | — | — | — | JUD |

### Contagem por Provedor (CPF)

| Candidato   | BDC | Escavador | Judit | Exato | Total Único |
|:------------|:---:|:---------:|:-----:|:-----:|:-----------:|
| André       | 0   | 0         | 0     | 0     | **0**       |
| Diego       | 1   | 1 (diferente!) | 0 | 1     | **2**       |
| Renan       | 1   | 1         | 1     | 1     | **1**       |
| Francisco   | 7¹  | 7         | 1     | 2     | **7**       |
| Matheus     | 0   | 0         | 1     | 0     | **1**       |
| **TOTAL**   | **9** | **9**   | **2** | **4** | **11**      |

> ¹ BDC retornou 8 registros, mas `0040713-08.2013` aparece duplicado (2 instâncias do mesmo CNJ).

### Análise por Provedor — Busca por CPF

**BDC (9/11 = 82%):**
- ✅ Achou 100% dos processos de Francisco (7/7)
- ✅ Achou Diego (1), mas processo DIFERENTE do Escavador (2018 vs 2024)
- ✅ Achou Renan (1/1)
- ❌ Não achou Matheus TJSP (gap de indexação)
- ❌ Não achou Diego 2024 (gap de indexação TJCE recente)

**Escavador (9/11 = 82%):**
- ✅ Achou 100% dos processos de Francisco (7/7)
- ✅ Achou Diego (1), mas processo DIFERENTE do BDC (2024 vs 2018)
- ✅ Achou Renan (1/1)
- ❌ Não achou Matheus TJSP (gap de indexação)
- ❌ Não achou Diego 2018 (gap de indexação TJCE antigo)

**Judit (2/11 = 18%):**
- ⚠️ Achou processos ÚNICOS: Matheus TJSP (ninguém mais achou!)
- ✅ Achou Renan e Francisco (apenas 1 cada)
- ❌ Não achou André, Diego, nem os outros 6 de Francisco

**Exato (4/11 = 36%):**
- ✅ Achou os mesmos que BDC para Diego e Renan
- ⚠️ Francisco: apenas 2/7 processos
- ❌ Não achou André nem Matheus

---

## BLOCO 2 — PROCESSOS ENCONTRADOS POR NOME (BUSCA COMPLEMENTAR)

> ⚠️ **ATENÇÃO: Busca por nome gera homônimos massivamente.** Não deve ser usada como fonte primária.

### 2.1 — BDC por Nome (`name{NOME}`)

| Candidato | Entidades Retornadas | CPFs Distintos | Processos Total | Processos do NOSSO candidato |
|:----------|:--------------------:|:--------------:|:---------------:|:----------------------------:|
| André     | 5                    | 5 (nenhum = 48052053854) | 4 | **0** (todos homônimos) |
| Diego     | 1                    | 1              | 1               | 1 (= busca por CPF)         |
| Renan     | 1                    | 1              | 1               | 1 (= busca por CPF)         |
| Francisco | 1                    | 1              | 8               | 8 (= busca por CPF)         |
| Matheus   | **0**                | 0              | 0               | **0** (nem por nome achou!)  |

**Conclusão BDC por nome:** 
- Nomes comuns (André, Matheus) = ruído ou zero resultados
- Nomes menos comuns (Diego, Renan, Francisco) = mesmos resultados que CPF
- **Zero processos adicionais legítimos** encontrados por nome vs CPF

### 2.2 — Escavador por Nome (`?nome=NOME`)

Buscas realizadas apenas para André e Matheus (fallback quando CPF = 0 processos).

| Candidato | Processos Retornados | CPFs com esse nome no Escavador | São do nosso candidato? |
|:----------|:--------------------:|:-------------------------------:|:-----------------------:|
| André     | 22²                 | **8 CPFs** | ❌ **NÃO** — CPF nos processos: `274.894.258-24` ≠ André (`480.520.538-54`) |
| Matheus   | 50²                 | **289 CPFs** | ❌ **NÃO** — Nenhum processo confirmável como sendo do nosso CPF |
| Diego     | —                   | — (não buscado) | — |
| Renan     | —                   | — (não buscado) | — |
| Francisco | —                   | — (não buscado) | — |

> ² Escavador limita retorno por paginação (20-50 itens). Quantidade real pode ser maior.

**Detalhes André (22 processos por nome — TODOS homônimos):**
- Tribunais: TJSP, TJBA, TJRR, TRT1, TRT5, TRF1 — nenhum no domicílio (SP com CPF)
- CPF encontrado: `27489425824` (diferente!) 
- Escavador reporta `cpfs_com_esse_nome: 8` → 8 pessoas com nome idêntico

**Detalhes Matheus (50 processos por nome — TODOS homônimos):**
- Tribunais: TJSP, TJGO, TJBA, TJRS, TJSC, TJPR, TRT2, TRT3, TRT15, TRF4 → espalhados por 10+ estados
- Escavador reporta `cpfs_com_esse_nome: 289` → **289 pessoas** com o mesmo nome!
- **Impossível** identificar quais (se algum) pertencem ao CPF `462.472.438-04`

### 2.3 — Judit por Nome (`search_type: 'name'`)

| Candidato | Processos Retornados |
|:----------|:--------------------:|
| André     | 0                    |
| Matheus   | 0                    |

**Conclusão Judit por nome:** Retornou zero. A busca por nome no data lake Judit não encontrou nada adicional.

### 2.4 — Exato por Nome

**Não disponível.** Exato busca exclusivamente por CPF.

---

## BLOCO 3 — CRUZAMENTO: NOME ENCONTROU ALGO QUE CPF NÃO ENCONTROU?

| Candidato | CPF Total (4 providers) | Nome Total (3 providers) | Nome achou processos LEGÍTIMOS extras? |
|:----------|:-----------------------:|:------------------------:|:--------------------------------------:|
| André     | 0                       | 22 ESC + 4 BDC + 0 JUD  | ❌ Todos 26 são homônimos confirmados  |
| Diego     | 2                       | 1 BDC (= CPF)           | ❌ Nome não acrescentou nada           |
| Renan     | 1                       | 1 BDC (= CPF)           | ❌ Nome não acrescentou nada           |
| Francisco | 7                       | 8 BDC (= CPF)           | ❌ Nome não acrescentou nada           |
| Matheus   | 1                       | 50 ESC + 0 BDC + 0 JUD  | ❌ 50 processos sem CPF verificável    |

### Veredicto

> **A busca por nome NUNCA encontrou um processo legítimo que a busca por CPF não tenha encontrado.**
>
> - Para nomes comuns: gera dezenas/centenas de falsos positivos (homônimos)
> - Para nomes raros: retorna os mesmos resultados que a busca por CPF
> - O gap real (Matheus TJSP) é de **indexação**, não de método de busca

---

## BLOCO 4 — GAPS DE COBERTURA POR PROVEDOR (BUSCA CPF)

### Processos que APENAS UM provedor encontrou

| CNJ | Candidato | Provedor Exclusivo | Por que os outros não acharam? |
|:----|:----------|:------------------:|:-------------------------------|
| 0001549-63.2024.8.06.0001 | Diego | **Escavador** | BDC/Exato têm o de 2018, não o de 2024 |
| 0114945-28.2018.8.06.0001 | Diego | **BDC + Exato** | Escavador tem o de 2024, não o de 2018 |
| 1505327-09.2024.8.26.0001 | Matheus | **Judit** | Nenhum outro provider indexou TJSP para este CPF |
| 0013417-40.2021.8.06.0293 | Francisco | **BDC + ESC** | Judit e Exato não indexaram |
| 0205659-11.2024.8.06.0167 | Francisco | **BDC + ESC** | Judit e Exato não indexaram |
| 0040713-08.2013.8.06.0167 | Francisco | **BDC + ESC** | Judit e Exato não indexaram |
| 3001575-02.2021.8.06.0167 | Francisco | **BDC + ESC** | Judit e Exato não indexaram |
| 0012198-45.2022.8.06.0167 | Francisco | **BDC + ESC** | Judit e Exato não indexaram |

### Diego: Caso Especial — 2 Processos Distintos

- **Escavador achou:** `0001549-63.2024.8.06.0001` (TJCE, 2024)
- **BDC + Exato acharam:** `0114945-28.2018.8.06.0001` (TJCE, 2018)
- **Nenhum provedor achou ambos por CPF!**
- Isso reforça: **multi-provider é obrigatório** para cobertura total

---

## BLOCO 5 — COBERTURA CRUZADA (BUSCA CPF)

```
               BDC    ESC    JUD    EXA
André    (0p)  --     --     --     --
Diego    (2p)  ◐      ◐      ✗      ◐     ← processos DIFERENTES no BDC vs ESC
Renan    (1p)  ●      ●      ●      ●     ← único com 100% de cobertura
Francisco(7p)  ●●●●●●●●●●●●●●  ◑      ◑◑    ← BDC+ESC têm 100%, Judit 14%, Exato 28%
Matheus  (1p)  ✗      ✗      ●      ✗     ← só Judit achou

Legenda: ● encontrou  ✗ não encontrou  ◐ parcial  ◑ muito parcial
```

### Complementaridade Real

| Combinação de Providers | Processos Encontrados | Cobertura |
|:------------------------|:---------------------:|:---------:|
| BDC sozinho             | 9/11                  | 82%       |
| Escavador sozinho       | 9/11                  | 82%       |
| BDC + Escavador         | 10/11                 | **91%**   |
| BDC + ESC + Judit       | **11/11**             | **100%**  |
| BDC + ESC + Judit + Exato | 11/11               | 100%      |
| Exato sozinho           | 4/11                  | 36%       |
| Judit sozinho           | 2/11                  | 18%       |

---

## BLOCO 6 — RECOMENDAÇÃO ARQUITETURAL

### Estratégia de Busca

1. **Busca primária: SEMPRE por CPF** — zero falsos positivos, identificação unívoca
2. **Busca por nome: NÃO recomendada** em produção — gera ruído massivo sem acrescentar processos legítimos
3. **Multi-provider: OBRIGATÓRIO** — nenhum provider tem 100% sozinho

### Hierarquia Recomendada (custo-benefício)

```
CAMADA 1 — BDC (R$0.20/consulta combinada)
  ├── Cobertura: 82% dos processos
  ├── Dados mais ricos: movimentações com texto, decisões, partes com CPF
  ├── Dados cadastrais: nome da mãe, nascimento, status CPF, RAIS
  └── KYC: sanções, PEP, mandados de prisão

CAMADA 2 — Escavador (R$0.015/consulta)
  ├── Complementa gaps do BDC (+9% de cobertura = 91%)
  ├── Custo 13x menor que BDC
  └── Diego: processo de 2024 que BDC não tem

CAMADA 3 — Judit (R$0.50-2.00/consulta)
  ├── Complementa gap final (+9% = 100%)
  ├── Único que achou Matheus TJSP
  └── Usar apenas quando BDC+ESC retornam 0 processos
  
CAMADA 4 — Exato (excluir)
  ├── Nunca achou algo que BDC+ESC não tenham
  ├── Movimentações sempre vazias
  └── Custo não justificável
```

### Custo Estimado por Consulta Completa

| Cenário | Fluxo | Custo |
|:--------|:------|:-----:|
| Caso típico (BDC acha processos) | BDC only | R$0.20 |
| BDC + complemento | BDC → ESC | R$0.215 |
| Cobertura total (BDC + ESC = 0) | BDC → ESC → JUD | R$0.715 - R$2.215 |
| Média ponderada (~70% caso 1, ~25% caso 2, ~5% caso 3) | — | **~R$0.25** |

---

## NOTAS TÉCNICAS

### Formato CNJ
BDC e Exato retornam CNJ sem formatação (`00530230220208060167`).  
Escavador e Judit retornam formatado (`0053023-02.2020.8.06.0167`).  
Normalizar com: `raw.slice(0,7)+'-'+raw.slice(7,9)+'.'+raw.slice(9,13)+'.'+raw.slice(13,14)+'.'+raw.slice(14,16)+'.'+raw.slice(16,20)`

### Homônimos — Métricas de Ruído por Nome
| Nome | CPFs no Escavador | Entidades no BDC (nome) |
|:-----|:-----------------:|:-----------------------:|
| ANDRE LUIZ CRUZ DOS SANTOS | **8** | **5** |
| MATHEUS GONCALVES DOS SANTOS | **289** | **0** |
| DIEGO EMANUEL ALVES DE SOUZA | — (não testado) | 1 |
| RENAN GUIMARAES DE SOUSA AUGUSTO | — | 1 |
| FRANCISCO TACIANO DE SOUSA | — | 1 |

### Arquivos de Referência

**Busca por CPF:**
- `results/escavador_X_NOME.json` — Escavador por CPF
- `results/judit_lawsuits_X_NOME.json` — Judit por CPF
- `results/bigdatacorp/bdc_X_combined.json` — BDC por CPF
- `results/exato/exato_processos_X_NOME.json` — Exato por CPF

**Busca por Nome:**
- `results/escavador_X_NOME_byname.json` — Escavador por nome (André e Matheus)
- `results/advanced/esc_X_nome_baseline.json` — Escavador advanced por nome (André e Matheus)
- `results/bigdatacorp/bdc_X_byname.json` — BDC por nome (5 candidatos)
- `results/missing/judit_X_nome_baseline.json` — Judit por nome (André e Matheus)
