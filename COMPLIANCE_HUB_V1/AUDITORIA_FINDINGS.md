# AUDITORIA FINDINGS - ComplianceHub

## Data: 2026-05-05
## Status: EM ANDAMENTO - FASE DE CORRECAO
## Total de Bugs: 53
## P0: 6 | P1: 18 | P2: 22 | P3: 7

---

## Resumo Executivo

Auditoria completa dos 4 fluxos principais identificou **53 bugs**:
- **Flow 1 - Solicitacao**: 14 bugs (4 P0, 5 P1, 4 P2, 1 P3)
- **Flow 2 - Enriquecimento**: 11 bugs (2 P0, 3 P1, 6 P2)
- **Flow 3 - Analise**: 13 bugs (4 P1, 7 P2, 2 P3)
- **Flow 4 - Relatorios**: 15 bugs (6 P1, 5 P2, 4 P3)

---

## Bugs P0 - Criticos (Impedem Uso / Seguranca)

### P0-001: Backend aceita UF vazia (bypass de validacao)
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:5597-5601`
- **Problema**: Backend so valida UF se nao-vazia. Bypass via callable direto.
- **Correcao**: Rejeitar strings vazias: `if (!VALID_UFS.has(hiringUfClean)) throw ...`

### P0-002: otherSocialUrls aceita objetos arbitrarios (XSS/Injection)
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:5645,5675`
- **Problema**: Array de objetos sem validacao de estrutura interna.
- **Correcao**: Validar e sanitizar cada item: `{ label: String(item.label).slice(0,50), url: String(item.url).slice(0,500) }`

### P0-003: Race condition entre incremento de quota e criacao do caso
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:5614-5720`
- **Problema**: Quota incrementada em transacao separada. Se batch.commit() falhar, quota fica inflada permanentemente.
- **Correcao**: Incrementar quota dentro do mesmo batch ou usar compensacao.

### P0-004: IP spoofing possivel nos audit logs
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:8910-8914`
- **Problema**: IP extraido de x-forwarded-for sem verificacao.
- **Correcao**: Priorizar request.rawRequest.ip (infraestrutura Firebase).

### P0-005: Relancamento de erros em triggers Firebase (retry loops)
- **Flow**: 2 - Enriquecimento
- **Arquivo:linha**: `functions/index.js:3505,3673,3780`
- **Problema**: throw err em triggers causa retry automatico (3x). Custo duplicado em APIs pagas.
- **Correcao**: Remover throw err. Marcar status como FAILED e retornar silenciosamente.

### P0-006: runAutoClassifyAndAi pode deixar case travado
- **Flow**: 2 - Enriquecimento
- **Arquivo:linha**: `functions/index.js:4064-4351`
- **Problema**: Excecao antes do catch deixa caso sem classificacao e sem lock.
- **Correcao**: Garantir persistencia de estado minimo (aiStatus: 'FAILED') mesmo em falhas.

---

## Bugs P1 - Altos (Funcionalidade Comprometida)

### P1-001: Backend nao limita tamanho de campos textuais
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:5627-5718`
- **Problema**: Campos como fullName, position, etc. sem limite de tamanho.
- **Correcao**: Aplicar slice(0, MAX_LENGTH) em todos os campos.

### P1-002: Backend nao valida formato de email
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:5637,5677`
- **Problema**: Aceita qualquer string como email.
- **Correcao**: Adicionar validacao regex de email.

### P1-003: Backend nao valida formato de data de nascimento
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:5635`
- **Problema**: Aceita qualquer string como dateOfBirth.
- **Correcao**: Validar formato YYYY-MM-DD.

### P1-004: Backend nao valida URLs de redes sociais
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:5639-5674`
- **Problema**: Aceita qualquer string como URL.
- **Correcao**: Reutilizar validateUrl do frontend no backend.

### P1-005: Dados de notificacao sem sanitizacao de HTML
- **Flow**: 1 - Solicitacao
- **Arquivo:linha**: `functions/index.js:8757-8784`
- **Problema**: candidateName e tenantName inseridos em message/title sem escapar.
- **Correcao**: Escapar HTML antes de persistir na notificacao.

### P1-006: Circuit breaker incompleto (faltam BigDataCorp e DJEN)
- **Flow**: 2 - Enriquecimento
- **Arquivo:linha**: `functions/helpers/circuitBreaker.js:19-24`
- **Problema**: PROVIDER_DEFAULTS nao inclui bigdatacorp nem djen.
- **Correcao**: Adicionar configuracoes para ambos.

### P1-007: FonteData normalizer retorna campo sem prefixo
- **Flow**: 2 - Enriquecimento
- **Arquivo:linha**: `functions/normalizers/phases.js:182-184`
- **Problema**: Retorna criminalFlag (sem prefixo) que pode sobrescrever campo derivado.
- **Correcao**: Remover criminalFlag sem prefixo, manter apenas fontedataCriminalFlag.

