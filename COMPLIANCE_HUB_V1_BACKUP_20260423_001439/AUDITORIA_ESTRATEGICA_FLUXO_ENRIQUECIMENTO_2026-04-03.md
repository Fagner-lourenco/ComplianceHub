# Auditoria Estratégica do Fluxo de Enriquecimento

**Data:** 2026-04-03  
**Projeto:** ComplianceHub  
**Objetivo:** avaliar se o fluxo atual maximiza cobertura útil com custo e latência controlados, sem perder sinais relevantes de risco.

---

## 1. Veredito Executivo

**Conclusão curta:** a estratégia atual está **boa, moderna e economicamente mais inteligente** do que a estratégia histórica descrita nos MDs antigos, mas **ainda não é a melhor estratégia possível** para o objetivo de equilíbrio com redução agressiva de custo sem perda relevante de sinal.

### Veredito final

- **Manter** a base atual `Judit-first`, com `lawsuits` síncrono em datalake por padrão.
- **Manter** `warrant` e `execution` da Judit sempre ativos e assíncronos com callback.
- **Manter** a decisão de **não usar filtro de tribunal por padrão**.
- **Manter** FonteData fora do fluxo automático principal.
- **Ajustar** a lógica de acionamento do Escavador.
- **Ajustar** a modelagem de homônimos e de “negativo suspeito”.
- **Ajustar** o suplemento por nome da Judit, que hoje existe mas não está plenamente ancorado em dado real de ruído.

### Julgamento estratégico

Hoje o sistema está em um ponto intermediário:

- **Melhor que o desenho histórico multi-provider fixo**, porque:
  - reduz custo;
  - reduz latência;
  - elimina dependência excessiva da FonteData;
  - usa o que a Judit tem de mais exclusivo e confiável para compliance.
- **Ainda abaixo do ótimo**, porque:
  - pode deixar passar casos “negativos demais” quando a Judit subcobre e o Escavador não é acionado;
  - ainda não formaliza um safety net barato para falsos negativos;
  - ainda não transforma o risco de homônimo em decisão operacional consistente.

Em termos práticos:

> **A base atual está correta, mas o melhor fluxo default não é “Judit sozinho até aparecer bandeira”. O melhor fluxo é “Judit-first + Escavador seletivo para positivo e para negativo suspeito”.**

---

## 2. Fontes de Verdade Usadas

Esta auditoria foi feita cruzando quatro grupos de evidência:

### Código real

- Orquestração: `functions/index.js`
- Adapters:
  - `functions/adapters/judit.js`
  - `functions/adapters/escavador.js`
  - `functions/adapters/fontedata.js`
- Normalizers:
  - `functions/normalizers/judit.js`
  - `functions/normalizers/escavador.js`

### Documentação empírica interna

- `MATRIZ_RESULTADOS.md`
- `ANALISE_API_ESCAVADOR_JUDIT_2026-04-02.md`
- `ANALISE_API_FONTEDATA_2026-04-02.md`

### Scripts de teste

- `test-apis.cjs`
- `test-apis-advanced.cjs`
- `test-apis-extra.cjs`
- `test-missing-calls.cjs`
- `test-names-missing.cjs`
- `test-names-missing-v2.cjs`

### Resultados brutos

- `results/`
- `results/advanced/`
- `results/missing/`
- `results/names/`

---

## 3. Fluxo Real Implementado Hoje

O fluxo atual implementado **não é mais o fluxo histórico FonteData-first**. Hoje ele é efetivamente **Judit-first**.

### 3.1 Criação do caso

Quando um documento é criado em `cases/{caseId}`, a function principal disparada é:

- `enrichJuditOnCase`

Ela carrega a configuração do tenant via:

- `loadJuditConfig(tenantId)`

Se o tenant não tiver configuração explícita, os defaults são:

- Judit: **enabled true**
- Escavador: **enabled false**
- FonteData: **enabled false**

### 3.2 Gate de identidade

Primeira etapa real:

1. `queryEntityDataLake(cpf, apiKey)`
2. `normalizeJuditEntity(...)`

O gate valida:

- CPF ativo em `revenue_service_active`
- similaridade entre nome retornado e nome do caso

