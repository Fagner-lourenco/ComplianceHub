# Guia de Deploy — Compliance Hub V2 Backend

## Pré-requisitos

- Node.js 22
- Firebase CLI (`npm install -g firebase-tools`)
- Acesso ao projeto Firebase `compliance-hub-v2`

## 1. Configurar variáveis de ambiente

```bash
cd app/functions
cp .env.example .env.local
# Edite .env.local com seus valores reais
```

Variáveis obrigatórias:
- `BIGDATACORP_ACCESS_TOKEN`
- `BIGDATACORP_TOKEN_ID`

## 2. Verificar health check

```bash
node scripts/healthCheck.js
```

## 3. Deploy das Cloud Functions

```bash
firebase deploy --only functions
```

Funções deployadas:
- `apiV1` — REST API v1 (onRequest)
- `enrichBigDataCorpOnCaseV2` — Trigger BDC-first
- `onModuleRunUpdatedV2` — Trigger de retry/progresso
- Todas as legacy functions (preservadas via bootstrap.js)

## 4. Deploy dos índices Firestore

```bash
firebase deploy --only firestore:indexes
```

## 5. Testar endpoints

```bash
# Criar dossiê
curl -X POST https://southamerica-east1-compliance-hub-v2.cloudfunctions.net/apiV1/dossiers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subjectType":"pf","document":"05023290336","name":"Teste","presetKey":"compliance"}'

# Listar dossiês
curl https://southamerica-east1-compliance-hub-v2.cloudfunctions.net/apiV1/dossiers \
  -H "Authorization: Bearer $TOKEN"
```

## 6. Monitoramento

- Logs: Firebase Console > Functions > Logs
- Métricas: Cloud Monitoring
- Custos BDC: `providerRequests` collection

## Rollback

Se necessário, o monolito legacy ainda está funcional em `bootstrap.js`.
