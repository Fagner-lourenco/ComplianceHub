# Plano Detalhado de Correcao Mobile

## Escopo
Este documento converte a auditoria mobile de 2026-04-09 em backlog tecnico executavel.

Base de evidencia usada:
- navegacao autenticada real nos portais `ops` e `client`;
- capturas reais de iPhone Chrome enviadas durante a auditoria;
- validacao automatizada em `390px` e `320px`;
- leitura estrutural de layout, CSS global e componentes compartilhados.

Objetivo:
- corrigir os gargalos de uso real no mobile sem regressao funcional;
- reduzir densidade vertical e dependencia de tabelas desktop;
- melhorar navegacao, toque, leitura, fluxo e conforto de uso;
- preservar o desktop atual enquanto a experiencia mobile e reconstruida de forma segura.

## Guardrails de implementacao
- Nao reescrever tudo de uma vez.
- Nao misturar refactor visual com mudanca de regra de negocio.
- Nao substituir tabelas desktop; criar variantes mobile.
- Toda mudanca de layout compartilhado deve ser validada em `ops`, `client` e `demo`.
- Toda interacao critica no mobile deve ter alvo minimo de `44x44`.
- Toda tela com listagem densa deve ter modo mobile sem scroll horizontal obrigatorio.
- Toda fase deve fechar com validacao visual em `320px`, `390px` e tablet.

## Escala de prioridade, risco e impacto

### Prioridade
- `P0`: bloqueia ou degrada fortemente o uso real no mobile; precisa entrar antes de refinamentos.
- `P1`: nao bloqueia tudo, mas gera friccao consistente em fluxos recorrentes; entra logo apos a base estrutural.
- `P2`: polimento importante, densidade, compactacao e aceleracao de leitura; entra depois dos fluxos criticos.

### Risco
- `Baixo`: alteracao localizada de espaco, toque ou apresentacao sem trocar estrutura de fluxo.
- `Medio`: mudanca de composicao ou de componente compartilhado com chance controlada de afetar mais de uma rota.
- `Alto`: reorganiza fluxo critico, detalhe complexo ou shell compartilhado com impacto em muitos estados.

### Impacto no fluxo
- `Baixo`: ganho principalmente visual ou incremental.
- `Medio`: melhora navegacao e execucao, mas o fluxo ja era utilizavel.
- `Alto`: reduz passos, erro de toque, rolagem ou carga cognitiva em fluxo recorrente.
- `Critico`: sem essa correcao o fluxo mobile segue apenas "abrindo", mas nao fica praticavel.

## Matriz consolidada de problemas

### PRB-001 - Shell mobile superdimensionado
**Telas afetadas:** todo o app em `ops`, `client` e `demo`.  
**Elementos especificos afetados:** topbar, seletor de franquia/tenant, chip do usuario, acoes de topo e espaco antes do conteudo util.  
**Causa tecnica:** o layout mobile reorganiza o grid, mas nao reduz a quantidade real de chrome e nem compacta os blocos de contexto.  
**Impacto funcional:** o usuario perde a primeira dobra inteira antes de chegar ao conteudo principal.  
**Prioridade:** `P0`  
**Risco:** `Alto`  
**Backlog associado:** `MOB-001`, `MOB-002`

### PRB-002 - Alvos de toque abaixo do minimo seguro
**Telas afetadas:** cabecalho, fila, metricas, relatorios e controles pequenos compartilhados.  
**Elementos especificos afetados:** menu, toggle de tema, tabs de periodo, checkboxes de selecao, botoes de acao curta e selects compactos.  
**Causa tecnica:** varios controles foram desenhados para densidade visual e nao para ergonomia de toque.  
**Impacto funcional:** aumenta erro de toque, re-tentativa e inseguranca em acoes sensiveis.  
**Prioridade:** `P0`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-003`

### PRB-003 - Tabelas desktop-first em viewport reduzida
**Telas afetadas:** `Fila`, `Casos`, `Clientes`, `Auditoria`, `Relatorios`, `Solicitacoes`, `Exportacoes`, `Equipe`.  
**Elementos especificos afetados:** wrappers de tabela, colunas com `nowrap`, cabecalhos, linhas de acao e metadados secundarios.  
**Causa tecnica:** o padrao atual privilegia manter a grade tabular com scroll horizontal em vez de reconstruir a semantica da informacao no mobile.  
**Impacto funcional:** a tarefa principal deixa de ser "encontrar e agir" e vira "rolar lateralmente e tentar ler".  
**Prioridade:** `P0`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-010`, `MOB-011`

### PRB-004 - Fila operacional impraticavel no iPhone
**Telas afetadas:** `ops/fila`.  
**Elementos especificos afetados:** cards KPI iniciais, filtros empilhados, checkboxes, tabela principal e botoes `Assumir` e `Abrir`.  
**Causa tecnica:** excesso de elementos antes da lista e dependencia de grade com colunas demais para o viewport.  
**Impacto funcional:** triagem, atribuicao e abertura de caso ficam cansativas e sujeitas a erro.  
**Prioridade:** `P0`  
**Risco:** `Medio-Alto`  
**Backlog associado:** `MOB-020`

### PRB-005 - Todos os Casos segue com densidade de desktop
**Telas afetadas:** `ops/casos`.  
**Elementos especificos afetados:** KPIs, filtros, tabela e CTA de abertura.  
**Causa tecnica:** excesso de informacao simultanea e sem recorte de prioridade para mobile.  
**Impacto funcional:** consulta operacional geral quase exige desktop para ser eficiente.  
**Prioridade:** `P0`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-021`

### PRB-006 - Gestao de clientes combina bug de layout e listagem inadequada
**Telas afetadas:** `ops/clientes`.  
**Elementos especificos afetados:** hero, campo de busca, CTA `Novo cliente`, tabela e fluxo de configuracao.  
**Causa tecnica:** composicao mobile ainda herda logica de desktop, inclusive com crescimento vertical indevido do bloco superior.  
**Impacto funcional:** administracao de clientes e tenants fica visualmente confusa e operacionalmente lenta.  
**Prioridade:** `P1`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-022`

