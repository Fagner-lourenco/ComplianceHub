# Escavador2 API — Correção de Deploy e Integração com ComplianceHub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar a API Escavador2 (`escavador2-api` no Cloud Run) para o estado funcional da revisão `00008-5cm`, corrigir o fingerprint `edge127` não suportado pelo `curl_cffi` e garantir que a integração no ComplianceHub consulte CPFs reais com sucesso.

**Architecture:** A API Escavador2 atua como proxy entre o ComplianceHub e o site público do Escavador. Ela usa `curl_cffi` para impersonar navegadores e BrightData para proxy. A revisão `00009-jjl` falhou porque: (a) todas as variáveis de ambiente BrightData foram concatenadas em `ESCAVADOR_DEBUG`, e (b) o fingerprint `edge127` não é suportado pela versão do `curl_cffi` instalada. O plano faz rollback imediato para `00008-5cm`, depois corrige o código-fonte, rebuilda e testa.

**Tech Stack:** Python 3.12, FastAPI, `curl_cffi`, BrightData proxy, Google Cloud Run, gcloud CLI, Firebase Emulator Suite, Node.js 22, Vitest.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `D:\escavador-api\http_client.py` | Cliente HTTP com rotação de fingerprints `curl_cffi` e proxy BrightData. |
| `D:\escavador-api\requirements.txt` | Dependências Python; precisa pinar `curl_cffi` compatível. |
| `D:\escavador-api\tests\test_http_client.py` | Testes do cliente HTTP; adicionar validação de fingerprints. |
| `D:\escavador-api\Dockerfile` | Imagem de container; já está correta, mas usada no rebuild. |
| `D:\escavador-api\main.py` | Entry FastAPI; não precisa de mudanças. |
| `D:\ComplianceHub\functions\adapters\escavador2.js` | Adapter do ComplianceHub; timeout já aumentado. |
| `D:\ComplianceHub\scripts\test-escavador2-single.cjs` | Script isolado de teste de um CPF. |
| `D:\ComplianceHub\scripts\test-escavador2-local.cjs` | Script isolado de teste de múltiplos CPFs. |

---

## Task 1: Rollback imediato da API Escavador2 para revisão funcional

**Files:**
- Usa: gcloud CLI (não altera código-fonte).

- [ ] **Step 1: Verificar tráfego atual e revisões**

```bash
gcloud run services describe escavador2-api \
  --region=southamerica-east1 \
  --project=compliance-hub-br \
  --format="value(status.traffic)"

gcloud run revisions list \
  --service=escavador2-api \
  --region=southamerica-east1 \
  --project=compliance-hub-br \
  --format="table(metadata.name, metadata.creationTimestamp, status.conditions[0].status)"
```

**Expected output:** tráfego apontando para `escavador2-api-00009-jjl`; revisão `escavador2-api-00008-5cm` com status `True`.

- [ ] **Step 2: Redirecionar 100% do tráfego para revisão 00008-5cm**

```bash
gcloud run services update-traffic escavador2-api \
  --to-revisions escavador2-api-00008-5cm=100 \
  --region=southamerica-east1 \
  --project=compliance-hub-br
```

**Expected output:** `Updated service [escavador2-api].`

- [ ] **Step 3: Validar /health e uma chamada de CPF**

```bash
curl https://escavador2-api-dowqa75f4a-rj.a.run.app/health
```

**Expected output:** `{"status":"ok"}`

```bash
export ESCAVADOR2_KEY=$(gcloud secrets versions access latest \
  --secret=ESCAVADOR2_INTERNAL_API_KEY \
  --project=compliance-hub-br)

curl -X POST https://escavador2-api-dowqa75f4a-rj.a.run.app/escavador2/consultar \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Key: $ESCAVADOR2_KEY" \
  -d '{"cpf":"01630290599","nome":"ANTONIO DIEGO CONCEICAO NOBRE","detalhar":true,"movimentacoes":"risk_only","documentos":"risk_only"}'
```

