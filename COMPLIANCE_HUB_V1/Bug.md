# Bug.md — Auditoria Técnica Consolidada

**Escopo:** auditoria estática dos pacotes `src.zip` e `functions.zip`, sem implementação de alteração no código-fonte.  
**Regra operacional:** este arquivo é cumulativo. Em rodadas futuras, novos achados devem ser acrescentados ao final, sem apagar o histórico.  
**Data da rodada inicial:** 30/04/2026.

---

## Planejamento estratégico das rodadas

### Rodada 1 — Integridade do Dossiê e Fidelidade das Fontes
Inspecionar se o dossiê final, o `publicResult`, os relatórios HTML e os campos derivados representam fielmente os dados armazenados pelos provedores. Foco em divergências entre documentação, normalizadores, enriquecimento, conclusão do caso e renderização.

### Rodada 2 — Segurança, Autenticação, Autorização e Exposição de Dados
Inspecionar isolamento por tenant, permissões de Cloud Functions callable, regras Firestore, exposição acidental de segredos, relatórios públicos, HTML dinâmico, sanitização e possíveis vetores de XSS/injeção.

### Rodada 3 — Fluxo de Dados, Validação, Estados e Idempotência
Inspecionar validações de entrada, CPF/CNPJ, reprocessamento, retries, circuit breaker, estados presos, transições inválidas, correções de cliente, reexecução de provedores e consistência de flags.

### Rodada 4 — UX, Usabilidade e Fidelidade Operacional das Telas
Inspecionar fluxos de cliente e analista, mensagens de erro, inconsistências visuais/função, estados vazios, carregamento, acessibilidade básica, responsividade e clareza do dossiê.

### Rodada 5 — Performance, Escalabilidade e Custos
Inspecionar listeners, queries Firestore, índices, fan-out de triggers, volume de leituras/escritas, chamadas duplicadas a provedores, limites de Cloud Functions, risco de custo e gargalos operacionais.

### Rodada 6 — Testes, Observabilidade e Confiabilidade
Inspecionar cobertura de testes, testes de regras, testes de fluxo de dossiê, mocks de provedores, logs, auditoria, métricas, rastreabilidade e cenários de regressão.

---

## Bugs já identificados antes da Rodada 1 — consolidação inicial

### HIST-001 — Correção do cliente não reseta BigDataCorp
- **Severidade:** P0
- **Status:** Confirmado
- **Evidência Real:** detalhado na Rodada 1 como `BUG-R1-001`. Trechos centrais em `functions/index.js:5013-5122`, `functions/index.js:3276-3304` e `functions/index.js:2608-2639`.
- **Justificativa Técnica:** quando cliente corrige CPF/nome, os campos Judit/Escavador/FonteData/IA são resetados, mas os campos BigDataCorp permanecem. Como a Judit reutiliza o gate BigDataCorp quando ele está `DONE`, há risco de o novo ciclo usar identidade/processos/mandados de pessoa anterior.

### HIST-002 — BigDataCorp `BLOCKED` não encerra obrigatoriamente o pipeline
- **Severidade:** Pendente de severidade final
- **Status:** Pendente de Validação
- **Evidência Real:** em `functions/index.js:2410-2422`, o BigDataCorp marca `bigdatacorpEnrichmentStatus: 'BLOCKED'` e retorna. Em `functions/index.js:3215-3220`, a Judit é disparada quando BigDataCorp transita para estados terminais, incluindo `BLOCKED`, `FAILED` e `SKIPPED`:

```js
const bdcTerminal = ['DONE', 'BLOCKED', 'FAILED', 'SKIPPED'];
if (!bdcTerminal.includes(bdcAfter)) return;
```

- **Justificativa Técnica:** o comportamento pode ser intencional, mas contrasta com o uso do BigDataCorp como gate primário de identidade. A classificação final como bug depende de regra de negócio: se `BLOCKED` significa identidade reprovada, o pipeline deveria parar; se significa apenas falha de gate primário, o fallback é aceitável.

### HIST-003 — Judit desabilitada pode deixar caso preso em `PENDING`
- **Severidade:** P1
- **Status:** Confirmado
- **Evidência Real:** detalhado na Rodada 1 como `BUG-R1-002`. Trechos centrais em `functions/index.js:3240-3243`, `functions/index.js:3355-3359`, `functions/index.js:3390-3396`, `functions/index.js:3494-3499` e `functions/index.js:2474-2484`.
- **Justificativa Técnica:** quando Judit está desabilitada, as triggers apenas retornam sem marcar `juditEnrichmentStatus: 'SKIPPED'`. Como Escavador/DJEN/classificação dependem da Judit estar `DONE`, `PARTIAL` ou estado resolvido, o fluxo pode não avançar.

### HIST-004 — Funções operacionais sem checagem explícita de tenant
- **Severidade:** P0/P1, a validar na Rodada 2
- **Status:** Confirmado como ausência de checagem local; impacto final será aprofundado na Rodada 2
- **Evidência Real:** `assignCaseToCurrentAnalyst` lê o caso e atualiza sem comparar `caseData.tenantId` com `profile.tenantId` em `functions/index.js:5735-5754`. `setAiDecisionByAnalyst` também atualiza sem essa comparação em `functions/index.js:7339-7356`. Como contraste, `returnCaseToClient` faz a checagem em `functions/index.js:5790-5792` e `concludeCaseByAnalyst` em `functions/index.js:7116-7118`.
- **Justificativa Técnica:** funções callable operacionais devem impor isolamento por tenant no servidor. A inconsistência mostra que algumas funções protegem o tenant e outras não.

### HIST-005 — Arquivo `.env.local` incluído no pacote do frontend
- **Severidade:** P0/P1, a validar na Rodada 2
- **Status:** Confirmado
- **Evidência Real:** arquivo `/mnt/data/app_src/.env.local` existe no pacote analisado. Por segurança, os valores não foram reproduzidos. A estrutura contém variáveis nas linhas 1-9, incluindo `VITE_FIREBASE_*`, `FONTEDATA_API_KEY` e `OPENAI_API_KEY`.
- **Justificativa Técnica:** chaves de provedores e OpenAI não devem estar em pacote de frontend nem em artefato compartilhado. Mesmo que variáveis sem prefixo `VITE_` não sejam expostas no bundle do Vite, o arquivo em si vazou no pacote.

---

## Rodada 1 — Integridade do Dossiê e Fidelidade das Fontes

### BUG-R1-001 — Correção do cliente não reseta BigDataCorp e pode misturar identidade antiga com CPF/nome corrigido
- **Severidade:** P0
- **Status:** Confirmado
- **Evidência Real:**

`functions/index.js:5013-5066` — a correção altera nome/CPF e reseta Judit/Escavador/enrichment geral, mas não reseta `bigdatacorp*`:

```js
exports.submitClientCorrection = onCall(
...
batch.update(caseRef, {
    candidateName: String(candidateName).trim(),
    cpf: cpfDigits,
    cpfMasked: maskCpf(cpfDigits),
...
    status: 'PENDING',
    juditEnrichmentStatus: 'PENDING',
    juditError: null,
    escavadorEnrichmentStatus: 'PENDING',
    escavadorError: null,
    enrichmentStatus: 'PENDING',
    enrichmentError: null,
```

`functions/index.js:5067-5092` — limpa classificação/IA e campos publicados, mas continua sem limpar BigDataCorp:

```js
// Clear stale classification and AI data so they don't bleed into re-analysis
autoClassifiedAt: FieldValue.delete(),
criminalFlag: FieldValue.delete(),
...
...buildResetPublishedCaseFields(caseData, {
    preserveReviewDraft: true,
}),
```