Se a consulta de gate da Judit falhar tecnicamente, entra fallback:

- `queryReceitaFederal(cpf, fdApiKey)`
- `normalizeReceitaFederal(...)`

**Importante:** FonteData hoje entra como fallback de gate, não como fonte primária do fluxo.

### 3.3 Consultas processuais Judit

Se o gate passa:

1. `lawsuits` via sync datalake por padrão
   - `queryLawsuitsSync(cpf, apiKey)`
   - `normalizeJuditLawsuits(...)`
2. em paralelo:
   - `queryWarrantAsync(...)`
   - `queryExecutionAsync(...)`
3. se `lawsuits` por CPF retornar 0:
   - suplemento por nome
   - `queryLawsuitsSyncByName(...)` por padrão

### 3.4 Callback async

`warrant` e `execution` não bloqueiam mais o request principal.

O fluxo atual é:

1. cria request async na Judit;
2. salva `requestId` e mapping em `juditWebhookRequests/{requestId}`;
3. deixa o caso com:
   - `juditPendingAsyncPhases`
   - `juditPendingAsyncCount`
4. quando a Judit envia callback para `juditWebhook`:
   - busca responses;
   - normaliza;
   - atualiza o caso;
   - remove a pendência;
   - reavalia se Escavador precisa rodar;
   - dispara auto-classificação quando a fase assíncrona termina.

### 3.5 Escavador

Escavador **não roda automaticamente em todos os casos**.

Ele roda apenas se:

- `juditNeedsEscavador === true`, ou
- `escavador.alwaysRun === true`

A decisão atual é tomada por:

- `evaluateEscavadorNeed(...)`

Hoje essa função dispara Escavador só quando a Judit detecta:

- criminal positivo;
- warrant positivo;
- execution positiva;
- ou volume alto de processos.

### 3.6 Auto-classificação e IA

Quando Judit assenta, e quando Escavador termina ou é pulado:

1. `computeAutoClassification(...)`
2. `runAutoClassifyAndAi(...)`

A IA é opcional e depende de:

- `tenantSettings.enrichmentConfig.ai.enabled`
- orçamento mensal, se configurado

### 3.7 Fluxo manual residual

FonteData ainda existe em backend, mas hoje:

- não dispara na criação do caso;
- continua disponível para rerun manual via `rerunEnrichmentPhase`;
- ainda é útil como fallback e como ferramenta operacional.

---

## 4. Estado Multi-tenant Real

### `techcorp-inc`

Configuração observada:

- Judit: enabled
- Escavador: enabled
- FonteData: sem override
- AI: enabled
- gate.minNameSimilarity: `0.7`
- Judit:
  - `entity: true`
  - `lawsuits: true`
  - `warrant: true`
  - `execution: true`
  - `filters.useAsync: false`
- Escavador:
  - `processos: true`
  - `filters.incluirHomonimos: true`

Na prática:

- usa Judit-first;
- usa Escavador condicional;
- não usa FonteData automaticamente.

### `madero-br`

Configuração observada:

- sem overrides explícitos

Na prática, pelos defaults:

- Judit: enabled
- Escavador: disabled
- FonteData: disabled
- AI: disabled

**Impacto estratégico importante:** o tenant `madero-br` hoje roda um fluxo muito mais “Judit-only” que `techcorp-inc`. Isso reduz custo, mas aumenta risco de subcobertura em tenants com exigência de compliance mais forte.

---

## 5. Scorecard Estratégico por Provider

## 5.1 Judit

### Pontos fortes

- melhor base default para fluxo econômico;
- `entity` barato para gate;
- `lawsuits` sync rápido e previsível;
- `warrant` é indispensável;
- `execution` tem dado penal exclusivo;
- `parties[].person_type` é um diferencial forte:
  - `TESTEMUNHA`
  - `REU`
  - `AVERIGUADO`
  - `AUTORIDADE POLICIAL`
  - `VÍTIMA`
- bom valor para interpretação qualitativa de risco;
- bom para papel processual e mandado.

### Pontos fracos

- cobertura processual por CPF é inconsistente;
- pode subcobrir civil, alimentícia e parte do criminal;
- busca por nome é fraca/inconsistente em alguns casos;
- callback async depende de latência externa do provider;
- `possible_homonym` não apareceu como mecanismo confiável nos testes;
- já houve divergência de shape de resposta entre teste real e parsing do adapter.

