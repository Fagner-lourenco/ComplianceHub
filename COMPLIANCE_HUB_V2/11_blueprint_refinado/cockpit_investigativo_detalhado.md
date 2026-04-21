# Cockpit investigativo detalhado

## 1. Finalidade

O cockpit investigativo existe para responder com rapidez e defensabilidade:

> **"Esta pessoa ou empresa e confiavel para a decisao que preciso tomar?"**

Ele nao e um dashboard decorativo. Ele e o ambiente de trabalho do analista.

## 2. Problemas operacionais que resolve

- reduzir tempo de leitura de dados dispersos;
- destacar o que realmente afeta a decisao;
- mostrar evidencias e origem sem exigir abrir varias telas;
- evitar decisao baseada em dado stale;
- evitar relatorio publicado sem snapshot valido;
- padronizar revisao humana;
- registrar justificativa e trilha de auditoria;
- separar dado interno de dado cliente-safe;
- reduzir retrabalho quando o mesmo sujeito ja foi consultado.

## 3. Principios de UX

### 3.1 Mostrar primeiro o que importa para decidir

O cockpit deve priorizar:

- identidade do sujeito;
- risco atual;
- alertas criticos;
- divergencias;
- evidencias-chave;
- pendencias de revisao;
- decisao sugerida;
- status do relatorio.

### 3.2 Evidencia antes de narrativa

A narrativa deve ser consequencia das evidencias. O analista precisa ver por que o sistema sugeriu um risco.

### 3.3 Decisao sempre visivel

O painel de decisao deve estar sempre acessivel. O analista nao pode se perder em dados e esquecer o objetivo.

### 3.4 Hierarquia visual rigorosa

O cockpit deve separar:

- critico;
- relevante;
- contextual;
- tecnico;
- restrito.

### 3.5 Menos cliques, mais contexto

O analista deve conseguir:

- abrir evidencia;
- aceitar/ignorar sinal;
- pedir nova consulta;
- marcar divergencia resolvida;
- escrever justificativa;
- gerar preview de relatorio;
- concluir caso.

Sem navegar por varias paginas.

### 3.6 Explainability nativa

Cada sinal deve responder:

- qual evidencia sustentou;
- qual fonte consultada;
- quando foi obtida;
- qual regra/modelo/narrativa gerou o sinal;
- qual peso/gravidade;
- quem revisou.

## 4. Layout macro

### 4.1 Barra superior

Conteudo:

- nome/razao social do sujeito;
- CPF/CNPJ mascarado conforme permissao;
- tipo PF/PJ;
- tenant/cliente/franquia;
- status do caso;
- prioridade/SLA;
- risco atual;
- modulos habilitados;
- acoes: salvar, consultar, concluir, devolver, gerar relatorio.

### 4.2 Busca global

Entrada:

- CPF;
- CNPJ;
- nome;
- razao social;
- caseId;
- report token;
- identificadores secundarios.

Resultado:

- casos;
- sujeitos;
- dossies;
- relatorios;
- evidencias permitidas.

### 4.3 Painel esquerdo: fila operacional

Mostra:

- casos pendentes;
- casos em enriquecimento;
- casos aguardando revisao;
- casos bloqueados;
- casos prontos para concluir;
- prioridade;
- SLA;
- cliente;
- modulo;
- risco preliminar.

### 4.4 Painel central: dossie

Coracao do cockpit.

Secoes:

- resumo executivo;
- identificacao;
- risco;
- evidencias-chave;
- processos/mandados/listas conforme modulo;
- vinculos PF/PJ;
- timeline;
- notas do analista.

### 4.5 Painel direito: sinais e decisao

Sempre visivel.

Conteudo:

- risk signals;
- divergencias;
- bloqueios;
- checklist de revisao;
- veredito sugerido;
- veredito final;
- justificativa;
- status do report snapshot.

### 4.6 Drawer inferior/lateral: evidencia

