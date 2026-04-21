# Trade-offs comparativos

## Usar Marble como base

Vantagens:

- Arquitetura madura de decisioning.
- Case management forte.
- Screening e continuous monitoring.
- Data model e pivots.
- Observabilidade e filas.

Desvantagens:

- Foco principal diferente.
- Alto custo de adaptacao para Brasil/BigDataCorp.
- Relatorio comercial e portal cliente nao sao diferenciais centrais.
- Risco de virar plataforma AML generica, nao investigativa brasileira.

Decisao: nao usar como base de codigo. Usar como referencia de arquitetura.

## Usar Ballerine como base

Vantagens:

- Workflow runtime.
- Collection flow.
- KYC/KYB.
- Documentos e revisao manual.
- Backoffice por entidades.

Desvantagens:

- Projeto OSS em reconstrucao.
- Monorepo e SDKs complexos.
- Foco em onboarding/KYB, nao investigacao brasileira.
- Pode gerar overengineering cedo.

Decisao: nao usar como base de codigo. Usar como referencia para workflow/coleta/revisao.

## Evoluir ComplianceHub

Vantagens:

- Produto ja alinhado ao mercado e ao fluxo comercial.
- Ja tem providers brasileiros.
- Ja tem relatorio e portal cliente.
- Ja tem revisao humana e auditoria.
- Menor risco de ruptura.

Desvantagens:

- Monolito serverless.
- Dados acoplados ao caso.
- Falta canonical model.
- Falta evidence store.
- Falta decisioning estruturado.

Decisao: melhor caminho. Evoluir incrementalmente com nova arquitetura interna.

## Trade-off principal da V2

Se a V2 tentar fazer tudo, ela atrasa e vira laboratorio. Se fizer pouco, continua V1.5. O ponto de equilibrio e:

```txt
Modelo canonico + evidencias + BigDataCorp-first + cockpit investigativo + relatorio confiavel
```

Monitoramento continuo, rule builder visual e grafo avancado ficam como expansoes apos a fundacao.