### Julgamento

**Manter como fonte primária do fluxo.**

Não porque seja completa, mas porque é a melhor combinação de:

- custo;
- latência;
- valor exclusivo;
- robustez de decisão.

## 5.2 Escavador

### Pontos fortes

- cobre lacunas importantes da Judit;
- tem melhor cobertura por nome;
- expõe `cpfs_com_esse_nome`, que é um sinal crítico de homônimo;
- dá visão mais rica de partes e papéis em muitos processos;
- mostrou muito valor em casos em que CPF não estava bem indexado;
- é barato por consulta no contexto do projeto.

### Pontos fracos

- muito ruído quando entra homônimo massivo;
- busca por nome em nomes comuns é quase inutilizável sem controle de ruído;
- não tem mandado;
- não substitui Judit para compliance penal fino.

### Julgamento

**Não deve virar provider primário universal**, mas **deve ser reforçado como safety net seletivo**.

Hoje ele está subutilizado para falsos negativos.

## 5.3 FonteData

### Pontos fortes

- `receita-federal-pf` é um fallback forte de gate;
- dados cadastrais ainda têm valor operacional;
- em alguns cenários detectou processos que ninguém mais detectou;
- útil como ferramenta de confirmação manual.

### Pontos fracos

- `antecedentes-criminais` é inutilizável;
- `cnj-mandados-prisao` mostrou instabilidade;
- `trt-consulta` tem fragilidade e semântica complicada;
- vários endpoints têm custo relativamente alto para valor marginal;
- manter no fluxo fixo eleva custo sem garantir superioridade.

### Julgamento

**Correta a remoção do fluxo automático principal.**  
**Errado removê-lo mentalmente da estratégia.**

FonteData ainda tem valor como:

- fallback de identidade;
- fallback processual direcionado;
- ferramenta manual de investigação.

---

## 6. Evidência por Cenário Obrigatório

## 6.1 André

### O que os testes mostraram

- FonteData encontrou processos penais relevantes.
- Escavador por CPF retornou 0.
- Escavador com homônimos e por nome trouxe muitos resultados contaminados.
- Judit por CPF retornou 0.

### O que o código atual faria

- Gate passaria.
- `lawsuits` da Judit retornaria 0.
- `warrant/execution` tenderiam negativo.
- suplemento por nome da Judit poderia rodar.
- Escavador **não seria acionado**, porque `evaluateEscavadorNeed` depende de flag positiva ou volume alto na Judit.

### Julgamento

Este é o principal caso que mostra que a estratégia atual **ainda não é ótima**.

O fluxo atual é econômico, mas **não protege bem contra negativo suspeito** quando:

- Judit cobre pouco;
- Escavador poderia trazer algo útil;
- e FonteData historicamente já mostrou blind spot relevante.

### Decisão recomendada

Adicionar um gatilho de safety net para Escavador em cenário:

- Judit negativo;
- caso com algum indício de risco estrutural;
- ou CPF com histórico de subcobertura conhecida.

## 6.2 Diego

### O que os testes mostraram

- Escavador encontrou 1 processo cível.
- FonteData também encontrou.
- Judit não encontrou.

### O que o código atual faria

- Judit possivelmente fecharia como 0 processos.
- Escavador não rodaria.

### Julgamento

Para risco criminal/mandado, isso não é gravíssimo.  
Para completude do caso e valor operacional, é subcobertura.

### Decisão recomendada

Não justifica ligar provider caro fixo, mas reforça a necessidade de:

- distinguir “negativo limpo” de “negativo com baixa cobertura provável”.

## 6.3 Renan

### O que os testes mostraram

- Judit foi valioso porque classificou Renan como `TESTEMUNHA`.
- Escavador e FonteData não entregaram a mesma nuance.
- houve divergência entre fontes para trabalhista/penal.

### O que o código atual faz bem

- aproveita `person_type` da Judit;
- melhora muito a interpretação do risco;
- evita falso positivo simplista.

### Julgamento

Este caso valida fortemente a decisão de manter Judit como eixo principal.