`functions/index.js:3276-3304` — BigDataCorp só roda em criação do documento, não em correção:

```js
exports.enrichBigDataCorpOnCase = onDocumentCreated(
    { document: 'cases/{caseId}', ... },
...
await runBigDataCorpEnrichmentPhase(caseRef, caseId, caseData, bdcConfig);
```

`functions/index.js:3338-3363` — a correção reexecuta Judit, não BigDataCorp:

```js
// Guard: only trigger on CORRECTION_NEEDED → PENDING transition
if (before.status !== 'CORRECTION_NEEDED' || after.status !== 'PENDING') return;
...
await runJuditEnrichmentPhase(caseRef, caseId, caseData, juditConfig);
```

`functions/index.js:2613-2639` — Judit reutiliza o gate BigDataCorp se ele estiver `DONE`:

```js
} else if (
    caseData.bigdatacorpEnrichmentStatus === 'DONE' &&
    caseData.bigdatacorpGateResult?.passed === true
) {
    const bdcGate = caseData.bigdatacorpGateResult;
...
    const fallbackIdentity = {
        name: caseData.bigdatacorpName || bdcGate.nameFound || '',
        cpfActive: true,
        cpfStatus: bdcGate.cpfStatus || 'REGULAR',
        birthDate: caseData.bigdatacorpBirthDate || null,
```

- **Justificativa Técnica:** o fluxo permite que, após uma correção de CPF/nome, a Judit considere válido um gate BigDataCorp antigo. Isso viola diretamente a integridade do dossiê, pois dados de identidade, processos, KYC ou mandados do CPF anterior podem contaminar o novo caso.

---

### BUG-R1-002 — Judit desabilitada deixa `juditEnrichmentStatus` pendente e impede avanço natural do pipeline
- **Severidade:** P1
- **Status:** Confirmado
- **Evidência Real:**

`functions/index.js:3240-3243` — no fluxo normal, se Judit está desabilitada, a função apenas retorna:

```js
const juditConfig = await loadJuditConfig(tenantId);
if (!juditConfig.enabled) {
    console.log(`Case ${caseId} [Judit]: disabled for tenant ${tenantId}.`);
    return;
}
```

`functions/index.js:3355-3359` — no fluxo de correção, o mesmo ocorre:

```js
const juditConfig = await loadJuditConfig(tenantId);
if (!juditConfig.enabled) {
    console.log(`Case ${caseId} [Judit correction]: disabled for tenant ${tenantId}.`);
    return;
}
```

`functions/index.js:3390-3396` — Escavador só avança quando Judit conclui `DONE` ou `PARTIAL`:

```js
const statusAfter = after.juditEnrichmentStatus;
...
if (statusAfter !== 'DONE' && statusAfter !== 'PARTIAL') return;
```

`functions/index.js:3494-3499` — DJEN também depende de Judit `DONE` ou `PARTIAL`:

```js
const statusAfter = after.juditEnrichmentStatus;
if (statusBefore === statusAfter) return;
if (statusAfter !== 'DONE' && statusAfter !== 'PARTIAL') return;
```

`functions/index.js:2474-2484` — BigDataCorp só dispara auto-classificação se Judit estiver em status resolvido:

```js
if (isSettledProviderStatus(freshData.juditEnrichmentStatus)) {
    await runAutoClassifyAndAi(caseRef, caseId, freshData);
}
```

- **Justificativa Técnica:** quando Judit está desabilitada para o tenant, o sistema deveria marcar `juditEnrichmentStatus` como `SKIPPED` ou outro estado terminal. Ao apenas retornar, o caso pode permanecer com Judit `PENDING`, impedindo Escavador, DJEN e classificação automática.

---

### BUG-R1-003 — Grupos de processos exibem fonte genérica falsa “Judit / Escavador / BigDataCorp”
- **Severidade:** P1
- **Status:** Confirmado
- **Evidência Real:**

`functions/index.js:5919-5924` — todos os agrupamentos recebem a mesma fonte fixa:

```js
return Object.entries(byArea).map(([area, items]) => ({
    title: area,
    area,
    source: 'Judit / Escavador / BigDataCorp',
    total: items.length,
```

`src/core/reportBuilder.js:107-115` — o frontend renderiza `group.source` no dossiê:

```js
<strong>${esc(group.title || group.area || 'Achado')}</strong>
${group.source ? `<span class="hcard__meta">${esc(group.source)}</span>` : ''}
```

`functions/reportBuilder.cjs:95-103` — o renderizador backend também exibe `group.source`:

```js
<strong>${esc(group.title || group.area || 'Achado')}</strong>
${group.source ? `<span class="hcard__meta">${esc(group.source)}</span>` : ''}
```

- **Justificativa Técnica:** mesmo que um agrupamento contenha somente Judit, somente Escavador ou somente BigDataCorp, o relatório informa as três fontes. Isso quebra fidelidade de fonte e pode induzir o cliente/analista a acreditar que houve validação cruzada inexistente.

---

### BUG-R1-004 — Processos BigDataCorp são lidos com nomes de campos incompatíveis e podem aparecer como “Nº não disponível”
- **Severidade:** P1
- **Status:** Confirmado
- **Evidência Real:**

`functions/normalizers/bigdatacorp.js:123-148` — o normalizador BigDataCorp produz `numero`, `tipo`, `assunto`, `courtType`, `courtName`, etc.:

```js
processos.push({
    numero,
    tipo,
    assunto,
    courtType: getFirst(p, ['CourtType', 'Court Type']),
    courtName: getFirst(p, ['CourtName', 'Court Name']),
...
});
```

`functions/index.js:5884-5908` — `buildProcessHighlights` espera campos diferentes: `numeroCnj`, `area`, `tribunal`, `grau`:

```js
const bdcItems = caseData.bigdatacorpProcessos || [];
for (const p of bdcItems) {
    const cnj = p.numeroCnj || '';
...
    area: p.area || null,
    court: p.tribunal || null,
    classification: p.assunto || null,
    stage: p.grau || null,
    source: 'BigDataCorp',
```

`functions/index.js:1490-1520` — outra função do próprio backend usa corretamente os campos BigDataCorp, confirmando a incompatibilidade local:

```js
const cnj = p.numero || '';
...
area: p.courtType || p.cnjBroadSubject || 'N/A',
classe: p.cnjProcedure || p.tipo || null,
assunto: p.assunto || p.cnjSubject || null,
status: p.status || 'N/A',
```

- **Justificativa Técnica:** `buildProcessHighlights` não lê corretamente o CNJ e metadados do BigDataCorp. O resultado pode ser processo relevante sem número, sem área correta, sem tribunal e agrupado em “Outros”, degradando o dossiê final.

---

### BUG-R1-005 — Deduplicação de CNJ em `buildProcessHighlights` não normaliza números
- **Severidade:** P2
- **Status:** Confirmado
- **Evidência Real:**

`functions/index.js:1236` — existe função de normalização de CNJ:

```js
function normCnj(v) { return String(v || '').replace(/\D/g, ''); }
```

`functions/index.js:5842-5859` — Judit/Escavador são comparados com string crua:

```js
if (p.code) seenCnj.add(p.code);
...
const cnj = p.numeroCnj || '';
if (cnj && seenCnj.has(cnj)) {
    const existing = relevant.find((r) => r.processNumber === cnj);
```

`functions/index.js:5887-5897` — BigDataCorp também usa string crua:

```js
const cnj = p.numeroCnj || '';
if (cnj && seenCnj.has(cnj)) {
    const existing = relevant.find((r) => r.processNumber === cnj);
...
if (cnj) seenCnj.add(cnj);
```