Abre quando o analista clica em um sinal, fato ou evento.

Conteudo:

- titulo da evidencia;
- origem;
- provider/dataset interno, quando permitido ao perfil;
- timestamp;
- payload/trecho normalizado;
- confianca;
- vinculo com fatos/sinais;
- historico de revisao.

### 4.7 Painel de relatorio

Conteudo:

- preview;
- secoes incluidas;
- campos cliente-safe;
- alertas de completude;
- versao/snapshot;
- botao gerar/publicar;
- link publico valido.

## 5. Modos e contextos

### 5.1 Modo fila

Objetivo: decidir o que trabalhar agora.

Mostra:

- prioridade;
- risco preliminar;
- SLA;
- cliente;
- etapa;
- bloqueios;
- ultima atualizacao.

### 5.2 Modo caso

Objetivo: conduzir uma demanda ate decisao e relatorio.

Mostra:

- contexto do pedido;
- modulos solicitados;
- sujeito vinculado;
- status das consultas;
- revisao;
- decisao;
- publicacao.

### 5.3 Modo entidade PF

Objetivo: entender pessoa fisica como sujeito investigativo.

Mostra:

- identidade;
- documentos;
- enderecos;
- contatos;
- processos;
- mandados;
- vinculos empresariais;
- sinais;
- timeline.

### 5.4 Modo entidade PJ

Objetivo: entender empresa como sujeito investigativo.

Mostra:

- cadastro;
- CNPJ;
- socios;
- administradores;
- participacoes;
- enderecos;
- situacao;
- processos;
- sinais;
- vinculos com PF/PJ.

### 5.5 Modo evidencia

Objetivo: inspecionar o material que sustenta conclusoes.

Mostra:

- origem;
- data de consulta;
- dado normalizado;
- trecho bruto quando perfil permite;
- confianca;
- relacao com fatos/sinais;
- quem revisou.

### 5.6 Modo revisao

Objetivo: transformar evidencias em decisao.

Mostra:

- checklist;
- divergencias;
- evidencias pendentes;
- narrativas sugeridas;
- justificativa;
- decisao final.

### 5.7 Modo relatorio

Objetivo: produzir output cliente-safe.

Mostra:

- secoes;
- preview;
- alertas de campos faltantes;
- versao;
- token/link;
- status de publicacao.

### 5.8 Modo comparacao historica

Objetivo: comparar estado atual com consulta/decisao anterior.

Fase recomendada: vendavel/premium.

Mostra:

- novos fatos;
- fatos removidos;
- risco alterado;
- novas relacoes;
- relatorios anteriores.

## 6. Componentes do cockpit

### 6.1 Fila operacional

Funcoes:

- priorizar trabalho;
- identificar gargalos;
- filtrar por cliente/modulo/status/risco;
- mostrar bloqueios;
- mostrar casos com relatorio pendente.

Campos minimos:

- caseId;
- cliente;
- sujeito;
- tipo PF/PJ;
- status;
- risco preliminar;
- SLA;
- etapa;
- pendencia.

### 6.2 Detalhe do caso

Funcoes:

- concentrar demanda operacional;
- mostrar solicitante e contexto;
- mostrar modulos contratados;
- conectar caso ao dossie;
- registrar revisao e decisao.

### 6.3 Dossie PF

Funcoes:

- consolidar identidade e contexto de pessoa fisica;
- organizar evidencias por modulo;
- mostrar sinais de risco;
- reutilizar dados entre casos.

Secoes:

- identificacao;
- documentos;
- enderecos;
- contatos;
- processos;
- mandados;
- midia/listas quando contratado;
- vinculos;
- timeline;
- decisoes anteriores.

### 6.4 Dossie PJ

Funcoes:

- consolidar contexto empresarial;
- mapear socios/administradores;
- identificar vinculos e sinais.

Secoes:

- dados cadastrais;
- situacao;
- socios;
- participacoes;
- enderecos;
- processos;
- risco reputacional;
- vinculos com PF/PJ;
- timeline.

