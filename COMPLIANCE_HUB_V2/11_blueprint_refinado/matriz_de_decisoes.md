# Matriz de decisoes de produto e arquitetura

## 1. Objetivo

Registrar o que ja esta decidido, o que ainda esta em aberto e o que depende de validacao antes da implementacao.

## 2. Matriz

| Tema | Status | Justificativa | Impacto | Risco | Proxima acao |
|---|---|---|---|---|---|
| Arquitetura propria | Decidido | Marble e Ballerine sao referencias, mas nao resolvem exatamente o caso Brasil-first/BigDataCorp-first | Evita clone inadequado | Escopo proprio exige disciplina | Manter como principio de produto |
| BigDataCorp-first | Decidido | Contexto de negocio define BigDataCorp como fonte central | Orienta provider contract e normalizacao | Acoplamento ao provider | Criar anti-corruption layer |
| Produto principal = dossie investigativo | Decidido | Consulta isolada tem baixo valor; dossie e unidade comercial | Clareza de venda | Dossie mal definido virar relatorio simples | Definir pacotes PF/PJ |
| Modelo comercial hibrido | Decidido recomendado | SaaS + consumo + dossie + relatorio + monitoramento futuro | Monetizacao mais realista | Complexidade de billing | Comecar com pacotes simples |
| Caso diferente de dado | Decidido | `cases` atual acumula responsabilidades | Permite dossie reutilizavel | Migracao gradual pode criar duplicacao | Criar `Subject` e `Evidence` ao lado |
| `cases` como envelope operacional | Decidido | Mantem producao e reduz risco | Transicao segura | Legado persistir demais | Definir campos de referencia V2 |
| Evidence store | Decidido | Base para explainability e auditoria | Aumenta defensabilidade | Modelagem generica demais | Comecar com `EvidenceItem` minimo |
| Raw snapshots | Decidido | Necessario para auditoria/provider-first | Permite reprocessamento | Custo e seguranca de armazenamento | Guardar hash/metadados e controlar acesso |
| Report snapshot imutavel | Decidido | Corrige drift e relatorio vazio/stale | Fortalece publicacao | Storage/versionamento | Implementar antes de relatorio V2 |
| `publicResult/latest` como projection | Decidido | Mantem compatibilidade sem virar dominio | Reduz regressao | Equipe continuar usando como fonte | Documentar contrato e testes |
| `clientCases` como projection | Decidido | Portal cliente precisa continuar | Transicao suave | Stale data | Gerar a partir de `ClientProjection` |
| Relatorio a partir de snapshot | Decidido | Relatorio deve refletir decisao aprovada | Evita vazio/incompleto | Demanda refatorar builder | Criar builder baseado em snapshot |
| Revisao humana em decisao critica | Decidido | Confiança comercial e juridica | Diferencial de qualidade | Pode aumentar SLA | Criar regras de bloqueio/aprovacao |
| IA como apoio, nao decisor autonomo | Decidido | Reduz risco e aumenta produtividade | Uso seguro de IA | Analista confiar cegamente | Exigir evidencia por narrativa |
| Firestore no curto prazo | Decidido recomendado | Evita migracao prematura | Velocidade | Limites se modelo crescer | Reavaliar apos V2 vendavel |
| Postgres/relacional | Depende de validacao | Pode ajudar em grafo, relacoes e analytics | Escalabilidade futura | Migracao cara | Avaliar apos dominio canonico estabilizar |
| Rule builder visual | Adiado | Valor futuro, mas alto custo | Diferencial premium | Overengineering | Usar regras versionadas primeiro |
| Grafo completo | Em aberto/premium | Valor investigativo alto, mas depende de relacoes boas | Diferenciacao | Cockpit bonito e inutil | Comecar com lista/mini-grafo |
| Watchlist | Em aberto/premium | Receita futura recorrente | Monitoramento | Custo/provider/legal | Modelar entidade, implementar depois |
| Monitoramento continuo | Premium | Exige politica de reconsulta e alertas | Receita avancada | Alert fatigue e custo | Preparar arquitetura, nao V2 minima |
| Cockpit minimo | Decidido | Necessario para produtividade | Melhora operacao | UI complexa cedo demais | Comecar por resumo, evidencias, sinais e decisao |
| Portal cliente V2 | Decidido | Output comercial depende dele | Experiencia cliente | Vazamento de campos | Whitelist e projection |
| Billing detalhado | Depende de validacao | Modelo comercial precisa precos reais | Monetizacao | Complexidade administrativa | Definir pacotes e metricas de consumo |
| Reuso automatico de dossie | Decidido com cautela | Reduz custo e retrabalho | Margem e velocidade | Reusar dado stale | Politica de freshness por modulo |
| Compartilhamento cross-tenant | Em aberto | Pode gerar eficiencia, mas risco legal | Escala | Privacidade/governanca | Nao implementar sem decisao juridica |
| Nomes de providers na apresentacao comercial | Decidido restrito | Usuario pediu nao expor APIs sensiveis | Segurança comercial | Promessa vaga demais | Falar em fontes qualificadas/modulos |

## 3. Decisoes que precisam ser fechadas antes da primeira implementacao

- Quais pacotes comerciais entram no lancamento: PF essencial, PF completo, PJ, societario.
- Qual janela de freshness por modulo/cliente.
- Quais eventos obrigam aprovacao senior.
- Quais campos entram na projection cliente-safe.
- Qual nivel de raw payload pode ser armazenado e por quanto tempo.
- Qual politica de mascaramento CPF/CNPJ por perfil.
- Qual regra de regeneracao de relatorio.

## 4. Decisoes que podem esperar

- banco relacional;
- grafo completo;
- rule builder visual;
- SDK publico;
- watchlists;
- monitoramento continuo;
- BI avancado;
- marketplace de conectores.

## 5. Conclusao

As decisoes maduras apontam para uma V2 focada em produto compravel:

> **dossie investigativo + decisao rastreavel + relatorio seguro + cockpit operacional.**

As decisoes em aberto nao devem bloquear esse nucleo.