**Expected output:** JSON com `consulta.status` igual a `DONE` ou `PARTIAL` e `processos` não vazio.

- [ ] **Step 4: Commit do registro (opcional, no ComplianceHub)**

Se quiser documentar o rollback, adicione uma linha em `D:\ComplianceHub\docs\audits\ADR-005-escavador2-integration.md`.

```bash
git add docs/audits/ADR-005-escavador2-integration.md
git commit -m "docs: registra rollback de escavador2-api para 00008-5cm"
```

---

## Task 2: Corrigir fingerprints não suportados em http_client.py

**Files:**
- Modify: `D:\escavador-api\http_client.py:15-25`
- Test: `D:\escavador-api\tests\test_http_client.py` (será criado na Task 4)

- [ ] **Step 1: Detectar fingerprints suportados localmente**

```bash
cd D:\escavador-api
.venv\Scripts\python.exe -c "from curl_cffi import requests as cr; print([b.value for b in cr.BrowserType])"
```

**Expected output:** lista contendo `chrome120`, `chrome123`, `chrome124`, `safari17_0`, `safari15_5`, `firefox131`, mas **sem** `edge127`.

- [ ] **Step 2: Substituir edge127 por um fingerprint suportado**

Edite `D:\escavador-api\http_client.py` e troque a tupla `FINGERPRINTS`:

```python
FINGERPRINTS = (
    "chrome124",
    "chrome123",
    "chrome120",
    "safari17_0",
    "safari15_5",
    "firefox131",
    "chrome119",
)
```

**Rationale:** `edge127` não é suportado pela versão atual do `curl_cffi` e causou `ImpersonateError`. `chrome124` é o mais recente suportado e foi testado com sucesso em cenários semelhantes.

- [ ] **Step 3: Verificar que não há outras referências a edge127**

```bash
cd D:\escavador-api
grep -R "edge127" --include="*.py" .
```

**Expected output:** nenhuma ocorrência.

- [ ] **Step 4: Commit parcial**

```bash
git add http_client.py
git commit -m "fix: remove edge127 fingerprint nao suportado pelo curl_cffi"
```

---

## Task 3: Pinar curl_cffi em versão compatível

**Files:**
- Modify: `D:\escavador-api\requirements.txt:6`

- [ ] **Step 1: Verificar versão atual instalada**

```bash
cd D:\escavador-api
.venv\Scripts\python.exe -c "import curl_cffi; print(curl_cffi.__version__)"
```

**Expected output:** `0.15.0` (ou superior).

- [ ] **Step 2: Atualizar requirements.txt**

Edite `D:\escavador-api\requirements.txt`:

```text
fastapi>=0.115,<1.0
uvicorn[standard]>=0.30,<1.0
curl-cffi>=0.15.0,<1.0
beautifulsoup4>=4.12
lxml>=5.2
playwright>=1.60
pydantic>=2.7,<3.0
requests>=2.32
python-dotenv>=1.0
pytest>=8.0
```

**Rationale:** `curl-cffi>=0.9` era muito permissivo. A imagem de produção pode ter instalado uma versão antiga sem suporte a `chrome124`/`edge127`. Pinar `>=0.15.0` garante compatibilidade com os fingerprints escolhidos.

- [ ] **Step 3: Reinstalar dependências localmente**

```bash
cd D:\escavador-api
.venv\Scripts\python.exe -m pip install --no-cache-dir -r requirements.txt
```

**Expected output:** `Successfully installed curl-cffi-X.Y.Z` com `X.Y.Z >= 0.15.0`.

- [ ] **Step 4: Commit parcial**

```bash
git add requirements.txt
git commit -m "fix: pin curl-cffi >= 0.15.0 para suportar fingerprints atuais"
```

---

## Task 4: Adicionar teste de validação de fingerprints

**Files:**
- Create: `D:\escavador-api\tests\test_http_client.py`

