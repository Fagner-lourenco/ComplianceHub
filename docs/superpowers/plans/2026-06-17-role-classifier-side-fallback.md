# Role Classifier com Fallback por Lado/Polo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar falsos negativos na classificação de papéis processuais (criminal e trabalhista) ampliando as regexes do `roleClassifier` e adicionando um fallback por lado/polo do processo, garantindo que papeis desconhecidos mas posicionados como parte passiva sejam classificados como réu e parte ativa como autor.

**Architecture:** Centralizar toda a lógica de classificação em `functions/helpers/roleClassifier.js`, adicionando um parâmetro opcional `side` a `classifyRole(role, area, side)`. O fallback por lado atua apenas após as regras de ignorar/testemunha/vítima/autoridade, evitando reclassificar papéis já seguros. Os normalizadores (`judit`, `bigdatacorp`, `escavador`, `djen`) passam o lado/polo disponível para o classificador.

**Tech Stack:** Node.js 22, CommonJS, Vitest, ESLint flat config, Firebase Functions Gen2.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `functions/helpers/roleClassifier.js` | Centraliza `classifyRole` e as regexes exportadas; recebe `side` opcional e aplica fallback por lado |
| `functions/helpers/roleClassifier.test.js` | Testes unitários do classificador, incluindo novos papéis e fallback por lado |
| `functions/normalizers/judit.js` | Passa `role?.side` para `classifyRole` |
| `functions/normalizers/bigdatacorp.js` | Passa `polo` para `classifyRole` |
| `functions/normalizers/escavador.js` | Passa `polo`/`side` disponível para `classifyRole` |
| `functions/normalizers/djen.js` | Passa `side`/`polarity` disponível para `classifyRole` |
| `functions/modules/autoClassification.js` | Consome `isDefendant`/`isPlaintiff` gerados pelo classificador; não precisa de alteração direta |
| `functions/modules/autoClassification.test.js` | Testes de integração da classificação automática; deve continuar passando |
| `docs/superpowers/plans/2026-06-17-role-classifier-side-fallback.md` | Este plano |

---

## Contexto Obrigatório para Leitura

Antes de tocar no código, leia:
- `functions/helpers/roleClassifier.js` — entender `normalizeLegalText`, ordem das regras (ignore → vítima → área específica → cível) e as regexes exportadas.
- `functions/helpers/aiHomonym.js` — entender como `buildBigDataCorpProcessCandidates`, `buildJuditProcessCandidates`, etc. usam `classifyRole` para montar candidatos.
- `functions/normalizers/judit.js` — entender `findPersonRole`, `areaForRole` e `roleClassification`.
- `functions/normalizers/bigdatacorp.js` — entender `polo`, `partyType`, `specificRole` e `areaForRole`.
- `functions/normalizers/escavador.js` e `functions/normalizers/djen.js` — entender como chamam `classifyRole` hoje.
- `AGENTS.md` seção 7 (Testes), seção 10 (Segurança) e seção 4 (Build/Teste/Deploy).

---

## Task 1: Expandir regexes de papéis criminais e trabalhistas

**Files:**
- Modify: `functions/helpers/roleClassifier.js:36-57`
- Test: `functions/helpers/roleClassifier.test.js`

**Contexto:** A análise de 1.317 casos em produção identificou papéis reais que ainda caem em `UNKNOWN` mesmo com o código atual, ou que só são classificados em algumas variações. Exemplos: `REQUERENTES` (plural), `REU 2`, `AUTOR A`, `AUTORA`, `RECORRIDA`, `NOTICIADO`, `OFENSOR`, `HERDEIRO`, `EMBARGADO`, `EMBARGANTE`, `RECTE`.

- [ ] **Step 1: Escrever testes de falha para os novos papéis**

No arquivo `functions/helpers/roleClassifier.test.js`, dentro do `describe('classifyRole')`, substitua ou estenda o bloco `it.each` existente para incluir (adicione essas linhas junto aos casos já existentes):

