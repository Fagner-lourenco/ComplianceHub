# Análise Comparativa da Exato Digital no ComplianceHub

**Data da execução real:** 07/04/2026  
**Endpoints testados:** `POST /br/exato/processos`, `POST /br/cnj/mandados-prisao`  
**Amostra real:** 5 CPFs já usados no baseline (`ANDRE`, `DIEGO`, `RENAN`, `FRANCISCO`, `MATHEUS`)  
**Resultados brutos:** `results/exato/`

---

## 1. Baseline atual das APIs já avaliadas

### Forças já comprovadas antes da Exato

- **Escavador** é a fonte mais forte para **volume e detalhamento processual** por CPF quando o CPF está indexado.
- **Judit** é a fonte mais forte para **mandados de prisão**, **papel da pessoa no processo** e **casos pontuais de alto risco** que outras fontes não detectam.
- **FonteData** cobre algumas lacunas reais de cobertura, especialmente no caso **ANDRE**, mas tem instabilidades importantes em mandados e outros endpoints.

### Fragilidades já comprovadas antes da Exato

- Nenhuma fonte sozinha fecha a cobertura do produto.
- **Judit** perde volume em processos quando comparado com Escavador.
- **Escavador** falha em CPFs não indexados e sofre com homônimos.
- **FonteData** teve instabilidade crítica em `cnj-mandados-prisao`.

### Casos âncora do baseline

- **ANDRE**: FonteData encontrou 5 penais; Escavador e Judit ficaram zerados por CPF.
- **DIEGO**: Escavador e FonteData encontraram 1 processo; Judit não.
- **RENAN**: Judit mostrou que ele era **TESTEMUNHA**, reduzindo risco operacional.
- **FRANCISCO**: Escavador trouxe 7 processos; Judit trouxe 1 processo relevante e **1 mandado ativo**.
- **MATHEUS**: só a Judit detectou 1 investigação criminal ativa com ele como **AVERIGUADO**.

### Conclusão do baseline antes da Exato

- **Processos:** Escavador > Judit em cobertura e detalhe bruto.
- **Mandados:** Judit era a melhor referência prática.
- **Casos críticos exclusivos:** Judit detectava achados que as outras fontes deixavam passar.

---

## 2. Estrutura técnica da Exato Digital

### Contrato técnico observado

- **Base:** `https://api.exato.digital`
- **Swagger/OpenAPI:** `https://api.exato.digital/swagger-ui/`
- **OpenAPI real:** `https://api.exato.digital/openapi`
- **Autenticação:** header `token`
- **Formato de envio:** `application/x-www-form-urlencoded`
- **Método:** `POST`

### Endpoint 1: `POST /br/exato/processos`

- **Parâmetro real usado:** `cpf`
- **Resposta real:** objeto unificado com metadados da transação + `Result.Processos`
- **Custo observado:** `TotalCostInCredits = 1` por consulta, inclusive em `not_found`
- **Tempo observado na 1ª rodada:** 844 ms a 2.048 ms
- **Tempo médio observado:** 1.268 ms

### Endpoint 2: `POST /br/cnj/mandados-prisao`

- **Parâmetro real usado:** `cpf`
- **Resposta real:** objeto unificado com metadados da transação + `Result.Mandados`
- **Custo observado:** `TotalCostInCredits = 2` por consulta, inclusive em `not_found`
- **Tempo observado na 1ª rodada:** 14,5 s a 35,2 s
- **Tempo médio observado:** 22,7 s
- **Recheck positivo (Francisco):** 338 ms

### Campos úteis observados na Exato

#### Processos

- `Numero`
- `Tipo`
- `Assunto`
- `TribunalNome`
- `TribunalInstancia`
- `TribunalTipo`
- `TribunalDistrito`
- `Estado`
- `Situacao`
- `Valor`
- `NotificacaoData`
- `UltimaMovimentacaoData`
- `CapturaData`
- `UltimaAtualizacaoData`
- `Partes[]` com:
  - `Documento`
  - `Nome`
  - `Polaridade`
  - `Tipo`

#### Mandados

- `NumeroPeca`
- `NumeroPecaFormatado`
- `NumeroProcesso`
- `DescricaoStatus`
- `DataExpedicao`
- `NomeOrgao`
- `DescricaoPeca`
- `NomeMae`
- `DescricaoSexo`
- `DataNascimento`
- `PdfUrl`

### Divergências entre Swagger e resposta real