## 6.4 Francisco

### O que os testes mostraram

- Escavador trouxe 7 processos.
- Judit trouxe 1 processo criminal muito relevante.
- Judit trouxe 1 mandado ativo crítico.
- execução penal veio 0.

### O que o código atual faz

- Judit detecta processo + warrant;
- Escavador é acionado porque há sinal positivo claro;
- a combinação final fica forte.

### Julgamento

Este é o melhor exemplo de que:

- Judit precisa ser primário;
- warrant precisa ser obrigatório;
- Escavador funciona muito bem como cross-validation seletivo.

## 6.5 Matheus

### O que os testes mostraram

- Judit encontrou investigação relevante com `AVERIGUADO` e `VÍTIMA`.
- Escavador por CPF retornou 0.
- FonteData retornou 0.

### O que o código atual faz bem

- heurística no normalizer da Judit já tenta tratar esse tipo de caso como criminal;
- a decisão de usar Judit como primário protege contra falso negativo que os outros providers não cobrem.

### Julgamento

Este caso reforça que **não faz sentido voltar para FonteData-first**.

---

## 7. Gaps Reais Encontrados

## 7.1 Gap 1 — Escavador só roda para positivo, não para negativo suspeito

### Estado atual

`evaluateEscavadorNeed()` só aciona quando a própria Judit já apontou:

- criminal;
- warrant;
- execution;
- ou alto volume.

### Problema

Se a Judit subcobrir e vier limpa, o Escavador pode nunca rodar.

### Impacto

- risco de falso negativo;
- casos como André e Diego ficam subprotegidos;
- o custo cai, mas talvez demais.

### Julgamento

**Esse é o principal ajuste necessário para chegar à melhor estratégia.**

## 7.2 Gap 2 — Controle de homônimos da Judit por nome não está plenamente ancorado

### Estado atual

O código tenta decidir o suplemento por nome com base em:

- `nameSearchSupplement.maxCpfsComNome`

Mas o valor consultado é:

- `gateEntityData?.juditIdentity?.cpfsComNome`

E `normalizeJuditEntity()` hoje **não expõe `cpfsComNome`**.

### Problema

Na prática, `entityHomonymCount` tende a ficar `null`, e o código considera `null` como permissivo para buscar por nome.

### Impacto

- o suplemento por nome pode rodar sem um controle de ruído realmente informado;
- isso enfraquece a política configurável de homônimos.

### Julgamento

**Falha real de estratégia implementada.**

## 7.3 Gap 3 — Risco de homônimo do Escavador não entra forte na classificação final

### Estado atual

A classificação usa:

- `juditHomonymFlag`

Mas o sinal de homônimo mais forte observado empiricamente vem do Escavador:

- `cpfs_com_esse_nome`

### Problema

O modelo de classificação não transforma esse sinal em:

- inconclusivo;
- revisão obrigatória;
- ou baixa confiança estrutural.

### Impacto

- o sistema entende bem o positivo bruto;
- mas ainda entende mal a confiabilidade do match.

### Julgamento

**Gap importante de robustez operacional.**

## 7.4 Gap 4 — FonteData saiu do fluxo principal corretamente, mas o fallback processual ainda não foi redesenhado

### Estado atual

FonteData só entra:

- como fallback de gate;
- como rerun manual.

### Problema

O pipeline ficou mais barato e coerente, mas perdeu um fallback automático pontual para blind spots conhecidos.

### Julgamento

**Não recomendo reativar FonteData no fluxo completo.**  
**Recomendo decidir se vale um fallback processual direcionado.**

---

## 8. O Que Manter, Ajustar ou Reverter

## 8.1 Manter

- Judit como provider primário.
- `entity` da Judit como gate primário, com fallback para Receita Federal.
- `lawsuits` sync datalake como default.
- `warrant` e `execution` sempre ligados.
- callback async em vez de polling bloqueante.
- ausência de filtro de tribunal por padrão.
- IA só depois de settlement das fontes.
- FonteData fora do fluxo automático fixo.

## 8.2 Ajustar

- disparo do Escavador;
- política de negativo suspeito;
- modelagem de homônimos;
- suplemento por nome da Judit;
- definição de “cobertura insuficiente” para fallback.