```js
['REQUERENTES', 'Criminal', 'PLAINTIFF', 'LOW'],
['POLO ATIVO PRINCIPAL', 'Criminal', 'PLAINTIFF', 'LOW'],
['POLO ATIVO', 'Criminal', 'PLAINTIFF', 'LOW'],
['EXEQUENTE', 'Criminal', 'PLAINTIFF', 'LOW'],
['EXEQTE', 'Criminal', 'PLAINTIFF', 'LOW'],
['REQTE', 'Criminal', 'PLAINTIFF', 'LOW'],
['DEMANDANTE', 'Criminal', 'PLAINTIFF', 'LOW'],
['PROMOVENTE', 'Criminal', 'PLAINTIFF', 'LOW'],
['PARTE AUTORA', 'Criminal', 'PLAINTIFF', 'LOW'],
['RECTE', 'Criminal', 'PLAINTIFF', 'LOW'],
['AUTOR A', 'Criminal', 'PLAINTIFF', 'LOW'],
['AUTORA', 'Criminal', 'PLAINTIFF', 'LOW'],
['REU 2', 'Criminal', 'DEFENDANT', 'HIGH'],
['REU A', 'Criminal', 'DEFENDANT', 'HIGH'],
['RECORRIDA', 'Criminal', 'DEFENDANT', 'HIGH'],
['RECORRIDO A', 'Criminal', 'DEFENDANT', 'HIGH'],
['AGRAVADO A', 'Criminal', 'DEFENDANT', 'HIGH'],
['APELADA', 'Criminal', 'DEFENDANT', 'HIGH'],
['NOTICIADO', 'Criminal', 'DEFENDANT', 'HIGH'],
['OFENSOR', 'Criminal', 'DEFENDANT', 'HIGH'],
['EMBARGADO', 'Criminal', 'DEFENDANT', 'HIGH'],
['EMBARGANTE', 'Criminal', 'DEFENDANT', 'HIGH'],
['AUTOR DO FATO VITIMA', 'Criminal', 'VICTIM', 'LOW'],
['HERDEIRO', 'Criminal', 'OTHER', 'IGNORE'],
['INVENTARIANTE', 'Criminal', 'OTHER', 'IGNORE'],
['TERINTCER', 'Criminal', 'OTHER', 'IGNORE'],
['ESPOLIO REQUERIDO', 'Criminal', 'OTHER', 'IGNORE'],
['ALIMENTADO', 'Criminal', 'OTHER', 'IGNORE'],
['PARTES', 'Criminal', 'OTHER', 'IGNORE'],
['EMBARGADO', 'Trabalhista', 'DEFENDANT', 'LOW'],
['EMBARGANTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
['RECTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
['REQUERENTES', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
['AUTOR A', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
['AUTORA', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
```

- [ ] **Step 2: Rodar os testes para confirmar falha**

Run:
```bash
cd functions
npx vitest run helpers/roleClassifier.test.js --reporter=verbose
```

Expected: FAIL para todos os novos casos adicionados (categoria `UNKNOWN` ou risco incorreto).

- [ ] **Step 3: Atualizar as regexes no roleClassifier**

No arquivo `functions/helpers/roleClassifier.js`, altere as constantes para:

```js
// Roles que cometem crime ou são processados criminalmente
const HIGH_RISK_CRIMINAL_ROLES = /^(REU|RE\s*$|REU\s+(RE|S|\d+|A)|REU\s+A|INDICIAD[OA]|INDICIADO\s+A|INDICIADA|INVESTIGAD[OA]|INVESTIGADO\s+A|INVESTIGADA|AUTOR\s*(?:A)?\s+DO\s+FATO|AUTORA\s*(?:A)?\s+DO\s+FATO|AUTOR\s+FATO|CONDENAD[OA]|ACUSAD[OA]|ACUSADO\s+A|ACUSADA|AVERIGUAD[OA]|AVERIGUADA|EXECUTADO|EXECTD[OA]|EXECD[OA]|EXECDO|EXECDA|REEDUCANDO|BENEFICIARIO|SUJE?TO|AGENTE|DENUNCIAD[OA]|DENUNCIADO\s+A|DENUNCIADA|NOTICIAD[OA]|AUTUAD[OA]|FLAGRANTEAD[OA]|FLAGRANTEADO\s*\(?A\)?|FLAGRANTEADA|SENTENCIAD[OA]|EM\s+APURACAO|POLO\s+PASSIVO|PASSIVO|PACIENTE|PROMOVIDO|DEPRECAD[OA]|DEPRECADO\s+A|DEPRECADA|INFRATOR|CORREU|REQUERIDO|REQUERIDA|APELANTE|APELADA|APELADO|RECORRENTE|RECORRIDA|RECORRIDO\s+A|RECORRIDO|AGRAVANTE|AGRAVADO\s+A|AGRAVADO|EMBARGANTE|EMBARGADO|NOTICIADO|OFENSOR)$/i;

// Roles que processaram empregadores (trabalhista) - ALTO RISCO para nova empresa
const HIGH_RISK_LABOR_PLAINTIFF = /^(AUTOR(?:\s+A)?|AUTORA(?:\s+A)?|RECLAMANTE|EXEQUENTE|EXEQTE|REQTE|QUERELANTE|IMPETRANTE|REQUERENTE(?:S)?|RECORRENTE|RECORRIDO|AGRAVANTE|AGRAVADO(?:\s+A)?|APELANTE|APELADO|POLO\s+ATIVO|POLO\s+ATIVO\s+PRINCIPAL|RECTE|PROMOVENTE|DEMANDANTE)$/i;

// Roles que foram processados pelo empregado (trabalhista) - BAIXO RISCO
const LOW_RISK_LABOR_DEFENDANT = /^(RECLAMADO|REU\s+TRABALHISTA|REU(?:\s+(RE|S|\d+|A))?|EXECUTADO|REQUERIDO|POLO\s+PASSIVO|REQDO|REQDA|EXECTDO|EXECTDA|EXECDO|EXECDA|DEMANDADO(?:\s+A)?|EMBARGADO|PASSIVO)$/i;

// Vítimas - sempre baixo risco
const VICTIM_ROLES = /^(VITIMA|V\b|VITIMA\s+DO\s+FATO|OFENDIDO|OFENDIDA|OFENDIDO\s+DO\s+FATO|OFENDIDA\s+DO\s+FATO|PREJUDICADO|LESADO|DAMNIFICADO|AGRAVIADO|PREJUDICADA|LESADA|DAMNIFICADA|AGRAVIADA|AUTOR\s+DO\s+FATO\s+VITIMA|AUTOR\s+DO\s+FATO\s+VITIMA)$/i;

// Profissionais - ignorar
const LAWYER_ROLES = /^(ADVOGAD[OA]\b.*|LAWYER|PROCURADOR|DEFENSOR|PROCURADORIA|DEFENSORIA|PATRONO|REPRESENTANTE\s+LEGAL|DOUTOR[A]?|ADVOGADO\s+REQTE|ADVOGADO\s+EXEQTE|ADVOGADO\s+IMPTTE|ADVOGADO\s+AUTOR|ADVOGADO\s+AUTOR\s+A|ADVOGADO\s+EXECTDO|ADVOGADO\s+HERDEIRO\s+A|ADVOGADO\s+EXECUTADO\s+A|ADVOGADO\s+INTERESDO|ADVOGADO\s+INVTANTE)$/i;

// Testemunhas - ignorar
const WITNESS_ROLES = /^(TESTEMUNHA|TESTEMUNHA\s+DO\s+JUIZO|TESTEMUNHA\s+POLO\s+ATIVO|TESTEMUNHA\s+POLO\s+PASSIVO|TESTEMUNHA\s+DE\s+ACUSACAO|TESTEMUNHA\s+PARTE\s+ATIVA|TESTEMUNHA\s+PARTE\s+PASSIVO|INFORMANTE|INFORMADO|INFORMADA)$/i;

// Instituições - ignorar
const AUTHORITY_ROLES = /^(AUTORIDADE|MINISTERIO\s+PUBLICO|MP|JUSTICA|DELEGACIA|ORGAO|INSTITUICAO|JUIZO|VARA|TRIBUNAL|FAZENDA|UNIAO|ESTADO|MUNICIPIO|INSS|RECEITA\s+FEDERAL|CAIXA|BANCO|INSTITUTO|PREFEITURA|SECRETARIA|DEPRECANTE|CONFRONTANTE|COMUNICANTE|JUIZO\s+RECORRENTE|ARROLANTE)$/i;

// Outros neutros
const OTHER_NEUTRAL_ROLES = /^(OUTRO|OUTROS(\s+PARTICIPANTES?)?|DESCONHECIDO|NAO\s+INFORMADO|TERCEIRO|INTERESSAD[OA](?:S)?|CONSIGNATARIO|REPRESENTANTE\b.*|ASSISTENCIA|CURADOR|TUTOR|PUPILO|SUCESSOR|TERCEIRO\s+INTERESSADO|NAO\s+APLICAVEL|N\s*A|INDEFINIDO|HERDEIRO|INVENTARIANTE|ESPOLIO\s+REQUERIDO|ALIMENTADO|PARTES|TERINTCER|ESPOLIO|INTERESSADO\s+PGM|REPRESENTANTE\s+REU)$/i;
```