- [ ] **Step 1: Criar teste que garante fingerprints suportados**

```python
import pytest
from http_client import FINGERPRINTS, HttpClient


def test_all_fingerprints_are_supported_by_curl_cffi():
    """Garante que nenhum fingerprint configurado dispare ImpersonateError no runtime."""
    from curl_cffi import requests as curl_requests

    supported = {browser.value for browser in curl_requests.BrowserType}
    unsupported = [fp for fp in FINGERPRINTS if fp not in supported]
    assert not unsupported, f"Fingerprints nao suportados: {unsupported}"


def test_http_client_can_rotate_without_error():
    """Verifica que a rotacao de fingerprint cria sessoes sem erro."""
    client = HttpClient(rotate=True, proxy=None)
    seen = set()
    for _ in range(len(FINGERPRINTS) * 2):
        fingerprint = client.rotate_now()
        assert fingerprint in FINGERPRINTS
        seen.add(fingerprint)
    assert len(seen) == len(FINGERPRINTS)
```

- [ ] **Step 2: Rodar o teste e confirmar passagem**

```bash
cd D:\escavador-api
.venv\Scripts\python.exe -m pytest tests/test_http_client.py -v
```

**Expected output:**

```text
tests/test_http_client.py::test_all_fingerprints_are_supported_by_curl_cffi PASSED
tests/test_http_client.py::test_http_client_can_rotate_without_error PASSED
```

- [ ] **Step 3: Commit parcial**

```bash
git add tests/test_http_client.py
git commit -m "test: garante fingerprints suportados pelo curl_cffi"
```

---

## Task 5: Criar script de deploy correto para Cloud Run

**Files:**
- Create: `D:\escavador-api\scripts\deploy-cloud-run.ps1`

- [ ] **Step 1: Criar script PowerShell com env vars separadas**

```powershell
# scripts/deploy-cloud-run.ps1
# Deploy seguro da API Escavador2 para Cloud Run.
# Cada variável de ambiente é passada com --set-env-vars separadamente.

param(
    [string]$ProjectId = "compliance-hub-br",
    [string]$Region = "southamerica-east1",
    [string]$ServiceName = "escavador2-api",
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

$image = "southamerica-east1-docker.pkg.dev/$ProjectId/cloud-run-source-deploy/${ServiceName}:$ImageTag"

gcloud builds submit --tag $image --project $ProjectId

gcloud run deploy $ServiceName `
  --image $image `
  --region $Region `
  --project $ProjectId `
  --platform managed `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --concurrency 80 `
  --max-instances 10 `
  --timeout 600 `
  --set-env-vars "ESCAVADOR_DEBUG=false" `
  --set-env-vars "BRIGHTDATA_ZONE=residential_proxy1" `
  --set-env-vars "BRIGHTDATA_COUNTRY=br" `
  --set-env-vars "BRIGHTDATA_CA_CERT=/app/certs/brightdata_proxy_33335.crt" `
  --set-env-vars "ESCAVADOR_HTTP_ATTEMPTS=4" `
  --set-env-vars "ESCAVADOR_HTTP_BACKOFF_BASE_SECONDS=2" `
  --set-env-vars "ESCAVADOR_HTTP_BACKOFF_MAX_SECONDS=25" `
  --set-env-vars "ESCAVADOR_REQUEST_DELAY_MIN_MS=1000" `
  --set-env-vars "ESCAVADOR_REQUEST_DELAY_MAX_MS=3500" `
  --set-secrets "ESCAVADOR2_INTERNAL_API_KEY=ESCAVADOR2_INTERNAL_API_KEY:latest" `
  --set-secrets "BRIGHTDATA_CUSTOMER_ID=BRIGHTDATA_CUSTOMER_ID:latest" `
  --set-secrets "BRIGHTDATA_ZONE_PASSWORD=BRIGHTDATA_ZONE_PASSWORD:latest"

