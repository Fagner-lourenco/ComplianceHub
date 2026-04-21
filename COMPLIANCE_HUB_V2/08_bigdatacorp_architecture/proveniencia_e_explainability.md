# Proveniencia e explainability

## Objetivo

Garantir que todo fato, alerta, score, decisao e relatorio possam ser explicados com rastreabilidade.

## Niveis de explainability

### Fato

Exemplo:

```txt
Fato: processo criminal ativo encontrado.
Origem: BigDataCorp/processes.
Consulta: 2026-04-20 23:25.
Snapshot: raw_123.
Registro: provider_record_456.
Confianca: high.
Visibilidade: report_safe.
```

### Sinal

Exemplo:

```txt
Sinal: risco criminal alto.
Motivo: processo criminal ativo + mandado ativo.
Evidencias: ev_1, ev_2.
Impacto no score: +40.
```

### Decisao

Exemplo:

```txt
Decisao: NOT_RECOMMENDED.
Score: 92.
Motivos: mandado ativo, processo criminal ativo, divergencia de fontes.
Revisado por: analystId.
Data: timestamp.
```

### Relatorio

Exemplo:

```txt
Relatorio: report_abc.
Build: v2.0.0.
Decision: dec_123.
Public snapshot hash: hash.
Evidencias incluidas: ev_1, ev_2.
Evidencias omitidas: ev_3 por ser interna.
```

## Campos obrigatorios por item auditavel

- `tenantId`.
- `caseId`.
- `subjectId`.
- `sourceSnapshotId`.
- `providerRecordId`.
- `createdAt`.
- `createdBy`.
- `visibility`.
- `confidence`.
- `explanation`.

## Regras de seguranca

- Payload bruto nunca deve ir para o cliente.
- Evidencia interna nunca deve entrar em `clientCases`.
- Relatorio publico deve usar snapshot imutavel.
- Alteracao do analista deve gerar audit event.
- Regerar relatorio deve criar nova versao, nao sobrescrever silenciosamente.