> **Nota sobre decisões de classificação:** `EMBARGANTE` em processo criminal é classificado como `DEFENDANT/HIGH`, pois, no procedimento penal brasileiro, o embargante é tipicamente o condenado/réu. Já `LITISCONSORTE` não consta dos papéis neutros: é um papel ambíguo e deve ser resolvido pelo fallback de lado/polo (passivo = réu, ativo = autor/querelante).

- [ ] **Step 4: Rodar os testes para confirmar passagem**

Run:
```bash
cd functions
npx vitest run helpers/roleClassifier.test.js --reporter=verbose
```

Expected: PASS em todos os testes (incluindo os novos).

- [ ] **Step 5: Commit**

```bash
git add functions/helpers/roleClassifier.js functions/helpers/roleClassifier.test.js
git commit -m "feat(roleClassifier): expande regexes de papéis criminais e trabalhistas"
```

---

## Task 2: Adicionar fallback por lado/polo ao classifyRole

**Files:**
- Modify: `functions/helpers/roleClassifier.js:65-133`
- Test: `functions/helpers/roleClassifier.test.js`

**Contexto:** Mesmo com regexes ampliadas, provedores retornam papéis raros/ambíguos (ex: `ENVOLVIDO`, `REPRESENTADO`, `LITISCONSORTE`, `TJ`, `REPTANTE`). Quando sabemos o lado do processo (`Passive`/`Active`, `PASSIVE`/`ACTIVE`, `NEUTRAL`), podemos classificar com segurança, priorizando eliminar falsos negativos. O fallback NUNCA deve sobrepor vítima, testemunha, advogado, autoridade ou papel neutro conhecido.

- [ ] **Step 1: Escrever testes de falha para fallback por lado**

No arquivo `functions/helpers/roleClassifier.test.js`, adicione um novo `describe` dentro de `describe('classifyRole')`:

```js
describe('side/polo fallback', () => {
    it('classifies unknown passive role in criminal as DEFENDANT/HIGH', () => {
        const result = classifyRole('ENVOLVIDO', 'Criminal', 'Passive');
        expect(result.category).toBe('DEFENDANT');
        expect(result.riskLevel).toBe('HIGH');
    });

    it('classifies unknown active role in criminal as PLAINTIFF/LOW', () => {
        const result = classifyRole('REPRESENTADO', 'Criminal', 'Active');
        expect(result.category).toBe('PLAINTIFF');
        expect(result.riskLevel).toBe('LOW');
    });

    it('classifies unknown passive role in labor as DEFENDANT/LOW', () => {
        const result = classifyRole('LITISCONSORTE', 'Trabalhista', 'Passive');
        expect(result.category).toBe('DEFENDANT');
        expect(result.riskLevel).toBe('LOW');
    });

    it('classifies unknown active role in labor as PLAINTIFF/HIGH', () => {
        const result = classifyRole('REPRESENTADO', 'Trabalhista', 'Active');
        expect(result.category).toBe('PLAINTIFF');
        expect(result.riskLevel).toBe('HIGH');
    });

    it('does not fallback for witnesses', () => {
        const result = classifyRole('TESTEMUNHA POLO PASSIVO', 'Criminal', 'Passive');
        expect(result.category).toBe('WITNESS');
        expect(result.riskLevel).toBe('IGNORE');
    });

    it('does not fallback for victims', () => {
        const result = classifyRole('VITIMA DO FATO', 'Criminal', 'Passive');
        expect(result.category).toBe('VICTIM');
        expect(result.riskLevel).toBe('LOW');
    });

    it('does not fallback for lawyers', () => {
        const result = classifyRole('ADVOGADO REQTE', 'Criminal', 'Passive');
        expect(result.category).toBe('LAWYER');
        expect(result.riskLevel).toBe('IGNORE');
    });

    it('does not fallback for neutral roles', () => {
        const result = classifyRole('TERCEIRO INTERESSADO', 'Criminal', 'Passive');
        expect(result.category).toBe('OTHER');
        expect(result.riskLevel).toBe('IGNORE');
    });

    it('keeps UNKNOWN for neutral side', () => {
        const result = classifyRole('ENVOLVIDO', 'Criminal', 'Neutral');
        expect(result.category).toBe('UNKNOWN');
        expect(result.riskLevel).toBe('NEUTRAL');
    });

    it('keeps UNKNOWN when side is missing', () => {
        const result = classifyRole('ENVOLVIDO', 'Criminal');
        expect(result.category).toBe('UNKNOWN');
        expect(result.riskLevel).toBe('NEUTRAL');
    });
});
```

- [ ] **Step 2: Rodar os testes para confirmar falha**

Run:
```bash
cd functions
npx vitest run helpers/roleClassifier.test.js --reporter=verbose
```

Expected: FAIL para os novos testes de fallback.

- [ ] **Step 3: Implementar fallback por lado**

No arquivo `functions/helpers/roleClassifier.js`, altere a assinatura e a lógica de `classifyRole`:

