# O que aprender com o Ballerine

## Aprendizados para incorporar

- Workflow runtime como estado versionado.
- Contexto de workflow separado da entidade.
- Manual review como parte do fluxo, nao improviso.
- Documentos e pendencias como objetos de dominio.
- Backoffice orientado a entidades e casos.
- Collection flow configuravel para cliente.
- Alertas como dominio separado de transacoes/eventos.

## O que adaptar

Para ComplianceHub V2, adaptar:

- `WorkflowDefinition` -> templates de fluxo por modulo/plano.
- `WorkflowRuntimeData` -> instancia de investigacao/revisao.
- `Business`/`EndUser` -> `Company`/`Person`.
- `Document` -> evidencias/documentos enviados ou coletados.
- `Alert` -> sinais de risco/alertas investigativos.

## O que evitar

- Copiar monorepo completo.
- Criar SDKs antes de produto estabilizado.
- Criar plugin marketplace cedo.
- Reproduzir transaction monitoring como foco inicial.
- Construir workflow visual completo antes de ter fluxo operacional validado.

## Melhor inspiracao Ballerine para V2

A melhor inspiracao e:

```txt
Workflow + coleta + revisao humana + documentos + backoffice por entidade
```

Isso complementa o Marble, que e mais forte em decisioning e case management.