### P1-008: runFonteDataEnrichmentPhase sem lock em rerun manual
- **Flow**: 2 - Enriquecimento
- **Arquivo:linha**: `functions/index.js:9598`
- **Problema**: Rerun manual nao usa acquirePhaseRun. Race condition e cobranca duplicada.
- **Correcao**: Adicionar acquirePhaseRun antes de invocar.

### P1-009: Race condition na atribuicao de casos
- **Flow**: 3 - Analise
- **Arquivo:linha**: `functions/index.js:6694,6741`
- **Problema**: Read-modify-write sem transacao Firestore.
- **Correcao**: Usar db.runTransaction para atribuicao.

### P1-010: Conclusao sem validacao de status do caso
- **Flow**: 3 - Analise
- **Arquivo:linha**: `functions/index.js:8330`
- **Problema**: Pode concluir caso PENDING, CORRECTION_NEEDED, ou ja DONE.
- **Correcao**: Validar status IN_PROGRESS antes de concluir.

### P1-011: Risk score aceito do cliente sem recalculo
- **Flow**: 3 - Analise
- **Arquivo:linha**: `functions/index.js:6532,8461`
- **Problema**: ALLOWED_CONCLUDE_FIELDS inclui riskScore. Bypass do calculo.
- **Correcao**: Remover riskScore/riskLevel da allowlist. Sempre recalcular no servidor.

### P1-012: Narratives nao sanitizam tags HTML (XSS persistente)
- **Flow**: 3 - Analise
- **Arquivo:linha**: `functions/index.js:478,757`
- **Problema**: sanitizeStructuredText e sanitizeAiOutput nao removem tags HTML.
- **Correcao**: Adicionar stripHtmlTags na pipeline de sanitizacao.

### P1-013: processHighlights ausente no frontend reportBuilder
- **Flow**: 4 - Relatorios
- **Arquivo:linha**: `src/core/reportBuilder.js`
- **Problema**: Frontend omite secao de apontamentos relevantes de processos.
- **Correcao**: Copiar processHighlightsHtml do backend para o frontend.

### P1-014: Timeline fallback descarta Timestamps
- **Flow**: 4 - Relatorios
- **Arquivo:linha**: `functions/index.js:8946-8948`
- **Problema**: typeof caseData.createdAt === 'string' falha para Timestamps, atribuindo ''.
- **Correcao**: Usar asDate() ou toISOString() para Timestamps.

### P1-015: buildCanonicalReportHtml sobrescreve sourceSummary/statusSummary
- **Flow**: 4 - Relatorios
- **Arquivo:linha**: `functions/index.js:8953-8969`
- **Problema**: Sobrescreve valores ja sanitizados do publicResultData.
- **Correcao**: Preferir publicResultData.* || caseData.* || fallback.

### P1-016: createClientPublicReport nao persiste publicSnapshotHash
- **Flow**: 4 - Relatorios
- **Arquivo:linha**: `functions/index.js:6265-6362`
- **Problema**: Nao computa nem persiste hash de integridade.
- **Correcao**: Reutilizar syncPublicResultLatest + computePublicSnapshotHash.

### P1-017: ClientReportPage iframe permite scripts
- **Flow**: 4 - Relatorios
- **Arquivo:linha**: `src/portals/client/ClientReportPage.jsx:234`
- **Problema**: Sandbox inclui allow-scripts desnecessariamente.
- **Correcao**: Remover allow-scripts do sandbox.

### P1-018: createClientPublicReport nao atualiza reportReady
- **Flow**: 4 - Relatorios
- **Arquivo:linha**: `functions/index.js:6344`
- **Problema**: Endpoint do cliente nao seta reportReady: true.
- **Correcao**: Incluir reportReady: true no caseRef.update().

---

## Bugs P2 - Medios (Experiencia Degradada)

### P2-001: Nome minimo de 1 caractere aceito
- **Flow**: 1 - Solicitacao
- **Correcao**: Exigir minimo 3 caracteres.

### P2-002: digitalProfileNotes nao respeita maxLength no backend
- **Flow**: 1 - Solicitacao
- **Correcao**: Aplicar slice(0, 500).

### P2-003: Campos textuais nao sao trimados no backend
- **Flow**: 1 - Solicitacao
- **Correcao**: Aplicar .trim() em todos os campos de texto.

### P2-004: Quota status pode estar stale no frontend
- **Flow**: 1 - Solicitacao
- **Correcao**: Reconsultar quota antes de submit ou remover validacao frontend.

### P2-005: Documentacao desatualizada no header do index.js
- **Flow**: 2 - Enriquecimento
- **Correcao**: Atualizar para "BigDataCorp-First Enrichment Pipeline".

### P2-006: Triggers nao disparam para documentos ja em estado terminal
- **Flow**: 2 - Enriquecimento
- **Correcao**: Adicionar bootstrap triggers para casos bulk.

### P2-007: DJEN pode rodar antes de Escavador
- **Flow**: 2 - Enriquecimento
- **Correcao**: Adicionar guard para esperar Escavador quando juditNeedsEscavador.