Write-Host "Deploy concluido. Verifique /health e uma chamada de teste."
```

**Rationale:** O deploy que gerou `00009-jjl` provavelmente usou `--set-env-vars="ESCAVADOR_DEBUG=false BRIGHTDATA_ZONE=..."` (uma string só), fazendo com que todas as variáveis fossem concatenadas em `ESCAVADOR_DEBUG`. Passar cada uma separadamente evita isso. Secrets continuam vindo do Secret Manager.

- [ ] **Step 2: Criar diretório scripts se não existir**

```bash
mkdir -p D:\escavador-api\scripts
```

- [ ] **Step 3: Commit parcial**

```bash
git add scripts/deploy-cloud-run.ps1
git commit -m "ops: adiciona script de deploy com env vars separadas"
```

---

## Task 6: Build e deploy da API corrigida

**Files:**
- Usa: `D:\escavador-api\scripts\deploy-cloud-run.ps1`

- [ ] **Step 1: Rodar o deploy**

```powershell
cd D:\escavador-api
.\scripts\deploy-cloud-run.ps1
```

**Expected output:** comando termina sem erro e exibe `Deploy concluido.`

- [ ] **Step 2: Verificar nova revisão e env vars separadas**

```bash
gcloud run revisions list \
  --service=escavador2-api \
  --region=southamerica-east1 \
  --project=compliance-hub-br \
  --format="table(metadata.name, metadata.creationTimestamp, status.conditions[0].status)"

gcloud run services describe escavador2-api \
  --region=southamerica-east1 \
  --project=compliance-hub-br \
  --format="value(spec.template.spec.containers[0].env)"
```

**Expected output:**
- Nova revisão (ex: `escavador2-api-00010-xxx`) com status `True`.
- Cada variável (`ESCAVADOR_DEBUG`, `BRIGHTDATA_ZONE`, `BRIGHTDATA_COUNTRY`, etc.) deve aparecer como entrada separada.

- [ ] **Step 3: Validar /health**

```bash
curl https://escavador2-api-dowqa75f4a-rj.a.run.app/health
```

**Expected output:** `{"status":"ok"}`

- [ ] **Step 4: Testar CPF com processos conhecidos**

```bash
export ESCAVADOR2_KEY=$(gcloud secrets versions access latest \
  --secret=ESCAVADOR2_INTERNAL_API_KEY \
  --project=compliance-hub-br)

curl -X POST https://escavador2-api-dowqa75f4a-rj.a.run.app/escavador2/consultar \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Key: $ESCAVADOR2_KEY" \
  -d '{"cpf":"01630290599","nome":"ANTONIO DIEGO CONCEICAO NOBRE","detalhar":true,"movimentacoes":"risk_only","documentos":"risk_only"}'
```

**Expected output:** `consulta.status` = `DONE`/`PARTIAL`, `processos` não vazio, sem `ImpersonateError` ou `ProxyError` nos logs.

- [ ] **Step 5: Commit de tag/release (opcional)**

```bash
git tag -a escavador2-api-v1.1.1 -m "Corrige fingerprints e env vars do deploy"
git push origin escavador2-api-v1.1.1
```

---

## Task 7: Validar adapter do ComplianceHub contra API real

**Files:**
- Usa: `D:\ComplianceHub\scripts\test-escavador2-single.cjs`
- Usa: `D:\ComplianceHub\scripts\test-escavador2-local.cjs`

- [ ] **Step 1: Garantir secret no ComplianceHub**

```bash
gcloud secrets versions access latest --secret=escavador2-api-key --project=compliance-hub-br
```

**Expected output:** chave de 64 caracteres (mesma de `ESCAVADOR2_INTERNAL_API_KEY`). Se não existir ou estiver diferente, recriar:

```bash
# Linux/Mac
KEY=$(gcloud secrets versions access latest --secret=ESCAVADOR2_INTERNAL_API_KEY --project=compliance-hub-br)
printf "%s" "$KEY" > /tmp/key.txt
gcloud secrets create escavador2-api-key --data-file=/tmp/key.txt --project=compliance-hub-br

