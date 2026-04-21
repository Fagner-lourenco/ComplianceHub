# Modelo operacional da V2

## 1. Principio operacional

O ComplianceHub V2 deve operar com uma regra simples:

> **Nenhuma decisao critica deve ser publicada sem evidencia, revisao humana, snapshot e projection cliente-safe.**

## 2. Regras de negocio fundamentais

### Regra 1: tudo vira evidencia

Nada relevante entra no sistema sem:

- origem;
- provider/fonte;
- data de consulta;
- contexto;
- snapshot;
- versao do normalizador;
- relacao com caso/sujeito.

### Regra 2: decisao sempre rastreavel

Toda decisao precisa responder:

- por que foi tomada;
- baseada em quais evidencias;
- quando foi tomada;
- por quem;
- qual versao foi publicada;
- qual relatorio foi gerado.

### Regra 3: cliente nunca ve dado bruto sensivel

Cliente so ve projection cliente-safe.

Nunca deve ver:

- payload bruto;
- nomes sensiveis de APIs;
- custo interno;
- logs tecnicos;
- heuristicas internas;
- notas restritas;
- campos fora de whitelist.

### Regra 4: caso nao e dado

Caso e processo operacional.

Dado investigativo vive em:

- subject;
- entity;
- evidence;
- fact;
- relationship;
- signal;
- decision;
- report snapshot.

### Regra 5: reuso de dados e obrigatorio quando seguro

Se ja existe snapshot recente e valido para o mesmo sujeito/modulo/tenant, o sistema deve sugerir reuso.

Nova consulta ocorre quando:

- politica de freshness expirou;
- modulo novo foi solicitado;
- cliente/supervisor pediu atualizacao;
- houve divergencia critica;
- caso exige prova atualizada;
- dado anterior esta incompleto.

### Regra 6: revisao humana em decisoes criticas

Decisoes de alto risco, rejeicao, nao recomendacao, mandado ativo, divergencia critica ou evidencias sensiveis devem exigir revisao humana e, quando configurado, aprovacao senior.

## 3. Papeis

### Cliente solicitante

Pode:

- criar solicitacao;
- acompanhar status;
- responder pendencias;
- abrir relatorio publicado;
- visualizar resultado cliente-safe.

Nao pode:

- ver raw payload;
- editar conclusao;
- acessar notas internas;
- ver custos internos.

### Analista

Pode:

- abrir caso;
- revisar evidencias;
- pedir nova consulta;
- editar narrativa;
- sugerir/verificar decisao;
- preparar relatorio.

Nao pode, salvo permissao:

- aprovar alto risco sozinho;
- revogar relatorio;
- alterar policy;
- acessar raw restrito.

### Analista senior / supervisor

Pode:

- aprovar decisoes criticas;
- resolver divergencias;
- reabrir caso publicado;
- autorizar reconsulta fora da politica;
- revisar overrides.

### Administrador

Pode:

- configurar tenant;
- configurar modulos;
- gerenciar usuarios;
- configurar permissoes;
- consultar auditoria ampliada.

### Sistema/IA

Pode:

- sugerir resumo;
- sugerir sinais;
- agrupar evidencias;
- detectar divergencias;
- pre-preencher narrativa.

Nao pode:

- publicar sozinho;
- ocultar evidencia;
- tomar decisao final critica sem revisao.

## 4. Estados do caso

Estados recomendados:

- `requested`;
- `data_needed`;
- `enrichment_pending`;
- `evidence_ready`;
- `review_required`;
- `in_review`;
- `supervisor_required`;
- `decision_draft`;
- `decision_approved`;
- `report_generating`;
- `report_ready`;
- `published`;
- `correction_requested`;
- `reopened`;
- `archived`;
- `failed`.

## 5. Quando trava

O caso deve travar publicacao quando:

- nao ha decision aprovada;
- nao ha report snapshot;
- report snapshot esta vazio;
- ha evidencia critica sem revisao;
- ha divergencia critica aberta;
- projection cliente-safe falhou;
- public report token nao foi criado;
- whitelisting detectou campo interno;
- dados obrigatorios do relatorio estao ausentes.

## 6. Quando exige nova consulta

Nova consulta deve ser exigida ou sugerida quando:

- snapshot expirou pela politica do tenant/modulo;
- identificador mudou;
- modulo adicional foi contratado;
- provider anterior falhou;
- evidencia e insuficiente para decisao;
- decisao depende de atualidade;
- supervisor solicita;
- cliente reabre/corrige dados.

## 7. Quando reaproveita dossie

Reuso deve ser permitido quando:

- mesmo tenant ou politica permite compartilhamento;
- mesmo sujeito ou match forte de identificador;
- modulos consultados cobrem a demanda;
- snapshot esta dentro da janela configurada;
- nao ha alerta de stale;
- analista confirma quando risco exigir.

## 8. Quando gera novo snapshot

Novo `RawSnapshot`:

- a cada chamada real a provider;
- a cada reconsulta;
- a cada nova fonte/dataset;
- quando payload muda;
- quando normalizador muda e for necessario reprocessar.

Novo `ReportSnapshot`:

- a cada decisao aprovada;
- a cada republicacao com mudanca de conteudo;
- a cada reabertura concluida;
- quando relatorio anterior estiver incompleto/stale.

## 9. Quando cliente ve resultado

Cliente so ve resultado quando:

- caso tem `Decision` aprovada;
- `ReportSnapshot` foi criado;
- `ClientProjection` foi criada;
- `PublicReport` valido existe;
- status esta `published` ou equivalente;
- regras de tenant permitem exibicao.

Antes disso, cliente ve status operacional, nao conclusao parcial.

## 10. Regeneracao de relatorio

### Permitido sem nova decisao

Quando:

- houve ajuste visual;
- houve correcao de template;
- conteudo da decisao nao mudou;
- evidence set e o mesmo;
- `ReportSnapshot` registra versao nova derivada do mesmo `Decision`.

### Exige nova decisao/revisao

Quando:

- evidencia mudou;
- nova consulta foi feita;
- veredito mudou;
- justificativa mudou materialmente;
- houve correcao de dados do sujeito;
- divergencia foi resolvida de forma diferente.

### Nunca permitido

- sobrescrever snapshot antigo sem historico;
- trocar conteudo de relatorio publicado sem nova versao;
- manter mesmo token apontando para conteudo divergente sem audit trail.

## 11. Coerencia entre revisao e publicacao

Cada publicacao deve guardar:

- `caseId`;
- `subjectId`;
- `decisionId`;
- `decisionRevision`;
- `evidenceSetHash`;
- `reportSnapshotId`;
- `clientProjectionId`;
- `publicReportToken`;
- `publishedAt`;
- `publishedBy`;
- `builderVersion`;
- `contentHash`.

## 12. Fluxo de revisao recomendado

1. Analista abre caso.
2. Cockpit mostra evidencias e sinais.
3. Analista resolve divergencias.
4. Analista valida narrativa e highlights.
5. Checklist confirma campos obrigatorios.
6. Sistema calcula/verifica veredito sugerido.
7. Analista define veredito final.
8. Supervisor aprova se regra exigir.
9. Sistema cria `Decision`.
10. Sistema cria `ReportSnapshot`.
11. Sistema gera projection cliente-safe.
12. Sistema publica relatorio.

## 13. Fluxo de devolucao ao cliente

Usar quando:

- dados de entrada insuficientes;
- CPF/CNPJ invalido;
- autorizacao/documento faltante;
- conflito de identidade;
- escopo contratado nao cobre conclusao.

Devolucao deve:

- explicar pendencia em linguagem cliente-safe;
- nao expor detalhe tecnico;
- registrar audit event;
- manter caso em status especifico.

## 14. Fluxo de reabertura

Reabertura deve:

- preservar historico anterior;
- criar nova revision;
- invalidar ou marcar relatorio anterior como substituido;
- exigir justificativa;
- registrar usuario e horario;
- gerar novo snapshot se conteudo mudar.

## 15. Metricas operacionais

Minimas:

- tempo medio de analise;
- tempo em enriquecimento;
- tempo em revisao;
- taxa de reconsulta;
- taxa de relatorio incompleto bloqueado;
- taxa de divergencia;
- taxa de reabertura;
- custo por dossie;
- consumo por modulo;
- SLA por cliente.

## 16. Conclusao

O modelo operacional precisa impedir que a V2 vire apenas uma UI nova.

O diferencial operacional e:

> **cada decisao publicada tem caminho completo de evidencia, revisao, snapshot, projection e auditoria.**

