# Trade-offs da V2

## Firestore vs Postgres

Firestore preserva velocidade, realtime e menor migracao. Postgres facilita relacionamentos, queries, auditoria relacional e grafo leve.

Recomendacao: V2 pode iniciar em Firestore com colecoes canonicas. Avaliar Postgres para V2.5/V3 se grafo/query virar gargalo.

## Rule engine simples vs no-code builder

Motor simples codificado entrega valor rapido e auditavel. Builder no-code aumenta flexibilidade, mas exige UI, versionamento, validacao e governanca.

Recomendacao: `RiskSignal` explicavel na V2; builder visual na V3.

## BigDataCorp-first vs multi-provider generico

BigDataCorp-first acelera valor. Multi-provider generico reduz lock-in, mas aumenta custo inicial.

Recomendacao: contrato provider-agnostic, implementacao BigDataCorp-first.

## Cockpit completo vs tela de revisao incremental

Cockpit completo e diferencial, mas caro. Incremental reduz risco.

Recomendacao: decompor `CasoPage` e adicionar dossie/evidencias primeiro.

## Relatorio rico vs relatorio enxuto

Relatorio rico vende melhor, mas aumenta risco de vazamento e inconsistencias.

Recomendacao: relatorio rico baseado em visibility e snapshot.

## Monitoramento continuo agora vs depois

Agora seria atrativo comercialmente, mas depende de entidade canonica e watchlist.

Recomendacao: preparar dados na V2; vender monitoramento completo na V3.