# Windows (PowerShell)
$key = gcloud secrets versions access latest --secret=ESCAVADOR2_INTERNAL_API_KEY --project=compliance-hub-br
$bytes = [System.Text.Encoding]::UTF8.GetBytes($key.Trim())
[System.IO.File]::WriteAllBytes("$env:TEMP\key.bin", $bytes)
gcloud secrets create escavador2-api-key --data-file="$env:TEMP\key.bin" --project=compliance-hub-br
```

- [ ] **Step 2: Testar um CPF pelo adapter**

```bash
cd D:\ComplianceHub
node scripts/test-escavador2-single.cjs "016.302.905-99" "ANTONIO DIEGO CONCEICAO NOBRE"
```

**Expected output:**

```text
Status: DONE
Total processos: > 0
Criminal: NEGATIVE (0)
Trabalhista: POSITIVE (>=1)
```

- [ ] **Step 3: Testar múltiplos CPFs**

```bash
cd D:\ComplianceHub
node scripts/test-escavador2-local.cjs
```

**Expected output:** todos os CPFs retornam dentro de ~120s, sem timeout, e os resultados batem com a expectativa:
- `016.302.905-99` → processos trabalhistas (Não recomendado).
- `154.673.877-07` → processos trabalhistas/criminais (Não recomendado).
- `922.336.605-44` e `ANDERLON RIBEIRO CAMPOS` → atenção se houver processos.
- CPFs `Apto` → 0 processos ou apenas processos de baixo risco.

- [ ] **Step 4: Commit dos scripts de teste (se ainda não commitados)**

```bash
cd D:\ComplianceHub
git add scripts/test-escavador2-single.cjs scripts/test-escavador2-local.cjs
git commit -m "test: scripts isolados para validar escavador2"
```

---

## Task 8: Validar trigger end-to-end no ComplianceHub (emulador)

**Files:**
- Usa: `firebase.json` do ComplianceHub.

- [ ] **Step 1: Subir emuladores**

```bash
cd D:\ComplianceHub
firebase emulators:start --only functions,firestore
```

**Expected output:** Firestore em `8080`, Functions em `5001`.

- [ ] **Step 2: Criar caso de teste no Firestore emulator**

Use o script `scripts/seed-escavador2-test-case.cjs` (criar se não existir):

```javascript
// scripts/seed-escavador2-test-case.cjs
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const app = initializeApp({
  projectId: 'compliance-hub-br',
});
const db = getFirestore(app);