### 6.5 Timeline investigativa

Funcoes:

- ordenar eventos por tempo;
- separar consulta, fato, evento juridico, revisao e decisao;
- facilitar narrativa do relatorio.

Tipos de evento:

- consulta realizada;
- evidencia criada;
- fato identificado;
- relacao detectada;
- sinal gerado;
- analista revisou;
- decisao aprovada;
- relatorio publicado.

### 6.6 Visualizacao de vinculos

V2 minima:

- lista agrupada de relacoes.

V2 vendavel:

- mini-mapa de relacoes com filtros.

V2 premium:

- grafo interativo com expansao, pesos, filtros e trilha de evidencia.

### 6.7 Viewer de evidencias

Funcoes:

- mostrar evidencia com origem;
- permitir marcar como relevante, irrelevante ou precisa revisao;
- vincular evidencia a sinal;
- impedir que narrativa seja criada sem suporte.

### 6.8 Painel de risk signals

Funcoes:

- listar sinais detectados;
- agrupar por gravidade;
- explicar origem;
- permitir revisao/override;
- destacar bloqueios.

Exemplos de sinais:

- mandado ativo;
- processo criminal relevante;
- divergencia de identidade;
- vinculo societario sensivel;
- dado stale;
- evidencia incompleta;
- divergencia entre fontes.

### 6.9 Painel de decisao

Funcoes:

- mostrar veredito sugerido;
- coletar veredito final;
- exigir justificativa;
- validar checklist;
- gerar `Decision`;
- liberar `ReportSnapshot`.

Estados:

- rascunho;
- aguardando revisao;
- aprovado;
- publicado;
- reaberto.

### 6.10 Report composer

Funcoes:

- compor secoes do relatorio;
- mostrar conteudo cliente-safe;
- indicar campos faltantes;
- bloquear publicacao se snapshot estiver incompleto;
- gerar preview.

### 6.11 Painel de divergencias

Funcoes:

- mostrar divergencias entre fontes;
- classificar impacto;
- exigir resolucao quando critico;
- registrar justificativa do analista.

### 6.12 Painel de auditoria

Funcoes:

- mostrar quem consultou;
- quem revisou;
- quem aprovou;
- quem publicou;
- quando relatorio foi aberto;
- qual snapshot foi usado.

### 6.13 Painel de custos/consultas

Funcoes:

- mostrar internamente consumo por provider/modulo;
- evitar consultas duplicadas;
- apoiar monetizacao por consumo.

Restricao:

- nao expor custo interno ao cliente, salvo relatorio gerencial contratado.

### 6.14 Painel de proveniencia

Funcoes:

- responder "de onde veio isso?";
- ligar fato a evidencia;
- ligar evidencia a snapshot;
- ligar snapshot a provider request.

## 7. Fluxo operacional ponta a ponta

1. Demanda entra pelo portal cliente ou pelo operador.
2. Sistema cria caso operacional.
3. Sistema cria ou localiza sujeito.
4. Sistema verifica se existe dossie/snapshot reutilizavel.
5. Politica de freshness decide reaproveitar, atualizar ou solicitar nova consulta.
6. Provider contract executa consulta.
7. Sistema registra `ProviderRequest`.
8. Sistema armazena `RawSnapshot`.
9. Normalizador gera `ProviderRecord`.
10. Mapper cria `EvidenceItem`, `Fact` e `Relationship`.
11. Motor simples gera `RiskSignal`.
12. Cockpit apresenta resumo, sinais, evidencias e pendencias.
13. Analista revisa evidencias e resolve divergencias.
14. Analista confirma ou altera veredito.
15. Supervisor aprova quando regra exigir.
16. Sistema cria `Decision` versionada.
17. Sistema cria `ReportSnapshot`.
18. Sistema cria `ClientProjection`.
19. Sistema cria/atualiza `PublicReport`.
20. Cliente ve resultado e abre relatorio preenchido.
21. Acesso e publicacao ficam auditados.