### PRB-007 - Auditoria parece disponivel, mas nao e utilizavel
**Telas afetadas:** `ops/auditoria`.  
**Elementos especificos afetados:** tabela de logs, colunas de data, usuario, acao, alvo, detalhe e IP.  
**Causa tecnica:** a pagina preserva uma tabela ampla e densa em vez de resumir cada evento em lista vertical.  
**Impacto funcional:** consulta de trilha e investigacao rapida ficam praticamente inviaveis no celular.  
**Prioridade:** `P0`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-023`

### PRB-008 - Relatorios publicos tem hero bom e operacao ruim
**Telas afetadas:** `ops/relatorios`.  
**Elementos especificos afetados:** busca, tabela, token, nome do candidato e CTA `Revogar`.  
**Causa tecnica:** a listagem continua com modelo de tabela e botao sensivel pequeno demais.  
**Impacto funcional:** localizar e revogar links compartilhados no iPhone fica propenso a erro.  
**Prioridade:** `P1`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-024`

### PRB-009 - Solicitacoes do cliente ainda nao viraram experiencia mobile
**Telas afetadas:** `client/solicitacoes`.  
**Elementos especificos afetados:** KPIs, filtros, heatmap, tabela/listagem e gatilho do drawer.  
**Causa tecnica:** existe uma boa camada de resumo, mas a regiao realmente operacional continua tabular e extensa.  
**Impacto funcional:** o cliente enxerga o volume de casos, mas gerencia mal os itens individuais no celular.  
**Prioridade:** `P1`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-030`

### PRB-010 - Drawer de detalhe do cliente concentra informacao sem hierarquia suficiente
**Telas afetadas:** detalhe de solicitacao no portal do cliente.  
**Elementos especificos afetados:** tabs, cabecalho do drawer, resumo do caso, evidencias e secoes auxiliares.  
**Causa tecnica:** a estrutura atual tenta caber tudo num drawer com muitas camadas e pouca diferenciacao de prioridade.  
**Impacto funcional:** o usuario precisa percorrer e interpretar demais para entender o resultado do caso.  
**Prioridade:** `P1`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-031`

### PRB-011 - Exportacoes e Equipe tem formulacao razoavel e historico/listagem ruins
**Telas afetadas:** `client/exportacoes` e `client/equipe`.  
**Elementos especificos afetados:** tabela de historico, tabela de membros, seletor de papel e pequenos controles auxiliares.  
**Causa tecnica:** os blocos de criacao foram adaptados ao mobile, mas a camada de consulta e administracao continua em tabela.  
**Impacto funcional:** gerar funciona; acompanhar, revisar e administrar continua desconfortavel.  
**Prioridade:** `P1`  
**Risco:** `Medio`  
**Backlog associado:** `MOB-032`, `MOB-033`

### PRB-012 - Nova Solicitacao nao quebra, mas e longa demais para uso continuo
**Telas afetadas:** `client/nova-solicitacao`.  
**Elementos especificos afetados:** blocos de dados, redes sociais, observacoes, prioridade e CTA final.  
**Causa tecnica:** todo o formulario esta em fluxo unico de rolagem, sem progressao nem agrupamento orientado por tarefa.  
**Impacto funcional:** aumenta fadiga, risco de abandono e sensacao de formulario interminavel.  
**Prioridade:** `P1`  
**Risco:** `Alto`  
**Backlog associado:** `MOB-040`

### PRB-013 - Detalhe de caso operacional segue dependente de desktop
**Telas afetadas:** `ops/caso/:id` e composicoes equivalentes de demo.  
**Elementos especificos afetados:** header do caso, step nav, pipeline, evidencias, blocos de revisao e CTA final.  
**Causa tecnica:** o detalhe mostra toda a densidade de escritorio em coluna unica, sem resumo fixo e sem trilha de decisao guiada.  
**Impacto funcional:** para leitura profunda o celular continua sendo um dispositivo secundario, nao principal.  
**Prioridade:** `P1`  
**Risco:** `Alto`  
**Backlog associado:** `MOB-041`

### PRB-014 - Dashboards, perfis e paginas estaveis ainda carregam altura e densidade desnecessarias
**Telas afetadas:** `ops/metricas-ia`, `ops/saude`, `client/dashboard`, `perfil` e `relatorio publico`.  
**Elementos especificos afetados:** heros, cards altos, graficos comprimidos e resumos finais ainda tabulares.  
**Causa tecnica:** essas telas foram adaptadas visualmente, mas nao totalmente otimizadas para leitura rapida em mobile.  
**Impacto funcional:** nao bloqueia uso, mas reduz velocidade de compreensao e consome rolagem demais.  
**Prioridade:** `P2`  
**Risco:** `Baixo-Medio`  
**Backlog associado:** `MOB-025`, `MOB-026`, `MOB-034`, `MOB-050`, `MOB-051`