`functions/index.js:1406-1446` e `functions/index.js:1490-1497` — outra função do mesmo arquivo deduplica corretamente com `normCnj`:

```js
const nk = cnj ? normCnj(cnj) : null;
if (nk && seen.has(nk)) {
    const existing = all.find((e) => normCnj(e.cnj) === nk);
```

- **Justificativa Técnica:** o mesmo processo pode vir com pontuação diferente entre provedores. Sem normalização, o dossiê pode duplicar apontamentos, inflar totais por área e sugerir múltiplos processos onde há apenas um.

---

### BUG-R1-006 — Mandados BigDataCorp são considerados na classificação, mas omitidos de `warrantFindings` e da validação rígida de conclusão
- **Severidade:** P0
- **Status:** Confirmado
- **Evidência Real:**

`functions/normalizers/bigdatacorp.js:329-397` — BigDataCorp normaliza mandados ativos:

```js
const activeWarrants = warrantEntries.filter((w) => w.isActive !== false);
...
bigdatacorpHasArrestWarrant: hasArrestWarrant,
bigdatacorpActiveWarrants: activeWarrants,
```

`functions/index.js:4246-4255` — a classificação automática usa mandados BigDataCorp para marcar `warrantFlag = 'POSITIVE'`:

```js
const bigdatacorpWarrants = Array.isArray(caseData.bigdatacorpActiveWarrants) ? caseData.bigdatacorpActiveWarrants : [];
const bigdatacorpHasWarrant = bigdatacorpWarrants.length > 0 || caseData.bigdatacorpHasArrestWarrant === true;

if (juditWarrantPositive || fontedataWarrant || bigdatacorpHasWarrant) {
    result.warrantFlag = 'POSITIVE';
```

`functions/index.js:6469-6475` e `functions/index.js:6588-6600` — os textos determinísticos também consideram BigDataCorp:

```js
const allWarrants = [...(caseData.juditWarrants || []), ...(caseData.bigdatacorpActiveWarrants || [])];
```

`functions/index.js:5935-5961` — porém `buildWarrantFindings` só publica Judit e FonteData, não BigDataCorp:

```js
const findings = (caseData.juditWarrants || []).map((w) => ({
    ...
    source: 'Judit',
}));
// FonteData is a reserve provider — only include its warrant finding when Judit returned nothing
```

`functions/index.js:7125-7134` — a validação rígida de conclusão só bloqueia se Judit tiver mandado ativo:

```js
if (
    (caseData.juditActiveWarrantCount || 0) > 0 &&
    updatePayload.warrantFlag &&
    !['POSITIVE', 'INCONCLUSIVE'].includes(updatePayload.warrantFlag)
) {
```

- **Justificativa Técnica:** o sistema reconhece mandado BigDataCorp na classificação, mas não publica detalhes em `warrantFindings` e não impede conclusão incompatível quando o mandado veio apenas do BigDataCorp. Isso pode gerar dossiê final sem o achado mais sensível ou permitir decisão final negativa diante de mandado ativo.

---

### BUG-R1-007 — `sourceSummary` perde fontes reais e pode gerar `[object Object]`
- **Severidade:** P1
- **Status:** Confirmado
- **Evidência Real:**

`functions/index.js:6779-6781` — lê `enrichmentSources` apenas quando existe `.source`:

```js
Object.entries(caseData.enrichmentSources || {}).forEach(([phase, sourceData]) => {
    if (sourceData?.source) pushUnique(`${phase}: ${sourceData.source}`);
});
```

`functions/index.js:6793-6795` — objetos são convertidos diretamente para string:

```js
if (typeof bucket === 'object') {
    Object.values(bucket).forEach((item) => pushUnique(String(item || '')));
}
```

`functions/index.js:6798-6799` — só adiciona Judit e Escavador, omitindo BigDataCorp e DJEN:

```js
appendSourceBucket(caseData.juditSources);
appendSourceBucket(caseData.escavadorSources);
```

`functions/normalizers/judit.js:194-198`, `functions/normalizers/escavador.js:131-137` e `functions/normalizers/bigdatacorp.js:201-207` — os normalizadores usam `_source.provider`, `_source.endpoint`, `_source.dataset`, etc., não `.source`:

```js
_source: {
    provider: 'judit',
    endpoint: 'lawsuits',
```

```js
_source: {
    provider: 'escavador',
    endpoint: 'envolvido/processos',
```

```js
_source: {
    provider: 'bigdatacorp',
    dataset: 'processes',
```

`src/core/reportBuilder.js:232-237` e `functions/reportBuilder.cjs:219-223` — `sourceSummary` aparece no relatório como “Origem resumida dos dados”:

```js
${c.sourceSummary ? `<p><strong>Origem resumida dos dados:</strong> ${esc(c.sourceSummary)}</p>` : ''}
```

- **Justificativa Técnica:** o resumo de fontes pode omitir provedores relevantes ou exibir valores genéricos como `[object Object]`. Isso compromete a rastreabilidade do dossiê e a fidelidade sobre quais bases realmente foram consultadas.

---

### BUG-R1-008 — TTL do relatório público está em 365 dias, divergindo da ADR de 14 dias
- **Severidade:** P1
- **Status:** Confirmado
- **Evidência Real:**

`src/README.md:614-618` — a decisão arquitetural determina TTL de 14 dias:

```md
### ADR-003 — Relatório Público com TTL de 14 dias
**Decisão:** Reduzir o TTL de 30 para 14 dias.
```

`functions/index.js:5217-5218` — relatório criado pelo analista expira em 365 dias:

```js
const TTL_DAYS = 365;
const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
```

`functions/index.js:5392-5393` — relatório criado pelo cliente também expira em 365 dias:

```js
const TTL_DAYS = 365;
const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
```

- **Justificativa Técnica:** relatório público contém dados sensíveis de compliance/candidato. A documentação afirma janela curta de 14 dias, mas o código expõe links por 365 dias, ampliando a superfície de exposição e descumprindo requisito declarado.

---

### BUG-R1-009 — Links sociais “outros” são gravados como objeto, mas renderizados como string
- **Severidade:** P2
- **Status:** Confirmado
- **Evidência Real:**

`src/portals/client/NovaSolicitacaoPage.jsx:184-187` — o frontend adiciona outros links sociais como objeto `{ label, url }`:

```js
setForm((previous) => ({
    ...previous,
    otherSocialUrls: [...previous.otherSocialUrls, { label: otherLabel || 'Outro', url: otherUrl }],
}));
```

`src/portals/client/NovaSolicitacaoPage.jsx:147-167` — envia `otherSocialUrls` sem transformação:

```js
await callCreateClientSolicitation({
...
    otherSocialUrls: form.otherSocialUrls,
});
```

`functions/index.js:4925` e `functions/index.js:4954` — backend salva o array como recebido quando ele é array:

```js
otherSocialUrls: Array.isArray(otherSocialUrls) ? otherSocialUrls : [],
```

`src/core/reportBuilder.js:185` e `functions/reportBuilder.cjs:172` — os renderizadores tratam cada item como string:

```js
...(Array.isArray(cd.otherSocialUrls) ? cd.otherSocialUrls.map(u=>socialLinkHtml(u,u,'🔗')) : []),
```

```js
...(Array.isArray(c.otherSocialUrls) ? c.otherSocialUrls.map(u=>socialLinkHtml(u,u,'🔗')) : []),
```

`functions/reportBuilder.cjs:49-53` — `socialLinkHtml` espera `href` string; objeto vira `https://[object Object]`:

```js
const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
return `<a href="${esc(url)}" ...>${esc(icon)} ${esc(label)}</a>`;
```

- **Justificativa Técnica:** o dossiê pode renderizar links inválidos e rótulos `[object Object]`, prejudicando fidelidade de perfis digitais e usabilidade do relatório.

---

### BUG-R1-010 — Backend aceita CPF de 11 dígitos sem validar dígitos verificadores
- **Severidade:** P1
- **Status:** Confirmado
- **Evidência Real:**

`src/core/validators.js:6-16` — o frontend valida CPF com regra completa, incluindo repetição e dígitos verificadores:

```js
export function validateCpf(cpf) {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    for (let t = 9; t < 11; t++) {
...
    return true;
}
```

`functions/index.js:4881-4884` — criação no backend exige apenas 11 dígitos:

```js
const cpfDigits = sanitizeCpf(cpf);
if (!candidateName || cpfDigits.length !== 11) {
    throw new HttpsError('invalid-argument', 'Nome completo e CPF valido sao obrigatorios.');
}
```

`functions/index.js:5037-5040` — correção também exige apenas 11 dígitos:

```js
const cpfDigits = sanitizeCpf(cpf);
if (cpfDigits.length !== 11) {
    throw new HttpsError('invalid-argument', 'CPF invalido para reenviar o caso.');
}
```

`functions/index.js:7412-7414` — `sanitizeCpf` apenas remove não dígitos e corta tamanho:

```js
function sanitizeCpf(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 11);
}
```

- **Justificativa Técnica:** Cloud Functions callable podem ser chamadas diretamente, sem passar pela validação do frontend. O backend pode criar ou corrigir dossiês com CPF formalmente inválido, gerando consultas externas incorretas e dossiês sem integridade cadastral.

---

## Resultado da Rodada 1 por severidade

### P0
- `BUG-R1-001` — Correção não reseta BigDataCorp; risco de mistura de identidade antiga com nova.
- `BUG-R1-006` — Mandados BigDataCorp podem ser reconhecidos internamente, mas omitidos de `warrantFindings` e da validação rígida de conclusão.

### P1
- `BUG-R1-002` — Judit desabilitada pode travar pipeline em pendência.
- `BUG-R1-003` — Fonte genérica falsa nos grupos de processos.
- `BUG-R1-004` — Campos BigDataCorp incompatíveis em `buildProcessHighlights`.
- `BUG-R1-007` — `sourceSummary` perde fontes reais e pode gerar `[object Object]`.
- `BUG-R1-008` — TTL de relatório público divergente da ADR de 14 dias.
- `BUG-R1-010` — Backend aceita CPF sem validar dígitos verificadores.

### P2
- `BUG-R1-005` — Deduplicação de CNJ sem normalização pode duplicar processos.
- `BUG-R1-009` — Links sociais “outros” podem renderizar `[object Object]`.

---

## Próxima rodada planejada

**Rodada 2 — Segurança, Autenticação, Autorização e Exposição de Dados.**  
Foco inicial: isolamento multi-tenant nas Cloud Functions, permissões operacionais, regras Firestore, relatório público por token, sanitização de HTML e presença de segredos no pacote frontend.

---

# Rodada 7 — Revisão cruzada e priorização executiva dos bugs acumulados

> Registro de continuidade operacional para manter o histórico consolidado antes do plano técnico da Rodada 8. Esta seção não adiciona novos bugs; ela organiza os achados por cadeia de risco, duplicidade e ordem de correção.

## Matriz executiva consolidada

| Severidade | Quantidade consolidada | Observação |
|---|---:|---|
| P0 | 10 | Falhas que podem comprometer isolamento, integridade do dossiê, conclusão canônica, callbacks assíncronos ou exposição crítica. |
| P1 | 31 | Falhas altas de consistência, validação, UX operacional, custo, observabilidade e governança. |
| P2 | 6 | Falhas médias de UX, monitoramento, deduplicação ou comportamento incompleto. |
| **Total** | **47** | Total acumulado após as Rodadas 1 a 6. |

## Cadeias críticas identificadas

### Cadeia A — Autorização frágil e risco multi-tenant

Bugs relacionados:

- `BUG-R2-001` — Rules permitem escrita direta em `userProfiles` por usuários operacionais.
- `BUG-R2-002` — Rules permitem alteração direta de `cases` por analistas.
- `BUG-R2-003` — relatório público operacional sem validação de tenant do caso.
- `BUG-R2-004` — backend permite gestão/configuração por `analyst` apesar do RBAC visual negar.
- `BUG-R2-005` — callables operacionais sem validação de tenant do caso.
- `BUG-R2-006` — perfil operacional inativo ainda pode ser aceito por helper backend.

Conclusão de priorização: esta cadeia deve ser corrigida antes de qualquer ajuste funcional, porque afeta o limite de confiança do sistema inteiro.

### Cadeia B — Dossiê contaminável por reprocessamento, correção e callbacks antigos

Bugs relacionados:

- `BUG-R1-001` — correção não reseta BigDataCorp.
- `BUG-R3-001` — fallback assíncrono Judit pode processar mapping em ordem insegura.
- `BUG-R3-002` — webhook Judit responde 200 antes de persistir.
- `BUG-R3-004` — correção não invalida callbacks assíncronos antigos.
- `BUG-R3-005` — correção não reseta DJEN.
- `BUG-R3-006` — rerun não invalida fases derivadas, classificação e IA.

Conclusão de priorização: o sistema precisa de geração/versão canônica de enriquecimento antes de liberar reprocessamentos em produção.

### Cadeia C — Conclusão inconsistente e divergência entre UI, backend e relatório

Bugs relacionados:

- `BUG-R1-003` — fonte genérica falsa em agrupamentos de processos.
- `BUG-R1-004` — campos BigDataCorp incompatíveis em highlights.
- `BUG-R1-006` — mandados BigDataCorp considerados em score, mas omitidos de validação/achados canônicos.
- `BUG-R1-007` — `sourceSummary` perde fontes reais ou gera `[object Object]`.
- `BUG-R3-003` — validação de mandado ativo antes do fallback do rascunho.
- `BUG-R4-002` — aceitar sugestão da IA não persiste score sugerido.
- `BUG-R4-005` — bloqueio visual de mandado ignora BigDataCorp.

Conclusão de priorização: criar um contrato único para o dossiê final antes de mexer em layout ou relatórios.

### Cadeia D — Testes e observabilidade não impedem regressão

Bugs relacionados:

- `BUG-R6-001` — testes backend não executáveis pelo pacote `functions`.
- `BUG-R6-002` — teste de Rules é textual, não semântico/emulador.
- `BUG-R6-003` — testes pulam suíte quando `index.js` falha.
- `BUG-R6-005` — circuit breaker sem `await`.
- `BUG-R6-006` — falha em auditoria de tenant é engolida.
- `BUG-R6-008` — saúde mostra ausência de telemetria como saudável.

Conclusão de priorização: nenhuma correção crítica deve ser considerada concluída sem teste de regressão no nível correto.

## Reclassificações propostas