- O Swagger sugere enums como `Success` e `NotFound`, mas a resposta real veio com `ApiResultType` em lowercase: `success`, `not_found`.
- O Swagger mostra `DetalhesCompleto` no mandado, mas **o caso positivo do Francisco não trouxe esse bloco**.
- `OriginalFilesUrl` veio preenchido, porém os HEADs testados retornaram **404**.
- `HasPdf = true` apareceu até em respostas negativas de mandados, e o PDF negativo existia e retornava `200`.

---

## 3. Resultados reais obtidos

### Estabilidade de transporte

- **10/10 chamadas** principais retornaram HTTP `200`.
- Não houve `503`, `timeout` de transporte nem `429` na amostra.
- Em mandados, a latência é alta na primeira execução, mas o recheck positivo do Francisco caiu para **338 ms**.

### Resultado por pessoa

#### 1. ANDRE LUIZ CRUZ DOS SANTOS

- **Processos Exato:** 0
- **Mandados Exato:** 0
- **Resultado técnico:** `EntityNotFound`
- **Impacto:** não cobriu a lacuna histórica do ANDRE; continua cego para o caso em que a FonteData encontrava 5 penais.

#### 2. DIEGO EMANUEL ALVES DE SOUZA

- **Processos Exato:** 1
- **CNJ:** `01149452820188060001`
- **Mandados Exato:** 0
- **Observação relevante:** processo veio como **`DADOS OCULTADOS: SEGREDO DE JUSTIÇA`**, sem tipo, assunto, partes ou movimentações.
- **Achado novo:** esse CNJ **não aparece** no baseline de Escavador/Judit/FonteData.

#### 3. RENAN GUIMARAES DE SOUSA AUGUSTO

- **Processos Exato:** 1
- **CNJ:** `01019762120165010007`
- **Mandados Exato:** 0
- **Cobertura:** coincide com Escavador e Judit.
- **Valor operacional:** a Exato trouxe `RENAN` como **`Testemunha`**, com `Polaridade = Neutra`, e listou 10 partes com documentos.

#### 4. FRANCISCO TACIANO DE SOUSA

- **Processos Exato:** 2
- **CNJs:** `02027437220228060167`, `00530230220208060167`
- **Mandados Exato:** 1 ativo
- **Mandado:** processo `02047235420228060167`, status `Pendente de Cumprimento`
- **Valor operacional real:** confirmou o mandado ativo e trouxe um processo criminal relevante.
- **Limitação forte:** perdeu **5 dos 7 processos** que o Escavador trazia por CPF.

#### 5. MATHEUS GONCALVES DOS SANTOS

- **Processos Exato:** 0
- **Mandados Exato:** 0
- **Resultado técnico:** `EntityNotFound`
- **Impacto:** não detectou o processo que a Judit encontrou com MATHEUS como **AVERIGUADO**.
- **Recheck:** o zero se repetiu de forma consistente.

---

## 4. Comparação detalhada com Judit / Escavador / outras

### A. Cobertura

| Caso | Exato Processos | Escavador CPF | Judit CPF | FonteData | Leitura comparativa |
|---|---:|---:|---:|---:|---|
| ANDRE | 0 | 0 | 0 | 5 | Exato não resolve a maior lacuna do baseline |
| DIEGO | 1 | 1 | 0 | 1 | Exato achou **1 processo diferente**, mas oculto |
| RENAN | 1 | 1 | 1 | 2 | Exato empata no trabalhista conhecido |
| FRANCISCO | 2 | 7 | 1 | 8 | Exato perde feio em volume processual |
| MATHEUS | 0 | 0 | 1 | 0 | Exato perde o achado mais crítico da Judit |

### B. Mandados

| Caso | Exato Mandados | Judit Mandados | FonteData Mandados | Leitura comparativa |
|---|---:|---:|---:|---|
| ANDRE | 0 | 0 | 0 | Exato estável, mas sem ganho |
| DIEGO | 0 | 0 | 0 | Exato estável, mas sem ganho |
| RENAN | 0 | 0 | 0 | Exato estável, mas sem ganho |
| FRANCISCO | 1 | 1 | 503 histórico | Exato confirma o positivo real |
| MATHEUS | 0 | 0 | 0 | Exato estável, mas sem ganho |

### C. Sobreposição de CNJs

- **RENAN:** sobreposição total com Escavador e Judit.
- **FRANCISCO:** sobreposição parcial com Escavador e total com Judit apenas no processo `0202743...`; mandado coincide com a Judit em `0204723...`.
- **DIEGO:** a Exato trouxe um CNJ **novo** (`0114945-28.2018.8.06.0001`), mas praticamente sem payload.
- **ANDRE** e **MATHEUS:** nenhum ganho de cobertura.

### D. Conclusão comparativa

