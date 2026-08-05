# Qualidade de dados do Escavador2

## Contexto

Uma auditoria somente leitura dos casos criados entre 2026-06-26 e 2026-07-17 identificou dois defeitos independentes no enriquecimento Escavador2:

1. O payload bruto contem polos e nomes das partes, mas o normalizador nao os transfere para `escavador2Processos[].parties`. O prefill, portanto, nao consegue exibir a contraparte trabalhista quando nenhum outro provedor complementa o mesmo processo.
2. O callback persiste o payload bruto completo e duplicado no documento do caso. Um callback tentou elevar um caso a 1.227.224 bytes e foi rejeitado pelo limite de 1 MiB do Firestore, deixando caso e task em `RUNNING`/`QUEUED`.

O mesmo normalizador tambem descarta `status_predito`, `cidade` e `orgao_julgador`, embora esses dados estejam disponiveis no payload.

## Objetivos

- Preservar as partes processuais necessarias para identificar a contraparte no prefill trabalhista.
- Preservar status processual, cidade e orgao julgador normalizados.
- Manter rastreabilidade interna com um raw compacto e limitado.
- Impedir que campos volumosos e duplicados do Escavador2 levem o documento do caso ao limite do Firestore.
- Manter o raw Escavador2 exclusivamente interno, sem anonimizar ou mascarar evidencias processuais.

## Fora de escopo

- Deploy de Cloud Functions.
- Escritas, reruns ou correcoes no Firestore de producao.
- Correcao automatica de casos historicos.
- Mudanca na classificacao de risco ou na politica de veredito.
- Nova subcolecao para payloads ou alteracao de schema persistente fora dos campos Escavador2 existentes.

## Desenho

### Normalizacao de partes

O normalizador deve produzir `parties` no formato canonico usado por `reportHelpers`:

```js
{
  name: 'Madero Industria e Comercio S.A',
  role: 'Polo Passivo',
  side: 'PASSIVE',
}
```

As fontes, em ordem de preferencia, sao:

1. `processo.lista.polo_ativo` e `processo.lista.polo_passivo`.
2. `processo.detalhes.processo.polo_ativo` e `processo.detalhes.processo.polo_passivo`.
3. `processo.detalhes.raw.fontes[].envolvidos[]`, quando houver nome e polo.

Nomes devem ser aparados, deduplicados de forma insensivel a caixa e ignorados quando vazios. Polos ativos usam `side: 'ACTIVE'`; polos passivos usam `side: 'PASSIVE'`.

### Dados processuais adicionais

O processo normalizado deve mapear:

- `status`: status processual string existente ou `normalizado.dados.status_predito` como fallback.
- `processCity` e `comarca`: `normalizado.dados.cidade`.
- `vara` e `judgingBody`: `normalizado.dados.orgao_julgador`.

O status de coleta em formato objeto continua proibido como status processual.

### Raw compacto

`escavador2RawPayloads.response` deve manter somente evidencias de auditoria necessarias:

- `consulta`, `perfil`, `resumo`, `erros_parciais` e `estatisticas`.
- Lista resumida de processos, incluindo CNJ, polos e papeis.
- Por processo: CNJ, classificacao, papel do candidato, dados normalizados essenciais e polos presentes em `detalhes.processo`.

Nomes, partes, polos, CNJs e demais identificadores processuais preservados no raw compacto nao devem ser anonimizados, mascarados ou substituidos. A compactacao elimina somente volume tecnico sem valor adicional para a auditoria.

Devem ser removidos do raw persistido:

- HTML e resumos textuais extensos.
- Documentos e conteudos de documentos.
- Listas completas de movimentacoes.
- Copias redundantes da mesma resposta.

O compactador deve aplicar um teto defensivo de 128 KiB ao JSON do raw. Se o primeiro nivel compacto exceder o teto, deve reduzir para metadados, resumo e lista processual minima. O resultado final precisa permanecer abaixo do teto para deixar margem aos demais campos do caso.

Os processos normalizados tambem nao devem duplicar estruturas raw extensas em `_sourceEscavador2` ou `movimentacoesResumo`; somente metadados resumidos sao preservados.

## Fluxo de dados

1. O callback recebe `body.result`.
2. `normalizeEscavador2Response` cria processos canonicos, partes e raw compacto.
3. A deduplicacao marca achados novos sem alterar as partes.
4. A transacao atualiza o caso com a representacao compacta.
5. A classificacao automatica usa o caso atualizado.
6. `selectTopProcessos` preserva `parties` e `formatLaborProcessBlock` exibe a contraparte.

## Tratamento de erros

- Valores inesperados de polos ou partes devem ser ignorados sem derrubar o callback.
- Formatos objeto usados como status de coleta nao devem aparecer no relatorio.
- O compactador deve ser deterministico e nao mutar a resposta recebida.
- O callback deve continuar usando os estados terminais existentes (`DONE`, `PARTIAL`, `FAILED`, `SKIPPED`).

O caso de producao atualmente travado nao sera alterado por esta implementacao. Depois de um eventual deploy, ele exigira decisao operacional separada para rerun ou finalizacao controlada.

## Testes e criterios de aceitacao

1. Dado um processo trabalhista com candidato no polo ativo e Madero no polo passivo, o normalizador gera a parte passiva e o prefill contem `Parte reclamada/passiva: Madero Industria e Comercio S.A`.
2. Dado o segundo formato real observado, a contraparte tambem e extraida da lista resumida.
3. Partes repetidas em lista, detalhes e envolvidos aparecem apenas uma vez.
4. `status_predito`, cidade e orgao julgador chegam ao processo normalizado e ao bloco formatado.
5. Um status de coleta em formato objeto nao vira status processual.
6. Um payload sintetico com movimentos, documentos e HTML volumosos produz raw compacto abaixo de 128 KiB.
7. A entrada original permanece inalterada.
8. Testes do normalizador, prefill, callback e enriquecimento continuam passando.

## Verificacao operacional posterior

Fora desta implementacao local, um rollout seguro deve incluir:

1. Deploy isolado das funcoes afetadas somente apos revisao.
2. Monitoramento de erros HTTP 500 e tamanho de documento no callback.
3. Auditoria read-only de novos casos para confirmar contraparte, status e local.
4. Plano explicito e aprovado para o caso travado e para historicos afetados.