## 8.3 Não reverter

Não recomendo:

- voltar para FonteData-first;
- rodar todos os providers em todos os casos;
- ligar async/on-demand da Judit por padrão;
- usar filtro de tribunal na busca padrão;
- usar busca por nome como etapa ampla e precoce.

---

## 9. Estratégia Default Recomendada

### Estratégia recomendada

1. **Gate primário**
   - Judit `entity`
   - fallback Receita Federal apenas se gate Judit falhar

2. **Busca primária**
   - Judit `lawsuits` sync datalake

3. **Sinais críticos obrigatórios**
   - Judit `warrant`
   - Judit `execution`

4. **Sem filtro de tribunal por padrão**

5. **Escavador seletivo em dois caminhos**
   - caminho A: cross-validation de positivo
   - caminho B: safety net de negativo suspeito

6. **Suplemento por nome**
   - só em cenário controlado por ruído
   - com regra real de homônimos

7. **FonteData**
   - fora do fluxo fixo
   - disponível para fallback de identidade
   - fallback processual apenas se a evidência do tenant justificar

8. **IA**
   - somente após o assentamento das fontes relevantes

### Safety net recomendado para “negativo suspeito”

A melhor melhoria de custo-benefício é disparar Escavador quando a Judit vier negativa, mas houver um destes sinais:

- tenant com rigor alto de compliance;
- CPF com baixa confiança de cobertura;
- inconsistência entre identidade/endereço/UF e ausência total de processo;
- histórico de blind spot conhecido do provider;
- necessidade manual do analista;
- cenário em que um falso negativo é mais caro do que uma consulta extra barata.

---

## 10. Backlog Priorizado

## 10.1 Correções obrigatórias

1. Expor `cpfsComNome` ou campo equivalente no gate/identity para que `nameSearchSupplement.maxCpfsComNome` funcione de verdade.
2. Revisar `evaluateEscavadorNeed` para incluir safety net de negativo suspeito.
3. Levar sinal de homônimo do Escavador para a classificação automática e para a UI operacional.
4. Marcar claramente na UI quando o caso estiver negativo com cobertura reduzida ou confiança baixa.

## 10.2 Melhorias de cobertura

1. Formalizar critérios de “cobertura insuficiente”.
2. Diferenciar:
   - negativo limpo;
   - negativo parcial;
   - inconclusivo por ruído/homônimo;
   - inconclusivo por baixa cobertura.
3. Avaliar fallback processual direcionado via FonteData em tenants específicos.

## 10.3 Melhorias de custo/latência

1. Manter async da Judit sem polling bloqueante.
2. Evitar qualquer ampliação de provider fixo por caso.
3. Acionar fallback só por risco/cobertura, não por completude cosmética.

## 10.4 Limpeza de inconsistências históricas

1. Atualizar documentação interna para refletir que o fluxo real é Judit-first.
2. Separar nos MDs o que é:
   - evidência empírica histórica;
   - estratégia recomendada;
   - estratégia realmente implementada.
3. Limpar a interpretação antiga de que FonteData ainda é base principal do pipeline.

---

## 11. Conclusão Final

### Resposta objetiva à pergunta principal

**O fluxo atual possui uma estratégia boa, mas ainda não a melhor estratégia.**

Ele já está no rumo certo porque:

- escolheu o provider certo como eixo principal;
- reduziu custo estrutural;
- tratou `warrant` e `execution` do jeito operacionalmente correto;
- parou de depender do desenho antigo da FonteData.

Mas ainda não é o melhor ponto porque:

- falta um safety net barato para falsos negativos;
- a política de homônimos está incompleta na implementação;
- o Escavador ainda entra tarde demais para alguns cenários;
- falta explicitar confiança/cobertura na decisão final.

### Melhor estratégia recomendada

> **Judit-first, datalake-first, warrant/execution sempre ligados, Escavador seletivo para positivo e negativo suspeito, FonteData só como fallback inteligente.**

Essa é a estratégia que melhor atende ao objetivo de:

- **reduzir custo o máximo possível**
- **sem perder sinais relevantes**
- **sem inflar latência**
- **sem voltar para um pipeline pesado e redundante**