async function main() {
  const caseId = 'test-escavador2-' + Date.now();
  await setDoc(doc(db, 'cases', caseId), {
    tenantId: 'madero',
    candidateName: 'ANTONIO DIEGO CONCEICAO NOBRE',
    cpf: '016.302.905-99',
    enrichmentStatus: 'DONE',
    bigdatacorpStatus: 'DONE',
    juditStatus: 'DONE',
    escavadorStatus: 'DONE',
    djenStatus: 'DONE',
    escavador2EnrichmentStatus: 'PENDING',
    enrichmentConfig: {
      escavador2: { enabled: true },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log('Caso criado:', caseId);
}

main().catch(console.error);
```

```bash
cd D:\ComplianceHub
node scripts/seed-escavador2-test-case.cjs
```

**Expected output:** `Caso criado: test-escavador2-XXXX`.

- [ ] **Step 3: Verificar execução do trigger e resultado**

Acesse o Firestore emulator via UI (`http://127.0.0.1:4000/firestore`) ou use:

```bash
curl "http://127.0.0.1:8080/v1/projects/compliance-hub-br/databases/(default)/documents/cases/test-escavador2-XXXX"
```

**Expected output:** documento atualizado com:
- `escavador2EnrichmentStatus`: `DONE` ou `PARTIAL`
- `escavador2Processos`: array não vazio
- `escavador2Processos[].isDuplicate`: preenchido
- `escavador2RawPayloads`: presente (dados crus)

- [ ] **Step 4: Verificar logs do Functions emulator**

No terminal do emulador, procure por:

```text
Escavador2 completed
```

sem erros de `ImpersonateError`, `ProxyError` ou `timeout`.

---

## Task 9: Testes de regressão no ComplianceHub

**Files:**
- Usa: `D:\ComplianceHub\functions\adapters\escavador2.test.js`
- Usa: `D:\ComplianceHub\functions\normalizers\escavador2.test.js`
- Usa: `D:\ComplianceHub\functions\helpers\deduplicateEscavador2.test.js`
- Usa: `D:\ComplianceHub\functions\modules\enrichmentPhases.test.js`

- [ ] **Step 1: Rodar testes do backend**

```bash
cd D:\ComplianceHub\functions
npm test
```

**Expected output:** todos os testes passam (aproximadamente 330 testes).

- [ ] **Step 2: Rodar lint do backend**

```bash
cd D:\ComplianceHub\functions
npm run lint
```

**Expected output:** `0` erros.

- [ ] **Step 3: Rodar build e contrato do frontend**

```bash
cd D:\ComplianceHub
npm run build
npm test -- frontendBackendContract.test.js
```

**Expected output:**
- Build completa sem erro.
- Contrato passa (`3 passed`).

- [ ] **Step 4: Lint do frontend**

```bash
cd D:\ComplianceHub
npm run lint
```

**Expected output:** `0` erros (warnings pré-existentes são aceitáveis).

---

## Task 10: Limpeza e documentação

**Files:**
- Modify: `D:\escavador-api\README.md` ou `D:\escavador-api\AGENTS.md`

- [ ] **Step 1: Documentar deploy correto**

Adicione no final de `D:\escavador-api\README.md`:

```markdown
## Deploy para Cloud Run

Nunca passe várias variáveis de ambiente em uma única string `--set-env-vars`.
Use o script:

```powershell
.\scripts\deploy-cloud-run.ps1
```

Ou passe cada variável separadamente com `--set-env-vars`.
```

- [ ] **Step 2: Remover revisão quebrada (opcional, após 24h de validação)**

```bash
gcloud run revisions delete escavador2-api-00009-jjl \
  --service=escavador2-api \
  --region=southamerica-east1 \
  --project=compliance-hub-br
```

**Expected output:** `Deleted revision [escavador2-api-00009-jjl].`

- [ ] **Step 3: Commit final**

```bash
cd D:\escavador-api
git add README.md
git commit -m "docs: documenta deploy correto e historico da correcao"
```

---

## Self-Review

### Spec coverage
- Rollback para revisão funcional: Task 1.
- Correção do fingerprint `edge127`: Task 2.
- Correção das env vars concatenadas: Task 1 (rollback) + Task 5 (script de deploy correto).
- Pin de dependência `curl_cffi`: Task 3.
- Testes de fingerprints: Task 4.
- Validação da API isolada: Task 6.
- Validação do adapter ComplianceHub: Task 7.
- Validação end-to-end no emulador: Task 8.
- Testes de regressão: Task 9.
- Documentação: Task 10.

### Placeholder scan
- Nenhum `TBD`, `TODO` ou referência não definida.
- Cada comando inclui expected output.
- Código completo nas tasks 2, 3, 4, 5 e 8.

### Type consistency
- `FINGERPRINTS` em `http_client.py` continua como tupla de strings.
- Teste usa `curl_requests.BrowserType` conforme API do `curl_cffi`.
- Nomes de env vars (`BRIGHTDATA_ZONE`, `BRIGHTDATA_COUNTRY`, etc.) coincidem entre `.env.example`, `Dockerfile`, script de deploy e Cloud Run.

---

## Execution Handoff

**Plan complete and saved to `D:\ComplianceHub\docs\superpowers\plans\2026-06-13-fix-escavador2-api.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
