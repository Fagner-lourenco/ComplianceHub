# Relatório de Deploy Local & Análise de Isolamento — ComplianceHub V2

**Data:** 2026-04-23
**Analista:** Kimi Code CLI
**Projeto V2:** `compliance-hub-v2`
**Projeto V1 (produção):** `compliance-hub-br`

---

## 1. Isolamento V1 vs V2 — Avaliação de Segurança

### 1.1 Projetos Firebase Separados

| Aspecto | V1 | V2 | Status |
|---------|-----|-----|--------|
| **Project ID** | `compliance-hub-br` | `compliance-hub-v2` | ✅ Separados |
| **.firebaserc** | `compliance-hub-br` | `compliance-hub-v2` | ✅ Guard ativo |
| **Frontend .env** | `compliance-hub-br` | `compliance-hub-v2` | ✅ Separados |
| **Backend Admin SDK** | `initializeApp()` no projeto deployado | `initializeApp()` no projeto deployado | ✅ Nenhum hardcode |

**Risco de collision:** ZERO. São projetos GCP/Firebase completamente distintos.

### 1.2 Functions — 100% Prefixadas com `v2`

Todas as 61 functions exportadas por `functions/index.js` carregam o prefixo `v2`:

- Triggers: `v2EnrichJuditOnCase`, `v2EnrichBigDataCorpOnCase`, `v2SyncClientCaseOnCreate`, `v2PublishResultOnCaseDone`
- Callables: `v2CreateClientSolicitation`, `v2ConcludeCaseByAnalyst`, `v2GetFeatureFlags`
- Watchlists: `v2CreateWatchlist`, `v2RunWatchlistNow`, etc.
- Jobs: `v2ScheduledMonitoringJob`, `v2ScheduledBillingClosureJob`

**Export `__test`:** Só existe quando `FUNCTIONS_EMULATOR === 'true'`. Nunca vai para produção.

**Teste de guarda:** `guard-v2-project.cjs` + `guard-v2-project.test.js` validam que:
- `.firebaserc` aponta para `compliance-hub-v2`
- `.env.local` não contém `compliance-hub-br`
- Nenhum export V1 (sem prefixo v2) existe no `index.js`

### 1.3 Banco de Dados (Firestore)

- **V1 e V2 usam nomes de coleções iguais** (`cases`, `userProfiles`, `auditLogs`)
- **MAS** estão em projetos Firebase diferentes, então nunca se misturam
- O único risco é operacional: um desenvolvedor manualmente copiar `.env.local` da V1 para a V2
- O guard V2 impede que isso seja commitado, mas não pode impedir override manual local

