# Alerta de CPF duplicado na Nova Solicitação

## Contexto

O cliente (empresa que usa o portal) pediu um aviso simples ao criar uma
nova solicitação de análise: se o CPF informado já foi consultado antes por
essa mesma empresa, o sistema deve confirmar com o usuário antes de criar
outro caso para o mesmo candidato — evitando duplicidade acidental de
solicitações (e o custo/tempo de análise associado).

## Escopo

- Verificação restrita ao **tenant** do usuário logado (não é uma checagem
  global entre empresas clientes diferentes).
- Disparo **apenas ao clicar em "Enviar"** — sem checagem a cada edição do
  campo CPF.
- Modal de confirmação **simples**, sem exibir detalhes do caso anterior
  (status, data, analista etc.) — só confirma que já existe.

Fora de escopo: aplicar essa checagem no fluxo de correção de caso
(`submitClientCorrection`), que edita um caso já existente e não cria um novo.

## Backend

Nova função callable dedicada `checkClientCpfExists`, em
`functions/modules/clientSolicitations.js`, seguindo o padrão de factory já
usado no arquivo (`createClientSolicitationHandler`).

```
createCheckClientCpfExistsHandler({ db, getClientUserProfile })
```

Comportamento:
1. Exige autenticação (`request.auth?.uid`), mesmo padrão dos outros handlers
   client-facing.
2. Resolve `profile.tenantId` via `getClientUserProfile(uid)`.
3. Sanitiza/valida o CPF recebido (`sanitizeCpf` + `validateCpfDigits`,
   helpers já existentes em `_shared/sanitizers`); CPF inválido → `HttpsError
   ('invalid-argument', ...)`.
4. Query: `db.collection('cases').where('tenantId', '==', tenantId)
   .where('cpf', '==', cpfDigits).limit(1).get()`.
5. Retorna `{ exists: boolean }` — nenhum outro dado do caso anterior.

Registro em `functions/index.js`:

```js
exports.checkClientCpfExists = onCall(
    { region: 'southamerica-east1', cors: [/\.vercel\.app$/, /localhost/] },
    withRateLimit({ maxRequests: 20, windowMs: 60000, key: 'checkCpfExists' })(
        clientSolicitations.createCheckClientCpfExistsHandler({ db, getClientUserProfile })
    ),
);
```

Rate limit leve (20/min) só para evitar varredura de CPFs por força bruta;
não é uma operação sensível (não vaza nada além de um booleano do próprio
tenant do usuário autenticado).

Sem índice composto novo necessário — Firestore resolve `AND` de duas
igualdades (`tenantId==`, `cpf==`) com índices de campo único automáticos.

## Frontend

**`src/core/firebase/firestoreService.js`**: novo wrapper, mesmo padrão dos
demais:

```js
export async function callCheckClientCpfExists(cpf) {
    return callBackendFunction('checkClientCpfExists', { cpf });
}
```

**`src/portals/client/NovaSolicitacaoPanel.jsx`**:

- Novo estado `const [showCpfDuplicateModal, setShowCpfDuplicateModal] =
  useState(false)` e `const [cpfConfirmed, setCpfConfirmed] =
  useState(false)`, resetados no mesmo `useEffect` que já limpa o form ao
  abrir o painel.
- Em `handleSubmit`, logo após `validate()` passar e antes do bloco de
  checagem de quota: se `!cpfConfirmed`, chama `callCheckClientCpfExists
  (form.cpf)`; se `exists === true`, seta `showCpfDuplicateModal(true)` e
  retorna (interrompe o submit, sem seguir pro check de quota ainda).
- Modal (reaproveita o componente `Modal` já usado para `showExceedModal`):
  - Título: **"CPF já consultado"**
  - Corpo: *"Este candidato já foi consultado anteriormente por sua
    empresa. Tem certeza que deseja continuar com uma nova solicitação?"*
  - Botões: "Cancelar" (fecha o modal, mantém o form preenchido) / "Sim,
    continuar" (seta `cpfConfirmed(true)`, fecha o modal, e chama
    `handleSubmit` de novo — que agora pula a checagem de CPF e segue pro
    fluxo de quota/submit já existente).
- Falha de rede/erro na checagem (`callCheckClientCpfExists` rejeita): não
  bloqueia o envio — trata como "não encontrado" (fail-open), já que é uma
  conveniência de UX, não uma trava de segurança. Loga o erro no console
  como os demais catches do arquivo.

## Testes

- **Backend** (`functions/modules/clientSolicitations.test.js`): três casos
  — CPF inédito no tenant (`exists:false`), CPF já existente no mesmo
  tenant (`exists:true`), CPF existente em outro tenant não conta
  (`exists:false`, prova o isolamento por tenant).
- **Frontend** (`NovaSolicitacaoPage.test.jsx` ou arquivo próprio): submit
  com CPF novo vai direto pro fluxo normal; submit com CPF duplicado abre o
  modal; clicar "Sim, continuar" prossegue e chama
  `callCreateClientSolicitation`; clicar "Cancelar" mantém o form aberto sem
  submeter.