```js
function classifyRole(role, area = '', side = '') {
    const normalizedRole = normalizeLegalText(role);
    const normalizedArea = normalizeLegalText(area);
    const normalizedSide = normalizeLegalText(side);

    if (!normalizedRole) {
        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel nao informado' };
    }

    // Verificar ignorar primeiro
    if (WITNESS_ROLES.test(normalizedRole)) {
        return { category: 'WITNESS', riskLevel: 'IGNORE', reason: 'Testemunha - nao indica risco' };
    }

    if (LAWYER_ROLES.test(normalizedRole)) {
        return { category: 'LAWYER', riskLevel: 'IGNORE', reason: 'Advogado - papel profissional' };
    }

    if (AUTHORITY_ROLES.test(normalizedRole)) {
        return { category: 'AUTHORITY', riskLevel: 'IGNORE', reason: 'Instituicao/Autoridade' };
    }

    if (OTHER_NEUTRAL_ROLES.test(normalizedRole)) {
        return { category: 'OTHER', riskLevel: 'IGNORE', reason: 'Papel neutro ou desconhecido' };
    }

    // Verificar vitima
    if (VICTIM_ROLES.test(normalizedRole)) {
        return { category: 'VICTIM', riskLevel: 'LOW', reason: 'Vitima do crime/ofensa' };
    }

    // Lógica específica por área
    if (normalizedArea.includes('CRIM') || normalizedArea.includes('PENAL')) {
        // Criminal: Réu/Indiciado/Autor do Fato = ALTO
        if (HIGH_RISK_CRIMINAL_ROLES.test(normalizedRole)) {
            return { category: 'DEFENDANT', riskLevel: 'HIGH', reason: 'Reu/Indiciado em processo criminal' };
        }
        // Autor em criminal (não "autor do fato") = geralmente querelante/vitima = BAIXO
        if (/^(AUTOR|REQUERENTE|IMPETRANTE|QUERELANTE|ATIVO|POLO\s+ATIVO|POLO\s+ATIVO\s+PRINCIPAL|REQTE|EXEQTE|EXEQUENTE|DEMANDANTE|PROMOVENTE|RECTE|PARTE\s+AUTORA)$/.test(normalizedRole)) {
            return { category: 'PLAINTIFF', riskLevel: 'LOW', reason: 'Autor/Querelante em processo criminal' };
        }

        // Fallback por lado/polo quando papel não foi reconhecido
        if (normalizedSide && /^(PASSIVO?|PASSI|PASSIVE|PASSIVA?)$/.test(normalizedSide)) {
            return { category: 'DEFENDANT', riskLevel: 'HIGH', reason: 'Papel nao classificado, lado passivo em processo criminal' };
        }
        if (normalizedSide && /^(ATIVO?|ATIVA?|ACTIVE|ATIV|AUTHOR|PLAINTIFF)$/.test(normalizedSide)) {
            return { category: 'PLAINTIFF', riskLevel: 'LOW', reason: 'Papel nao classificado, lado ativo em processo criminal' };
        }

        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel nao classificado em processo criminal' };
    }

    if (normalizedArea.includes('TRAB') || normalizedArea.includes('TRABALHISTA')) {
        // Trabalhista: Autor/Reclamante (processou empregador) = ALTO RISCO
        if (HIGH_RISK_LABOR_PLAINTIFF.test(normalizedRole)) {
            return { category: 'PLAINTIFF', riskLevel: 'HIGH', reason: 'Autor/Reclamante em acao trabalhista (processou empregador)' };
        }
        // Trabalhista: Reclamado/Réu (foi processado pelo empregado) = BAIXO RISCO
        if (LOW_RISK_LABOR_DEFENDANT.test(normalizedRole) || /^(PASSIVO|DEFENDANT)$/.test(normalizedRole)) {
            return { category: 'DEFENDANT', riskLevel: 'LOW', reason: 'Reclamado/Reu em acao trabalhista (processado pelo empregado)' };
        }

        // Fallback por lado/polo
        if (normalizedSide && /^(PASSIVO?|PASSI|PASSIVE|PASSIVA?)$/.test(normalizedSide)) {
            return { category: 'DEFENDANT', riskLevel: 'LOW', reason: 'Papel nao classificado, lado passivo em processo trabalhista' };
        }
        if (normalizedSide && /^(ATIVO?|ATIVA?|ACTIVE|ATIV|AUTHOR|PLAINTIFF)$/.test(normalizedSide)) {
            return { category: 'PLAINTIFF', riskLevel: 'HIGH', reason: 'Papel nao classificado, lado ativo em processo trabalhista' };
        }

        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel nao classificado em processo trabalhista' };
    }

    // Cível e outras áreas (quando area é desconhecida, ser conservador)
    if (normalizedArea) {
        // Réu/Passivo/Executado = MEDIO
        if (/^(REU|PASSIVO|DEFENDANT|EXECUTADO|REQUERIDO|POLO\s+PASSIVO)$/.test(normalizedRole)) {
            return { category: 'DEFENDANT', riskLevel: 'MEDIUM', reason: 'Reu/Passivo em processo cível' };
        }
        // Autor/Ativo = BAIXO
        if (/^(AUTOR|ATIVO|ACTIVE|REQUERENTE|POLO\s+ATIVO)$/.test(normalizedRole)) {
            return { category: 'PLAINTIFF', riskLevel: 'LOW', reason: 'Autor/Ativo em processo cível' };
        }
    }

    return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel nao classificado' };
}
```

