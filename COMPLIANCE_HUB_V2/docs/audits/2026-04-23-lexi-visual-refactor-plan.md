# Refatoracao Visual Lexi / Dossie

## Objetivo

A referencia visual analisada em `C:\Users\Analista\Downloads\FireShot\Lexi\FireShot Capture 093 - Dossiê - [dossie.uplexis.com].png` mostra uma experiencia de dossie com:

- hierarquia visual muito clara
- fundo predominantemente branco
- uma cor-acento forte e consistente
- seccionamento por areas e fontes
- leitura operacional orientada por blocos expansivos
- densidade alta de informacao sem parecer poluida

O objetivo para a `COMPLIANCE_HUB_V2/app` nao deve ser copiar a tela literalmente, e sim aproximar o app desse idioma visual com mudancas basicas de cor, ritmo, borda, espacamento e navegacao, preservando a arquitetura plug-and-play do produto.

## Leitura da referencia

### O que define o visual

- topo com gradiente quente para roxo, usado como assinatura da marca
- corpo da pagina quase todo branco ou cinza muito claro
- tabs horizontais para macroareas do dossie
- cards e secoes com borda sutil, cantos arredondados e sombra leve
- badges pequenos para status, contagem e criticidade
- listas e tabelas com linhas finas e bastante respiracao
- forte separacao entre:
  - contexto geral do dossie
  - grupos de fontes
  - itens detalhados por fonte
  - parecer e comentarios finais

### O que vale trazer para o app

- trocar o peso atual do azul/indigo como cor principal por uma paleta mais editorial, com acento quente + roxo
- reduzir ruido visual do layout geral e deixar o conteudo principal mais branco
- deixar a navegacao do dossie mais horizontal e mais "por area"
- transformar cards e blocos em um sistema mais consistente de superficie
- padronizar badges de risco, status, fonte e contagem
- reforcar separacao entre resumo executivo, modulos/fonte e evidencia detalhada

## Diagnostico da V2 atual

### Pontos positivos

- existe base de design system em `src/index.css`
- o pipeline de produtos ja e configuravel por `productKey`
- o cadastro de produtos em `src/core/productPipelines.js` ja respeita PF, PJ e familias
- o fluxo de modulos opcionais em `src/portals/client/pipeline/ModuleConfigStep.jsx` ja aponta para um modelo componivel
- existe uma primeira aproximacao visual de dossie em `src/ui/components/DossieView/DossieView.jsx`

### Gargalos atuais

- o tema global ainda esta muito ancorado em `brand-600/700` azul-indigo
- `DossieView` esta visualmente inspirado na referencia, mas estruturalmente esta fixo em abas hardcoded
- a visualizacao do dossie ainda assume uma espinha unica de secoes, o que dificulta dossies personalizados
- os modulos sao configuraveis no pipeline, mas a camada de apresentacao do resultado ainda nao e guiada por schema
- `ProductCard` e `ProductHubPage` ainda comunicam mais um catalogo SaaS generico do que uma plataforma de dossies premium

## Direcao de refatoracao

### 1. Tema visual primeiro, sem mexer no motor

Primeira etapa deve ser quase toda de skin:

- revisar tokens em `src/index.css`
- introduzir paleta base:
  - accent-warm
  - accent-purple
  - neutral-paper
  - neutral-line
  - neutral-ink
- aplicar essa paleta em:
  - topbar
  - botoes principais
  - tabs
  - badges
  - cards
  - estados hover/focus

Isso entrega ganho visual rapido sem quebrar o comportamento atual.

### 2. Separar "tema do dossie" de "estrutura do dossie"

`src/ui/components/DossieView/DossieView.jsx` deve evoluir para dois conceitos:

- `DossieTheme`
  - controla cores, bordas, densidade, badges, cabecalho e componentes base
- `DossieSchema`
  - controla quais secoes aparecem
  - em qual ordem aparecem
  - quais modulos alimentam cada secao
  - quais campos/resumos cada secao exibe

Sem essa separacao, cada novo dossie personalizado tende a virar if/else.

### 3. Modelar dossies personalizados como configuracao, nao como tela nova

Para manter a ideia plug-and-play, o caminho mais consistente e criar um registro declarativo de dossies customizaveis, por exemplo:

- `dossier_pf_basic`
- `dossier_pf_full`
- `dossier_pj`
- `dossier_pf_custom`
- `dossier_pj_custom`

Cada definicao deveria informar:

- tipo de sujeito: `pf`, `pj` ou `mixed`
- modulos disponiveis
- modulos obrigatorios
- grupos de exibicao
- labels comerciais
- ordem de tabs/secoes
- variacoes de resumo executivo
- regras de exibicao de evidencias