| Bug ID | Severidade Original | Severidade Revisada | Status da Revisão | Domínio | Resumo | Observação |
|---|---|---|---|---|---|---|
| `BUG-R2-005` | P1 | P0 | Confirmado | Segurança multi-tenant | Callables operacionais sem tenant check | Reclassificar para P0 por permitir mutação cross-tenant via backend. |
| `BUG-R1-009` | P2 | P1 | Confirmado | Fidelidade de dado / UX operacional | Links sociais extras somem ou quebram | Reforçado por `BUG-R4-003`; impacta fluxo OSINT/documentação do caso. |
| `BUG-R6-002` | P1 | P1 técnico / P0 de processo | Confirmado | Testes de segurança | Rules sem teste semântico | Enquanto Rules críticas não forem testadas no emulador, o risco processual é crítico. |
| `BUG-R6-004` | P1 | P1, podendo subir para P0 | Pendente de validação operacional | Privacidade/logs | CPF completo em logs | Sobe para P0 se logs forem enviados a terceiros ou ferramenta externa. |
| `BUG-R6-007` | P1 | P1, podendo subir para P0 | Pendente de validação operacional | Privacidade/test data | Dados reais no repositório | Sobe para P0 se pacote/repo foi compartilhado fora do ambiente controlado. |

## Ordem executiva de correção sugerida

1. Contenção de segredos e PII.
2. Firestore Rules e RBAC backend.
3. Tenant isolation nas callables operacionais.
4. Máquina de estados e callbacks assíncronos.
5. Correção/rerun com invalidação completa.
6. Contrato canônico de mandados, score, fontes e relatório.
7. Fidelidade de fontes e renderização do dossiê.
8. Testes obrigatórios de regressão.
9. UX operacional crítica.
10. Performance, escalabilidade e custos.
11. Auditoria/observabilidade.
12. TTL/política de relatório público.

---

# Rodada 8 — Plano de correção técnica sem implementação

## Escopo executado

Esta rodada transforma os bugs acumulados em um plano técnico de correção sem aplicar código. O objetivo é ordenar os PRs/blocos de trabalho para reduzir risco, evitar regressão e garantir que cada correção seja validada por teste adequado.

**Importante:** nenhuma alteração de código-fonte do projeto foi implementada nesta rodada. O resultado é apenas planejamento técnico.

## Matriz de Revisão

| Bug ID | Severidade Original | Severidade Revisada | Status da Revisão | Domínio | Resumo | Observação |
|---|---|---|---|---|---|---|
| `BUG-R2-005` | P1 | P0 | Confirmado | Segurança / Tenant | Callables operacionais sem validar tenant do caso | Deve entrar no mesmo bloco de correção de Rules/RBAC. |
| `BUG-R1-009` | P2 | P1 | Confirmado | Dossiê / OSINT | Links sociais extras quebram ou somem | Deve ser corrigido junto com `BUG-R4-003`. |
| `BUG-R6-002` | P1 | P1 técnico | Confirmado | Testes de segurança | Rules testadas só por string | Deve virar gate obrigatório de CI antes de encerrar P0 de Rules. |
| Demais bugs | Mantida | Mantida | Confirmado ou conforme status original | Vários | Sem nova evidência nesta rodada | Rodada 8 é planejamento; não reaudita evidência linha a linha. |

## Novos bugs descobertos

Nenhum bug novo foi registrado nesta rodada. O foco foi converter os 47 achados em plano de correção técnica.

---

## Princípios obrigatórios para a correção

1. **Não corrigir UI antes de corrigir backend/autorização.**  
   A UI não é fronteira de segurança.

2. **Não concluir bugs de segurança sem testes no emulador ou teste callable realista.**  
   Teste textual não é suficiente para `firestore.rules`.

3. **Não corrigir dossiê por remendo visual.**  
   Primeiro deve existir contrato canônico backend para fontes, mandados, score, links sociais, `publicResult` e relatório.

4. **Toda correção de enriquecimento deve considerar geração/versão.**  
   Correção de CPF/nome, rerun manual e callbacks externos precisam invalidar resultados antigos.

5. **Toda correção que altera estado deve ter teste de transição.**  
   Exemplo: `PENDING → IN_PROGRESS`, `CORRECTION_NEEDED → PENDING`, `DONE` não pode ser reaberto indevidamente.

6. **Toda correção que envolve dado pessoal deve incluir sanitização de logs e massa de teste.**  
   CPF completo, nomes reais e outputs jurídicos não devem ficar em repositório, console ou artefato.

---

# Plano de PRs / blocos técnicos

## Bloco 0 — Congelamento, contenção e preparação

**Objetivo:** reduzir exposição imediata antes de alterar lógica.

**Bugs cobertos:**

- `BUG-R2-007`
- `BUG-R6-004`
- `BUG-R6-007`

**Arquivos afetados previstos:**

```txt
app_src/.env.local
app_src/.gitignore
app_src/.env.example
app_functions/.env.example
app_src/scripts/**
app_src/results/**
app_src/test-warrant-output.txt
functions/index.js
functions/adapters/bigdatacorp.js
functions/adapters/judit.js
functions/adapters/escavador.js
```

**Ações técnicas recomendadas, sem implementação nesta rodada:**

1. Remover `.env.local` do pacote/repositório.
2. Garantir `.gitignore` para `.env*`, exceto `.env.example` sem segredo.
3. Rotacionar chaves expostas, se forem reais.
4. Substituir massa real por fixtures sintéticas.
5. Redigir CPF nos logs: usar máscara ou hash HMAC quando necessário correlacionar eventos.
6. Remover outputs reais de consultas jurídicas do repositório.

**Critérios de aceite:**

- `grep`/scanner não encontra CPF válido, token real, chave de provedor ou secret em arquivos versionados.
- Logs de provedores não exibem CPF completo.
- `.env.example` documenta variáveis sem valor sensível.
- Nenhum script de teste depende de pessoa real.

**Testes mínimos:**

```txt
npm run secrets:scan
npm run pii:scan
Teste unitário de redator de CPF/hash de correlação
Teste de fixture sintética para scripts de provedor
```

**Ordem:** primeiro bloco a ser executado.

---

## Bloco 1 — Firestore Rules, RBAC e fronteira de autorização

**Objetivo:** impedir elevação de privilégio, escrita direta em coleções críticas e bypass das Cloud Functions.

**Bugs cobertos:**

- `BUG-R2-001`
- `BUG-R2-002`
- `BUG-R2-004`
- `BUG-R2-006`
- `BUG-R6-002`

**Arquivos afetados previstos:**

```txt
app_src/firestore.rules
app_src/firestore.rules.test.js
app_functions/index.js
app_functions/auth/opsProfile.js ou helper equivalente, se criado
src/core/rbac/permissions.js
```

**Ações técnicas recomendadas:**

1. Bloquear escrita direta em `userProfiles` para qualquer usuário operacional comum.
2. Permitir gestão de perfil apenas por função administrativa backend controlada.
3. Bloquear escrita direta em `cases` pelo frontend operacional; mutações devem passar por callables auditáveis.
4. Tornar `status: inactive` impeditivo no helper backend que carrega perfil operacional.
5. Harmonizar RBAC visual com RBAC real do backend.
6. Substituir teste textual de Rules por testes com Firebase Emulator.

**Critérios de aceite:**

- `analyst` não cria, edita ou remove `userProfiles` via SDK Firestore.
- `analyst` não edita `cases/{caseId}` diretamente via SDK Firestore.
- `supervisor/admin` só realizam ações permitidas pelo contrato definido.
- Perfil `inactive` não consegue chamar funções operacionais.
- Teste de Rules falha se a regra voltar a permitir escrita direta.

**Testes mínimos:**

```txt
rules: analyst cannot write userProfiles
rules: analyst cannot update cases directly
rules: client cannot write clientCases/publicResult
callable: inactive ops user is rejected
callable: analyst cannot manage tenant settings/users unless explicit permission exists
```

**Dependência:** executar após Bloco 0.

---

## Bloco 2 — Tenant isolation em callables operacionais

**Objetivo:** garantir que toda mutação operacional respeite tenant do caso e escopo do operador.

**Bugs cobertos:**