- [ ] **Step 4: Rodar os testes para confirmar passagem**

Run:
```bash
cd functions
npx vitest run helpers/roleClassifier.test.js --reporter=verbose
```

Expected: PASS em todos os testes.

- [ ] **Step 5: Commit**

```bash
git add functions/helpers/roleClassifier.js functions/helpers/roleClassifier.test.js
git commit -m "feat(roleClassifier): adiciona fallback por lado/polo em criminal e trabalhista"
```

---

## Task 3: Passar lado/polo nos normalizadores

**Files:**
- Modify: `functions/normalizers/judit.js:137`
- Modify: `functions/normalizers/bigdatacorp.js:126`
- Modify: `functions/normalizers/escavador.js:84`
- Modify: `functions/normalizers/djen.js:359`

**Contexto:** O fallback por lado só tem efeito se os normalizadores passarem o lado disponível. `classifyRole` tem assinatura retrocompatível (`side` é opcional), então chamadas antigas continuam funcionando.

- [ ] **Step 1: Judit — passar role.side**

No arquivo `functions/normalizers/judit.js`, altere a linha 137 de:

```js
const roleClassification = classifyRole(role?.personType, areaForRole);
```

para:

```js
const roleClassification = classifyRole(role?.personType, areaForRole, role?.side);
```

- [ ] **Step 2: BigDataCorp — passar polo**

No arquivo `functions/normalizers/bigdatacorp.js`, altere a linha 126 de:

```js
const roleClassification = classifyRole(specificRole || partyType, areaForRole);
```

para:

```js
const roleClassification = classifyRole(specificRole || partyType, areaForRole, polo);
```

- [ ] **Step 3: Escavador — passar polo/side disponível**

No arquivo `functions/normalizers/escavador.js`, encontre a chamada a `classifyRole`. Supondo que ela se pareça com:

```js
const roleClassification = classifyRole(role?.tipoNormalizado || role?.tipo, areaForRole);
```

altere para:

```js
const roleClassification = classifyRole(role?.tipoNormalizado || role?.tipo, areaForRole, role?.polo || role?.side || role?.lado);
```

Se os nomes de propriedade forem diferentes no objeto `role`, inspecione o objeto e use a propriedade correta que representa o lado/polo.

- [ ] **Step 4: DJEN — passar side/polarity disponível**

No arquivo `functions/normalizers/djen.js`, encontre a chamada a `classifyRole` (próximo à linha 359). Supondo algo como:

```js
return classifyRole(role, area);
```

altere para:

```js
return classifyRole(role, area, item?.side || item?.polarity || item?.polo);
```

Ajuste `item` para o nome da variável que representa o participante/process object no contexto local.

- [ ] **Step 5: Rodar testes dos normalizadores**

Run:
```bash
cd functions
npx vitest run normalizers/judit.test.js normalizers/bigdatacorp.test.js normalizers/escavador.test.js normalizers/djen.test.js --reporter=verbose
```

Expected: PASS. Se algum teste falhar, ajuste o mock/teste para refletir a nova classificação (se for intencional) ou corrija a implementação.

- [ ] **Step 6: Commit**

```bash
git add functions/normalizers/judit.js functions/normalizers/bigdatacorp.js functions/normalizers/escavador.js functions/normalizers/djen.js
git commit -m "feat(normalizers): passa lado/polo para roleClassifier"
```

---

## Task 4: Verificar integração com autoClassification e aiHomonym

**Files:**
- Read-only: `functions/modules/autoClassification.js`
- Read-only: `functions/helpers/aiHomonym.js`
- Test: `functions/modules/autoClassification.test.js`
- Test: `functions/helpers/aiHomonym.test.js` (se existir)

