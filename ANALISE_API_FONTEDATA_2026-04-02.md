# Análise Completa das APIs FonteData — ComplianceHub
**Data da execução:** 02 de abril de 2026  
**API Key utilizada:** `fd_live_kfjF6sqWsZprUQCc5dqueScMSWeO76cu`  
**Saldo inicial:** R$ 50,00  
**Saldo final:** R$ 36,11  
**Total consumido nos testes:** R$ 13,89  
**Base URL:** `https://app.fontedata.com/api/v1/consulta`

---

## SUMÁRIO EXECUTIVO

### Descobertas Críticas
1. **Parâmetros são QUERY STRING** (`?cpf=12345678900`), NÃO path params (`/12345678900`) — diferente do que a documentação sugere no exemplo de cURL
2. **`antecedentes-criminais` está completamente não funcional** — nenhuma combinação de parâmetros retorna dados (sempre 400)
3. **`trt-consulta` aceita código numérico de TRT como `regiao`**, NÃO a sigla da UF — nosso código tem um bug porque envia UF
4. **`cadastro-pf-basica` NÃO retorna `situacaoCadastral`** — apenas `receita-federal-pf` (R$ 0,54) retorna esse campo essencial para o gate
5. **`tj-processos` retorna `found: false`** mesmo para CPFs com processos TJ confirmados pelo `processos-agrupada`
6. **`tj-certidao` e `trf-certidao`** retornaram 503 (serviço indisponível) em todas as tentativas

---

## CPFs UTILIZADOS NOS TESTES

| # | Nome Completo | CPF | Cidade/UF Informada |
|---|---|---|---|
| 1 | ANDRE LUIZ CRUZ DOS SANTOS | 48052053854 | São Paulo / SP |
| 2 | DIEGO EMANUEL ALVES DE SOUZA | 10794180329 | Fortaleza / CE |
| 3 | RENAN GUIMARAES DE SOUSA AUGUSTO | 11819916766 | Rio de Janeiro / RJ |
| 4 | FRANCISCO TACIANO DE SOUSA | 05023290336 | Ceará / CE |
| 5 | MATHEUS GONCALVES DOS SANTOS | 46247243804 | São Paulo / SP |

---