## Estrategia de implementacao sem regressao
- Toda mudanca compartilhada deve entrar primeiro atras de breakpoint e nunca substituir o comportamento desktop por acidente.
- O shell mobile deve ser corrigido antes das telas, porque o ganho local some se o topo continuar alto demais.
- As listas mobile devem nascer como primitive reutilizavel, e nao como oito implementacoes independentes.
- Toda migracao de tabela para cards deve usar a mesma fonte de dados e as mesmas regras de permissao da tabela atual.
- Nao alterar `fetch`, hooks de negocio, adaptadores de API ou regras de RBAC enquanto o objetivo for apenas UX mobile.
- Toda tela migrada deve manter estados `loading`, `empty`, `error` e `success` coerentes entre mobile e desktop.
- Se houver risco alto em fluxo critico, a implementacao deve ser fatiada em dois PRs:
  - PR 1: shell/estrutura/primitive;
  - PR 2: migracao da pagina ou fluxo especifico.

## Mapa de dependencias entre tarefas
- `MOB-001` depende de `MOB-000`.
- `MOB-002` depende de `MOB-001`.
- `MOB-003` depende de `MOB-001`.
- `MOB-010` depende de `MOB-001` e `MOB-003`.
- `MOB-011` depende de `MOB-001`.
- `MOB-020`, `MOB-021`, `MOB-023`, `MOB-024`, `MOB-030`, `MOB-032`, `MOB-033` dependem de `MOB-010`.
- `MOB-020`, `MOB-021`, `MOB-023`, `MOB-024`, `MOB-030` dependem de `MOB-011`.
- `MOB-022` depende de `MOB-001` e deve reutilizar o padrao de lista mobile se possivel.
- `MOB-031` depende de `MOB-030`.
- `MOB-040` pode iniciar em paralelo a `MOB-032` e `MOB-033`, mas nao deve compartilhar alteracoes estruturais sem alinhamento.
- `MOB-041` deve comecar apenas depois da estabilizacao do shell e dos componentes de toque.
- `MOB-025`, `MOB-026`, `MOB-034`, `MOB-050`, `MOB-051` entram por ultimo e nunca devem bloquear `P0` e `P1`.

## Ordem recomendada
1. Shell mobile compartilhado
2. Primitive mobile para listas densas
3. Fluxos criticos operacionais
4. Fluxos criticos do cliente
5. Formularios longos e detalhes densos
6. Dashboards e refinamentos

## Definition of Done global
- Sem necessidade de scroll horizontal para completar tarefa principal.
- CTA principal visivel e confortavel no mobile.
- Controles criticos com area de toque adequada.
- Sem blocos vazios ou repeticao excessiva de contexto.
- Conteudo primario aparece ate a primeira ou segunda dobra.
- Desktop preservado visual e funcionalmente.

---

## Fase 0 - Baseline e seguranca

### MOB-000 - Criar baseline de validacao visual
**Prioridade:** P0  
**Arquivos alvo:**  
- `results/real-mobile-audit-2026-04-09/*`
- opcionalmente `tests/` ou `scripts/` para snapshots

**Problema:** sem baseline formal, as correcoes mobile podem degradar outras telas sem sinal claro.

**Justificativa tecnica e funcional:** o layout compartilhado afeta quase tudo. Sem baseline, cada melhoria local pode quebrar outro portal.

**Implementacao segura:**
- registrar screenshots de referencia para `ops` e `client` em `320`, `390`, `430` e tablet;
- registrar checklist minimo por fluxo:
  - login;
  - menu lateral;
  - fila/listas;
  - drawer;
  - modal;
  - formulario longo;
  - perfil;
  - dashboard.

**Risco:** baixo  
**Impacto no fluxo:** indireto, mas protege todo o rollout.

**Criterios de aceite:**
- existe baseline por rota critica;
- existe checklist objetivo para revalidacao manual;
- as proximas fases podem ser comparadas com antes/depois.

---

## Fase 1 - Shell mobile compartilhado

### MOB-001 - Compactar topbar mobile
**Prioridade:** P0  
**Arquivos alvo:**  
- [src/ui/layouts/Topbar.css](/d:/ComplianceHub/src/ui/layouts/Topbar.css)
- [src/ui/layouts/Topbar.jsx](/d:/ComplianceHub/src/ui/layouts/Topbar.jsx)

**Problema:** topbar alta demais, repetitiva e com controles pequenos.

**Elementos afetados:**
- `.topbar`
- `.topbar__menu-btn`
- `.topbar__context`
- `.topbar__user-chip`
- `.topbar__theme-toggle`

**Justificativa tecnica:**
- o CSS atual reorganiza o grid, mas nao reduz de verdade o volume de informacao;
- no mobile ainda existem contexto, usuario e acoes com muita altura somada;
- `menu` e `theme toggle` tem hit area abaixo do ideal.

**Justificativa funcional:**
- consome a primeira dobra;
- atrasa a descoberta do conteudo util;
- aumenta fadiga em todas as telas.

**Implementacao segura:**
- criar variante mobile dedicada abaixo de `768px`;
- reduzir topbar para:
  - linha 1: menu + titulo da secao + acoes compactas;
  - linha 2: contexto da franquia em bloco menor, sem meta redundante;
- substituir o `user chip` por versao compacta:
  - avatar pequeno;
  - apenas nome curto no mobile;
  - email e papel acessiveis em perfil/drawer, nao no header;
- aumentar `menu` e `theme toggle` para `44x44`.

**Risco:** medio-alto  
**Impacto no fluxo:** alto; afeta todos os portais.

**Dependencias:** MOB-000

**Criterios de aceite:**
- conteudo principal sobe pelo menos uma dobra em relacao ao estado atual;
- `menu` e `tema` passam em teste de toque;
- `ops`, `client` e `demo` continuam navegando corretamente;
- nome de franquia longa nao quebra o header.

### MOB-002 - Reduzir repeticao entre topbar e sidebar
**Prioridade:** P0  
**Arquivos alvo:**  
- [src/ui/layouts/Sidebar.jsx](/d:/ComplianceHub/src/ui/layouts/Sidebar.jsx)
- [src/ui/layouts/Sidebar.css](/d:/ComplianceHub/src/ui/layouts/Sidebar.css)
- [src/ui/layouts/Topbar.jsx](/d:/ComplianceHub/src/ui/layouts/Topbar.jsx)