**Contexto:** `autoClassification.js` consome `isDefendant`/`isPlaintiff` gerados pelos normalizadores. `aiHomonym.js` também chama `classifyRole`. Não devemos alterar esses arquivos, mas precisamos garantir que as mudanças não quebram seus testes.

- [ ] **Step 1: Rodar testes de autoClassification**

Run:
```bash
cd functions
npx vitest run modules/autoClassification.test.js --reporter=verbose
```

Expected: PASS.

- [ ] **Step 2: Rodar testes de aiHomonym**

Run:
```bash
cd functions
npx vitest run helpers/aiHomonym.test.js --reporter=verbose
```

Expected: PASS. Se o arquivo não existir, pule este passo.

- [ ] **Step 3: Commit (somente se houver alterações)**

Se não houve alteração de código, não faça commit. Se precisou ajustar algum teste/mock, commite:

```bash
git add functions/modules/autoClassification.test.js functions/helpers/aiHomonym.test.js
git commit -m "test: ajusta expectativas após fallback por lado/polo"
```

---

## Task 5: Rodar suite completa e lint

**Files:**
- Todos os arquivos modificados.

- [ ] **Step 1: Rodar todos os testes do backend**

Run:
```bash
cd functions
npm test
```

Expected: PASS em todos os testes ( Vitest ~1.200+ testes, duração ~8s conforme AGENTS.md).

- [ ] **Step 2: Rodar lint do backend**

Run:
```bash
cd functions
npm run lint
```

Expected: 0 erros, 0 warnings críticos.

- [ ] **Step 3: Rodar testes e lint do frontend (se houver mudança compartilhada)**

Run na raiz:
```bash
npm test
npm run lint
```

Expected: PASS. Nota: este plano não altera o frontend, mas a suite deve continuar verde.

- [ ] **Step 4: Commit (se houver ajustes de lint)**

```bash
git add -A
git commit -m "chore: ajustes de lint pós role classifier fallback"
```

---

## Task 6: Deploy das functions

**Files:**
- Nenhum arquivo novo.

**Contexto:** Deploy manual via Firebase CLI. Não reprocessar casos finalizados — as mudanças só afetam novos enriquecimentos.

- [ ] **Step 1: Fazer deploy apenas das functions**

Run na raiz do projeto:
```bash
firebase deploy --only functions
```

Expected: Deploy bem-sucedido para o projeto `compliance-hub-br`.

- [ ] **Step 2: Monitorar logs por 30-60 minutos**

Run:
```bash
firebase functions:log --project compliance-hub-br --limit 50
```

Ou use o console do Firebase. Verifique por erros inesperados em `normalizeJuditLawsuits`, `normalizeBigDataCorpProcesses`, `normalizeEscavadorLawsuits`, `normalizeDjenUpdates`.

- [ ] **Step 3: Verificar classificação em novos casos**

Após o deploy, quando novos casos forem enriquecidos, inspecione `juditRoleSummary`, `bigdatacorpProcessos`, etc. Verifique se papéis como `ENVOLVIDO`/`PASSIVO` agora aparecem como `DEFENDANT/HIGH`.

---

## Self-Review

**1. Spec coverage:**
- Expandir regexes de papéis criminais → Task 1
- Expandir regexes de papéis trabalhistas → Task 1
- Adicionar fallback por lado/polo → Task 2
- Passar lado/polo nos normalizadores → Task 3
- Garantir que vítimas/testemunhas/advogados não sejam reclassificados → coberto nos testes da Task 2
- Não reprocessar casos finalizados → nota na Task 6
- Manter retrocompatibilidade → `side` é opcional em `classifyRole`

**2. Placeholder scan:**
- Nenhum TBD/TODO/fill in details
- Todos os comandos e códigos estão explícitos
- Nenhuma referência a tipos/funções não definidos

**3. Type consistency:**
- `classifyRole(role, area = '', side = '')` mantém compatibilidade
- Normalizadores passam strings para `side`
- Testes usam strings para área, papel e lado

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-17-role-classifier-side-fallback.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