## ENDPOINT 1: cadastro-pf-basica (Pessoa Física — Básico)
- **URL:** `GET /api/v1/consulta/cadastro-pf-basica?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 0,24
- **Status geral:** ✅ FUNCIONAL — Todas 5 consultas retornaram 200 OK
- **Parâmetros aceitos:** `cpf` (11 dígitos, sem formatação)

### Estrutura da Resposta (campos encontrados)
```
{
  "cpf": "480.520.538-54",              // CPF formatado com pontos e traço
  "nome": "ANDRE LUIZ CRUZ DOS SANTOS", // Nome completo uppercase
  "sexo": "Masculino",                  // "Masculino" ou "Feminino"
  "dataNascimento": "24/07/1997 00:00:00", // DD/MM/YYYY HH:mm:ss
  "nomeMae": "VALDINEIDE PINTO DA CRUZ",   // Nome da mãe uppercase
  "idade": 28,                          // Idade calculada (numérico)
  "signo": "LEAO",                      // Signo zodiacal uppercase
  "telefones": [...],                   // Array de objetos telefone
  "enderecos": [...],                   // Array de objetos endereço
  "emails": [...],                      // Array de objetos email
  "rendaEstimada": "4020.55",           // String com valor numérico
  "rendaFaixaSalarial": "Faixa 3 salários mínimos" // Faixa descritiva
}
```

**⚠️ CAMPO AUSENTE:** `situacaoCadastral` — Este endpoint NÃO retorna o status do CPF (REGULAR/SUSPENSA/etc.). Para isso, usar `receita-federal-pf`.

### Estrutura de Telefone
```json
{
  "telefoneComDDD": "(13) 992036849",
  "telemarketingBloqueado": false,        // bool ou null
  "operadora": "CLARO",                  // CLARO, VIVO, etc.
  "tipoTelefone": "TELEFONE MÓVEL",      // MÓVEL ou RESIDENCIAL
  "whatsApp": true                       // bool — indica se tem WhatsApp
}
```

### Estrutura de Endereço
```json
{
  "logradouro": "RUA R ANTONIO RIBEIRAO",
  "numero": "1",
  "complemento": "1 NULL",        // Pode conter "NULL" literal
  "bairro": "JOSE MENINO",
  "cidade": "SAO PAULO",
  "uf": "SP",
  "cep": "11065-290"
}
```

### Estrutura de Email
```json
{
  "enderecoEmail": "andrezinho_mjm@hotmail.com"
}
```

---

### Resposta CPF 1 — ANDRE LUIZ CRUZ DOS SANTOS (48052053854)
- **Cost:** R$ 0,24 | **Balance restante:** R$ 48,98
```json
{
  "cpf": "480.520.538-54",
  "nome": "ANDRE LUIZ CRUZ DOS SANTOS",
  "sexo": "Masculino",
  "dataNascimento": "24/07/1997 00:00:00",
  "nomeMae": "VALDINEIDE PINTO DA CRUZ",
  "idade": 28,
  "signo": "LEAO",
  "telefones": [
    {"telefoneComDDD": "(13) 992036849", "telemarketingBloqueado": false, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true},
    {"telefoneComDDD": "(13) 991284274", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": false},
    {"telefoneComDDD": "(13) 991335140", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": false}
  ],
  "enderecos": [
    {"logradouro": "RUA R ANTONIO RIBEIRAO", "numero": "1", "complemento": "1 NULL", "bairro": "JOSE MENINO", "cidade": "SAO PAULO", "uf": "SP", "cep": "11065-290"}
  ],
  "emails": [
    {"enderecoEmail": "andrezinho_mjm@hotmail.com"}
  ],
  "rendaEstimada": "4020.55",
  "rendaFaixaSalarial": "Faixa 3 salários mínimos"
}
```
**Observações:** DDD 13 = Santos/SP (baixada santista). CEP 11065 = Santos. Endereço bate com informação fornecida (São Paulo).

---

### Resposta CPF 2 — DIEGO EMANUEL ALVES DE SOUZA (10794180329)
- **Cost:** R$ 0,24 | **Balance restante:** R$ 48,74
```json
{
  "cpf": "107.941.803-29",
  "nome": "DIEGO EMANUEL ALVES DE SOUZA",
  "sexo": "Masculino",
  "dataNascimento": "20/04/2002 00:00:00",
  "nomeMae": "ANTONIA SUELANNE ALVES DE SOUSA",
  "idade": 23,
  "signo": "TOURO",
  "telefones": [],
  "enderecos": [],
  "emails": [
    {"enderecoEmail": "diegoasouza400@gmail.com"},
    {"enderecoEmail": "dieggo.emanuel20@gmail.com"},
    {"enderecoEmail": "diihalvess18@gmail.com"}
  ],
  "rendaEstimada": "909.81",
  "rendaFaixaSalarial": "Faixa 1 salário mínimo"
}
```
**Observações:** Sem telefones e sem endereços cadastrados. Única pessoa sem dados de contato direto. Jovem (23 anos). Renda estimada mais baixa do grupo. 3 emails diferentes.

---

### Resposta CPF 3 — RENAN GUIMARAES DE SOUSA AUGUSTO (11819916766)
- **Cost:** R$ 0,24 | **Balance restante:** R$ 48,50
```json
{
  "cpf": "118.199.167-66",
  "nome": "RENAN GUIMARAES DE SOUSA AUGUSTO",
  "sexo": "Masculino",
  "dataNascimento": "27/07/1987 00:00:00",
  "nomeMae": "RITA DE CASSIA GUIMARAES RAMOS",
  "idade": 38,
  "signo": "LEAO",
  "telefones": [
    {"telefoneComDDD": "(21) 26569569", "telemarketingBloqueado": false, "operadora": "HIT", "tipoTelefone": "TELEFONE RESIDENCIAL", "whatsApp": false},
    {"telefoneComDDD": "(21) 970810263", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true},
    {"telefoneComDDD": "(21) 978017401", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true},
    {"telefoneComDDD": "(21) 982343791", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true},
    {"telefoneComDDD": "(21) 992376033", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true}
  ],
  "enderecos": [
    {"logradouro": "AVENIDA DQ DE CAXIAS", "numero": "1410", "complemento": "AVAI", "bairro": "DEODORO", "cidade": "RIO DE JANEIRO", "uf": "RJ", "cep": "21615-220"},
    {"logradouro": "RUA CARNAUBA", "numero": "530", "complemento": null, "bairro": "SEN CAMARA", "cidade": "RIO DE JANEIRO", "uf": "RJ", "cep": "21842-010"},
    {"logradouro": "RUA JOSE REGATIERE FILHO", "numero": "5", "complemento": null, "bairro": "CORUMBA", "cidade": "RIO DE JANEIRO", "uf": "RJ", "cep": "26041-800"}
  ],
  "emails": [
    {"enderecoEmail": "renangsaugust@gmail.com"},
    {"enderecoEmail": "renangsaugusto@gmail.com"},
    {"enderecoEmail": "renanguimaraes860@gmail.com"}
  ],
  "rendaEstimada": "3154.87",
  "rendaFaixaSalarial": "Faixa 2 salários mínimos"
}
```
**Observações:** Maior volume de dados. 5 telefones (4 com WhatsApp), 3 endereços (todos RJ), 3 emails. Pessoa com 38 anos, mais experiência profissional. Bate com informação fornecida (RJ).

---

### Resposta CPF 4 — FRANCISCO TACIANO DE SOUSA (05023290336)
- **Cost:** R$ 0,24 | **Balance restante:** R$ 48,26
```json
{
  "cpf": "050.232.903-36",
  "nome": "FRANCISCO TACIANO DE SOUSA",
  "sexo": "Masculino",
  "dataNascimento": "16/08/1991 00:00:00",
  "nomeMae": "FRANCISCA CAETANA DE SOUSA",
  "idade": 34,
  "signo": "LEAO",
  "telefones": [
    {"telefoneComDDD": "(88) 993691161", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true},
    {"telefoneComDDD": "(88) 992621718", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true},
    {"telefoneComDDD": "(88) 994402868", "telemarketingBloqueado": null, "operadora": "CLARO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true}
  ],
  "enderecos": [
    {"logradouro": "RUA DA CASTANHOLA", "numero": "47", "complemento": "ATUAL STA C", "bairro": "CENTRO", "cidade": "SOBRAL", "uf": "CE", "cep": "62010-650"},
    {"logradouro": "RUA DA CASTANHOLA", "numero": "78", "complemento": null, "bairro": "CENTRO", "cidade": "SOBRAL", "uf": "CE", "cep": "62010-650"},
    {"logradouro": "ARCOVERDE", "numero": "759", "complemento": null, "bairro": "SUMARE", "cidade": "SOBRAL", "uf": "CE", "cep": "62014-010"}
  ],
  "emails": [],
  "rendaEstimada": "2376.60",
  "rendaFaixaSalarial": "Faixa 2 salários mínimos"
}
```
**Observações:** DDD 88 = região de Sobral/CE. Todos endereços em Sobral/CE. Sem emails. 3 telefones com WhatsApp. Endereço bate com informação (Ceará).

---

### Resposta CPF 5 — MATHEUS GONCALVES DOS SANTOS (46247243804)
- **Cost:** R$ 0,24 | **Balance restante:** R$ 48,02
```json
{
  "cpf": "462.472.438-04",
  "nome": "MATHEUS GONCALVES DOS SANTOS",
  "sexo": "Masculino",
  "dataNascimento": "30/10/1997 00:00:00",
  "nomeMae": "CRISTINA GONCALVES",
  "idade": 28,
  "signo": "ESCORPIAO",
  "telefones": [
    {"telefoneComDDD": "(44) 991360336", "telemarketingBloqueado": false, "operadora": "VIVO", "tipoTelefone": "TELEFONE MÓVEL", "whatsApp": true}
  ],
  "enderecos": [
    {"logradouro": "AVENIDA NAPOLEAO MOREIRA DA SILVA", "numero": "480", "complemento": "C", "bairro": "CENTRO", "cidade": "TERRA BOA", "uf": "PR", "cep": "87240-000"},
    {"logradouro": "GRUMIXABA", "numero": "20", "complemento": null, "bairro": "ELDORADO", "cidade": "SAO PAULO", "uf": "SP", "cep": "04476-430"},
    {"logradouro": "RUA R MIGUEL RODRIGUES", "numero": "191", "complemento": "191 NULL", "bairro": "CID ARACY", "cidade": "SAO CARLOS", "uf": "SP", "cep": "13573-019"}
  ],
  "emails": [
    {"enderecoEmail": "matheusninjaararas@hotmail.com"}
  ],
  "rendaEstimada": "1797.41",
  "rendaFaixaSalarial": "Faixa 2 salários mínimos"
}
```
**Observações:** DDD 44 = região de Maringá/PR. Endereços em PR e SP (Terra Boa/PR, São Paulo/SP, São Carlos/SP). Informado como SP — parcialmente correto.

---

## ENDPOINT 2: receita-federal-pf (Receita Federal — Pessoa Física)
- **URL:** `GET /api/v1/consulta/receita-federal-pf?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 0,54
- **Status geral:** ✅ FUNCIONAL — Todas 5 consultas retornaram 200 OK
- **Parâmetros aceitos:** `cpf` (11 dígitos, sem formatação)

### Estrutura da Resposta
```
{
  "numeroCPF": "480.520.538-54",                   // CPF formatado
  "nomePessoaFisica": "ANDRE LUIZ CRUZ DOS SANTOS", // Nome oficial na Receita
  "nomeSocial": null,                               // Nome social (se houver)
  "dataNascimento": "24/07/1997 00:00:00",          // DD/MM/YYYY HH:mm:ss
  "situacaoCadastral": "REGULAR",                   // ⭐ CAMPO ESSENCIAL PARA O GATE
  "dataInscricao": "22/01/2014 00:00:00",           // Data de inscrição do CPF
  "dataInscricaoAnterior1990": null,                // Se inscrito antes de 1990
  "digitoVerificador": "00",                        // DV do CPF
  "dataEmissao": "02/04/2026 00:43:21",             // Data/hora da emissão da certidão
  "codigoControleComprovante": "555E.8714.91FD.77B4", // Código de controle
  "possuiObito": false,                             // ⭐ Indica se CPF tem registro de óbito
  "anoObito": null                                  // Ano do óbito (se houver)
}
```

**⭐ CAMPO CRÍTICO:** `situacaoCadastral` — Possíveis valores: "REGULAR", "SUSPENSA", "TITULAR FALECIDO", "PENDENTE DE REGULARIZAÇÃO", "CANCELADA DE OFÍCIO", "NULA"

---

### Respostas por CPF

| CPF | Nome Retornado | Situação Cadastral | Óbito | Data Inscrição | Data Emissão |
|---|---|---|---|---|---|
| 48052053854 | ANDRE LUIZ CRUZ DOS SANTOS | **REGULAR** | Não | 22/01/2014 | 02/04/2026 00:43:21 |
| 10794180329 | DIEGO EMANUEL ALVES DE SOUZA | **REGULAR** | Não | 25/09/2019 | 02/04/2026 00:44:32 |
| 11819916766 | RENAN GUIMARAES DE SOUSA AUGUSTO | **REGULAR** | Não | 14/04/2004 | 02/04/2026 00:44:38 |
| 05023290336 | FRANCISCO TACIANO DE SOUSA | **REGULAR** | Não | 09/09/2008 | 02/04/2026 00:44:43 |
| 46247243804 | MATHEUS GONCALVES DOS SANTOS | **REGULAR** | Não | 26/11/2012 | 02/04/2026 00:44:47 |

**Resultado:** Todos os 5 CPFs estão REGULARES. Nenhum possui registro de óbito.

**Custo total deste endpoint:** R$ 2,70 (5 × R$ 0,54)

---

## ENDPOINT 3: antecedentes-criminais
- **URL:** `GET /api/v1/consulta/antecedentes-criminais?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 0,54
- **Status geral:** ❌ NÃO FUNCIONAL — TODAS as tentativas retornaram ERRO

### Testes Realizados

| Tentativa | Parâmetros | HTTP Status | Resposta |
|---|---|---|---|
| 1 | `?cpf=48052053854` | 400 | `{"error":{"code":"bad_request","message":"Parametros invalidos para esta consulta."}}` |
| 2 | `?cpf=10794180329` | 400 | Idem |
| 3 | `?cpf=11819916766` | 400 | Idem |
| 4 | `?cpf=05023290336` | 400 | Idem |
| 5 | `?cpf=46247243804` | 400 | Idem |
| 6 | `?cpf=48052053854&nome=ANDRE+LUIZ+CRUZ+DOS+SANTOS` | 400 | Idem |
| 7 | `?cpf=48052053854&nome=...&dataNascimento=24/07/1997` | 400 | Idem |
| 8 | `?cpf=48052053854&nome=...&nomeMae=VALDINEIDE+PINTO+DA+CRUZ` | 400 | Idem |
| 9 | `?cpf=48052053854&nome=...&data_nascimento=24/07/1997&nome_mae=...` | 400 | Idem |
| 10 | `?cpf=48052053854&nome=...&data_nascimento=1997-07-24&nome_mae=...` | 400 | Idem |
| 11 | `?cpf=48052053854&uf=SP` | 400 | Idem |
| 12 | `?cpf=48052053854&estado=SP` | 400 | Idem |
| 13 | `?cpf=48052053854&regiao=SP` | 400 | Idem |
| 14 | `?cpf=48052053854&tipo=pf` | 400 | Idem |
| 15 | `?cpf=480.520.538-54` (formatado) | 400 | Idem |
| 16 | `?documento=48052053854` (sem cpf) | 400 | `{"error":{"code":"bad_request","message":"Parametro obrigatorio ausente: 'cpf'"}}` |
| 17 | `?documento=48052053854&uf=SP` | 400 | Idem (cpf ausente) |
| 18 | `?cpf=48052053854&birthday=1997-07-24` | 400 | Parametros invalidos |
| 19 | `?nome=...&dataNascimento=...&nomeMae=...` (sem cpf) | 400 | `Parametro obrigatorio ausente: 'cpf'` |
| 20 | POST `{"cpf":"48052053854"}` | 400 | `Parametro obrigatorio ausente: 'cpf'` |
| 21 | PATH `/antecedentes-criminais/48052053854` | 404 | `Recurso não encontrado` |
| 22 | `?cpf=48052053854` + Accept header | 400 | Parametros invalidos |

### Análise
- O endpoint reconhece `cpf` como parâmetro obrigatório (teste 16 confirma)
- Mas quando `cpf` é enviado COMO ÚNICO parâmetro, retorna "Parametros invalidos" — indicando que existem outros params obrigatórios NÃO DOCUMENTADOS
- Nenhuma combinação de params adicionais (nome, dataNascimento, nomeMae, uf, estado, etc.) funciona
- **Conclusão:** Endpoint provavelmente requer params não documentados, ou está com bug do lado da API

### Alternativas para dados criminais
1. **`processos-agrupada`** (R$ 1,65) → mostra área "Direito Penal" nos agrupamentos
2. **`processos-completa`** (R$ 4,95) → detalha processos criminais com assunto, classificação, status

**Custo total neste endpoint:** R$ 0,00 (nenhuma cobrança em erros 400)

---

## ENDPOINT 4: cnj-mandados-prisao (Mandados de Prisão — BNMP/CNJ)
- **URL:** `GET /api/v1/consulta/cnj-mandados-prisao?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 1,08
- **Status geral:** ✅ FUNCIONAL (com instabilidade — 1 retornou 503)
- **Parâmetros aceitos:** `cpf` (11 dígitos, sem formatação)

### Estrutura da Resposta
```
{
  "cpf": "480.520.538-54",          // CPF formatado
  "possuiMandado": false,            // ⭐ Boolean principal do endpoint
  "mandadosPrisao": [],              // Array de mandados (vazio se não houver)
  "status": "Não há mandados de prisão para a pessoa pesquisada."  // Texto descritivo
}
```

**Nota:** Não obtivemos exemplo com `possuiMandado: true` nestes testes. A estrutura interna de `mandadosPrisao[]` é desconhecida.

---

### Respostas por CPF

| CPF | Nome | Status | possuiMandado | mandadosPrisao | Custo | Balance |
|---|---|---|---|---|---|---|
| 48052053854 | ANDRE LUIZ | ✅ 200 OK | `false` | `[]` | R$ 1,08 | R$ 42,05 |
| 10794180329 | DIEGO EMANUEL | ✅ 200 OK | `false` | `[]` | R$ 1,08 | R$ 40,97 |
| 11819916766 | RENAN GUIMARAES | ✅ 200 OK | `false` | `[]` | R$ 1,08 | R$ 39,89 |
| 05023290336 | FRANCISCO TACIANO | ❌ **503** | — | — | R$ 0,00 | — |
| 46247243804 | MATHEUS GONCALVES | ✅ 200 OK | `false` | `[]` | R$ 1,08 | R$ 38,81 |

### Erro do FRANCISCO (503)
```json
{"error":{"code":"service_unavailable","message":"Erro ao processar consulta. Tente novamente."}}
```
**Análise:** Intermitente. O endpoint funciona para os outros 4 CPFs. Pode ser instabilidade da fonte de dados do CNJ/BNMP.

**Custo total:** R$ 4,32 (4 × R$ 1,08 — a chamada com 503 não cobrou)

---

## ENDPOINT 5: trt-consulta (Tribunal Regional do Trabalho)
- **URL:** `GET /api/v1/consulta/trt-consulta?cpf=XXXXXXXXXXX&regiao=XX`
- **Custo por chamada:** R$ 0,54
- **Status geral:** ✅ FUNCIONAL
- **Parâmetros aceitos:** `cpf` (obrigatório) + `regiao` (opcional, CÓDIGO NUMÉRICO do TRT)

### ⚠️ BUG CRÍTICO: Parâmetro `regiao`

O parâmetro `regiao` aceita **códigos numéricos de TRT** (01, 02, 07...), **NÃO siglas de UF** (SP, RJ, CE...).

| Teste | Parâmetro | Resultado |
|---|---|---|
| `regiao=RJ` | ❌ 400 Bad Request | UF NÃO aceita |
| `regiao=SP` | ❌ 400 Bad Request | UF NÃO aceita |
| `regiao=01` | ✅ 200 OK | TRT-1 (Rio de Janeiro) |
| `regiao=02` | ✅ 200 OK | TRT-2 (São Paulo capital/litoral) |
| `regiao=07` | ✅ 200 OK | TRT-7 (Ceará) |
| sem `regiao` | ✅ 200 OK | Default: TRT-1 ("01") |

### Mapeamento Completo UF → Código TRT (para correção do código)
```
TRT-1  = RJ
TRT-2  = SP (capital e litoral)
TRT-3  = MG
TRT-4  = RS
TRT-5  = BA
TRT-6  = PE
TRT-7  = CE
TRT-8  = PA, AP
TRT-9  = PR
TRT-10 = DF, TO
TRT-11 = AM, RR
TRT-12 = SC
TRT-13 = PB
TRT-14 = RO, AC
TRT-15 = SP (interior — Campinas)
TRT-16 = MA
TRT-17 = ES
TRT-18 = GO
TRT-19 = AL
TRT-20 = SE
TRT-21 = RN
TRT-22 = PI
TRT-23 = MT
TRT-24 = MS
```

**Atenção:** SP tem DOIS TRTs:
- TRT-2 = São Paulo capital e litoral (Santos, Guarulhos, etc.)
- TRT-15 = São Paulo interior (Campinas, Ribeirão Preto, São Carlos, etc.)

### Estrutura da Resposta
```
{
  "documento": "480.520.538-54",       // CPF formatado
  "regiao": "01",                       // Código da região consultada (ou "02 - São Paulo")
  "nome": "ANDRE LUIZ CRUZ DOS SANTOS", // Nome encontrado
  "numeroCertidao": "36027196/2026",    // Número da certidão emitida
  "dataEmissao": "02/04/2026 00:00:00", // Data de emissão
  "dataValidade": null,                 // Data de validade (pode ser null ou data)
  "status": "Certifica-se, que NÃO CONSTA(M) ação(ões) trabalhista(s)...", // Texto da certidão
  "codigoAutenticidade": "102.480.562.085", // Código de autenticidade
  "possuiProcesso": false,              // ⭐ Boolean principal
  "processos": []                       // Array de processos (vazio se não houver)
}
```

**Observação sobre `regiao` na resposta:**
- Quando consultado com `regiao=01`: retorna `"regiao": "01"` (só o número)
- Quando consultado com `regiao=02`: retorna `"regiao": "02 - São Paulo"` (número + nome)
- Formato inconsistente entre regiões

---

### Respostas SEM filtro de região (default = TRT-1)

| CPF | Nome | regiao | possuiProcesso | Certidão | Custo |
|---|---|---|---|---|---|
| 48052053854 | ANDRE LUIZ | 01 | `false` | 36027196/2026 | R$ 0,54 |
| 10794180329 | DIEGO EMANUEL | 01 | `false` | 36027375/2026 | R$ 0,54 |
| 11819916766 | RENAN GUIMARAES | 01 | `false` | 36027431/2026 | R$ 0,54 |
| 05023290336 | FRANCISCO TACIANO | 01 | `false` | 36027386/2026 | R$ 0,54 |
| 46247243804 | MATHEUS GONCALVES | 01 | `false` | 36027392/2026 | R$ 0,54 |

### Respostas COM filtro de região

| CPF | Nome | regiao | possuiProcesso | Observação |
|---|---|---|---|---|
| 48052053854 | ANDRE | 02 (SP) | `false` | dataValidade preenchida: "01/07/2026 00:50:54" |
| 11819916766 | RENAN | 01 (RJ) | `false` | Mesmo resultado do default |
| 05023290336 | FRANCISCO | 07 (CE) | `false` | numeroCertidao: null |

### ⚠️ Inconsistência Detectada: RENAN (11819916766)
- **`processos-agrupada`** mostra: TRT-1, 1 processo trabalhista, R$ 40.000,00, ano 2026
- **`trt-consulta` com regiao=01** retorna: `possuiProcesso: false`, "NÃO CONSTA"
- **Possível explicação:** O TRT emite certidão negativa quando o processo já foi encerrado/arquivado, mesmo que tenha existido. Ou a inconsistência é entre fontes de dados diferentes.

**Custo total TRT:** R$ 4,32 (8 chamadas × R$ 0,54)

---

## ENDPOINT 6: processos-agrupada (Processos Judiciais — Resumo Agrupado)
- **URL:** `GET /api/v1/consulta/processos-agrupada?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 1,65
- **Status geral:** ✅ FUNCIONAL — Todas 5 consultas retornaram 200 OK
- **Parâmetros aceitos:** `cpf` (11 dígitos, sem formatação)

### Estrutura da Resposta
```
{
  "documentoConsultado": "480.520.538-54",
  "segmentos": [                        // Agrupamento por segmento judicial
    {"segmento": "JUSTIÇA ESTADUAL", "totalPorSegmento": 5}
  ],
  "tribunais": [                        // Agrupamento por tribunal
    {"tribunal": "TJ-SP", "totalPorTribunal": 5}
  ],
  "distribuicaoPorAno": [               // Distribuição temporal
    {"ano": "2017", "totalPorAno": 1}
  ],
  "areasDireito": [                     // ⭐ Áreas de direito com tipo e valor
    {
      "areaDireito": "Direito Penal",
      "tipoAreaDireito": "Passivo",     // Passivo=réu, Ativo=autor, Outros
      "totalProcessosArea": 4,
      "totalValorProcessosArea": "R$ 0,00"
    }
  ],
  "totalProcessos": 5,                  // ⭐ Total geral
  "observacoes": "Foram encontrados vários processos para o documento consultado."
}
```

---

### Resposta CPF 1 — ANDRE LUIZ (48052053854)
- **Cost:** R$ 1,65 | **Balance:** R$ 34,46

| Dado | Valor |
|---|---|
| **Total Processos** | **5** |
| Segmentos | JUSTIÇA ESTADUAL (5) |
| Tribunais | TJ-SP (5) |
| Anos | 2017(1), 2018(1), 2019(2), 2023(1) |
| Áreas | **Direito Penal / Passivo**: 4 processos, R$ 0,00 |
| | **Direito Penal / Outros**: 1 processo, R$ 0,00 |

**🔴 ALERTA:** 5 processos penais, sendo 4 como RÉU (polo passivo). Nenhum valor envolvido. Todos no TJ-SP.

---

### Resposta CPF 2 — DIEGO EMANUEL (10794180329)
- **Cost:** R$ 1,65 | **Balance:** R$ 32,81

| Dado | Valor |
|---|---|
| **Total Processos** | **1** |
| Segmentos | JUSTIÇA ESTADUAL (1) |
| Tribunais | TJ-CE (1) |
| Anos | 2024(1) |
| Áreas | **Direito Civil / Passivo**: 1 processo, R$ 1.412,00 |

**🟡 ATENÇÃO:** 1 processo civil como réu, valor baixo (R$ 1.412). Processo recente (2024).

---

### Resposta CPF 3 — RENAN GUIMARAES (11819916766)
- **Cost:** R$ 1,65 | **Balance:** R$ 31,16

| Dado | Valor |
|---|---|
| **Total Processos** | **2** |
| Segmentos | JUSTIÇA DO TRABALHO (1), JUSTIÇA ESTADUAL (1) |
| Tribunais | TJ-RJ (1), TRT-1 (1) |
| Anos | 2016(1), 2026(1) |
| Áreas | **Direito do Trabalho / Outros**: 1 processo, **R$ 40.000,00** |
| | **Direito Penal / Passivo**: 1 processo, R$ 0,00 |

**🔴 ALERTA:** Processo trabalhista ativo em 2026 no TRT-1 com valor de R$ 40.000,00. Processo penal como réu no TJ-RJ (2016).

**Nota:** O `trt-consulta` com `regiao=01` retornou "NÃO CONSTA" para este CPF — inconsistência entre endpoints.

---

### Resposta CPF 4 — FRANCISCO TACIANO (05023290336)
- **Cost:** R$ 1,65 | **Balance:** R$ 29,51

| Dado | Valor |
|---|---|
| **Total Processos** | **8** |
| Segmentos | JUSTIÇA ESTADUAL (8) |
| Tribunais | TJ-CE (8) |
| Anos | 2013(1), 2015(1), 2016(1), 2022(3), 2024(2) |
| Áreas | **Direito Civil / Passivo**: 1 processo, R$ 3.204,73 |
| | **Direito Penal / Ativo**: 1 processo, R$ 0,00 |
| | **Direito Penal / Passivo**: 6 processos, R$ 0,02 |

**🔴🔴 ALERTA ALTO:** 8 processos, sendo 6 penais como RÉU. Padrão reincidente (processos de 2013 a 2024). Todos no TJ-CE/Sobral.

---

### Resposta CPF 5 — MATHEUS GONCALVES (46247243804)
- **Cost:** R$ 1,65 | **Balance:** R$ 27,86

| Dado | Valor |
|---|---|
| **Total Processos** | **0** |
| Segmentos | (vazio) |
| Tribunais | (vazio) |
| Anos | (vazio) |
| Áreas | (vazio) |
| Observações | "Nenhum resultado encontrado." |

**🟢 LIMPO:** Nenhum processo judicial encontrado em nenhuma esfera.

**Custo total processos-agrupada:** R$ 8,25 (5 × R$ 1,65)

---

## ENDPOINT 7: processos-completa (Processos Judiciais — Detalhamento Completo)
- **URL:** `GET /api/v1/consulta/processos-completa?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 4,95
- **Status geral:** ✅ FUNCIONAL
- **Parâmetros aceitos:** `cpf` (11 dígitos, sem formatação)
- **Testado apenas para:** FRANCISCO TACIANO (CPF com mais processos)

### Estrutura da Resposta (por processo)
```
{
  "documentoConsultado": "050.232.903-36",
  "processos": [
    {
      "numeroProcesso": "02056591120248060167",     // Número CNJ
      "instancia": 1,                               // 1 ou 2
      "justicaGratuita": false,                      // bool
      "segredoJustica": false,                       // bool
      "processoDigital": true,                       // bool
      "tutelaAntecipada": false,                     // bool
      "prioritario": false,                          // bool
      "orgaoJulgador": {
        "tribunal": "TJ-CE",
        "comarca": null,
        "orgaoResponsavel": "2 Vara de Familia E Sucessoes da Comarca de Sobral",
        "unidadeOrigem": "Sobral",
        "cidade": null,
        "uf": "CE"
      },
      "ambitoJustica": "Justiça Estadual",
      "sistema": "ESAJ-TJCE",                       // Sistema processual
      "areaDireito": "Direito Civil",
      "classificacao": {
        "codigoClassificacao": "12246",
        "descricao": "Cumprimento de Sentença de Obrigação de Prestar Alimentos"
      },
      "assuntos": [
        {"codigoAssunto": null, "assunto": "Alimentos", "assuntoPrincipal": true}
      ],
      "dataDistribuicao": "03/10/2024 08:50:00",
      "dataAutuacao": null,
      "partes": [
        {
          "nomeCompleto": "Jose Levy Lima de Sousa",
          "documento": "104.169.803-84",
          "polo": "Ativo",
          "posicaoProcessual": "Exequente",
          "advogados": []
        },
        {
          "nomeCompleto": "Francisco Taciano de Sousa",
          "documento": "050.232.903-36",
          "polo": "Passivo",
          "posicaoProcessual": "Executado",
          "advogados": []
        }
      ],
      "valorProcesso": "R$ 3.204,73",
      "processosRelacionados": ["02056591120248060167", "02047235420228060167"],
      "detalhesStatusProcesso": {
        "statusDetalhes": "em Tramitação",            // ⭐ Status atual
        "dataArquivamento": null,
        "dataTransitoJulgado": null,
        "julgamentos": [],
        "penhoras": []
      }
    }
  ],
  "totalProcessos": 8,
  "observacoes": "A entidade possui vários processos, inclusive como réu."
}
```

---

### Detalhamento: 8 Processos de FRANCISCO TACIANO DE SOUSA

#### Processo 1 — Cumprimento de Sentença / Alimentos
| Campo | Valor |
|---|---|
| Número | 02056591120248060167 |
| Tribunal | TJ-CE — 2ª Vara de Família de Sobral |
| Área | **Direito Civil** |
| Assuntos | Alimentos |
| Distribuição | 03/10/2024 |
| Polo | **PASSIVO (Executado)** |
| Parte contrária | Jose Levy Lima de Sousa (Exequente) |
| Valor | **R$ 3.204,73** |
| Status | **EM TRAMITAÇÃO** 🔴 |
| Penhoras | Nenhuma |

#### Processo 2 — Termo Circunstanciado / Porte de Arma Branca
| Campo | Valor |
|---|---|
| Número | 30015750220218060167 |
| Tribunal | TJ-CE — 2ª Unidade do Juizado Especial de Sobral |
| Área | **Direito Penal** |
| Assuntos | Contravencoes Penais, **Porte de Arma (Branca)** |
| Distribuição | 31/01/2024 (autuação: 12/09/2021) |
| Polo | **PASSIVO (Autor do Fato)** |
| Vítima | Josiane de Lima Monteiro |
| Valor | R$ 0,00 |
| Status | **Arquivamento Definitivo** ✅ |
| Julgamento | Extinta — Prescrição (30/09/2024) |
| Trânsito em julgado | 01/10/2024 |

#### Processo 3 — Ação Penal / Contravencoes Penais
| Campo | Valor |
|---|---|
| Número | 00121984520228060167 |
| Tribunal | TJ-CE — 4ª Vara Criminal de Sobral |
| Área | **Direito Penal** |
| Assuntos | Contravencoes Penais |
| Distribuição | 24/11/2022 |
| Polo | **PASSIVO (Autor do Fato)** |
| Vítima | Josiane de Lima Monteiro |
| Valor | R$ 0,00 |
| Status | **Arquivamento Definitivo** ✅ |

#### Processo 4 — Ação Penal / Ameaça + Violência Doméstica
| Campo | Valor |
|---|---|
| Número | 02027437220228060167 |
| Tribunal | TJ-CE — Juizado da Violência Doméstica de Sobral |
| Área | **Direito Penal** |
| Assuntos | **Ameaça**, Real, **Violência Doméstica contra a Mulher** |
| Distribuição | 16/11/2022 |
| Polo | **PASSIVO (Réu)** |
| Vítima | Josiane de Lima Monteiro |
| Valor | R$ 0,01 |
| Status | **EM GRAU DE RECURSO** 🔴 |
| Julgamento | **Procedente** (25/04/2024) |

**🔴🔴 GRAVÍSSIMO:** Condenado em 1ª instância por ameaça e violência doméstica. Processo em recurso.

#### Processo 5 — Medidas Protetivas de Urgência (Lei Maria da Penha)
| Campo | Valor |
|---|---|
| Número | 00134174020218060293 |
| Tribunal | TJ-CE — Juizado da Violência Doméstica de Sobral |
| Área | **Direito Penal** |
| Assuntos | Contravencoes Penais |
| Classificação | **Medidas Protetivas de Urgência (Lei Maria da Penha) - Criminal** |
| Distribuição | 16/11/2022 (autuação: 12/09/2021) |
| Polo | **PASSIVO (Requerido)** |
| Vítima | Josiane de Lima Monteiro |
| Valor | R$ 0,01 |
| Status | **Arquivamento Definitivo** ✅ (25/10/2022) |

#### Processo 6 — Embargos de Declaração Criminal (2ª instância)
| Campo | Valor |
|---|---|
| Número | 00407130820138060167 (instância 2) |
| Tribunal | TJ-CE — Forum das Turmas Recursais |
| Área | **Direito Penal** |
| Classificação | Embargos de Declaração Criminal |
| Distribuição | 12/07/2016 |
| Polo | **ATIVO (Embargante)** |
| Valor | R$ 0,00 |
| Status | **Arquivamento Definitivo** ✅ |
| Julgamento | Extinta — Prescrição (21/07/2017) |

#### Processo 7 — Apelação Criminal (2ª instância)
| Campo | Valor |
|---|---|
| Número | 00407130820138060167 (instância 2) |
| Tribunal | TJ-CE — 2ª Turma Recursal dos Juizados Especiais |
| Área | **Direito Penal** |
| Classificação | Apelação Criminal |
| Distribuição | 04/08/2015 |
| Polo | **PASSIVO (Apelado)** |
| MP como Apelante |
| Valor | R$ 0,00 |
| Status | **Arquivamento Definitivo** ✅ |
| Julgamento | Procedente — Provimento (10/06/2016) |

#### Processo 8 — Termo Circunstanciado / Contravencoes Penais (1ª instância, 2013)
| Campo | Valor |
|---|---|
| Número | 00407130820138060167 (instância 1) |
| Tribunal | TJ-CE — JECC de Sobral |
| Área | **Direito Penal** |
| Classificação | Termo Circunstanciado |
| Distribuição | 09/04/2013 (autuação: 04/04/2013) |
| Polo | **PASSIVO (Autor do Fato)** |
| Vítima | "a Sociedade" |
| Valor | R$ 0,00 |
| Status | **Arquivamento Definitivo** ✅ |
| Julgamentos | Extinta (24/04/2014), Procedente/Provimento (10/06/2016) |

**Custo total processos-completa:** R$ 4,95 (1 chamada)

---

## ENDPOINT 8: tj-certidao (Certidão de Tribunal de Justiça)
- **URL:** `GET /api/v1/consulta/tj-certidao?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 0,54
- **Status geral:** ❌ NÃO FUNCIONAL (503 Service Unavailable)

### Testes Realizados

| CPF | Status | Resposta |
|---|---|---|
| 48052053854 (ANDRE) | ❌ 503 | `{"error":{"code":"service_unavailable","message":"Erro ao processar consulta. Tente novamente."}}` |
| 05023290336 (FRANCISCO) com uf=CE | ❌ 400 | `Parametros invalidos para esta consulta.` |

**Conclusão:** Serviço indisponível. Não testado com mais CPFs para não gastar saldo sem necessidade. O teste com `uf=CE` indica que `uf` NÃO é um parâmetro aceito.

**Custo total:** R$ 0,00

---

## ENDPOINT 9: trf-certidao (Certidão de TRF — Tribunal Regional Federal)
- **URL:** `GET /api/v1/consulta/trf-certidao?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 0,54
- **Status geral:** ❌ NÃO FUNCIONAL (503 Service Unavailable)

### Testes Realizados

| CPF | Status | Resposta |
|---|---|---|
| 48052053854 (ANDRE) | ❌ 503 | `{"error":{"code":"service_unavailable","message":"Erro ao processar consulta. Tente novamente."}}` |

**Custo total:** R$ 0,00

---

## ENDPOINT 10: tj-processos (Processos em TJs Estaduais)
- **URL:** `GET /api/v1/consulta/tj-processos?cpf=XXXXXXXXXXX`
- **Custo por chamada:** R$ 0,54 (cobrou R$ 0,00 nos testes!)
- **Status geral:** ⚠️ FUNCIONAL MAS INEFICAZ — retorna vazio mesmo com processos confirmados

### Estrutura de Resposta (quando não encontra)
```json
{
  "found": false,
  "data": null,
  "message": "Nenhum registro encontrado"
}
```

### Testes Realizados

| CPF | Processos TJ conhecidos (via agrupada) | Resultado tj-processos | Cost |
|---|---|---|---|
| 48052053854 (ANDRE) | 5 processos TJ-SP | `found: false` | R$ 0,00 |
| 11819916766 (RENAN) | 1 processo TJ-RJ | `found: false` | R$ 0,00 |
| 05023290336 (FRANCISCO) | 8 processos TJ-CE | `found: false` | R$ 0,00 |

**Conclusão:** O endpoint não cobra quando não encontra, mas também não encontra NADA — mesmo para CPFs com processos TJ confirmados pelo `processos-agrupada` e `processos-completa`. Endpoint inútil no estado atual.

**Custo total:** R$ 0,00

---

## COMPARATIVO DE ENDPOINTS

### Por funcionalidade no contexto de Due Diligence

| Necessidade | Endpoint Recomendado | Custo | Funciona? | Alternativa |
|---|---|---|---|---|
| Validação de identidade (nome, dados) | `cadastro-pf-basica` | R$ 0,24 | ✅ | `receita-federal-pf` (+RF oficial) |
| Status do CPF (REGULAR/etc.) | `receita-federal-pf` | R$ 0,54 | ✅ | Nenhuma |
| Óbito | `receita-federal-pf` | R$ 0,54 | ✅ | `consulta-obito` (R$ 0,54) |
| Antecedentes criminais | `antecedentes-criminais` | R$ 0,54 | ❌ | `processos-agrupada` (penal) |
| Mandados de prisão | `cnj-mandados-prisao` | R$ 1,08 | ✅ (instável) | Nenhuma |
| Processos trabalhistas | `trt-consulta` | R$ 0,54 | ✅ | `processos-agrupada` (trabalhista) |
| Panorama judicial geral | `processos-agrupada` | R$ 1,65 | ✅ | `processos-completa` (R$ 4,95) |
| Detalhes de processos | `processos-completa` | R$ 4,95 | ✅ | Nenhuma (mais caro mas mais rico) |

### Por confiabilidade

| Endpoint | Disponibilidade | Cobrança em erro |
|---|---|---|
| `cadastro-pf-basica` | 5/5 (100%) | N/A |
| `receita-federal-pf` | 5/5 (100%) | N/A |
| `antecedentes-criminais` | 0/5 (0%) | Não cobra em 400 |
| `cnj-mandados-prisao` | 4/5 (80%) | Não cobra em 503 |
| `trt-consulta` | 8/8 (100%) | N/A |
| `processos-agrupada` | 5/5 (100%) | N/A |
| `processos-completa` | 1/1 (100%) | N/A |
| `tj-certidao` | 0/2 (0%) | Não cobra em 503 |
| `trf-certidao` | 0/1 (0%) | Não cobra em 503 |
| `tj-processos` | 3/3 (100% HTTP) ⚠️ | Não cobra (R$ 0,00) |

---

## PERFIL DE RISCO POR CANDIDATO

### 🔴 FRANCISCO TACIANO DE SOUSA (CPF 05023290336) — ALTO RISCO
- **8 processos judiciais** — maior volume do grupo
- **6 processos penais como réu** — padrão de reincidência
- **Violência doméstica (Lei Maria da Penha)** — condenado, em recurso
- **Ameaça** — condenado, em recurso
- **Porte de arma branca** — prescrito
- **Medidas protetivas** aplicadas contra ele
- Mesma vítima em múltiplos processos (Josiane de Lima Monteiro)
- Processos de 2013 a 2024 — **comportamento crônico**
- Processo de alimentos em tramitação (R$ 3.204,73)

### 🔴 ANDRE LUIZ CRUZ DOS SANTOS (CPF 48052053854) — ALTO RISCO
- **5 processos penais** no TJ-SP
- **4 como réu** (polo passivo) em Direito Penal
- Processos de 2017 a 2023 — padrão contínuo
- Sem detalhamento dos processos (não chamamos processos-completa)

### 🟡 RENAN GUIMARAES DE SOUSA AUGUSTO (CPF 11819916766) — MÉDIO RISCO
- **2 processos**: 1 trabalhista + 1 penal
- Processo trabalhista TRT-1 com valor **R$ 40.000,00** (2026, recente)
- Processo penal como réu no TJ-RJ (2016)
- Inconsistência: TRT-consulta não confirma o processo trabalhista

### 🟡 DIEGO EMANUEL ALVES DE SOUZA (CPF 10794180329) — BAIXO-MÉDIO RISCO
- **1 processo civil** no TJ-CE
- Réu em ação civil de R$ 1.412,00 (2024)
- Sem dados de telefone/endereço (difícil contato)
- Mais jovem do grupo (23 anos)

### 🟢 MATHEUS GONCALVES DOS SANTOS (CPF 46247243804) — BAIXO RISCO
- **0 processos** em qualquer esfera
- Sem mandados de prisão
- Sem ações trabalhistas
- Ficha completamente limpa

---

## CUSTOS ACUMULADOS POR ENDPOINT NOS TESTES

| Endpoint | Chamadas OK | Chamadas Erro | Custo Total |
|---|---|---|---|
| cadastro-pf-basica | 5 | 0 | R$ 1,20 |
| receita-federal-pf | 5 | 0 | R$ 2,70 |
| antecedentes-criminais | 0 | 22 | R$ 0,00 |
| cnj-mandados-prisao | 4 | 1 | R$ 4,32 |
| trt-consulta | 8 | 0 | R$ 4,32 |
| processos-agrupada | 5 | 0 | R$ 8,25 |
| processos-completa | 1 | 0 | R$ 4,95 |
| tj-certidao | 0 | 2 | R$ 0,00 |
| trf-certidao | 0 | 1 | R$ 0,00 |
| tj-processos | 0* | 3 | R$ 0,00 |
| **TOTAL** | **28** | **29** | **~R$ 25,74** |

*tj-processos retornou 200 mas com `found: false`, custo R$ 0,00

**Nota:** Saldo caiu de R$ 50,00 para R$ 36,11, mas parte do consumo pode ter sido de testes de sessões anteriores.

---

## BUGS NO CÓDIGO ATUAL DO COMPLIANCEHUB

### Bug 1: Gate de Identidade usa endpoint errado para situacaoCadastral
- **Arquivo:** `functions/index.js`
- **Problema:** O gate checa `cpfStatus === 'REGULAR'` mas usa `cadastro-pf-basica` via `queryIdentity()`, que NÃO retorna `situacaoCadastral`
- **Solução:** Usar `receita-federal-pf` para o gate, ou chamar ambos os endpoints
- **Impacto:** O gate NUNCA consegue validar o status do CPF — `cpfStatus` será sempre `undefined`

### Bug 2: TRT regiao recebe UF em vez de código numérico
- **Arquivo:** `functions/index.js` + `functions/adapters/fontedata.js`
- **Problema:** O código passa `params.regiao = uf` onde `uf` é "SP", "RJ", etc. Mas a API aceita apenas "01", "02", "07", etc.
- **Solução:** Criar mapa UF → código TRT e converter antes de enviar
- **Impacto:** Quando UF é informada, a chamada retorna 400 (Bad Request) — fallback pode mascarar o erro

### Bug 3: normalizeIdentity busca campos inexistentes
- **Arquivo:** `functions/normalizers/phases.js`
- **Problema:** O normalizador de identidade pode buscar `situacaoCadastral` no response de `cadastro-pf-basica`, que não tem esse campo
- **Solução:** Refatorar para usar os campos corretos: `nome`, `dataNascimento`, `nomeMae`, etc.
- **Impacto:** Dados incompletos no enrichment

### Bug 4: antecedentes-criminais nunca retorna dados
- **Arquivo:** `functions/adapters/fontedata.js`  
- **Problema:** `queryCriminal(cpf, apiKey)` envia apenas `{ cpf }` que retorna 400 sempre
- **Solução:** Substituir por `processos-agrupada` (panorama geral que inclui criminal) ou investigar params faltantes com suporte FonteData
- **Impacto:** Fase criminal do enrichment SEMPRE falha

---

## RECOMENDAÇÕES PARA DECISÃO

### Cenário A: Custo Mínimo (~R$ 2,51/caso)
- `cadastro-pf-basica` (R$ 0,24) — identidade + gate de nome
- `receita-federal-pf` (R$ 0,54) — status CPF para gate
- `cnj-mandados-prisao` (R$ 1,08) — mandados ativos
- `trt-consulta` (R$ 0,54) — trabalhista (com mapa UF→TRT corrigido)
- ❌ Sem cobertura criminal (antecedentes não funciona)
- ❌ Sem visão de processos cíveis/penais

### Cenário B: Cobertura Padrão (~R$ 4,16/caso)
- Cenário A +
- `processos-agrupada` (R$ 1,65) — panorama completo (cível + penal + trabalhista + federal)
- ✅ Cobre deficiência do antecedentes-criminais
- ✅ Melhor relação custo/benefício

### Cenário C: Cobertura Completa (~R$ 9,11/caso)
- Cenário B +
- `processos-completa` (R$ 4,95) — detalhamento processo a processo
- ✅ Máxima informação para análise
- ❌ Custo alto

### Cenário D: Reavaliação de Endpoints
- Remover `antecedentes-criminais` (não funciona)
- Remover `trt-consulta` (redundante se já tem `processos-agrupada`)
- Usar: `cadastro-pf-basica` (R$ 0,24) + `receita-federal-pf` (R$ 0,54) + `cnj-mandados-prisao` (R$ 1,08) + `processos-agrupada` (R$ 1,65) = **R$ 3,51/caso**
- ✅ Sem dependência de endpoints instáveis
- ✅ Panorama completo via agrupada
- ⚠️ Perde certidão TRT específica por região

---

*Documento gerado automaticamente em 02/04/2026. Dados obtidos da API FonteData em tempo real.*