**Problema:** contexto e identidade aparecem duplicados.

**Justificativa tecnica:** a mesma informacao existe na topbar e no rodape da sidebar.

**Justificativa funcional:** o usuario recebe menos conteudo util e mais chrome.

**Implementacao segura:**
- no mobile, manter na sidebar apenas o essencial:
  - navegacao;
  - contexto;
  - sair;
- remover redundancias nao essenciais do rodape ou compacta-las;
- evitar que o drawer lateral ocupe espaco visual desnecessario com informacao repetida.

**Risco:** medio  
**Impacto no fluxo:** medio-alto.

**Criterios de aceite:**
- sidebar aberta continua clara;
- o usuario entende quem esta logado e em qual franquia esta;
- a soma visual topbar + sidebar fica mais leve.

### MOB-003 - Padronizar hit area minima de controles criticos
**Prioridade:** P0  
**Arquivos alvo:**  
- [src/index.css](/d:/ComplianceHub/src/index.css)
- [src/ui/layouts/Topbar.css](/d:/ComplianceHub/src/ui/layouts/Topbar.css)
- [src/ui/styles/shared-tables.css](/d:/ComplianceHub/src/ui/styles/shared-tables.css)
- CSS locais por pagina

**Problema:** varios controles ficam abaixo de `44x44`.

**Controles afetados:**
- menu;
- toggle de tema;
- checkboxes de fila;
- tabs de periodo;
- `Revogar`;
- selects compactos;
- toggles pequenos.

**Implementacao segura:**
- criar utilitario ou regra base para controles interativos criticos;
- revisar alturas minima por tipo:
  - botao;
  - icon button;
  - checkbox customizada ou wrapper clicavel;
  - tab button.

**Risco:** baixo-medio  
**Impacto no fluxo:** alto em toque.

**Criterios de aceite:**
- nenhum controle critico relevante fica abaixo de `44x44`;
- alinhamento visual continua estavel;
- interacoes nao ficam “espalhadas” demais.

---

## Fase 2 - Primitive mobile para listas densas

### MOB-010 - Criar padrao compartilhado de `MobileDataCardList`
**Prioridade:** P0  
**Arquivos alvo:**  
- novo componente em `src/ui/components/`
- [src/ui/styles/shared-tables.css](/d:/ComplianceHub/src/ui/styles/shared-tables.css)
- [src/index.css](/d:/ComplianceHub/src/index.css)

**Problema:** telas densas dependem de tabela com `white-space: nowrap` no mobile.