## 8. Informacao por prioridade

### 8.1 Logo de cara

- identidade;
- risco;
- alertas criticos;
- bloqueios;
- status de consultas;
- decisao pendente;
- relatorio pronto ou nao.

### 8.2 Segundo nivel

- processos detalhados;
- mandados;
- vinculos;
- timeline;
- divergencias;
- historico de casos.

### 8.3 Sob demanda

- evidencia completa;
- payload bruto permitido;
- logs de provider;
- detalhes tecnicos;
- versoes de normalizador;
- custos internos.

### 8.4 Apenas analista senior/admin

- raw payload;
- override de sinais criticos;
- reabertura apos publicacao;
- revogacao de relatorio;
- configuracao de modulos;
- politicas de freshness.

### 8.5 Nunca para cliente

- payload bruto;
- nomes internos de APIs sensiveis;
- custo de provider;
- logs tecnicos;
- heuristicas internas;
- notas internas restritas;
- campos fora da whitelist cliente-safe.

## 9. Alertas e produtividade

### 9.1 Alertas visuais

- risco alto;
- evidencia critica sem revisao;
- divergencia de identidade;
- snapshot stale;
- provider falhou;
- relatorio nao gerado;
- caso pronto sem publicacao;
- publicacao bloqueada;
- SLA vencendo.

### 9.2 Filas inteligentes

Filas recomendadas:

- novos casos;
- enriquecimento pendente;
- revisao necessaria;
- divergencia critica;
- aguardando supervisor;
- relatorio pendente;
- publicado;
- devolvido ao cliente.

### 9.3 Atalhos operacionais

- aceitar narrativa sugerida;
- abrir evidencia do sinal;
- marcar divergencia resolvida;
- pedir nova consulta;
- gerar preview;
- copiar justificativa padronizada;
- concluir com checklist valido.

### 9.4 Automacoes simples

- prefill de resumo executivo;
- agrupamento de evidencias;
- sugestao de risk signals;
- alerta de dados stale;
- bloqueio de relatorio incompleto;
- deduplicacao de consulta recente.

## 10. Cockpit por fase

### 10.1 Cockpit minimo

Deve conter:

- header do caso;
- status dos modulos;
- resumo do sujeito;
- evidencias-chave;
- sinais simples;
- painel de revisao;
- checklist de conclusao;
- geracao de report snapshot;
- link do relatorio.

Nao precisa conter:

- grafo;
- timeline rica;
- comparacao historica;
- watchlist.

### 10.2 Cockpit vendavel

Deve conter:

- dossie PF/PJ;
- timeline;
- painel de evidencias;
- painel de divergencias;
- risk signals explicaveis;
- report composer;
- auditoria por decisao;
- visualizacao simples de vinculos;
- reuso de dossie.

### 10.3 Cockpit premium

Deve conter:

- grafo interativo;
- watchlists;
- alert inbox;
- comparacao historica;
- monitoramento;
- dashboards operacionais;
- regras configuraveis;
- priorizacao automatica.

## 11. Erros a evitar

- cockpit bonito demais e inutil;
- graficos sem decisao acionavel;
- esconder evidencia atras de muitas abas;
- misturar cliente-safe com interno;
- deixar decisao fora do fluxo visual;
- permitir publicacao sem snapshot;
- mostrar tudo com a mesma importancia;
- transformar o analista em digitador de narrativas;
- deixar IA escrever sem base evidencial.

## 12. Definicao de sucesso

O cockpit sera bem-sucedido se:

- reduzir tempo medio de analise;
- reduzir retrabalho;
- aumentar consistencia dos relatorios;
- diminuir decisoes sem justificativa;
- permitir auditar cada conclusao;
- impedir relatorio vazio/incompleto;
- tornar facil explicar "por que decidimos isso".

