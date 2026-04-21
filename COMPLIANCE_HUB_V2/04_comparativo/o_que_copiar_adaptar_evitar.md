# O que copiar, adaptar e evitar

## Copiar conceitualmente

Do Marble:

- Case events.
- Inboxes.
- Decision separada do caso.
- Regras/screening explicaveis.
- Data model/pivots como inspiracao.
- Continuous screening como direcao futura.

Do Ballerine:

- Workflow runtime.
- Collection flow.
- Documentos e pendencias.
- Manual review formal.
- Entidades PF/PJ como dominio.
- Backoffice por entidade.

## Adaptar para ComplianceHub

- `Case` do Marble vira `InvestigationCase`.
- `Decision` do Marble vira `CaseDecision` com evidencias BigDataCorp/Judit/Escavador.
- `Client360` do Marble vira `EntityDossier`.
- `WorkflowRuntimeData` do Ballerine vira `ReviewWorkflow`.
- `Business`/`EndUser` do Ballerine vira `Company`/`Person`.
- `Document` do Ballerine vira documento/evidencia/pendencia do cliente.
- `Alert` vira `RiskSignal` e depois `MonitoringAlert`.

## Evitar

- Copiar repositorios inteiros.
- Reescrever tudo antes de estabilizar publicacao e relatorio.
- Criar rule builder visual na primeira onda.
- Criar SDK publico antes de contratos internos.
- Adotar monorepo complexo sem necessidade.
- Expor ao cliente a complexidade investigativa interna.
- Misturar payload bruto de provider com dominio canonico.

## Criar do zero

- Modelo brasileiro CPF/CNPJ/processos/mandados.
- BigDataCorp-first architecture.
- Evidence/provenance store.
- Dossie investigativo reutilizavel.
- Relatorio comercial com snapshot imutavel.
- Explicabilidade por fato, alerta e decisao.