- **Maior alcance que o baseline:** não.
- **Processos que as outras não retornam:** sim, mas só vimos isso em **DIEGO**, e com utilidade baixa por segredo de justiça.
- **Maior cobertura criminal:** não.
- **Maior cobertura cível:** não.
- **Maior cobertura trabalhista:** não.
- **Melhor cobertura de mandados do que FonteData:** sim, na amostra.
- **Melhor do que Judit em mandados:** não em detalhe; talvez apenas em simplicidade do fluxo.

---

## 5. Cobertura por tipo de achado

### Cobertura criminal

- **FRANCISCO:** Exato achou 1 criminal relevante (`0202743...`), mas perdeu a maior parte do histórico penal já conhecido.
- **MATHEUS:** Exato falhou no caso criminal mais sensível do baseline.
- **ANDRE:** Exato não trouxe os 5 penais que já preocupavam no baseline.

**Veredito:** a Exato **não melhora a cobertura criminal** do ComplianceHub.

### Cobertura cível

- **DIEGO:** trouxe 1 processo adicional, mas oculto por segredo de justiça.
- **FRANCISCO:** trouxe 1 processo oculto que já aparecia no Escavador.

**Veredito:** há algum sinal de cobertura cível/família, mas sem qualidade suficiente para virar ganho operacional claro.

### Cobertura trabalhista

- **RENAN:** trouxe corretamente o processo trabalhista e ainda explicitou que ele é testemunha.

**Veredito:** boa qualidade no caso observado, mas sem ampliar cobertura em relação ao baseline.

### Cobertura de mandados de prisão

- Confirmou o mandado ativo do FRANCISCO de forma consistente.
- Não falhou por transporte na amostra.
- Retorna PDF inclusive para respostas negativas.

**Veredito:** é a parte mais promissora da Exato.

---

## 6. Qualidade e profundidade dos dados

### Onde a Exato é melhor

- **Fluxo simples**: 1 chamada por endpoint, sem polling manual como na Judit.
- **Papéis e polaridade** em processos não sigilosos vêm de forma relativamente limpa.
- **RENAN** veio explicitamente como `Testemunha`, o que é útil para revisão operacional.
- **Mandados** retornam dados suficientes para alertar, mostrar tribunal, data, órgão e gerar PDF.

### Onde a Exato é pior

- **Movimentações** vieram vazias em todos os casos da amostra.
- **Petições** vieram vazias em todos os casos da amostra.
- **Francisco**: em processos, a Exato retornou só 2 registros contra 7 do Escavador e 8 da FonteData.
- **Mandado positivo do Francisco** veio sem `DetalhesCompleto`, sem síntese, sem motivo de expedição e sem o bloco rico de entidade que o Swagger sugere.

### Onde ela só parece melhor

- O Swagger dá impressão de payload muito profundo em mandados, mas **isso não apareceu no caso positivo real**.
- `OriginalFilesUrl` parece promissor, mas os testes com HEAD retornaram **404**.
- O CNJ novo do DIEGO parece ganho de cobertura, mas veio tão oculto que ainda não melhora o fluxo real.

### Ruído

- Respostas com `EntityNotFound` custam créditos e retornam pouco valor.
- Processos sigilosos entram no total e podem inflar percepção de cobertura sem realmente ajudar o analista.

### Redundância

- **RENAN:** a Exato praticamente repete o que já sabíamos.
- **FRANCISCO (mandado):** confirma o que a Judit já trazia, porém com menos profundidade.

---

## 7. Utilidade real para o fluxo do app

### Enriquecimento automático

- **Processos:** utilidade parcial. A estrutura é simples de normalizar, mas o volume e o detalhe real não sustentam substituição de Escavador/Judit.
- **Mandados:** utilidade boa para alimentar um flag rápido de mandado e anexar PDF.

### Classificação automática

- A Exato ajuda quando há `TribunalTipo = CRIMINAL` ou `TRABALHISTA`.
- Também ajuda quando `Partes[].Tipo` indica `Testemunha`, `Requerente`, `Requerido`.
- Mas o ganho cai muito em casos sigilosos e em `not_found`.

### Revisão operacional na CasoPage

- **Útil:** partes, polaridade, tipo da parte, valor, datas básicas, status textual.
- **Fraco:** ausência de movimentações, ausência de narrativa jurídica e baixa cobertura em casos críticos.

### Relatório final

- **Mandados:** bom para `warrantFindings`, especialmente pelo PDF.
- **Processos:** ruim para `processHighlights` quando o retorno vem oculto ou vazio de movimentações.

### IA e parecer