### 4. Reutilizar a logica de modulos para montar a tela final

Hoje o pipeline ja deixa escolher modulos. O proximo passo natural e a tela do dossie final ser montada pelos modulos efetivamente habilitados:

- se houver `identity_pf`, mostrar bloco cadastral PF
- se houver `identity_pj`, mostrar bloco empresarial
- se houver `relationship`, mostrar estrutura societaria/vinculos
- se houver `criminal` e `judicial`, compor a area juridica
- se houver `osint`, `social` e `digital`, compor a area de midia/internet

Isso aproxima o produto da referencia e evita telas estaticas para cada variacao.

## Proposta de arquitetura plug-and-play

### Registro recomendado

Criar uma camada parecida com:

- `src/core/dossierSchemas.js`

Cada schema deveria conter:

- `schemaKey`
- `productKey`
- `subjectType`
- `themeVariant`
- `sections`
- `summaryCards`
- `resultGroups`

### Exemplo conceitual de secoes

- `overview`
- `cadastro`
- `juridico`
- `midia_internet`
- `financeiro`
- `reguladores`
- `listas_restritivas`
- `bens_imoveis`
- `profissional`
- `socioambiental`
- `comentarios_finais`

Nem toda secao precisa existir para todo produto. O schema decide.

### Vantagem

Com isso, "criar um dossie personalizado para PF ou PJ" deixa de ser:

- criar nova pagina
- duplicar JSX
- duplicar CSS

E passa a ser:

- cadastrar novo schema
- escolher modulos
- escolher ordem e rotulos de secoes
- reaproveitar renderer padrao

## Plano de execucao sugerido

### Fase 1. Rebase visual

Arquivos prioritarios:

- `src/index.css`
- `src/ui/layouts/Topbar.css`
- `src/ui/layouts/AppLayout.css`
- `src/ui/components/PageHeader/PageHeader.css`
- `src/ui/components/ProductCard/ProductCard.css`
- `src/portals/client/ProductHubPage.css`

Entregas:

- nova paleta
- superficies mais claras
- botoes, tabs e badges mais proximos da referencia
- cards com menos cara de dashboard padrao e mais cara de dossie/plataforma analitica

### Fase 2. Dossie renderer

Arquivos prioritarios:

- `src/ui/components/DossieView/DossieView.jsx`
- `src/ui/components/DossieView/DossieView.css`
- novo `src/core/dossierSchemas.js`

Entregas:

- componente base orientado por schema
- tabs dinamicas
- secoes dinamicas
- suporte real a PF, PJ e custom

### Fase 3. Pipeline e customizacao

Arquivos prioritarios:

- `src/core/productPipelines.js`
- `src/portals/client/pipeline/ModuleConfigStep.jsx`
- `src/portals/client/pipeline/ReviewSubmitStep.jsx`

Entregas:

- diferenciar melhor produto fechado vs dossie customizado
- permitir preset custom PF/PJ
- salvar modulos escolhidos e schema alvo

### Fase 4. Caso e visualizacao operacional

Arquivos prioritarios:

- `src/portals/client/CaseViewPage.jsx`
- componentes em `src/portals/case-engine/slots`

Entregas:

- alinhar o caso operacional com a mesma taxonomia visual do dossie final
- evitar ruptura entre "analise em andamento" e "relatorio final"

## Recomendacoes objetivas

### Nao fazer agora

- nao duplicar telas para PF e PJ
- nao acoplar tabs fixas no JSX
- nao espalhar cores novas em arquivos soltos sem tokenizar primeiro
- nao tratar "dossie personalizado" como excecao fora do catalogo

### Fazer agora

- definir tokens globais de paleta e superficie
- revisar `ProductHubPage` e `ProductCard` para comunicar melhor familias de dossie
- transformar `DossieView` em renderer baseado em schema
- criar o conceito de `custom dossier preset` para PF e PJ

## Ordem recomendada da refatoracao

1. Atualizar design tokens e componentes base
2. Refinar hub/catalogo para refletir a nova identidade
3. Introduzir `dossierSchemas.js`
4. Refatorar `DossieView` para schema-driven
5. Conectar presets customizados PF/PJ ao pipeline

## Conclusao

A referencia visual combina bem com o posicionamento do produto, mas o ganho real nao esta so na cor. O principal ajuste estrutural e fazer o dossie deixar de ser uma tela fixa e passar a ser uma composicao configuravel.

Se fizermos isso, a V2 consegue:

- ficar visualmente mais premium com mudancas basicas de estilo
- manter a ideia plug-and-play
- suportar dossies existentes e personalizados
- escalar para PF, PJ e combinacoes futuras sem retrabalho de tela
