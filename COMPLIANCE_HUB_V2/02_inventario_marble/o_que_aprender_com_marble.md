# O que aprender com o Marble

## Aprendizados para incorporar

- Separar caso, decisao, screening, workflow e data model.
- Criar eventos de caso como dominio proprio.
- Ter inbox/fila operacional estruturada.
- Modelar outcome e status de forma mais rica.
- Registrar execucao de regras e explicacao da decisao.
- Criar visao por entidade relacionada ao caso.
- Preparar watchlists e monitoramento continuo com base em entidade canonica.
- Usar observabilidade e metricas como arquitetura, nao como pos-pensamento.

## O que adaptar

O `DataModel` do Marble deve inspirar o futuro grafo/dossie do ComplianceHub, mas a V2 deve comecar com entidades canonicas fixas:

- Person.
- Company.
- Lawsuit.
- Warrant.
- Relationship.
- Evidence.
- SourceSnapshot.
- RiskSignal.
- Decision.

Depois, em V3, pode existir extensibilidade tipo data model configuravel.

## O que evitar

- Copiar o engine generico de regras antes de estabilizar o modelo de evidencias.
- Copiar transaction monitoring se esse nao for o primeiro mercado.
- Construir Client360 generico antes de criar dossie CPF/CNPJ util.
- Trazer complexidade relacional e filas pesadas sem necessidade imediata.

## Melhor inspiracao Marble para a V2

A melhor inspiracao e a disciplina de separacao:

```txt
Dados -> Regras/sinais -> Decisoes -> Casos -> Eventos -> Revisao -> Auditoria
```

ComplianceHub hoje tem partes disso, mas ainda de forma acoplada ao documento `case`.