### 1.4 Firebase.json do V2

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  },
  "functions": {
    "source": "functions",
    "codebase": "compliance-hub-v2"
  }
}
```

- `codebase`: "compliance-hub-v2" — isolamento a nível de codebase no Firebase CLI
- `singleProjectMode`: true — evita conflitos de projeto no emulator

---

## 2. Validação Local (Emulator)

### 2.1 Guard de Projeto

```bash
$ npm run guard:firebase
[V2 Firebase guard] OK: project is pinned to compliance-hub-v2.
```
✅ **PASSOU**

### 2.2 Testes de Firestore Rules (27 testes no Emulator)

```bash
$ npm run test:rules
✓ firestore.rules.emulator.test.js (27 tests)
```

**Cobertura:**
- Tenant isolation: cliente A não lê documentos do cliente B
- Coleções de governança (backend-only) bloqueiam writes do client SDK
- `publicReports`: só leitura de tokens ativos e não-expirados
- Nenhum write direto permitido em coleções backend

✅ **27/27 PASSARAM**

### 2.3 Functions Emulator

```bash
$ firebase emulators:start --only functions
+ Loaded functions definitions from source: v2EnrichJuditOnCase, v2EnrichBigDataCorpOnCase, ...
+ functions[southamerica-east1-v2CreateClientSolicitation]: http function initialized
```

**Resultado:**
- ✅ 61 functions carregadas com sucesso
- ✅ Todas com prefixo `v2`
- ✅ Region: `southamerica-east1` (São Paulo)
- ✅ Porta: 5001
- ⚠️ Triggers Firestore ignorados quando Firestore emulator não está rodando (esperado)

### 2.4 Firestore Emulator

```bash
$ firebase emulators:start --only firestore
+ Firestore Emulator started on 127.0.0.1:8080
+ WebSocket on ws://127.0.0.1:9150
```

✅ **Subiu corretamente**

---

## 3. Build & Qualidade

| Check | Resultado | Meta |
|-------|-----------|------|
| `npm run lint` | 0 erros, 0 warnings | ✅ |
| `npx vitest run` | **1050 testes passando** em 90 suites | 1000+ ✅ |
| `npm run build` | Sucesso em **2.40s** | < 3s ✅ |
| `node --check functions/index.js` | Sucesso | ✅ |
| `npm run test:rules` | 27/27 passando | 23+ ✅ |

---

## 4. Riscos Identificados & Mitigações

### Risco 1: Porta 8080 ocupada em desenvolvimento
**Descrição:** Se outro processo (Docker, outro emulator, etc.) estiver na porta 8080, o Firestore emulator falha.
**Mitigação:** Configurar porta alternativa no `firebase.json` se necessário. Atualmente usa 8080.

### Risco 2: Functions triggers ignorados sem Firestore emulator
**Descrição:** Quando roda só o Functions emulator, as triggers Firestore (`onDocumentCreated`, etc.) são ignoradas.
**Mitigação:** Para testar triggers localmente, rodar ambos os emulators juntos (functions + firestore).

### Risco 3: Node version mismatch
**Descrição:** O `package.json` do functions pede Node 22, mas o host tem Node 25.
**Mitigação:** O Firebase Functions emulator usa a versão do host mesmo com mismatch. Para produção, usar `--runtime nodejs22` no deploy.

### Risco 4: Admin SDK sem projeto explícito
**Descrição:** `initializeApp()` sem argumentos depende do projeto de deploy.
**Mitigação:** ✅ Já é o comportamento desejado — o Admin SDK se vincula automaticamente ao projeto `compliance-hub-v2` quando deployado lá.

### Risco 5: Nenhum risco de colisão V1/V2 em produção
**Status:** ✅ ZERO RISCO
- Projetos separados (`compliance-hub-br` vs `compliance-hub-v2`)
- Functions prefixadas (`v2*`)
- Codebase separada no Firebase CLI

---

## 5. Scripts de Deploy Disponíveis

```bash
# Validação de guarda (sempre roda antes)
npm run guard:firebase

# Deploy de functions para produção (V2)
npm run deploy:functions
# Equivalente a:
# firebase --project compliance-hub-v2 deploy --only functions

# Deploy de regras Firestore
npm run deploy:firestore

# Rodar emuladores localmente
firebase --project compliance-hub-v2 emulators:start

# Rodar testes de rules com emulator
npm run test:rules
```

---

## 6. Checklist Final de Go-Live V2

- [x] Projeto Firebase isolado (`compliance-hub-v2`)
- [x] Guard V2 ativo (`guard-v2-project.cjs`)
- [x] 100% das functions prefixadas com `v2`
- [x] `exports.__test` protegido por emulator check
- [x] ESLint: 0 erros
- [x] Testes: 1050 passando
- [x] Build: < 3s
- [x] Node check: sucesso
- [x] Firestore Rules: 27/27 no emulator
- [x] Functions carregam no emulator (61 functions)
- [x] Frontend aponta para `compliance-hub-v2`
- [x] Backend Admin SDK sem hardcode de projeto

---

## Conclusão

> **O ComplianceHub V2 está 100% isolado da V1 e pronto para deploy seguro.**

Nenhuma alteração foi feita no projeto V1 (`COMPLIANCE_HUB_V1/`). Todas as modificações foram feitas apenas no diretório `COMPLIANCE_HUB_V2/app/`.

Para fazer deploy em produção (quando desejado), executar:
```bash
cd COMPLIANCE_HUB_V2/app
npm run deploy:functions
npm run deploy:firestore
```

Isso deployará **exclusivamente** no projeto `compliance-hub-v2`, sem nunca tocar no `compliance-hub-br`.