### P2-008: Gate do BigDataCorp pulado quando cpfStatus vazio
- **Flow**: 2 - Enriquecimento
- **Correcao**: Verificar fase habilitada em vez de valor truthy.

### P2-009: Timeout apertado no pollRequest do Judit
- **Flow**: 2 - Enriquecimento
- **Correcao**: Reduzir POLL_MAX_WAIT_MS para 6 min ou aumentar timeout da CF.

### P2-010: assumeAlreadyRunning sem verificacao
- **Flow**: 2 - Enriquecimento
- **Correcao**: Remover parametro ou implementar corretamente.

### P2-011: Divergencia entre reportBuilder frontend e backend
- **Flow**: 3 - Analise
- **Correcao**: Sincronizar ambos os arquivos.

### P2-012: enabledPhases nao validado contra configuracao do tenant
- **Flow**: 3 - Analise
- **Correcao**: Validar fases obrigatorias do tenant.

### P2-013: turnaroundHours fragil em casos reabertos
- **Flow**: 3 - Analise
- **Correcao**: Remover fallback para updatedAt.

### P2-014: Trigger publishResultOnCaseDone sem validacao de conteudo minimo
- **Flow**: 3 - Analise
- **Correcao**: Adicionar hasPublicReportMinimumContent antes de publicar.

### P2-015: assertOpsCanAccessCase nao valida assignee na conclusao
- **Flow**: 3 - Analise
- **Correcao**: Exigir assigneeId === uid para conclusao.

### P2-016: Mojibake de encoding ISO-8859-1 nao tratado
- **Flow**: 3 - Analise
- **Correcao**: Adicionar deteccao heuristica de mojibake latino.

### P2-017: unassignCase em caso DONE nao revoga publicacao
- **Flow**: 3 - Analise
- **Correcao**: Rejeitar unassign se status === DONE.

### P2-018: revokeCasePublicationArtifacts nao limpa publicReportToken
- **Flow**: 4 - Relatorios
- **Correcao**: Incluir publicReportToken: FieldValue.delete().

### P2-019: Ordem das secoes diverge entre frontend e backend
- **Flow**: 4 - Relatorios
- **Correcao**: Alinhar ordem e secoes.

### P2-020: Regex de sanitizacao do botao print e fragil
- **Flow**: 4 - Relatorios
- **Correcao**: Usar regex mais permissiva ou parser leve.

### P2-021: createAnalystPublicReport regenera sem estender expiresAt
- **Flow**: 4 - Relatorios
- **Correcao**: Documentar ou estender expiresAt ao regenerar.

### P2-022: Notificacao de nova solicitacao e best-effort sem retry
- **Flow**: 1 - Solicitacao
- **Correcao**: Usar Cloud Tasks ou Pub/Sub para notificacoes.

---

## Bugs P3 - Baixos (Melhoria/Cosmetico)

### P3-001: buildWarrantFindings sem deduplicacao cross-provider
- **Flow**: 3 - Analise
- **Correcao**: Usar normCnj() e Set para deduplicar.

### P3-002: Campo derivado hasNotes aceito do payload do cliente
- **Flow**: 3 - Analise
- **Correcao**: Remover hasNotes da ALLOWED_CONCLUDE_FIELDS.

### P3-003: Mojibake em console.logs e comentarios
- **Flow**: 4 - Relatorios
- **Correcao**: Re-salvar arquivo com encoding UTF-8 correto.

### P3-004: Strings hardcoded do timeline fallback sem acentuacao
- **Flow**: 4 - Relatorios
- **Correcao**: Corrigir para portugues correto.

### P3-005: buildCanonicalReportHtml nao valida status defensivamente
- **Flow**: 4 - Relatorios
- **Correcao**: Adicionar guarda no inicio da funcao.

### P3-006: generateClientCasePdf nao verifica publicResult/latest
- **Flow**: 4 - Relatorios
- **Correcao**: Verificar existencia e logar warning.

---

## Bugs Pre-Identificados (Antes da Auditoria)

### BUG-PRE-001: Mojibake em relatorios armazenados
- **Status**: Ainda presente em relatorios antigos
- **Correcao**: Regenerar relatorios publicos apos fixes

### BUG-PRE-002: ID vazio no footer do relatorio
- **Status**: Corrigido no backend, mas relatorios antigos ainda afetados
- **Correcao**: Regenerar relatorios publicos

### BUG-PRE-003: CPF redundante no relatorio
- **Status**: Pendente correcao
- **Correcao**: Revisar formatCpfStatus no reportBuilder

---

## Proximos Passos

1. [ ] Corrigir todos os P0 (6 bugs)
2. [ ] Corrigir P1 criticos (18 bugs)
3. [ ] Corrigir P2 importantes (22 bugs)
4. [ ] Corrigir P3 se houver tempo (7 bugs)
5. [ ] Validar todos os testes
6. [ ] Deploy para producao