**Justificativa tecnica:**
- hoje o CSS global reforca tabela horizontal no mobile em vez de adaptar semantica;
- a regra em [src/index.css](/d:/ComplianceHub/src/index.css#L570) mantem `white-space: nowrap`.

**Justificativa funcional:** o usuario nao quer “rolar uma tabela”; ele quer encontrar um item e agir.

**Implementacao segura:**
- manter tabela atual para desktop;
- abaixo de breakpoint, renderizar lista/card:
  - titulo principal;
  - 2 ou 3 metadados fortes;
  - status/veredito;
  - CTA principal;
  - secundarios em menu local ou linha inferior;
- usar mesma fonte de dados da tabela atual;
- nao alterar hooks nem fetch.

**Risco:** medio  
**Impacto no fluxo:** altissimo; habilita correcoes em lote.

**Dependencias:** MOB-001, MOB-003

**Criterios de aceite:**
- item principal e CTA cabem sem scroll horizontal;
- cards aceitam nomes longos sem quebrar;
- tabela continua intacta em desktop.

### MOB-011 - Criar padrao compartilhado de `FilterPanelMobile`
**Prioridade:** P0  
**Arquivos alvo:**  
- novo componente em `src/ui/components/`
- [src/ui/styles/shared-tables.css](/d:/ComplianceHub/src/ui/styles/shared-tables.css)

**Problema:** filtros em coluna tomam muito espaco antes das listas.

**Justificativa tecnica:** varias telas repetem `filter-bar` com busca + multiplos selects empilhados.

**Justificativa funcional:** no iPhone, os filtros consomem quase toda a primeira dobra antes da lista.

**Implementacao segura:**
- manter busca visivel;
- colapsar filtros avancados em botao `Filtros`;
- exibir contagem de filtros ativos;
- preservar desktop atual.

**Risco:** medio  
**Impacto no fluxo:** alto.

**Criterios de aceite:**
- o usuario consegue buscar sem abrir filtro;
- filtros avancados ficam acessiveis sem dominar a tela;
- lista sobe visualmente.

---

## Fase 3 - Fluxos criticos operacionais

### MOB-020 - Reconstruir `Fila` em variante mobile
**Prioridade:** P0  
**Arquivos alvo:**  
- [src/portals/ops/FilaPage.jsx](/d:/ComplianceHub/src/portals/ops/FilaPage.jsx)
- [src/portals/ops/FilaPage.css](/d:/ComplianceHub/src/portals/ops/FilaPage.css)
- shared mobile list

**Problema:** triagem operacional principal ainda e tabular e comprimida.

**Elementos afetados:**
- KPIs iniciais;
- filtros;
- tabela;
- checkboxes;
- botoes `Assumir` e `Abrir`.

**Justificativa tecnica:** checkboxes nativos pequenos e tabela com colunas demais para o viewport.

**Justificativa funcional:** a principal tarefa do admin no celular nao fica praticavel.

**Implementacao segura:**
- usar cards com:
  - nome do candidato;
  - empresa;
  - status;
  - prioridade;
  - resumo de risco;
  - CTA `Abrir`;
  - CTA `Assumir` quando cabivel;
- mover selecao em massa para modo explicito:
  - `Selecionar` ativa checkboxes maiores;
- compactar KPIs em grade `2x2` apenas se houver valor.

**Risco:** medio-alto  
**Impacto no fluxo:** critico.

**Criterios de aceite:**
- triar e abrir um caso com uma mao;
- sem scroll horizontal;
- selecao em massa continua funcionando;
- desktop permanece igual.

### MOB-021 - Reconstruir `Todos os Casos` em variante mobile
**Prioridade:** P0  
**Arquivos alvo:**  
- [src/portals/ops/CasosPage.jsx](/d:/ComplianceHub/src/portals/ops/CasosPage.jsx)
- [src/portals/ops/CasosPage.css](/d:/ComplianceHub/src/portals/ops/CasosPage.css)

**Problema:** excesso de KPIs, filtros e colunas.

**Implementacao segura:**
- aplicar `FilterPanelMobile`;
- aplicar `MobileDataCardList`;
- reduzir KPIs para resumo enxuto;
- nos cards, mostrar apenas:
  - candidato;
  - tenant;
  - status;
  - veredito;
  - score;
  - CTA `Abrir`.

**Risco:** medio  
**Impacto no fluxo:** alto.

**Criterios de aceite:**
- busca e filtros funcionam;
- cards mostram dados suficientes para decidir sem abrir tudo;
- tela deixa de parecer planilha no celular.

### MOB-022 - Reprojetar `Gestao de clientes`
**Prioridade:** P1  
**Arquivos alvo:**  
- [src/portals/ops/ClientesPage.jsx](/d:/ComplianceHub/src/portals/ops/ClientesPage.jsx)
- [src/portals/ops/ClientesPage.css](/d:/ComplianceHub/src/portals/ops/ClientesPage.css)
- [src/ui/components/Modal/Modal.css](/d:/ComplianceHub/src/ui/components/Modal/Modal.css)

**Problemas:**
- espaco morto no hero;
- tabela cortada;
- configuracao de tenant longa demais.

**Justificativa tecnica:** o arranjo do hero em mobile ainda herda logica de desktop.

**Implementacao segura:**
- remover crescimento desnecessario do bloco de busca;
- mover CTA para junto do campo de busca sem espaco morto;
- lista mobile por cliente:
  - tenant;
  - responsavel;
  - email;
  - resumo de fases;
  - CTA `Configurar`;
- separar `Novo cliente` de `Configuracao avancada` em dois fluxos:
  - modal curto para criar;
  - painel/drawer separado para configurar.

**Risco:** medio  
**Impacto no fluxo:** alto para admins.

**Criterios de aceite:**
- sem grande area vazia;
- lista legivel no iPhone;
- criar cliente funciona sem rolagem excessiva;
- configuracao avancada nao amontoa tudo num mesmo fluxo.

### MOB-023 - Reprojetar `Auditoria`
**Prioridade:** P0  
**Arquivos alvo:**  
- [src/portals/ops/AuditoriaPage.jsx](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.jsx)
- [src/portals/ops/AuditoriaPage.css](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.css)

**Problema:** tabela de logs e ilegivel no iPhone.

**Implementacao segura:**
- lista vertical com item de evento:
  - data/hora;
  - usuario;
  - acao;
  - alvo;
  - resumo do detalhe;
  - IP em secundario;
- permitir expandir cada item para detalhe completo;
- busca continua visivel;
- filtro de acao vai para painel colapsavel.

**Risco:** medio  
**Impacto no fluxo:** critico para consulta de logs.

**Criterios de aceite:**
- log fica legivel sem zoom;
- detalhe completo continua disponivel;
- vazio, loading e erro permanecem claros.

### MOB-024 - Reprojetar `Relatorios Publicos`
**Prioridade:** P1  
**Arquivos alvo:**  
- [src/portals/ops/RelatoriosPage.jsx](/d:/ComplianceHub/src/portals/ops/RelatoriosPage.jsx)
- [src/portals/ops/RelatoriosPage.css](/d:/ComplianceHub/src/portals/ops/RelatoriosPage.css)

**Problema:** hero bom, listagem ruim.

**Implementacao segura:**
- manter hero;
- criar cards por relatorio com:
  - token curto;
  - candidato;
  - criado em;
  - expira em;
  - status;
  - CTA `Revogar`;
- ampliar CTA `Revogar`;
- manter confirmacao atual.

**Risco:** medio  
**Impacto no fluxo:** medio-alto.

**Criterios de aceite:**
- localizar e revogar um relatorio no iPhone e simples;
- estados ativo/expirado/revogado permanecem claros;
- desktop nao muda.

### MOB-025 - Refinar `Metricas IA`
**Prioridade:** P2  
**Arquivos alvo:**  
- [src/portals/ops/MetricasIAPage.css](/d:/ComplianceHub/src/portals/ops/MetricasIAPage.css)
- [src/portals/ops/MetricasIAPage.jsx](/d:/ComplianceHub/src/portals/ops/MetricasIAPage.jsx)

**Problemas:**
- tabs pequenas;
- cards longos;
- tabela final apertada.

**Implementacao segura:**
- aumentar tabs para `44px`;
- reduzir altura dos cards e espacos verticais;
- converter `Resumo por Franquia` para cards no mobile;
- reorganizar `Tokens & Custo` para dois grupos mais compactos.

**Risco:** baixo-medio  
**Impacto no fluxo:** medio.

**Criterios de aceite:**
- leitura rapida do dashboard em ate 2 dobras iniciais;
- tabela final nao depende de grid estreito;
- desktop preservado.

### MOB-026 - Refinar `Saude dos Provedores`
**Prioridade:** P2  
**Arquivos alvo:**  
- [src/portals/ops/SaudePage.css](/d:/ComplianceHub/src/portals/ops/SaudePage.css)
- [src/portals/ops/SaudePage.jsx](/d:/ComplianceHub/src/portals/ops/SaudePage.jsx)

**Problema:** pagina esta boa, mas o header ainda pode ser mais curto.

**Implementacao segura:**
- compactar hero;
- aproximar CTA de atualizar sem bloco alto demais;
- reduzir padding vertical dos cards.

**Risco:** baixo  
**Impacto no fluxo:** baixo-medio.

**Criterios de aceite:**
- tela continua limpa;
- primeira dobra mostra mais conteudo util.

---

## Fase 4 - Fluxos criticos do cliente

### MOB-030 - Reprojetar `Minhas Solicitacoes`
**Prioridade:** P1  
**Arquivos alvo:**  
- [src/portals/client/SolicitacoesPage.jsx](/d:/ComplianceHub/src/portals/client/SolicitacoesPage.jsx)
- [src/portals/client/SolicitacoesPage.css](/d:/ComplianceHub/src/portals/client/SolicitacoesPage.css)

**Problemas:**
- lista ainda tabular;
- filtros empilhados demais;
- heatmap sem boa hierarquia;
- drawer denso.

**Implementacao segura:**
- aplicar `FilterPanelMobile`;
- aplicar cards por solicitacao;
- transformar `Heatmap` em toggle secundario dentro do painel de filtros;
- CTA `Nova Solicitacao` permanece fixo no topo da pagina;
- card deve mostrar:
  - nome;
  - status;
  - veredito;
  - score;
  - indicadores;
  - abertura do detalhe.

**Risco:** medio  
**Impacto no fluxo:** alto.

**Criterios de aceite:**
- usuario consegue localizar e abrir uma solicitacao rapidamente;
- filtros nao ocupam a primeira dobra inteira;
- card deixa claro se o caso pede atencao.

### MOB-031 - Simplificar drawer de detalhe da solicitacao
**Prioridade:** P1  
**Arquivos alvo:**  
- [src/ui/components/Drawer/Drawer.css](/d:/ComplianceHub/src/ui/components/Drawer/Drawer.css)
- [src/portals/client/SolicitacoesPage.jsx](/d:/ComplianceHub/src/portals/client/SolicitacoesPage.jsx)
- [src/portals/client/SolicitacoesPage.css](/d:/ComplianceHub/src/portals/client/SolicitacoesPage.css)

**Problema:** tabs demais e pouca hierarquia.

**Implementacao segura:**
- trocar tabs por:
  - `Resumo`;
  - `Evidencias`;
  - `Linha do tempo`;
  ou accordion equivalente;
- fixar resumo do caso e badge de veredito no topo;
- mover informacoes secundarias para secoes recolhiveis;
- tornar CTA de acao final mais evidente.

**Risco:** medio  
**Impacto no fluxo:** alto.

**Criterios de aceite:**
- a “resposta do caso” fica clara no topo;
- o usuario entende rapidamente porque o caso esta assim;
- navegar entre secoes nao exige precisao excessiva.

### MOB-032 - Reprojetar `Exportacoes`
**Prioridade:** P1  
**Arquivos alvo:**  
- [src/portals/client/ExportacoesPage.jsx](/d:/ComplianceHub/src/portals/client/ExportacoesPage.jsx)
- [src/portals/client/ExportacoesPage.css](/d:/ComplianceHub/src/portals/client/ExportacoesPage.css)

**Problemas:**
- formulario bom;
- historico ruim.

**Implementacao segura:**
- manter o bloco `Nova exportacao` quase intacto;
- converter historico em cards:
  - formato;
  - escopo;
  - data;
  - quantidade;
  - CTA de download/abrir.

**Risco:** baixo-medio  
**Impacto no fluxo:** medio.

**Criterios de aceite:**
- gerar exportacao continua simples;
- acompanhar historico deixa de depender de tabela cortada.

### MOB-033 - Reprojetar `Equipe`
**Prioridade:** P1  
**Arquivos alvo:**  
- [src/portals/client/EquipePage.jsx](/d:/ComplianceHub/src/portals/client/EquipePage.jsx)
- [src/portals/client/EquipePage.css](/d:/ComplianceHub/src/portals/client/EquipePage.css)

**Problemas:**
- lista de membros ainda tabular;
- seletor de papel apertado;
- modal precisa pequenos ajustes.

**Implementacao segura:**
- converter tabela em lista/card de usuario:
  - avatar;
  - nome;
  - email;
  - papel;
  - status;
  - acoes;
- manter KPIs e hero com leve compactacao;
- no modal:
  - empilhar `senha provisoria` e `Gerar` em larguras menores;
  - reduzir header e footer.

**Risco:** medio  
**Impacto no fluxo:** medio-alto.

**Criterios de aceite:**
- mudar papel ou status de um usuario no celular fica confortavel;
- modal continua claro e rapido;
- estado “voce” continua evidente.

### MOB-034 - Refinar `Perfil`
**Prioridade:** P2  
**Arquivos alvo:**  
- [src/pages/PerfilPage.css](/d:/ComplianceHub/src/pages/PerfilPage.css)
- [src/pages/PerfilPage.jsx](/d:/ComplianceHub/src/pages/PerfilPage.jsx)

**Problema:** a pagina e estavel, mas alta demais.

**Implementacao segura:**
- compactar hero;
- aproximar `Seguranca`;
- reduzir paddings verticais;
- revisar largura do botao `Redefinir senha`.

**Risco:** baixo  
**Impacto no fluxo:** baixo-medio.

**Criterios de aceite:**
- editar nome e redefinir senha ficam mais proximos do topo;
- visual permanece limpo.

---

## Fase 5 - Formularios longos e detalhes densos

### MOB-040 - Reestruturar `Nova Solicitacao`
**Prioridade:** P1  
**Arquivos alvo:**  
- [src/portals/client/NovaSolicitacaoPage.jsx](/d:/ComplianceHub/src/portals/client/NovaSolicitacaoPage.jsx)
- [src/portals/client/NovaSolicitacaoPage.css](/d:/ComplianceHub/src/portals/client/NovaSolicitacaoPage.css)

**Problema:** formulario nao quebra, mas cansa.

**Implementacao segura:**
- quebrar em etapas:
  - `Dados do candidato`;
  - `Redes sociais`;
  - `Observacoes`;
  - `Revisao`;
- persistir estado local entre etapas;
- manter validacao atual;
- exibir progresso;
- mover CTA principal para rodape fixo ou bloco de acoes mais proximo.

**Risco:** medio-alto  
**Impacto no fluxo:** alto.

**Criterios de aceite:**
- envio completo no iPhone sem sensacao de formulario “interminavel”;
- nenhuma etapa perde dados ao navegar;
- payload final segue igual.

### MOB-041 - Reestruturar `CasoPage` operacional para uso movel assistido
**Prioridade:** P1  
**Arquivos alvo:**  
- [src/portals/ops/CasoPage.jsx](/d:/ComplianceHub/src/portals/ops/CasoPage.jsx)
- [src/portals/ops/CasoPage.css](/d:/ComplianceHub/src/portals/ops/CasoPage.css)
- [src/ui/components/EnrichmentPipeline/EnrichmentPipeline.css](/d:/ComplianceHub/src/ui/components/EnrichmentPipeline/EnrichmentPipeline.css)

**Problema:** tudo aparece, mas a decisao nao e guiada.

**Implementacao segura:**
- criar topo de resumo fixo:
  - candidato;
  - status;
  - veredito;
  - score;
  - CTA principal;
- mover pipeline e evidencias para secoes recolhiveis;
- tornar a navegacao de etapas mais clara e maior para toque;
- revisar formularios de correcao e modais auxiliares.

**Risco:** alto  
**Impacto no fluxo:** alto para analistas.

**Criterios de aceite:**
- o analista entende o estado do caso sem percorrer a pagina inteira;
- concluir/revisar caso no celular fica possivel para cenarios comuns;
- desktop continua detalhado.

---

## Fase 6 - Dashboards e refinamentos

### MOB-050 - Enxugar `Dashboard Cliente`
**Prioridade:** P2  
**Arquivos alvo:**  
- [src/portals/client/DashboardClientePage.jsx](/d:/ComplianceHub/src/portals/client/DashboardClientePage.jsx)
- [src/portals/client/DashboardClientePage.css](/d:/ComplianceHub/src/portals/client/DashboardClientePage.css)

**Implementacao segura:**
- reduzir hero;
- aproximar metricas mais acionaveis;
- simplificar grafico mensal;
- diminuir altura dos cards.

**Risco:** baixo  
**Impacto no fluxo:** medio.

### MOB-051 - Revisar relatorio publico compartilhado
**Prioridade:** P2  
**Arquivos alvo:**  
- [src/pages/PublicReportPage.jsx](/d:/ComplianceHub/src/pages/PublicReportPage.jsx)
- [src/pages/PublicReportPage.css](/d:/ComplianceHub/src/pages/PublicReportPage.css)

**Implementacao segura:**
- converter metadados iniciais para lista vertical no mobile;
- manter botoes finais bem visiveis;
- garantir que informacoes longas quebrem sem cortar.

**Risco:** baixo  
**Impacto no fluxo:** medio-baixo.

---

## Checklist tecnico por fase

### Depois da Fase 1
- topbar compacta em `ops`, `client`, `demo`;
- menu abre/fecha corretamente;
- `body scroll lock` nao prende pagina de forma errada;
- nenhuma acao critica abaixo de `44x44`.

### Depois da Fase 2
- existe primitive reutilizavel para listas mobile;
- filtros avancados podem ser recolhidos;
- desktop continua usando tabela.

### Depois da Fase 3
- `Fila`, `Casos`, `Auditoria`, `Clientes`, `Relatorios` sao operaveis no iPhone;
- principais fluxos operacionais deixam de depender de scroll horizontal.

### Depois da Fase 4
- cliente consegue listar, abrir, exportar e gerenciar equipe sem friccao severa;
- drawer e modais ficam confortaveis no mobile.

### Depois da Fase 5
- formularios longos e detalhe de caso passam a guiar a tarefa;
- CTAs finais ficam proximos do contexto.

### Depois da Fase 6
- dashboards ficam mais rapidos de ler;
- refinamentos finais nao reabrem problemas estruturais.

## Riscos de regressao a monitorar
- quebra do desktop ao compartilhar CSS sem gating por breakpoint;
- quebra de navegacao entre `ops`, `client` e `demo`;
- perda de informacao ao migrar tabela para cards;
- estados vazios/loading/erro ficando inconsistentes entre desktop e mobile;
- drawers e modais com scroll interno ruim;
- nomes longos de tenant/candidato reintroduzindo truncamento ruim.

## Sugestao de execucao em sprints

### Sprint 1
- MOB-000
- MOB-001
- MOB-002
- MOB-003
- MOB-010
- MOB-011

### Sprint 2
- MOB-020
- MOB-021
- MOB-023

### Sprint 3
- MOB-022
- MOB-024
- MOB-030
- MOB-031

### Sprint 4
- MOB-032
- MOB-033
- MOB-040

### Sprint 5
- MOB-041
- MOB-025
- MOB-026
- MOB-034
- MOB-050
- MOB-051

## Arquivos com maior prioridade de intervencao
- [src/ui/layouts/Topbar.css](/d:/ComplianceHub/src/ui/layouts/Topbar.css)
- [src/ui/layouts/Topbar.jsx](/d:/ComplianceHub/src/ui/layouts/Topbar.jsx)
- [src/ui/layouts/Sidebar.css](/d:/ComplianceHub/src/ui/layouts/Sidebar.css)
- [src/ui/styles/shared-tables.css](/d:/ComplianceHub/src/ui/styles/shared-tables.css)
- [src/index.css](/d:/ComplianceHub/src/index.css)
- [src/portals/ops/FilaPage.jsx](/d:/ComplianceHub/src/portals/ops/FilaPage.jsx)
- [src/portals/ops/CasosPage.jsx](/d:/ComplianceHub/src/portals/ops/CasosPage.jsx)
- [src/portals/ops/AuditoriaPage.jsx](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.jsx)
- [src/portals/ops/ClientesPage.jsx](/d:/ComplianceHub/src/portals/ops/ClientesPage.jsx)
- [src/portals/client/SolicitacoesPage.jsx](/d:/ComplianceHub/src/portals/client/SolicitacoesPage.jsx)
- [src/portals/client/NovaSolicitacaoPage.jsx](/d:/ComplianceHub/src/portals/client/NovaSolicitacaoPage.jsx)
- [src/portals/ops/CasoPage.jsx](/d:/ComplianceHub/src/portals/ops/CasoPage.jsx)

## Matriz obrigatoria de validacao por viewport e rota

### Breakpoints obrigatorios
- `320px`: pior caso de largura pequena; valida empilhamento extremo.
- `390px`: baseline principal usada na auditoria real.
- `430px`: iPhone Max e Androids largos; valida espacos e alinhamento.
- `768px`: valida transicao entre mobile e tablet.

### Rotas que precisam ser revisitadas em toda fase compartilhada
- `ops/fila`
- `ops/casos`
- `ops/clientes`
- `ops/auditoria`
- `ops/relatorios`
- `ops/metricas-ia`
- `ops/saude`
- `client/solicitacoes`
- `client/nova-solicitacao`
- `client/exportacoes`
- `client/equipe`
- `client/perfil`

### Estados obrigatorios a validar por tela critica
- `loading`
- `empty`
- `error`
- `success`
- `nome longo`
- `tenant/franquia longa`
- `acao desabilitada`
- `modal aberto`
- `drawer aberto`

### Cenarios obrigatorios por categoria
- `Shell`: abrir menu, trocar tema, navegar, fechar menu, voltar para a lista.
- `Listas`: buscar, abrir filtros, limpar filtros, abrir item, acionar CTA primario.
- `Tabelas migradas para cards`: verificar ordem visual, truncamento, CTA e ausencia de scroll horizontal obrigatorio.
- `Formularios`: foco, teclado virtual, rolagem ate CTA, erro de validacao e submit.
- `Drawers e modais`: travamento correto do fundo, scroll interno, fechamento por botao e por overlay quando aplicavel.

## Sequenciamento recomendado em PRs

### PR-01 - Baseline e guardrails
- `MOB-000`
- screenshots e checklist de regressao
- sem alteracao visual de producao

### PR-02 - Shell mobile compartilhado
- `MOB-001`
- `MOB-002`
- `MOB-003`
- foco exclusivo em header, sidebar, toque e chrome global

### PR-03 - Primitives de lista e filtros
- `MOB-010`
- `MOB-011`
- sem migrar paginas ainda, exceto demo de validacao local

### PR-04 - Operacional critico I
- `MOB-020`
- `MOB-021`
- foco em triagem e consulta operacional

### PR-05 - Operacional critico II
- `MOB-023`
- `MOB-022`
- `MOB-024`
- foco em auditoria, clientes e relatorios

### PR-06 - Cliente critico I
- `MOB-030`
- `MOB-031`
- foco em listar e entender solicitacoes

### PR-07 - Cliente critico II
- `MOB-032`
- `MOB-033`
- foco em exportacoes e equipe

### PR-08 - Formularios e caso detalhado
- `MOB-040`
- `MOB-041`
- PR de maior cuidado, com walkthrough manual completo

### PR-09 - Dashboards e perfis
- `MOB-025`
- `MOB-026`
- `MOB-034`
- `MOB-050`
- `MOB-051`

## Checklist de liberacao sem regressao
- nenhum PR de mobile altera payload, endpoint, regra de permissao ou ordenacao de negocio sem justificativa separada;
- toda mudanca em componente compartilhado e validada em `ops`, `client` e `demo`;
- toda tela migrada preserva CTA primario, estados vazios e mensagens de erro;
- toda acao destrutiva ou sensivel continua com confirmacao onde ja existia;
- toda lista migrada continua acessivel por teclado e por leitores de tela no minimo no nivel atual;
- nenhum componente introduz scroll interno oculto sem indicacao visual;
- o desktop permanece com a tabela original ou layout equivalente;
- o comportamento do iPhone Chrome e revalidado depois de cada fase `P0` e `P1`.

## Recomendacoes de rollout
- fazer merge por fase concluida e nao por "mega-entrega" unica;
- capturar screenshots antes e depois de cada PR critico;
- usar dados reais de nomes longos e tenants grandes no smoke test;
- revisar com usuario final pelo menos `Fila`, `Solicitacoes` e `Nova Solicitacao` antes de fechar as fases `P0/P1`;
- se uma migracao de tabela gerar ruido no desktop, reverter apenas a camada mobile da pagina afetada, sem desfazer o restante da fase.