- `BUG-R2-003`
- `BUG-R2-005`
- `BUG-R3-007`
- `BUG-R4-004`
- parte de `BUG-R5-004`

**Arquivos afetados previstos:**

```txt
app_functions/index.js
app_functions/audit/**
src/pages/FilaPage.jsx
src/pages/CasoPage.jsx
```

**Ações técnicas recomendadas:**

1. Criar helper único, por exemplo `assertOpsCanAccessCase(uid, caseId, action)`.
2. O helper deve carregar caso, perfil operacional, tenant permitido e status do usuário.
3. Aplicar o helper em:
   - `assignCaseToCurrentAnalyst`
   - `setAiDecisionByAnalyst`
   - `rerunAiAnalysis`
   - `rerunEnrichmentPhase`
   - `createAnalystPublicReport`
   - qualquer função operacional que receba `caseId`
4. Validar transição de estado ao assumir caso.
5. Impedir reassumir `DONE`, `CANCELLED`, `CORRECTION_NEEDED` ou estados bloqueados sem função específica.
6. Ajustar seleção em massa da fila para só enviar casos elegíveis.

**Critérios de aceite:**

- Operador de tenant A não consegue executar callable sobre caso de tenant B.
- Caso `DONE` não volta para `IN_PROGRESS` por `assignCaseToCurrentAnalyst`.
- Caso `CORRECTION_NEEDED` não é assumido em massa.
- Relatório público operacional só é gerado por usuário autorizado para o tenant do caso.

**Testes mínimos:**

```txt
callable cross-tenant assignCase is denied
callable cross-tenant createAnalystPublicReport is denied
callable setAiDecision cross-tenant is denied
assignCase rejects DONE/CORRECTION_NEEDED
bulk UI filters non-assignable cases
```

**Dependência:** Bloco 1.

---

## Bloco 3 — Máquina de estados, geração de enriquecimento e callbacks assíncronos

**Objetivo:** impedir que resultados antigos ou callbacks fora de ordem contaminem o caso atual.

**Bugs cobertos:**

- `BUG-R3-001`
- `BUG-R3-002`
- `BUG-R3-004`
- `BUG-R3-005`
- `BUG-R3-006`
- `BUG-R1-001`
- `BUG-R1-002`

**Arquivos afetados previstos:**

```txt
app_functions/index.js
app_functions/adapters/judit.js
app_functions/adapters/bigdatacorp.js
app_functions/adapters/djen.js
app_functions/adapters/fontedata.js
app_functions/adapters/escavador.js
```

**Ações técnicas recomendadas:**

1. Introduzir campo canônico de geração, por exemplo:

```txt
enrichmentGeneration: number
enrichmentFingerprint: hash(cpf + nome + dataNascimento + tenantId)
```

2. Toda chamada externa assíncrona deve persistir `caseId`, `generation` e `fingerprint`.
3. Webhook/fallback só pode escrever se `generation/fingerprint` ainda corresponderem ao caso atual.
4. `submitClientCorrection` deve incrementar geração e invalidar:
   - BigDataCorp
   - Judit
   - Escavador
   - FonteData
   - DJEN
   - classificação automática
   - IA
   - publicResult/reportReady
   - requests assíncronos pendentes
5. Rerun manual deve declarar escopo:
   - rerun apenas uma fonte;
   - ou rerun em cascata com invalidação das fases derivadas.
6. Webhook Judit só deve responder sucesso depois de persistência ou depois de enfileirar retry durável.
7. Fallback assíncrono não deve marcar request como processado antes de confirmar estado final.
8. Judit desabilitada deve produzir status terminal explícito, como `SKIPPED`, e acionar fluxo seguinte, se aplicável.

**Critérios de aceite:**

- Callback antigo de Judit não altera caso após correção de CPF/nome.
- Correção de cliente limpa ou invalida todos os resultados dependentes.
- Rerun de BigDataCorp não deixa IA/classificação antiga como se fosse atual.
- Webhook não perde resultado por responder 200 antes da gravação.
- Judit desabilitada não deixa caso indefinidamente pendente.

**Testes mínimos:**

```txt
submitClientCorrection increments generation
old Judit callback with previous generation is ignored and audited
webhook failure after lock remains retryable
manual rerun invalidates derived IA/classification
Judit disabled sets SKIPPED and advances pipeline
correction resets BigDataCorp and DJEN
```

**Dependência:** Blocos 1 e 2.

---

## Bloco 4 — Contrato canônico do dossiê: fontes, processos, mandados, score e links sociais

**Objetivo:** criar uma representação única e fiel para o dossiê final, evitando divergência entre UI, backend e relatório.

**Bugs cobertos:**

- `BUG-R1-003`
- `BUG-R1-004`
- `BUG-R1-005`
- `BUG-R1-006`
- `BUG-R1-007`
- `BUG-R1-009`
- `BUG-R3-003`
- `BUG-R4-002`
- `BUG-R4-003`
- `BUG-R4-005`

**Arquivos afetados previstos:**

```txt
app_functions/index.js
app_functions/reportBuilder.cjs
src/core/reportBuilder.js
src/pages/CasoPage.jsx
src/components/cases/EnrichmentPipeline.jsx
src/components/cases/SocialLinks.jsx
src/core/validators.js
```

**Ações técnicas recomendadas:**

1. Definir schema canônico para processo jurídico:

```txt
{
  source: 'judit' | 'bigdatacorp' | 'escavador' | 'djen' | 'fontedata',
  providerRecordId,
  cnjNormalized,
  originalNumber,
  court,
  state,
  className,
  subject,
  parties,
  status,
  confidence,
  rawRef
}
```

2. Definir schema canônico para mandado:

```txt
{
  source,
  active: boolean,
  type,
  number,
  court,
  issuedAt,
  status,
  confidence,
  rawRef
}
```

3. `warrantFlag`, bloqueio de conclusão e tela de mandados devem ler o mesmo agregado canônico.
4. Normalizar CNJ antes de deduplicar.
5. Remover fonte genérica “Judit / Escavador / BigDataCorp”.
6. Preservar fontes reais em `sourceSummary`.
7. Padronizar `otherSocialUrls` como array de `{ label, url }` ou array de strings, mas não ambos.
8. Garantir que “Aceitar sugestão da IA” persista o score no payload realmente usado pela conclusão ou que a UI deixe claro que o score é recalculado.
9. Validação de mandado deve ocorrer após composição final do payload, incluindo fallback do rascunho.

**Critérios de aceite:**

- Processo BigDataCorp não aparece como “Nº não disponível” quando o número existe em campo alternativo conhecido.
- Fonte exibida no dossiê corresponde à fonte real do item.
- Mandado ativo de qualquer provedor impede conclusão como negativo/não encontrado, conforme regra de negócio.
- Score aceito da IA aparece no dossiê final ou é explicitamente descartado com UX coerente.
- Links sociais extras aparecem no caso, relatório e tela operacional com URL correta.

**Testes mínimos:**

```txt
normalizer maps BigDataCorp process fields to canonical schema
CNJ dedupe normalizes punctuation
active BDC warrant blocks negative conclusion
sourceSummary preserves provider labels
otherSocialUrls renders valid href and label
accept AI suggestion persists selected score or blocks misleading UI
conclusion validates final merged draft, not stale form state
```

**Dependência:** Bloco 3.

---

## Bloco 5 — Validação de CPF e consistência de entrada

**Objetivo:** garantir que dados críticos sejam validados no backend, não apenas na UI.

**Bugs cobertos:**

- `BUG-R1-010`
- `BUG-R3-008`

**Arquivos afetados previstos:**