- Ajuda pouco a IA em processos porque falta contexto narrativo.
- Ajuda moderadamente em mandados porque o fato objetivo já é suficiente para o parecer.

### Síntese de utilidade

- **Ganho real:** mandados e alguns casos com papel processual explícito.
- **Ganho aparente:** profundidade prometida no Swagger.
- **Ruído:** processos sigilosos sem conteúdo.
- **Oportunidade de integração:** mandados e complemento pontual de processos.

---

## 8. Riscos, limitações e pontos de atenção

### Riscos de cobertura

- Alto risco de **falso negativo** em processos criminais relevantes:
  - ANDRE continuou zerado.
  - MATHEUS continuou zerado.
  - FRANCISCO perdeu 5 processos conhecidos.

### Riscos de documentação/contrato

- A resposta real divergiu do Swagger em pontos importantes.
- `OriginalFilesUrl` pode ser publicado na resposta e ainda assim não existir.

### Riscos de custo

- `not_found` também consome crédito na prática observada.
- Se usada como busca ampla de processos, a Exato pode gerar custo sem ganho proporcional.

### Riscos de interpretação

- `TotalProcessosComoOutraParte` pode ser útil, mas não basta sozinho para classificar risco.
- Processos ocultos por segredo de justiça podem gerar “ganho estatístico” sem ganho operacional.

### Limitações operacionais

- Não vimos movimentações úteis em nenhum caso.
- Não vimos petições úteis em nenhum caso.
- Não vimos o detalhamento completo de mandado prometido no Swagger.

---

## 9. Recomendação estratégica

### Vale integrar?

**Sim, mas não como fonte principal de processos.**

### Papel recomendado

#### Processos

- **Não integrar como fonte principal**
- **Não substituir Escavador**
- **Não substituir Judit**
- **Usar apenas como fonte complementar seletiva**

Uso recomendado:

- em casos de divergência entre providers;
- em casos com suspeita de segredo de justiça;
- em casos em que “outra parte / testemunha” possa mudar o risco operacional;
- opcionalmente em revisão manual de casos sinalizados.

#### Mandados de prisão

- **Boa candidata a fonte secundária/fallback**
- **Não substituir a Judit ainda**

Uso recomendado:

- rodar quando a Judit falhar, atrasar ou ficar inconclusiva;
- rodar em paralelo em tenants de risco alto, se o custo comportar;
- usar o PDF como evidência operacional/anexo de auditoria.

### Prioridade sugerida

1. **Mandados**: prioridade média-alta  
2. **Processos como complemento**: prioridade média-baixa  
3. **Processos como fonte principal**: não recomendado

### Recomendação objetiva

- **Mandados:** integrar como **fonte secundária/fallback**, com boa chance de valor real.
- **Processos:** integrar apenas como **consulta complementar**, não como camada principal nem substituta.

---

## 10. Próximos passos

1. Criar um normalizer isolado da Exato para testes internos, sem entrar ainda no pipeline padrão.
2. Mapear `Situacao = "DADOS OCULTADOS: SEGREDO DE JUSTIÇA"` como flag explícita de sigilo.
3. Preparar campos `exatoProcessos`, `exatoWarrants`, `exatoPdfUrl`, `exatoOriginalFilesUrl`, `exatoCostInCredits`, `exatoApiResultType`.
4. Testar um lote maior de CPFs com:
   - mais casos criminais confirmados;
   - mais mandados positivos;
   - mais trabalhistas;
   - mais segredos de justiça.
5. Validar se `OriginalFilesUrl` passa a funcionar em produção real ou se o campo é apenas ornamental.
6. Se o objetivo for ganho imediato de produto, priorizar **mandados** antes de **processos**.

---

## Conclusão final

### Ganho real

- **Mandados de prisão**: sinal forte, estável na amostra, com PDF utilizável.
- **Papéis processuais** em casos não sigilosos: útil para revisão.

### Ganho aparente

- Payload extremamente rico em mandados e processos, como o Swagger sugere.

### Ruído

- Processos sigilosos sem conteúdo prático.
- `not_found` cobrando crédito.
- `OriginalFilesUrl` sem funcionar nos testes.

### Oportunidade de integração

- **Mandados:** sim, como camada secundária/fallback.
- **Processos:** sim, apenas em modo complementar e seletivo.

### Recomendação executiva

**A Exato Digital não supera o baseline atual em cobertura de processos e não deve entrar como fonte principal.**  
**Ela se mostra útil principalmente em mandados de prisão e como complemento pontual para processos, especialmente quando o objetivo é confirmação rápida, papel processual e geração de PDF de evidência.**