```txt
src/core/validators.js
app_functions/index.js
app_functions/validators/cpf.js ou helper compartilhado equivalente
src/pages/NovaSolicitacaoPage.jsx
src/pages/CorrecoesPage.jsx ou componente de correção equivalente
```

**Ações técnicas recomendadas:**

1. Criar ou compartilhar função de validação CPF com dígitos verificadores no backend.
2. Aplicar em `createClientSolicitation`.
3. Aplicar em `submitClientCorrection`.
4. Unificar mensagem de erro da UI entre criação e correção.
5. Garantir que chamadas diretas à callable sejam rejeitadas.

**Critérios de aceite:**

- CPF repetido `00000000000` é rejeitado na UI e no backend.
- CPF com 11 dígitos e DV inválido é rejeitado no backend.
- Correção não aceita CPF inválido por tamanho apenas.

**Testes mínimos:**

```txt
createClientSolicitation rejects invalid DV
submitClientCorrection rejects invalid DV
UI correction uses same validator as creation
```

**Dependência:** pode rodar em paralelo com Bloco 4, desde que não conflite nos mesmos arquivos.

---

## Bloco 6 — Relatórios públicos, TTL, HTML e publicação sanitizada

**Objetivo:** alinhar política de relatório público, segurança de HTML e consistência de `publicResult`.

**Bugs cobertos:**

- `BUG-R1-008`
- `BUG-R2-003`
- partes de `BUG-R1-007`, `BUG-R4-003` e `BUG-R5-007`

**Arquivos afetados previstos:**

```txt
app_functions/index.js
app_functions/reportBuilder.cjs
src/core/reportBuilder.js
src/pages/PublicReportPage.jsx
src/pages/RelatoriosPage.jsx
firestore.rules
```

**Ações técnicas recomendadas:**

1. Centralizar TTL de relatório público em constante/configuração única.
2. Alinhar TTL real com ADR/política vigente ou atualizar documentação formal.
3. Validar tenant antes de criar relatório operacional.
4. Garantir que HTML público seja gerado a partir de payload sanitizado e canônico.
5. Ajustar listagem operacional de relatórios para query paginada/filtrada corretamente.

**Critérios de aceite:**

- Relatório público expira no prazo definido oficialmente.
- Relatório público não pode ser criado por operador fora do tenant.
- `publicReports/{token}` não contém campos brutos desnecessários.
- Listagem encontra relatórios além dos primeiros 200, com paginação ou busca correta.

**Testes mínimos:**

```txt
createPublicReport expiresAt equals policy TTL
cross-tenant public report creation denied
public report uses sanitized result only
reports list pagination returns later documents
revoked/expired report is denied by rules
```

**Dependência:** Blocos 1, 2 e 4.

---

## Bloco 7 — UX operacional crítica e prevenção de perda de trabalho

**Objetivo:** corrigir telas que induzem erro operacional ou perda de rascunho.

**Bugs cobertos:**

- `BUG-R4-001`
- `BUG-R4-002`
- `BUG-R4-004`
- `BUG-R4-005`
- `BUG-R4-006`
- `BUG-R6-008`

**Arquivos afetados previstos:**

```txt
src/pages/CasoPage.jsx
src/pages/FilaPage.jsx
src/portals/ops/SaudePage.jsx
src/portals/ops/SaudePage.css
src/components/cases/**
```

**Ações técnicas recomendadas:**

1. Proteger navegação interna com rascunho sujo, não apenas `beforeunload`.
2. Ajustar botão “Voltar” para confirmar saída ou salvar rascunho.
3. Alinhar botão “Aceitar sugestão” com o payload realmente concluído.
4. Filtrar ações em massa para estados elegíveis.
5. Exibir mandados BDC/Judit/Escavador sob a mesma regra canônica.
6. Corrigir mensagem inalcançável de processamento no cliente.
7. Saúde do provedor deve exibir `Sem dados`, `Stale`, `Degradado`, `Indisponível` ou `Saudável`, conforme telemetria real.
8. Remover ou implementar promessa de “tempo real”.

**Critérios de aceite:**

- Usuário não perde rascunho ao clicar em voltar/navegar internamente.
- Botões em massa não chamam backend para caso inelegível.
- Tela de saúde não classifica ausência de documento como saudável.
- Cliente vê estados coerentes de processamento e conclusão.

**Testes mínimos:**

```txt
CasoPage dirty draft blocks internal navigation
FilaPage bulk assign excludes non-pending cases
SaudePage missing provider doc renders No data
Client case processing state is reachable or text removed
```

**Dependência:** Blocos 2 e 4.

---

## Bloco 8 — Performance, escalabilidade e custo

**Objetivo:** reduzir write amplification, consultas lineares e custo de IA/provedores.

**Bugs cobertos:**

- `BUG-R5-001`
- `BUG-R5-002`
- `BUG-R5-003`
- `BUG-R5-004`
- `BUG-R5-005`
- `BUG-R5-006`
- `BUG-R5-007`
- `BUG-R5-008`

**Arquivos afetados previstos:**

```txt
app_functions/index.js
src/core/firebase/firestoreService.js
src/pages/FilaPage.jsx
src/pages/RelatoriosPage.jsx
src/core/contexts/TenantContext.jsx
```

**Ações técnicas recomendadas:**

1. `syncClientCaseOnUpdate` deve comparar payload sanitizado antes de escrever.
2. Orçamento de IA deve usar ledger/agregado mensal, não varredura mensal de casos.
3. Remover chamada de IA de prefill se o resultado for sobrescrito, ou preservar resultado IA quando válido.
4. Criar callable batch para atribuição em massa.
5. Substituir diretório de tenants baseado em todos os `userProfiles` por coleção/agregado leve.
6. Backfill deve paginar leitura de `cases`, não carregar tudo em memória.
7. Relatórios públicos devem ter paginação e filtros server-side.
8. `fetchOrderedCollection` deve cancelar fallback REST quando SDK resolver primeiro.

**Critérios de aceite:**

- Atualização interna de `cases` sem mudança visível não regrava `clientCases`.
- Cálculo de orçamento IA é O(1) ou O(log n), não O(n) por casos do mês.
- Atribuição em massa usa uma chamada backend com validação atômica por item.
- Backfill suporta grandes volumes sem leitura total em memória.

**Testes mínimos:**

```txt
clientCases mirror does not write when sanitized payload unchanged
AI budget reads monthly aggregate/ledger
prefill AI output is used or call is skipped
bulk assign callable processes eligible cases only
backfill paginates cases
fetchOrderedCollection cancels fallback after SDK success
```

**Dependência:** Blocos 2 e 3 para evitar otimizar fluxo inseguro.

---

## Bloco 9 — Auditoria, circuit breaker e confiabilidade operacional

**Objetivo:** garantir que falhas importantes sejam observáveis, auditáveis e não silenciosas.

**Bugs cobertos:**

- `BUG-R6-005`
- `BUG-R6-006`
- `BUG-R6-008`
- parte de `BUG-R5-008`

**Arquivos afetados previstos:**

```txt
app_functions/helpers/circuitBreaker.js
app_functions/audit/writeAuditEvent.js
app_functions/index.js
src/portals/ops/SaudePage.jsx
```

**Ações técnicas recomendadas:**

1. `recordSuccess` e `recordFailure` devem ser `await` ou enviados para fila durável com observabilidade.
2. Falha ao gravar `tenantAuditLogs` não deve ser engolida sem retry/alerta.
3. Eventos auditáveis críticos devem ter correlation ID.
4. `systemHealth` deve registrar `updatedAt`, `lastSuccessAt`, `lastFailureAt`, `failCount`, `disabledUntil` e `lastErrorCode` redigido.
5. Saúde operacional deve diferenciar ausência de dado e dado velho.

**Critérios de aceite:**

- Falha de circuit breaker é visível em log estruturado ou teste.
- Falha na projeção de auditoria cliente gera erro, retry ou alerta.
- Tela de saúde reflete dado atualizado, ausente ou stale corretamente.

**Testes mínimos:**

```txt
recordFailure is awaited or durable
writeAuditEvent tenant projection failure is observable
systemHealth stale provider renders stale status
logs include correlationId and no CPF completo
```

**Dependência:** Bloco 0 para não ampliar logs com PII.

---

## Bloco 10 — Testes, CI e gates de regressão

**Objetivo:** transformar a auditoria em proteção permanente contra regressão.

**Bugs cobertos:**

- `BUG-R6-001`
- `BUG-R6-002`
- `BUG-R6-003`
- todos os P0/P1 que precisam de regressão automatizada

**Arquivos afetados previstos:**

```txt
app_functions/package.json
app_functions/package-lock.json
app_functions/*.test.js
app_src/package.json
app_src/firestore.rules.test.js
vitest.config.* ou jest config equivalente
firebase.json
.github/workflows/** ou pipeline equivalente, se existir
```

**Ações técnicas recomendadas:**

1. Adicionar script real de teste no pacote `functions`.
2. Declarar dependência de runner usado pelos testes.
3. Remover padrão `describe.skip` quando `index.js` falha ao carregar.
4. Separar testes unitários, integração callable e Rules Emulator.
5. Criar gate mínimo:

```txt
npm run lint
npm run test:functions
npm run test:rules
npm run build
npm run secrets:scan
npm run pii:scan
```

6. Criar fixtures sintéticas determinísticas para provedores.
7. Testar todos os P0 antes de release.

**Critérios de aceite:**

- `npm test` ou script equivalente roda no pacote correto.
- Falha ao importar `index.js` falha a suíte, não pula teste.
- Rules são testadas com operações reais permitidas/negadas.
- CI impede merge com segredo, CPF real ou regressão P0.

**Testes mínimos:**

```txt
functions package has test script
index.js import failure fails test suite
rules emulator denies analyst direct case write
rules emulator denies userProfiles write by analyst
all P0 regression tests pass
```

**Dependência:** deve ser iniciado cedo, mas finalizado junto com cada bloco.

---

# Ordem segura de execução

## Fase 1 — Contenção imediata

1. Bloco 0 — Segredos, PII e logs.
2. Bloco 10 parcial — scanners de segredo/PII.

**Motivo:** reduz risco antes de mexer em lógica.

## Fase 2 — Segurança estrutural

3. Bloco 1 — Firestore Rules/RBAC.
4. Bloco 2 — Tenant isolation em callables.
5. Bloco 10 parcial — testes de Rules e callables.

**Motivo:** fecha bypasses antes de consertar fluxo funcional.

## Fase 3 — Integridade de estado e enriquecimento

6. Bloco 3 — Máquina de estados, geração e callbacks.
7. Bloco 5 — Validação CPF.
8. Bloco 10 parcial — testes de estado/correção/rerun.

**Motivo:** impede contaminação de dossiê por dados antigos.

## Fase 4 — Dossiê e relatório canônico

9. Bloco 4 — Contrato canônico do dossiê.
10. Bloco 6 — Relatórios públicos/TTL/sanitização.
11. Bloco 7 parcial — UX ligada a conclusão/mandados/IA.

**Motivo:** garante que o que é exibido corresponde ao que foi apurado.

## Fase 5 — Custo, performance e observabilidade

12. Bloco 8 — Performance/custo.
13. Bloco 9 — Auditoria/circuit breaker/saúde.
14. Bloco 10 final — CI completo.

**Motivo:** depois de segurança e integridade, otimizar sem esconder falhas.

---

# Mapa de dependências entre bugs

```txt
BUG-R2-001 + BUG-R2-002 + BUG-R2-005
  → precisam ser corrigidos antes de confiar em qualquer mutação operacional.

BUG-R1-001 + BUG-R3-004 + BUG-R3-006
  → precisam de generation/fingerprint antes de corrigir apenas reset de campos.

BUG-R1-006 + BUG-R3-003 + BUG-R4-005
  → precisam de modelo canônico de mandados antes de alterar bloqueio visual.

BUG-R1-009 + BUG-R4-003
  → devem ser corrigidos juntos, porque envolvem nascimento, persistência e renderização dos links.

BUG-R6-001 + BUG-R6-002 + BUG-R6-003
  → devem ser resolvidos antes de marcar qualquer P0 como encerrado.

BUG-R5-001 + BUG-R8 plano de clientCases
  → depende de comparação canônica do payload sanitizado.
```

---

# Critério de encerramento por severidade

## Para encerrar um P0

Obrigatório:

1. Correção backend ou Rules aplicada.
2. Teste automatizado cobrindo o abuso original.
3. Teste negativo, demonstrando que a ação indevida é negada.
4. Teste positivo, demonstrando que o fluxo legítimo continua funcionando.
5. Auditoria/log sem PII indevida.
6. Revisão de regressão no fluxo completo.

## Para encerrar um P1

Obrigatório:

1. Correção no produtor e no consumidor do dado.
2. Teste unitário ou integração conforme domínio.
3. Validação manual do fluxo principal.
4. Sem piorar tenant isolation, dossiê ou relatório.

## Para encerrar um P2

Obrigatório:

1. Correção localizada.
2. Teste de UI/helper ou snapshot funcional quando aplicável.
3. Validação manual do estado afetado.

---

# Checklist de release pós-correção

Antes de considerar o sistema apto para nova validação:

```txt
[ ] .env.local e segredos removidos do pacote.
[ ] Chaves expostas rotacionadas, se eram reais.
[ ] Scanners de segredo/PII executados.
[ ] Firestore Rules testadas no emulador.
[ ] Callables P0 testadas contra cross-tenant.
[ ] Usuário inactive rejeitado no backend.
[ ] Correção de cliente invalida todas as fases dependentes.
[ ] Callbacks assíncronos antigos são ignorados por generation/fingerprint.
[ ] Rerun invalida classificação/IA/publicResult conforme escopo.
[ ] Mandados de todos os provedores entram no mesmo contrato canônico.
[ ] Relatório público usa payload sanitizado e TTL correto.
[ ] `clientCases` não é regravado sem mudança visível.
[ ] Testes backend rodam por script do pacote `functions`.
[ ] Testes não usam CPFs/nomes reais.
[ ] Build frontend passa.
[ ] Fluxos cliente e operacional foram testados manualmente após correções.
```

---

# Resultado da Rodada 8

## Resumo

| Item | Resultado |
|---|---|
| Novos bugs | Nenhum |
| Reclassificações novas | Nenhuma além das já propostas na Rodada 7 |
| Blocos técnicos definidos | 11 blocos, do Bloco 0 ao Bloco 10 |
| Prioridade máxima | Segredos/PII, Rules/RBAC, tenant isolation e callbacks assíncronos |
| Implementação realizada | Nenhuma |

## Próxima rodada planejada

**Rodada 9 — Preparação do prompt/agente de correção incremental.**

Foco sugerido:

- transformar este plano em prompt técnico para Codex/LLM;
- exigir correções em micro-rodadas;
- obrigar testes antes/depois;
- impedir alterações cosméticas fora do escopo;
- impedir que Segurança/LGPD sejam parcialmente corrigidas sem testes e sem rotação de segredos;
- criar checklist de execução por PR/bloco.
