# PLANO DE BACKEND — COMPLIANCE HUB V2
## Documento de Arquitetura e Execução — Backend Only

**Versão:** 1.0  
**Data:** 2026-04-24  
**Escopo:** Backend completo, API-first, frontend-agnostic  
**Stack base:** Firebase Functions v2 (Node 22) + Cloud Firestore  
**Fonte central de dados:** BigDataCorp API (BDC)  

---

## SUMÁRIO EXECUTIVO

O Compliance Hub V2 é uma plataforma SaaS de due diligence e compliance regulatório. O backend deve ser capaz de:

1. Orquestrar consultas a 199 endpoints da BDC
2. Gerenciar ciclo de vida de dossiês com máquina de estados
3. Consolidar resultados de múltiplas fontes em estruturas normalizadas
4. Calcular scores de risco em múltiplas dimensões
5. Expor APIs REST que alimentem diretamente a UI Lexi sem transformação no frontend
6. Suportar multi-tenant com isolamento rigoroso
7. Processar de forma assíncrona com controle de progresso granular

---

## 1. ARQUITETURA GERAL

### 1.1 Princípios Arquiteturais

| Princípio | Decisão |
|-----------|---------|
| **Camadas** | Clean Architecture adaptada: Domain -> Application -> Infrastructure -> Interface |
| **Fonte única de verdade** | BDC é a fonte primária; Firestore mantém snapshots, cache e metadados operacionais |
| **Imutabilidade de evidence** | Toda resposta bruta de provedor é armazenada em `rawSnapshots` (append-only) |
| **Event-driven** | Firestore triggers orquestram pipeline de enriquecimento |
| **API-first** | Todo dado consumível pela UI passa por normalização antes de persistir |
| **Idempotência** | Reexecução do mesmo dossiê não gera cobrança duplicada (provider ledger) |
| **Multi-tenant** | 100% das coleções possuem `tenantId`; queries sem tenantId são rejeitadas |

### 1.2 Estrutura de Pastas (Target)

```
COMPLIANCE_HUB_V2/app/functions/
├── index.js                              # Entry point APENAS — registra exports (max. 200 linhas)
├── config/
│   ├── environment.js                    # Variáveis de ambiente tipadas
│   ├── enrichmentDefaults.js             # Defaults de datasets por preset
│   ├── pricing.js                        # Tabela de custos BDC (199 datasets)
│   └── featureFlags.js                   # Flags ativas por ambiente
│
├── constants/
│   ├── collections.js                    # Nomes de coleções Firestore
│   ├── errors.js                         # Códigos de erro padronizados
│   ├── roles.js                          # Papéis RBAC
│   ├── caseStatus.js                     # Máquina de estados do dossiê
│   └── bdcDatasets.js                    # Catalogação completa dos 199 datasets BDC
│
├── domain/                               # REGRAS DE NEGÓCIO PURAS (sem I/O)
│   ├── dossierSchema.js                  # Já existe — manter e expandir
│   ├── v2CaseStatus.js                   # Já existe — manter
│   ├── v2Core.js                         # Já existe
│   ├── v2Rbac.js                         # Já existe
│   ├── v2Billing*.js                     # Já existe
│   ├── v2RiskResolver.js                 # REESCREVER — engine de score
│   ├── v2ScoreEngine.js                  # NOVO — cálculo de risco multidimensional
│   ├── v2NormalizationRules.js           # NOVO — regras de normalização cross-provider
│   ├── v2DossierLifecycle.js             # NOVO — orquestração de estados
│   ├── v2ProviderLedger.js               # Já existe — expandir para BDC-first
│   ├── v2RawSnapshot.js                  # Já existe
│   ├── v2FreshnessPolicy*.js             # Já existe
│   ├── v2TenantEntitlements.js           # Já existe
│   └── v2Monitoring*.js                  # Já existe
│
├── application/                          # ORQUESTRAÇÃO (casos de uso)
│   ├── dossier/
│   │   ├── createDossier.js              # Caso de uso: criação
│   │   ├── processDossier.js             # Caso de uso: processamento
│   │   ├── getDossierDetail.js           # Caso de uso: detalhe completo
│   │   ├── listDossiers.js               # Caso de uso: listagem paginada
│   │   ├── getDossierAnalytics.js        # Caso de uso: métricas analíticas
│   │   └── resolveDossierScore.js        # Caso de uso: recalcular score
│   │
│   ├── source/
│   │   ├── querySource.js                # Executa consulta em fonte específica
│   │   ├── retrySource.js                # Reprocessa fonte com falha
│   │   └── getSourceResult.js            # Retorna resultado normalizado
│   │
│   ├── profile/
│   │   ├── listProfiles.js
│   │   ├── createCustomProfile.js
│   │   └── getProfileSources.js
│   │
│   ├── analysis/
│   │   ├── addConclusiveAnalysis.js
│   │   ├── addComment.js
│   │   ├── approveDossier.js
│   │   └── rejectDossier.js
│   │
│   └── report/
│       ├── buildReportSnapshot.js
│       └── exportReport.js
│
├── infrastructure/                       # I/O E EXTERNOS
│   ├── database/
│   │   ├── firestore.js                  # Cliente Firestore configurado
│   │   ├── transactionHelpers.js         # Helpers para transactions
│   │   └── queryBuilders.js              # Builders de queries complexas
│   │
│   ├── messaging/
│   │   ├── pubsub.js                     # Cliente Pub/Sub (futuro)
│   │   └── taskQueue.js                  # Cloud Tasks (futuro)
│   │
│   ├── cache/
│   │   ├── memoryCache.js                # Cache em memória (Functions instância)
│   │   └── redisCache.js                 # Redis / Memorystore (futuro)
│   │
│   └── storage/
│       └── cloudStorage.js               # Upload/download de PDFs e snapshots pesados
│
├── adapters/                             # CLIENTES DE API EXTERNA (já existem)
│   ├── bigdatacorp.js                    # Já existe — EXPANDIR para 199 datasets
│   ├── bigdatacorpCatalog.js             # NOVO — mapeamento dataset -> endpoint
│   ├── bigdatacorpQueryBuilder.js        # NOVO — builder de Datasets string
│   ├── judit.js                          # Já existe
│   ├── escavador.js                      # Já existe
│   ├── fontedata.js                      # Já existe
│   └── djen.js                           # Já existe
│
├── normalizers/                          # TRANSFORMAÇÃO DE RESPOSTAS
│   ├── bigdatacorp.js                    # Já existe — EXPANDIR
│   ├── bigdatacorp/
│   │   ├── basicData.js                  # NOVO — normalização granular
│   │   ├── processes.js                  # NOVO — normalização de processos
│   │   ├── kyc.js                        # NOVO — normalização KYC/PEP
│   │   ├── occupation.js                 # NOVO — normalização profissional
│   │   ├── relationships.js              # NOVO — QSA e vínculos
│   │   ├── financial.js                  # NOVO — dados financeiros
│   │   ├── risk.js                       # NOVO — datasets de risco
│   │   └── esg.js                        # NOVO — dados socioambientais
│   ├── judit.js                          # Já existe
│   ├── escavador.js                      # Já existe
│   ├── fontedata.js                      # Já existe
│   └── djen.js                           # Já existe
│
├── interfaces/                           # API EXTERNA (HTTP / Callable)
│   ├── http/
│   │   ├── routes.js                     # Registro de todas as rotas
│   │   ├── middleware/
│   │   │   ├── requireAuth.js            # Já existe
│   │   │   ├── requireRole.js            # Já existe
│   │   │   ├── tenantResolver.js         # NOVO — injeta tenant no contexto
│   │   │   ├── rateLimiter.js            # NOVO — rate limit por tenant
│   │   │   └── errorHandler.js           # NOVO — formato padronizado de erro
│   │   ├── controllers/
│   │   │   ├── dossierController.js      # NOVO
│   │   │   ├── sourceController.js       # NOVO
│   │   │   ├── profileController.js      # NOVO
│   │   │   ├── analysisController.js     # NOVO
│   │   │   ├── reportController.js       # NOVO
│   │   │   ├── tenantController.js       # NOVO
│   │   │   └── webhookController.js      # Já existe (Judit)
│   │   └── validators/
│   │       ├── dossierValidators.js      # NOVO — validação de input
│   │       └── commonValidators.js       # NOVO
│   │
│   └── triggers/
│       ├── onCaseCreated.js              # Trigger: cases/{caseId} onCreate
│       ├── onModuleRunUpdated.js         # Trigger: moduleRuns/{runId} onUpdate
│       ├── onDossierStatusChanged.js     # Trigger: status transitions
│       └── scheduled/
│           ├── monitoringJob.js          # Já existe
│           └── billingClosureJob.js      # Já existe
│
├── helpers/                              # UTILITÁRIOS CROSS-CUTTING
│   ├── circuitBreaker.js                 # Já existe
│   ├── hash.js                           # NOVO — SHA-256 para docHash BDC
│   ├── cpfCnpj.js                        # NOVO — validação e formatação
│   ├── pagination.js                     # NOVO — cursor pagination helpers
│   └── logger.js                         # NOVO — structured logging
│
└── __tests__/                            # TESTES
    ├── unit/
    ├── integration/
    └── fixtures/
```

### 1.3 Refatoração do Monolito `index.js`

**Problema:** `index.js` tem ~10.600 linhas.  
**Ação obrigatória:** Quebrar em 4 arquivos de registro:

```javascript
// index.js — MÁXIMO 200 LINHAS
const { registerCallables } = require('./interfaces/http/callables');
const { registerTriggers } = require('./interfaces/triggers');
const { registerScheduled } = require('./interfaces/triggers/scheduled');
const { registerWebhooks } = require('./interfaces/http/webhooks');

registerCallables(exports);
registerTriggers(exports);
registerScheduled(exports);
registerWebhooks(exports);
```

Cada registrador importa apenas os controllers/functions necessários.

---

## 2. MODELAGEM DE DADOS

### 2.1 Coleções Firestore (Document Model)

Todas as coleções possuem `tenantId` (string, indexed). Queries sem `tenantId` são impossibilitadas por regras de segurança.

#### `cases` — Dossiê (Documento Raiz)

```typescript
interface Case {
  // IDs e metadados
  id: string;                           // Firestore auto-ID
  tenantId: string;                     // Isolamento multi-tenant
  dossierNumber: string;                // Número legível: "111.332" (sequencial por tenant)
  
  // Alvo da consulta
  subjectType: 'pf' | 'pj';             // Tipo de pessoa
  document: string;                     // CPF (11 dígitos) ou CNPJ (14 dígitos) — sem formatação
  documentFormatted: string;            // "050.232.903-36" ou "00.001.002/0001-05"
  name: string;                         // Nome/Razão social
  birthDate?: string;                   // ISO date (PF)
  motherName?: string;                  // Nome da mãe (PF)
  
  // Configuração do dossiê
  presetKey: string;                    // "compliance", "internacional", etc.
  schemaKey: string;                    // "dossier_pf_full", "dossier_pj", etc.
  customProfileId?: string;             // Referência se perfil personalizado
  requestedSectionKeys: string[];       // Seções solicitadas
  requestedMacroAreaKeys: string[];     // Macro-áreas solicitadas
  tag?: string;                         // Tag opcional
  parameters?: {                        // Parâmetros adicionais
    processosAutoRelevante?: boolean;   // Marcar processos como relevantes automaticamente
    [key: string]: any;
  };
  
  // Status e progresso
  status: 'received' | 'enriching' | 'ready' | 'published' | 'correction_needed';
  progress: number;                     // 0-100
  progressDetail: {                     // Granular por fonte
    totalSources: number;
    completed: number;
    withFindings: number;
    failed: number;
    pending: number;
    sources: Array<{
      sourceKey: string;
      status: string;
      label: string;
      variant: string;
    }>;
  };
  
  // Processamento
  autoProcess: boolean;                 // Criar e processar automaticamente
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  lastProcessedAt?: Timestamp;
  
  // Score
  score?: {
    overall: number;                    // 0-100 (100 = maior risco)
    category: 'low' | 'medium' | 'high' | 'critical';
    dimensions: {
      juridico: number;
      reguladores: number;
      financeiro: number;
      reputacional: number;
      socioambiental: number;
      conflitoInteresse: number;
    };
    signals: Array<{
      code: string;
      severity: 'info' | 'warning' | 'critical';
      message: string;
      sourceKey: string;
    }>;
    calculatedAt: Timestamp;
    version: string;                    // Versão do algoritmo
  };
  
  // Relacionamentos
  subjectId: string;                    // FK -> subjects
  moduleRunIds: string[];               // FKs -> moduleRuns
  evidenceItemIds: string[];            // FKs -> evidenceItems
  riskSignalIds: string[];              // FKs -> riskSignals
  reportSnapshotId?: string;            // FK -> reportSnapshots
  decisionId?: string;                  // FK -> decisions
  
  // Análise
  analysis?: {
    conclusive: string;                 // Texto livre da análise conclusiva
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: Timestamp;
    rejectedBy?: string;
    rejectedAt?: Timestamp;
    rejectionReason?: string;
  };
  
  // Auditoria
  createdBy: string;                    // UID do usuário
  createdByName: string;                // Denormalizado para listagem
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Feature flags
  flags: {
    monitoria: boolean;
    workflow: boolean;
    upFlag: boolean;
    score: boolean;
  };
}
```

#### `subjects` — Pessoa (PF/PJ) Cache

```typescript
interface Subject {
  id: string;
  tenantId: string;
  
  // Identificação
  type: 'pf' | 'pj';
  document: string;                     // CPF/CNPJ sem formatação
  documentHash: string;                 // SHA-256 para consulta BDC via dochash
  name: string;
  
  // Dados cadastrais (cache da última consulta BDC)
  basicData: {
    birthDate?: string;
    age?: number;
    gender?: string;
    motherName?: string;
    fatherName?: string;
    taxIdStatus?: string;               // REGULAR, CANCELADA, etc.
    companyStatus?: string;             // ATIVA, BAIXADA, etc. (PJ)
    legalNature?: string;               // Natureza jurídica (PJ)
    foundationDate?: string;            // Data de abertura (PJ)
    fantasyName?: string;               // Nome fantasia (PJ)
    cnae?: string;                      // CNAE principal (PJ)
    lastUpdated: Timestamp;
  };
  
  // Contatos (cache)
  emails: Array<{
    email: string;
    type: string;
    validationStatus: string;
    lastSeen: Timestamp;
  }>;
  phones: Array<{
    phone: string;
    type: string;
    ddd: string;
    lastSeen: Timestamp;
  }>;
  addresses: Array<{
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipcode: string;
    type: string;
    lastSeen: Timestamp;
  }>;
  
  // Índice reverso
  caseIds: string[];                    // Dossiês que consultaram este subject
  lastConsultedAt: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `moduleRuns` — Execução de Fonte/Seção

```typescript
interface ModuleRun {
  id: string;
  tenantId: string;
  caseId: string;                       // FK -> cases
  
  // Identificação
  moduleKey: string;                    // "judicial", "kyc", "identity_pf", etc.
  macroArea: string;                    // "juridico", "reguladores", etc.
  sourceKey: string;                    // "bigdatacorp_processes", "judit_lawsuits", etc.
  
  // Status
  status: 
    | 'pending'           // Criado, aguardando execução
    | 'queued'            // Na fila
    | 'running'           // Em execução
    | 'completed_with_findings'   // Concluído com dados
    | 'completed_no_findings'     // Concluído, sem dados
    | 'skipped_reuse'     // Reutilizado de cache (provider ledger)
    | 'skipped_policy'    // Não aplicável ao tipo de pessoa
    | 'failed_retryable'  // Falha, pode tentar novamente
    | 'failed_final'      // Falha definitiva
    | 'not_entitled';     // Tenant não contratou esta fonte
  
  // Progresso
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  retryCount: number;
  maxRetries: number;
  
  // Resultados
  resultCount: number;                  // Quantidade de itens encontrados
  evidenceItemIds: string[];            // FKs -> evidenceItems gerados
  
  // Provider Ledger (cobrança e cache)
  providerRequestId?: string;           // FK -> providerRequests
  wasReused: boolean;                   // Se usou cache
  reusedFromRequestId?: string;         // Se reutilizado, de qual
  
  // Erros
  error?: {
    code: string;
    message: string;
    timestamp: Timestamp;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `evidenceItems` — Evidência Normalizada

```typescript
interface EvidenceItem {
  id: string;
  tenantId: string;
  caseId: string;
  moduleRunId: string;                  // FK -> moduleRuns
  
  // Classificação
  macroArea: string;
  sectionKey: string;
  sourceKey: string;
  evidenceType: 
    | 'table'             // Dados tabulares (array de objetos)
    | 'paragraph'         // Texto livre
    | 'process_list'      // Lista de processos judiciais
    | 'certificate'       // Certidão
    | 'relationship_graph'// Grafo de relacionamentos
    | 'document'          // PDF/arquivo
    | 'alert';            // Alerta de risco
  
  // Conteúdo (polimórfico conforme evidenceType)
  content: {
    // evidenceType === 'table'
    headers?: string[];
    rows?: Array<Record<string, any>>;
    
    // evidenceType === 'paragraph'
    text?: string;
    
    // evidenceType === 'process_list'
    processes?: JudicialProcess[];
    
    // evidenceType === 'certificate'
    certificateType?: string;
    certificateNumber?: string;
    content?: string;
    validityDate?: string;
    pdfUrl?: string;
    
    // evidenceType === 'relationship_graph'
    nodes?: Array<{ id: string; type: 'pf' | 'pj'; name: string; document: string }>;
    edges?: Array<{ from: string; to: string; relation: string; percentage?: number }>;
  };
  
  // Metadados
  isRelevant: boolean;                  // Marcado como relevante pelo analista
  relevanceMarkedBy?: string;
  relevanceMarkedAt?: Timestamp;
  
  // Risco (calculado automaticamente ou pelo motor de regras)
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  riskSignals?: string[];               // Códigos dos sinais de risco detectados
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface JudicialProcess {
  number: string;                       // Número CNJ
  className: string;                    // Classe processual
  court: string;                        // Tribunal (TJ-CE, TRT-1, etc.)
  courtUnit: string;                    // Vara/Unidade judiciária
  status: 'Em tramitacao' | 'Arquivamento definitivo' | 'Em grau de recurso' | 'Suspensa' | 'Outro';
  participation: 'autor' | 'reu' | 'envolvido' | 'terceiro';
  subject: string;                      // Assunto/ matéria
  area: 'civel' | 'criminal' | 'trabalhista' | 'tributario' | 'administrativo' | 'previdenciario' | 'outro';
  segment: 'justica_estadual' | 'justica_federal' | 'trt' | 'tst' | 'stj' | 'stf' | 'tse' | 'outro';
  district: string;                     // Comarca/Distrito
  distributionDate: string;             // ISO date
  value: number;                        // Valor da causa em centavos
  valueFormatted: string;               // "R$ 1.234,56"
  link: string;                         // URL do tribunal
  
  // Partes
  activeParty: string;                  // Requerente/Autor
  passiveParty: string;                 // Requerido/Réu
  relatedPeople: Array<{
    name: string;
    documentType: 'cpf' | 'cnpj';
    document: string;
  }>;
  
  // Movimentações
  movements: Array<{
    date: string;
    description: string;
  }>;
  
  // Flags
  isSecret: boolean;
  isMonitored: boolean;
}
```

#### `providerRequests` — Rastreabilidade de Cobrança

```typescript
interface ProviderRequest {
  id: string;
  tenantId: string;
  caseId: string;
  moduleRunId: string;
  
  // Provedor
  provider: 'bigdatacorp' | 'judit' | 'escavador' | 'fontedata' | 'djen';
  endpoint: string;                     // "/pessoas", "/empresas", etc.
  datasetKey: string;                   // "basic_data", "processes", "kyc"
  
  // Consulta
  queryKey: string;                     // doc{CPF} ou doc{CNPJ}
  queryHash: string;                    // Hash da query para cache
  
  // Cobrança
  cost: number;                         // Custo em reais
  currency: 'BRL';
  
  // Cache e reutilização
  isReusable: boolean;
  freshnessHours: number;               // Por quantas horas pode reutilizar
  reusedCount: number;                  // Quantas vezes foi reutilizado
  
  // Resposta bruta
  rawSnapshotId: string;                // FK -> rawSnapshots
  responseStatus: number;               // Status code da resposta BDC
  responseTimeMs: number;
  
  createdAt: Timestamp;
}
```

#### `rawSnapshots` — Respostas Brutas (Imutáveis)

```typescript
interface RawSnapshot {
  id: string;
  tenantId: string;
  providerRequestId: string;
  
  // Dados brutos
  payload: any;                         // JSON completo da resposta do provedor
  payloadSize: number;                  // Tamanho em bytes
  
  // Se payload > 1MB: armazenar em Cloud Storage e guardar gs:// URL aqui
  storagePath?: string;
  
  createdAt: Timestamp;
}
```

#### `riskSignals` — Sinais de Risco

```typescript
interface RiskSignal {
  id: string;
  tenantId: string;
  caseId: string;
  moduleRunId?: string;
  evidenceItemId?: string;
  
  // Classificação
  code: string;                         // "PEP_LEVEL_1", "SANCTION_OFAC", "PROCESS_CRIMINAL_AUTOR", etc.
  category: 'juridico' | 'reguladores' | 'financeiro' | 'reputacional' | 'socioambiental' | 'conflito_interesse';
  severity: 'info' | 'warning' | 'critical';
  
  // Conteúdo
  title: string;                        // Título legível
  description: string;                  // Descrição detalhada
  sourceKey: string;                    // De qual fonte veio
  sourceReference?: string;             // Referência específica (número do processo, etc.)
  
  // Score
  scoreImpact: number;                  // Quanto impacta no score geral (0-100)
  
  // Ação
  requiresReview: boolean;              // Se exige revisão de senior
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewDecision?: 'confirmed' | 'false_positive' | 'pending';
  
  createdAt: Timestamp;
}
```

#### `customProfiles` — Perfis de Consulta Personalizados

```typescript
interface CustomProfile {
  id: string;
  tenantId: string;
  createdBy: string;
  
  name: string;                         // "Meu Perfil Custom"
  description: string;                  // Objetivo do perfil
  subjectType: 'pf' | 'pj';
  
  // Fontes selecionadas
  sourceKeys: string[];                 // Lista de sourceKeys habilitados
  sectionKeys: string[];                // Seções derivadas
  macroAreaKeys: string[];              // Macro-áreas derivadas
  
  // Mapeamento BDC
  bdcDatasets: string[];                // Datasets BDC a consultar
  
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `comments` — Comentários e Análise

```typescript
interface Comment {
  id: string;
  tenantId: string;
  caseId: string;
  
  type: 'analysis' | 'comment' | 'review';
  text: string;
  
  // Autor
  authorId: string;
  authorName: string;
  authorRole: string;
  
  // Contexto
  evidenceItemId?: string;              // Se comentário em evidência específica
  sectionKey?: string;                  // Se comentário em seção
  
  // Flags
  isRelevant: boolean;
  isConclusive: boolean;                // Se é a análise conclusiva do dossiê
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.2 Índices Firestore Obrigatórios

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "cases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "cases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "cases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "createdBy", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "cases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "tag", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "moduleRuns",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "caseId", "order": "ASCENDING" },
        { "fieldPath": "macroArea", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "evidenceItems",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "caseId", "order": "ASCENDING" },
        { "fieldPath": "macroArea", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "subjects",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "document", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "providerRequests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "queryHash", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 3. INTEGRAÇÃO COM BIGDATACORP (BDC)

### 3.1 Estratégia de Consumo

**Princípio:** BDC-first. Outros provedores (Judit, Escavador, etc.) complementam dados que a BDC não cobre ou quando a BDC retorna vazio.

**Decisões técnicas:**

| Decisão | Justificativa |
|---------|---------------|
| **Query combinada por default** | Reduz latência e custo. Ex: `basic_data,processes.limit(100),kyc,occupation_data` = R$ 0,20 |
| **Seleção de campos** | Usar `dataset{field1,field2}` para reduzir payload e custo |
| **Hash de documento** | Usar `dochash{SHA-256}` em produção para não enviar CPF/CNPJ em plain text |
| **Tags de rastreamento** | Enviar `Tags: { host, process, environment, dossierId }` para debug na BDC |
| **Recência configurável** | Usar `basic_data_with_configurable_recency` quando freshness < 7 dias |

### 3.2 Mapeamento Preset -> Datasets BDC

```javascript
// config/enrichmentDefaults.js — Mapeamento completo
const BDC_DATASET_MAP = {
  // Jurídico
  'bigdatacorp_processes': {
    endpoint: '/pessoas',
    dataset: 'processes',
    cost: 0.07,
    applicableTo: ['pf', 'pj'],
    fields: ['Number', 'ClassName', 'Court', 'Status', 'Parties', 'Movements', 'Value'],
    pagination: true,
    maxLimit: 100,
  },
  'bigdatacorp_owners_lawsuits': {
    endpoint: '/empresas',
    dataset: 'owners_lawsuits',
    cost: 0.13,
    applicableTo: ['pj'],
  },
  
  // Cadastro
  'bigdatacorp_basic_data': {
    endpoint: '/pessoas',          // ou /empresas
    dataset: 'basic_data',
    cost: { pf: 0.03, pj: 0.02 },
    applicableTo: ['pf', 'pj'],
    fields: ['Name', 'TaxId', 'BirthDate', 'Age', 'Gender', 'MotherName', 'TaxIdStatus'],
  },
  'bigdatacorp_historical_basic_data': {
    endpoint: '/pessoas',
    dataset: 'historical_basic_data',
    cost: 0.03,
    applicableTo: ['pf'],
  },
  
  // Reguladores / Compliance
  'bigdatacorp_kyc': {
    endpoint: '/pessoas',          // ou /empresas
    dataset: 'kyc',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    fields: [
      'PEPHistory', 'SanctionsHistory',
      'IsCurrentlySanctioned', 'WasPreviouslySanctioned',
      'IsCurrentlyPresentOnSource', 'WasRecentlyPresentOnSource'
    ],
  },
  'bigdatacorp_owners_kyc': {
    endpoint: '/empresas',
    dataset: 'owners_kyc',
    cost: 0.09,
    applicableTo: ['pj'],
  },
  'bigdatacorp_employees_kyc': {
    endpoint: '/empresas',
    dataset: 'employees_kyc',
    cost: 0.41,
    applicableTo: ['pj'],
  },
  'bigdatacorp_economic_group_kyc': {
    endpoint: '/empresas',
    dataset: 'economic_group_kyc',
    cost: 0.41,
    applicableTo: ['pj'],
  },
  
  // Financeiro
  'bigdatacorp_financial_data': {
    endpoint: '/pessoas',
    dataset: 'financial_data',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
  },
  'bigdatacorp_government_debtors': {
    endpoint: '/pessoas',
    dataset: 'government_debtors',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
  },
  'bigdatacorp_collections': {
    endpoint: '/pessoas',
    dataset: 'collections',
    cost: 0.07,
    applicableTo: ['pf', 'pj'],
  },
  'bigdatacorp_financial_risk': {
    endpoint: '/pessoas',
    dataset: 'financial_risk',
    cost: 0.05,
    applicableTo: ['pf'],
  },
  'bigdatacorp_indebtedness_question': {
    endpoint: '/pessoas',
    dataset: 'indebtedness_question',
    cost: 0.09,
    applicableTo: ['pf', 'pj'],
  },
  
  // Profissional
  'bigdatacorp_occupation': {
    endpoint: '/pessoas',
    dataset: 'occupation_data',
    cost: 0.05,
    applicableTo: ['pf'],
    fields: ['Jobs', 'IncomeRange', 'EmployeesRange', 'IsPublicServer'],
  },
  'bigdatacorp_class_organization': {
    endpoint: '/pessoas',
    dataset: 'class_organization',
    cost: 0.05,
    applicableTo: ['pf'],
  },
  'bigdatacorp_university_student_data': {
    endpoint: '/pessoas',
    dataset: 'university_student_data',
    cost: 0.05,
    applicableTo: ['pf'],
  },
  
  // Relacionamentos (PJ)
  'bigdatacorp_relationships': {
    endpoint: '/empresas',
    dataset: 'relationships',
    cost: 0.03,
    applicableTo: ['pj'],
    fields: ['Name', 'Type', 'Level', 'OwnershipPercentage'],
  },
  'bigdatacorp_dynamic_qsa_data': {
    endpoint: '/empresas',
    dataset: 'dynamic_qsa_data',
    cost: 0.09,
    applicableTo: ['pj'],
  },
  
  // Presença Digital
  'bigdatacorp_online_presence': {
    endpoint: '/pessoas',
    dataset: 'online_presence',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
  },
  'bigdatacorp_online_ads': {
    endpoint: '/pessoas',
    dataset: 'online_ads',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
  },
  
  // Político
  'bigdatacorp_political_involvement': {
    endpoint: '/pessoas',
    dataset: 'political_involvement',
    cost: 0.05,
    applicableTo: ['pf'],
  },
  'bigdatacorp_election_candidate_data': {
    endpoint: '/pessoas',
    dataset: 'election_candidate_data',
    cost: 0.05,
    applicableTo: ['pf'],
  },
  
  // Mídia / Reputação
  'bigdatacorp_media_profile_and_exposure': {
    endpoint: '/pessoas',
    dataset: 'media_profile_and_exposure',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    pagination: true,
  },
  
  // ESG
  'bigdatacorp_syndicate_agreements': {
    endpoint: '/empresas',
    dataset: 'syndicate_agreements',
    cost: 0.05,
    applicableTo: ['pj'],
  },
  'bigdatacorp_social_conscience': {
    endpoint: '/empresas',
    dataset: 'social_conscience',
    cost: 0.05,
    applicableTo: ['pj'],
  },
  
  // Ativos
  'bigdatacorp_property_data': {
    endpoint: '/pessoas',          // ou /empresas
    dataset: 'property_data',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
  },
};
```

### 3.3 Camada de Abstração — BigDataCorp Query Builder

```javascript
// adapters/bigdatacorpQueryBuilder.js

class BdcQueryBuilder {
  constructor() {
    this.datasets = [];
    this.filters = [];
    this.orders = [];
    this.limit = null;
    this.nextToken = null;
  }

  addDataset(datasetKey, options = {}) {
    let expr = datasetKey;
    if (options.fields?.length) expr += `{${options.fields.join(',')}}`;
    if (options.filter) expr += `.filter(${options.filter})`;
    if (options.order) expr += `.order(${options.order})`;
    if (options.limit) expr += `.limit(${options.limit})`;
    if (options.next) expr += `.next(${options.next})`;
    this.datasets.push(expr);
    return this;
  }

  buildBody(queryKey, options = {}) {
    const body = {
      q: queryKey,
      Datasets: this.datasets.join(','),
      Limit: options.limit || 1,
    };
    if (options.tags) body.Tags = options.tags;
    return body;
  }
}

// Uso:
const builder = new BdcQueryBuilder();
builder
  .addDataset('basic_data', { fields: ['Name', 'TaxId', 'BirthDate', 'Age'] })
  .addDataset('processes', { limit: 100 })
  .addDataset('kyc')
  .addDataset('occupation_data');

const body = builder.buildBody(`doc{${cpf}} returnupdates{false}`, { tags: { dossierId: '123' } });
```

### 3.4 Tratamento de Erros e Fallback

```javascript
// Estratégia de fallback por categoria de erro
const FALLBACK_STRATEGY = {
  // Erros de autenticação BDC (-1000 a -1199)
  AUTH_ERROR: {
    action: 'notify_admin',
    retry: false,
    fallbackSource: null,
    setStatus: 'failed_final',
  },
  
  // Rate limit (429) ou too many requests
  RATE_LIMITED: {
    action: 'exponential_backoff',
    retry: true,
    maxRetries: 5,
    baseDelayMs: 2000,
    setStatus: 'failed_retryable',
  },
  
  // Timeout / servidor BDC indisponível (-1200 a -1999)
  SERVER_ERROR: {
    action: 'exponential_backoff',
    retry: true,
    maxRetries: 3,
    baseDelayMs: 1000,
    setStatus: 'failed_retryable',
  },
  
  // Erro de input (-100 a -999)
  INPUT_ERROR: {
    action: 'mark_for_review',
    retry: false,
    fallbackSource: null,
    setStatus: 'failed_final',
  },
  
  // Fonte externa indisponível (OnDemand -2000 a -2999)
  EXTERNAL_SOURCE_UNAVAILABLE: {
    action: 'fallback_to_alternative',
    retry: true,
    maxRetries: 2,
    fallbackSource: 'alternative_provider', // Ex: Judit para processos
    setStatus: 'failed_retryable',
  },
};
```

### 3.5 Estratégia de Cache

**Camada 1 — Provider Ledger (cache de negócio):**
- Chave de cache: `SHA-256(tenantId + provider + endpoint + dataset + docHash)`
- TTL: configurável por dataset (default 24h, KYC 7d, basic_data 30d)
- Antes de chamar BDC, verificar `providerRequests` com mesma queryHash e `createdAt > now - TTL`
- Se encontrar: reutilizar `rawSnapshotId`, marcar `moduleRun.wasReused = true`

**Camada 2 — Memória (Function instance):**
- LRU cache de 100 itens por instância
- Chave: `queryHash`
- TTL: 5 minutos
- Usar apenas para datasets de alta frequência (`basic_data`, `kyc`)

**Camada 3 — Firestore (cache distribuído):**
- Coleção `providerRequests` já serve como cache persistente
- Índice composto: `tenantId + queryHash + createdAt DESC`

---

## 4. FLUXOS PRINCIPAIS DO SISTEMA

### 4.1 Criação de Dossiê

```
[Usuário] -> POST /api/v1/dossiers
            Body: {
              subjectType: 'pf',
              document: '05023290336',
              name: 'FRANCISCO TACIANO DE SOUSA',
              presetKey: 'compliance',
              tag: 'Tag opcional',
              autoProcess: true,
              parameters: { processosAutoRelevante: false }
            }

-> 1. Validação (CPF/CNPJ válido, tenant com entitlements)
-> 2. Verificar se subject já existe (por document + tenantId)
   -> Se sim: reusar subjectId
   -> Se não: criar subject (com docHash SHA-256)
-> 3. Resolver schema e seções via dossierSchema.js
-> 4. Gerar dossierNumber (sequencial por tenant — usar transaction)
-> 5. Criar documento case com status = 'received'
-> 6. Criar moduleRuns para cada sourceKey do preset (status = 'pending')
-> 7. Se autoProcess: publicar evento de início de processamento
-> 8. Retornar case completo (formato DossierListItem)
```

### 4.2 Processamento de Consultas

```
Trigger: onCaseCreated (ou evento explícito de início)

-> 1. Atualizar case.status = 'enriching'
-> 2. Para cada moduleRun com status 'pending':
   -> 2.1. Verificar entitlement do tenant para esta sourceKey
   -> 2.2. Verificar Provider Ledger (cache)
   -> 2.3. Se não cacheado: 
         -> Resolver dataset BDC via BDC_DATASET_MAP
         -> Construir query via BdcQueryBuilder
         -> Executar adapter.bigdatacorp.callPost()
         -> Armazenar rawSnapshot
         -> Criar providerRequest (cobrança)
   -> 2.4. Normalizar resposta via normalizers/bigdatacorp/*.js
   -> 2.5. Criar evidenceItems
   -> 2.6. Atualizar moduleRun.status = 'completed_with_findings' | 'completed_no_findings'
   -> 2.7. Atualizar progresso no case
-> 3. Quando todos moduleRuns concluídos:
   -> 3.1. Executar v2ScoreEngine.calculate(caseId)
   -> 3.2. Criar riskSignals
   -> 3.3. Atualizar case.status = 'ready'
   -> 3.4. Atualizar case.progress = 100
   -> 3.5. Gerar reportSnapshot
```

### 4.3 Consolidação de Resultados

A consolidação ocorre em 3 níveis:

**Nível 1 — Raw:** Resposta bruta do provedor (`rawSnapshots`)
**Nível 2 — Normalized:** Evidências estruturadas (`evidenceItems`)
**Nível 3 — Projected:** Projeção otimizada para UI (`clientProjections`)

```javascript
// application/dossier/getDossierDetail.js
async function getDossierDetail(caseId, tenantId, options = {}) {
  // 1. Buscar case
  const caseDoc = await db.collection('cases').doc(caseId).get();
  if (!caseDoc.exists || caseDoc.data().tenantId !== tenantId) {
    throw new NotFoundError('Dossiê não encontrado');
  }
  
  // 2. Buscar subject
  const subject = await db.collection('subjects').doc(caseDoc.data().subjectId).get();
  
  // 3. Buscar moduleRuns
  const moduleRuns = await db.collection('moduleRuns')
    .where('caseId', '==', caseId)
    .orderBy('createdAt', 'asc')
    .get();
  
  // 4. Buscar evidenceItems (paginado por macroArea se necessário)
  const evidenceQuery = db.collection('evidenceItems')
    .where('caseId', '==', caseId);
  if (options.macroArea) evidenceQuery.where('macroArea', '==', options.macroArea);
  const evidenceItems = await evidenceQuery.orderBy('createdAt', 'asc').get();
  
  // 5. Buscar riskSignals
  const riskSignals = await db.collection('riskSignals')
    .where('caseId', '==', caseId)
    .orderBy('severity', 'desc')
    .get();
  
  // 6. Buscar comments
  const comments = await db.collection('comments')
    .where('caseId', '==', caseId)
    .orderBy('createdAt', 'desc')
    .get();
  
  // 7. Calcular métricas analíticas (se modo analítico)
  const analytics = options.mode === 'analitico' 
    ? calculateAnalytics(evidenceItems, moduleRuns)
    : null;
  
  // 8. Montar projeção final (formato UI-ready)
  return buildClientProjection({
    case: caseDoc.data(),
    subject: subject.data(),
    moduleRuns: moduleRuns.docs.map(d => d.data()),
    evidenceItems: evidenceItems.docs.map(d => d.data()),
    riskSignals: riskSignals.docs.map(d => d.data()),
    comments: comments.docs.map(d => d.data()),
    analytics,
    mode: options.mode || 'analitico',
  });
}
```

### 4.4 Geração de Análise

```
-> 1. Analista acessa dossiê em status 'ready'
-> 2. Sistema apresenta evidenceItems organizados por macro-área
-> 3. Analista pode:
   - Marcar evidenceItem como relevante
   - Adicionar comentários em evidenceItems ou seções
   - Escrever análise conclusiva
   - Aprovar ou reprovar o dossiê
-> 4. Ao aprovar/reprovar:
   - Criar registro em decisions
   - Atualizar case.analysis.status
   - Se aprovado: case.status = 'published'
   - Gerar publicReport (token de acesso)
```

---

## 5. SISTEMA DE PROCESSAMENTO

### 5.1 Síncrono vs Assíncrono

| Operação | Modo | Justificativa |
|----------|------|---------------|
| Criação de dossiê | Síncrono | Usuário precisa do ID imediatamente |
| Consulta BDC combinada (4 datasets) | Síncrono | < 5s, UX aceitável |
| Consulta BDC complexa (10+ datasets) | Assíncrono | > 10s, usar trigger + polling |
| Consulta por processo (paginação) | Síncrono | < 3s |
| Reprocessamento de fonte | Assíncrono | Trigger onUpdate |
| Cálculo de score | Síncrono | < 2s após dados disponíveis |
| Geração de relatório PDF | Assíncrono | Cloud Task ou trigger |
| Monitoramento agendado | Assíncrono | Cloud Scheduler |

### 5.2 Controle de Status Granular

```
DOSSIÊ LEVEL:
received -> enriching -> ready -> published
                \-> correction_needed ->/

MODULE RUN LEVEL:
pending -> queued -> running -> completed_with_findings
                                 -> completed_no_findings
                                 -> skipped_reuse
                                 -> skipped_policy
                                 -> failed_retryable -> [retry] -> running
                                 -> failed_final
                                 -> not_entitled

PROVIDER REQUEST LEVEL:
pending -> sent -> responded -> normalized -> evidence_created
       -> failed -> [retry] -> sent
       -> cached (reutilizado)
```

### 5.3 Progresso (0-100%)

```javascript
function calculateProgress(moduleRuns) {
  const total = moduleRuns.length;
  if (total === 0) return 0;
  
  const weights = {
    'completed_with_findings': 1.0,
    'completed_no_findings': 1.0,
    'skipped_reuse': 1.0,
    'skipped_policy': 1.0,
    'failed_final': 1.0,          // Conta como "processado", mesmo com erro
    'not_entitled': 1.0,
    'failed_retryable': 0.5,      // Metade enquanto tenta retry
    'running': 0.3,
    'queued': 0.1,
    'pending': 0,
  };
  
  const weightedSum = moduleRuns.reduce((sum, run) => {
    return sum + (weights[run.status] || 0);
  }, 0);
  
  return Math.round((weightedSum / total) * 100);
}
```

### 5.4 Filas e Retry

**Implementação atual (Firestore triggers):**
- `onModuleRunCreated` -> se status = 'pending' e case.status = 'enriching', inicia processamento
- `onModuleRunUpdated` -> se status = 'failed_retryable' e retryCount < maxRetries, reagenda

**Implementação futura (Cloud Tasks / Pub-Sub):**
- Criar fila `bdc-queries` para queries pesadas (> 4 datasets)
- Criar fila `source-retries` para retry com backoff exponencial
- Criar fila `report-generation` para PDFs

---

## 6. SISTEMA DE SCORE E RISCO (CRÍTICO)

### 6.1 Arquitetura do Score Engine

```javascript
// domain/v2ScoreEngine.js

const SCORE_VERSION = 'v2-score-2026-04-24';

/**
 * O score é calculado em 2 fases:
 * 1. Extração de sinais (signal extraction) — de evidenceItems
 * 2. Agregação ponderada (aggregation) — de sinais para score final
 */

// ============================================================
// FASE 1: REGRAS DE EXTRAÇÃO DE SINAIS
// ============================================================

const SIGNAL_RULES = [
  // === REGULADORES ===
  {
    code: 'PEP_LEVEL_1',
    category: 'reguladores',
    severity: 'critical',
    scoreImpact: 40,
    condition: (evidence) => {
      if (evidence.sectionKey !== 'kyc') return false;
      const pep = evidence.content?.PEPHistory || [];
      return pep.some(p => parseInt(p.Level) >= 1);
    },
    extract: (evidence) => {
      const pep = evidence.content?.PEPHistory || [];
      const level1 = pep.filter(p => parseInt(p.Level) >= 1);
      return level1.map(p => ({
        title: `PEP Nível ${p.Level}`,
        description: `${p.JobTitle} — ${p.Department} (${p.Source})`,
        sourceReference: p.Source,
      }));
    },
  },
  {
    code: 'PEP_LEVEL_2',
    category: 'reguladores',
    severity: 'warning',
    scoreImpact: 25,
    condition: (evidence) => {
      if (evidence.sectionKey !== 'kyc') return false;
      const pep = evidence.content?.PEPHistory || [];
      return pep.some(p => parseInt(p.Level) === 2);
    },
  },
  {
    code: 'SANCTION_CURRENT',
    category: 'reguladores',
    severity: 'critical',
    scoreImpact: 50,
    condition: (evidence) => {
      return evidence.content?.IsCurrentlySanctioned === true;
    },
  },
  {
    code: 'SANCTION_PREVIOUS',
    category: 'reguladores',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) => {
      return evidence.content?.WasPreviouslySanctioned === true && 
             evidence.content?.IsCurrentlySanctioned !== true;
    },
  },
  {
    code: 'SANCTION_INTERNATIONAL',
    category: 'reguladores',
    severity: 'critical',
    scoreImpact: 45,
    condition: (evidence) => {
      const sanctions = evidence.content?.SanctionsHistory || [];
      const internationalSources = ['INTERPOL', 'FBI', 'OFAC', 'EU', 'UNSC'];
      return sanctions.some(s => internationalSources.includes(s.Source));
    },
  },
  
  // === JURÍDICO ===
  {
    code: 'PROCESS_CRIMINAL_AUTOR',
    category: 'juridico',
    severity: 'critical',
    scoreImpact: 35,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => 
        p.area === 'criminal' && p.participation === 'autor'
      );
    },
  },
  {
    code: 'PROCESS_CRIMINAL_REU',
    category: 'juridico',
    severity: 'critical',
    scoreImpact: 45,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => 
        p.area === 'criminal' && p.participation === 'reu'
      );
    },
  },
  {
    code: 'PROCESS_TRABALHISTA_REU',
    category: 'juridico',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => 
        p.area === 'trabalhista' && p.participation === 'reu'
      );
    },
  },
  {
    code: 'PROCESS_VALUE_HIGH',
    category: 'juridico',
    severity: 'warning',
    scoreImpact: 15,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => p.value > 10000000); // > R$ 100.000,00
    },
  },
  {
    code: 'PROCESS_MANY_ACTIVE',
    category: 'juridico',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      const active = processes.filter(p => p.status === 'Em tramitacao');
      return active.length >= 5;
    },
    extract: (evidence) => {
      const processes = evidence.content?.processes || [];
      const active = processes.filter(p => p.status === 'Em tramitacao');
      return [{
        title: `${active.length} processos ativos`,
        description: `O alvo possui ${active.length} processos em tramitação`,
      }];
    },
  },
  
  // === FINANCEIRO ===
  {
    code: 'DEBT_GOVERNMENT',
    category: 'financeiro',
    severity: 'critical',
    scoreImpact: 35,
    condition: (evidence) => {
      return evidence.content?.IsGovernmentDebtor === true;
    },
  },
  {
    code: 'COLLECTION_PRESENT',
    category: 'financeiro',
    severity: 'warning',
    scoreImpact: 25,
    condition: (evidence) => {
      return evidence.content?.IsPresentInCollection === true;
    },
  },
  {
    code: 'HIGH_FINANCIAL_RISK',
    category: 'financeiro',
    severity: 'critical',
    scoreImpact: 40,
    condition: (evidence) => {
      const risk = evidence.content?.FinancialRiskLevel;
      return risk === 'HIGH' || risk === 'VERY_HIGH';
    },
  },
  {
    code: 'PROBABLE_NEGATIVATION',
    category: 'financeiro',
    severity: 'warning',
    scoreImpact: 25,
    condition: (evidence) => {
      return evidence.content?.IndebtednessProbability === 'HIGH';
    },
  },
  
  // === CONFLITO DE INTERESSE ===
  {
    code: 'RELATIONSHIP_POLITICIAN',
    category: 'conflito_interesse',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) => {
      // Detectado via análise de relacionamentos + KYC de sócios
      return false; // Placeholder — requer regra custom
    },
  },
  
  // === SOCIOAMBIENTAL ===
  {
    code: 'ESG_NEGATIVE',
    category: 'socioambiental',
    severity: 'warning',
    scoreImpact: 15,
    condition: (evidence) => {
      const conscience = evidence.content?.SocialConscienceScore;
      return conscience && conscience < 30;
    },
  },
];

// ============================================================
// FASE 2: AGREGACÃO PONDERADA
// ============================================================

const CATEGORY_WEIGHTS = {
  reguladores: 0.30,        // 30% — PEP, sanções, KYC
  juridico: 0.25,           // 25% — Processos
  financeiro: 0.20,         // 20% — Dívidas, risco
  conflito_interesse: 0.10, // 10% — Vínculos
  socioambiental: 0.05,     // 5%  — ESG
  reputacional: 0.10,       // 10% — Mídia, digital
};

const MAX_SCORE_PER_CATEGORY = 100;

function calculateScore(caseId, evidenceItems, moduleRuns) {
  // 1. Extrair todos os sinais
  const signals = [];
  for (const evidence of evidenceItems) {
    for (const rule of SIGNAL_RULES) {
      if (rule.condition(evidence)) {
        const extractions = rule.extract ? rule.extract(evidence) : [{
          title: rule.code,
          description: 'Sinal de risco detectado',
        }];
        
        for (const ex of extractions) {
          signals.push({
            code: rule.code,
            category: rule.category,
            severity: rule.severity,
            scoreImpact: rule.scoreImpact,
            title: ex.title,
            description: ex.description,
            sourceKey: evidence.sourceKey,
            sourceReference: ex.sourceReference || null,
            requiresReview: rule.severity === 'critical',
          });
        }
      }
    }
  }
  
  // 2. Calcular score por categoria (máximo dos impactos, não soma)
  const dimensionScores = {};
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const categorySignals = signals.filter(s => s.category === category);
    
    // Score da categoria = máximo impacto + bônus por quantidade de sinais
    const maxImpact = categorySignals.length > 0
      ? Math.max(...categorySignals.map(s => s.scoreImpact))
      : 0;
    
    const signalCountBonus = Math.min(
      (categorySignals.length - 1) * 5,  // +5 por sinal adicional
      20                                  // Máx +20
    );
    
    dimensionScores[category] = Math.min(
      maxImpact + signalCountBonus,
      MAX_SCORE_PER_CATEGORY
    );
  }
  
  // 3. Score geral = média ponderada das categorias
  const overallScore = Object.entries(CATEGORY_WEIGHTS).reduce((sum, [cat, weight]) => {
    return sum + (dimensionScores[cat] || 0) * weight;
  }, 0);
  
  // 4. Categoria de risco
  let category = 'low';
  if (overallScore >= 75) category = 'critical';
  else if (overallScore >= 50) category = 'high';
  else if (overallScore >= 25) category = 'medium';
  
  return {
    overall: Math.round(overallScore),
    category,
    dimensions: dimensionScores,
    signals,
    calculatedAt: new Date(),
    version: SCORE_VERSION,
  };
}
```

### 6.2 Normalização de Dados BDC para Score

```javascript
// domain/v2NormalizationRules.js

const NORMALIZATION_RULES = {
  // Normalizar status de processo BDC -> enum interno
  processStatus: (bdcStatus) => {
    const map = {
      'ATIVO': 'Em tramitacao',
      'EM_TRAMITACAO': 'Em tramitacao',
      'ARQUIVADO': 'Arquivamento definitivo',
      'ARQUIVAMENTO_DEFINITIVO': 'Arquivamento definitivo',
      'RECURSO': 'Em grau de recurso',
      'EM_GRAU_DE_RECURSO': 'Em grau de recurso',
      'SUSPENSO': 'Suspensa',
    };
    return map[bdcStatus] || 'Outro';
  },
  
  // Normalizar participação
  partyType: (bdcPartyType) => {
    const map = {
      'AUTOR': 'autor',
      'REU': 'reu',
      'REQUERENTE': 'autor',
      'REQUERIDO': 'reu',
      'ENVOLVIDO': 'envolvido',
    };
    return map[bdcPartyType] || 'terceiro';
  },
  
  // Normalizar área processual
  processArea: (bdcClassName, bdcSubject) => {
    const criminalKeywords = ['CRIMINAL', 'PENAL', 'DELITO', 'CRIME', 'CONTRAVENCAO'];
    const laborKeywords = ['TRABALHISTA', 'TRABALHO', 'RECLAMACAO_TRABALHISTA'];
    const civilKeywords = ['CIVEL', 'CONTRATO', 'INDENIZACAO'];
    
    const text = `${bdcClassName} ${bdcSubject}`.toUpperCase();
    
    if (criminalKeywords.some(k => text.includes(k))) return 'criminal';
    if (laborKeywords.some(k => text.includes(k))) return 'trabalhista';
    if (civilKeywords.some(k => text.includes(k))) return 'civel';
    return 'outro';
  },
  
  // Normalizar valor da causa (BDC retorna em formato variável)
  processValue: (bdcValue) => {
    if (!bdcValue) return 0;
    // BDC pode retornar como número ou string formatada
    if (typeof bdcValue === 'number') return Math.round(bdcValue * 100); // centavos
    const cleaned = String(bdcValue).replace(/[^\d,]/g, '').replace(',', '.');
    return Math.round(parseFloat(cleaned) * 100);
  },
  
  // Normalizar tribunal
  courtCode: (bdcCourt) => {
    // Extrair código do tribunal (TJ-CE, TRT-1, etc.)
    const match = String(bdcCourt).match(/(TJ|TRT|TRF|STJ|STF|TST|TSE)-?([A-Z0-9]+)/i);
    return match ? `${match[1].toUpperCase()}-${match[2].toUpperCase()}` : bdcCourt;
  },
  
  // Normalizar MatchRate da BDC
  matchQuality: (matchRate) => {
    if (matchRate >= 95) return 'exact';
    if (matchRate >= 90) return 'high';
    if (matchRate >= 70) return 'medium';
    return 'low';
  },
};
```

---

## 7. API INTERNA (ENDPOINTS)

### 7.1 Decisão: REST JSON (não GraphQL)

**Justificativa:**
- Firestore não tem JOINs nativos — resolvers GraphQL seriam N+1 queries
- Firebase Functions callable já usa POST JSON
- Equipe atual é mais produtiva com REST
- Cache por URL é mais simples

### 7.2 Versionamento

- URL path: `/api/v1/...`
- Header opcional: `X-API-Version: v1`
- Breaking changes -> `/api/v2/...`

### 7.3 Padrão de Resposta

```typescript
// Sucesso
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    hasMore?: boolean;
    nextCursor?: string;
  };
}

// Erro
interface ApiError {
  success: false;
  error: {
    code: string;           // "DOSSIER_NOT_FOUND", "INVALID_CPF", etc.
    message: string;        // Mensagem legível
    details?: any;          // Detalhes adicionais
    requestId: string;      // Para rastreamento nos logs
  };
}
```

### 7.4 Endpoints REST

#### Dossiês

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/api/v1/dossiers` | Criar dossiê | Operador+ |
| GET | `/api/v1/dossiers` | Listar dossiês | Operador+ |
| GET | `/api/v1/dossiers/:id` | Detalhe completo | Operador+ |
| POST | `/api/v1/dossiers/:id/process` | Iniciar/reprocessar | Operador+ |
| POST | `/api/v1/dossiers/:id/retry-source` | Reprocessar fonte específica | Operador+ |
| PATCH | `/api/v1/dossiers/:id` | Atualizar tag/análise | Operador+ |
| DELETE | `/api/v1/dossiers/:id` | Arquivar dossiê | Supervisor+ |

**POST /api/v1/dossiers (Request):**
```json
{
  "subjectType": "pf",
  "document": "05023290336",
  "name": "FRANCISCO TACIANO DE SOUSA",
  "presetKey": "compliance",
  "tag": "FAGNER-2026-04",
  "autoProcess": true,
  "parameters": {
    "processosAutoRelevante": false
  }
}
```

**GET /api/v1/dossiers (Response — Listagem):**
```json
{
  "success": true,
  "data": {
    "dossiers": [
      {
        "id": "abc123",
        "numero": "111.332",
        "data_criacao": "2026-04-23T19:05:17Z",
        "tag": "FAGNER-2026-04",
        "criterio": "FRANCISCO TACIANO DE SOUSA",
        "progresso": 86,
        "status": "Processando",
        "monitoria": false,
        "workflow": false,
        "score": 45,
        "usuario_criador": "FAGNER LOURENÇO",
        "perfil_consulta": "Compliance"
      }
    ]
  },
  "meta": {
    "perPage": 20,
    "total": 156,
    "hasMore": true,
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA0LTIzVDE5OjA1OjE3WiJ9"
  }
}
```

**GET /api/v1/dossiers/:id (Response — Detalhe):**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "numero": "111.332",
    "modo": "analitico",
    "alvo": {
      "tipo": "PF",
      "documento": "050.232.903-36",
      "nome": "FRANCISCO TACIANO DE SOUSA",
      "idade": 47,
      "data_nascimento": "1979-03-15"
    },
    "metadata": {
      "data_criacao": "2026-04-23T19:05:17Z",
      "usuario_criador": "FAGNER LOURENÇO",
      "fontes_com_resultados": 4,
      "fontes_sem_resultados": 9,
      "perfil_consulta": "Compliance",
      "ultimo_processamento": "2026-04-23T19:15:17Z",
      "homonimos": "Único",
      "flags": { "upFlag": false, "workflow": false, "score": true }
    },
    "macro_areas": [
      {
        "areaKey": "juridico",
        "label": "Jurídico",
        "icon": "⚖️",
        "order": 1,
        "totalSources": 4,
        "sourcesWithResults": 2,
        "sourcesUnavailable": 0,
        "sections": [
          {
            "sectionKey": "judicial",
            "label": "Processos Judiciais",
            "executionStatus": "completed_with_findings",
            "statusLabel": "Com resultado",
            "statusVariant": "success",
            "hasFindings": true,
            "resultCount": 7
          }
        ]
      }
    ],
    "processos_judiciais": [...],
    "metricas_analiticas": {
      "total_processos": 7,
      "processos_autor": 2,
      "processos_reu": 5,
      "processos_envolvido": 0,
      "processos_segredo": 0,
      "graficos": {
        "status_processos": { "arquivamento": 5, "em_tramitacao": 2 },
        "por_tribunal": [{ "nome": "TJ-CE", "quantidade": 5 }, { "nome": "TRT-7", "quantidade": 2 }],
        "por_assunto": [{ "nome": "Contravenções Penais", "quantidade": 2 }],
        "por_vara": [{ "nome": "2ª Vara de Família", "quantidade": 1 }],
        "por_classe": [{ "nome": "Apelação Criminal", "quantidade": 1 }]
      }
    },
    "score": {
      "overall": 45,
      "category": "medium",
      "dimensions": {
        "juridico": 60,
        "reguladores": 20,
        "financeiro": 10,
        "reputacional": 5,
        "socioambiental": 0,
        "conflitoInteresse": 0
      },
      "signals": [
        {
          "code": "PROCESS_CRIMINAL_REU",
          "severity": "critical",
          "message": "Processo criminal como réu detectado",
          "sourceKey": "bigdatacorp_processes"
        }
      ]
    },
    "analise": {
      "conclusiva": null,
      "status_aprovacao": "pendente",
      "comentarios": []
    }
  }
}
```

#### Fontes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/sources` | Listar fontes disponíveis por tenant |
| GET | `/api/v1/sources/:sourceKey` | Detalhe de fonte e custo |
| POST | `/api/v1/dossiers/:id/sources/:sourceKey/retry` | Reprocessar fonte |

#### Perfis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/profiles` | Listar perfis padronizados + personalizados |
| POST | `/api/v1/profiles/custom` | Criar perfil personalizado |
| DELETE | `/api/v1/profiles/custom/:id` | Remover perfil personalizado |

#### Análise

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/dossiers/:id/comments` | Adicionar comentário |
| PATCH | `/api/v1/dossiers/:id/analysis` | Atualizar análise conclusiva |
| POST | `/api/v1/dossiers/:id/approve` | Aprovar dossiê |
| POST | `/api/v1/dossiers/:id/reject` | Reprovar dossiê |

#### Relacionamentos (upLink)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/relationships?document=XXX` | Buscar relacionamentos societários |
| POST | `/api/v1/relationships/expand` | Expandir nó do grafo |

---

## 8. SEGURANÇA

### 8.1 Autenticação

- Firebase Authentication (JWT)
- Tokens gerenciados pelo Firebase Admin SDK
- Refresh automático no cliente
- Sessão de 1 hora (padrão Firebase)

### 8.2 Autorização (RBAC)

```javascript
// constants/roles.js
const ROLES = {
  MASTER: {
    level: 100,
    permissions: ['*'],
  },
  ADMIN: {
    level: 80,
    permissions: [
      'dossier:create', 'dossier:read', 'dossier:update', 'dossier:delete',
      'dossier:approve', 'dossier:reject',
      'user:manage', 'tenant:manage',
      'report:export', 'billing:read',
    ],
  },
  SUPERVISOR: {
    level: 60,
    permissions: [
      'dossier:create', 'dossier:read', 'dossier:update',
      'dossier:approve', 'dossier:reject',
      'report:export', 'user:read',
    ],
  },
  OPERADOR: {
    level: 40,
    permissions: [
      'dossier:create', 'dossier:read', 'dossier:update',
      'comment:create', 'comment:read',
    ],
  },
  CLIENT_VIEWER: {
    level: 20,
    permissions: [
      'dossier:read', 'report:read',
    ],
  },
};
```

### 8.3 Tenant Isolation

**Regra de ouro:** Toda query no backend DEVE incluir `tenantId`.

```javascript
// middleware/tenantResolver.js
function tenantResolver(req, res, next) {
  const tenantId = req.user?.customClaims?.tenantId;
  if (!tenantId) {
    return res.status(403).json({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'Tenant não identificado', requestId: req.id }
    });
  }
  req.tenantId = tenantId;
  next();
}

// middleware/requireRole.js
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.customClaims?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Permissão insuficiente', requestId: req.id }
      });
    }
    next();
  };
}
```

### 8.4 Proteção de Dados Sensíveis

| Dado | Proteção |
|------|----------|
| CPF/CNPJ em trânsito | `dochash{SHA-256}` na BDC |
| CPF/CNPJ em repouso | Mascarado em logs; completo apenas em `subjects.document` |
| Respostas BDC brutas | `rawSnapshots` restrito a role >= SUPERVISOR |
| EvidenceItems | Acessível a todos do tenant |
| ClientProjections | Sem dados sensíveis (mascarados) |
| Billing | Apenas ADMIN e MASTER |

### 8.5 Rate Limiting

| Limite | Valor |
|--------|-------|
| BDC (externo) | 5.000 req / 5 min por IP |
| API interna (por tenant) | 100 req / min |
| API interna (por usuário) | 30 req / min |
| Criação de dossiê (por tenant) | 50 / hora |

---

## 9. PREPARAÇÃO PARA O FRONTEND

### 9.1 Princípio: UI-Ready Responses

**Toda resposta da API deve estar no formato exato que a UI precisa.** Nenhuma transformação no frontend.

**Regras:**
1. Números formatados: `"R$ 1.234,56"` no backend
2. Datas no formato `"23/04/2026 19:05:17"` no backend
3. Status como strings legíveis: `"Processando"`, `"Com resultado"`
4. Cores/variantes incluídas: `"success"`, `"warning"`, `"error"`, `"info"`, `"neutral"`
5. Ícones como strings: `"⚖️"`, `"🆔"`, `"💰"` (frontend mapeia para componentes)
6. Progresso como número 0-100
7. Labels e descrições traduzidas

### 9.2 Projeções Pré-computadas

Criar coleção `clientProjections` que armazena a resposta pronta para UI:

```typescript
interface ClientProjection {
  id: string;               // Mesmo ID do case
  tenantId: string;
  caseId: string;
  
  // Dados já no formato da UI
  dossierListItem: { ... }, // Para listagem
  dossierDetail: { ... },   // Para detalhe completo
  dossierAnalytics: { ... },// Para visão analítica
  
  // Metadados
  version: string;
  generatedAt: Timestamp;
  invalidatedAt?: Timestamp;
}
```

**Quando gerar:**
- Após `case.status` mudar para 'ready'
- Após evidenceItem ser adicionado/atualizado
- Após score ser recalculado
- Após comentário ser adicionado

**Quando invalidar:**
- Novo processamento iniciado
- Fonte reprocessada

### 9.3 Formatos de Resposta por Tela

#### Tela: Listagem de Dossiês (`/dossie`)
```json
{
  "dossiers": [{
    "id": "string",
    "numero": "string",
    "data_criacao": "string",        // Formatado
    "tag": "string | null",
    "criterio": "string",
    "progresso": 86,                  // Número
    "status": "string",               // "Iniciar", "Na fila", "Processando"
    "monitoria": true,
    "workflow": false,
    "score": 45,                      // Número ou null
    "usuario_criador": "string",
    "perfil_consulta": "string"
  }],
  "meta": { "perPage": 20, "total": 156, "hasMore": true, "nextCursor": "string" }
}
```

#### Tela: Detalhe Analítico (`/dossie/:id?mode=analitico`)
```json
{
  "id": "string",
  "numero": "string",
  "modo": "analitico",
  "alvo": { ... },
  "metadata": { ... },
  "macro_areas": [ ... ],           // Já agrupadas e ordenadas
  "metricas_analiticas": {           // Já agregadas
    "total_processos": 7,
    "processos_autor": 2,
    "graficos": {
      "status_processos": { "arquivamento": 5, "em_tramitacao": 2 },
      "por_tribunal": [{ "nome": "TJ-CE", "quantidade": 5 }]
    }
  },
  "score": { ... },
  "analise": { ... }
}
```

#### Tela: Detalhe Detalhado (`/dossie/:id?mode=detalhado`)
```json
{
  "id": "string",
  "macro_areas": [{
    "areaKey": "juridico",
    "sections": [{
      "sectionKey": "judicial",
      "evidenceItems": [{
        "id": "string",
        "evidenceType": "process_list",
        "content": {
          "processes": [{
            "number": "string",
            "className": "string",
            "court": "string",
            "status": "Em tramitacao",
            "participation": "Réu",
            "valueFormatted": "R$ 1.234,56",
            "link": "url"
          }]
        }
      }]
    }]
  }]
}
```

### 9.4 WebSocket / Real-time (Futuro)

Para progresso em tempo real:
- Usar Firestore `onSnapshot` no frontend para `cases/{caseId}` e `moduleRuns`
- Não implementar WebSocket custom agora — Firestore real-time é suficiente
- Backend atualiza `case.progress` e `case.progressDetail` a cada moduleRun concluído

---

## 10. PLANO DE EXECUÇÃO

### Fase 1: Fundação (Semana 1)
- [ ] Refatorar `index.js` para registradores modulares
- [ ] Criar estrutura de pastas `application/`, `infrastructure/`, `interfaces/`
- [ ] Implementar `tenantResolver` middleware
- [ ] Implementar error handler padronizado
- [ ] Criar coleção `customProfiles`
- [ ] Criar coleção `comments`

### Fase 2: Modelagem e Dados (Semana 1-2)
- [ ] Expandir `subjects` com cache de dados BDC
- [ ] Implementar `docHash` (SHA-256) para consultas BDC
- [ ] Criar índices Firestore obrigatórios
- [ ] Implementar `clientProjections` pipeline
- [ ] Criar sequencial `dossierNumber` por tenant

### Fase 3: BDC Integration (Semana 2)
- [ ] Criar `bigdatacorpCatalog.js` com todos os 199 datasets mapeados
- [ ] Criar `bigdatacorpQueryBuilder.js`
- [ ] Expandir adapter para `/empresas` endpoint
- [ ] Implementar normalizadores granulares (basicData, processes, kyc, occupation, relationships, financial, risk, esg)
- [ ] Implementar cache via Provider Ledger para todos os datasets BDC
- [ ] Implementar retry com exponential backoff

### Fase 4: Pipeline de Processamento (Semana 3)
- [ ] Implementar trigger `onCaseCreated` orquestrando BDC-first
- [ ] Implementar `moduleRun` lifecycle completo
- [ ] Implementar progress calculation
- [ ] Implementar fallback entre provedores
- [ ] Wire ProviderRequest -> RawSnapshot -> EvidenceItem

### Fase 5: Score Engine (Semana 3)
- [ ] Implementar `v2ScoreEngine.js` com signal rules
- [ ] Implementar `v2NormalizationRules.js`
- [ ] Criar coleção `riskSignals`
- [ ] Integrar score ao pipeline de processamento
- [ ] Testar com dados reais da BDC

### Fase 6: API REST (Semana 4)
- [ ] Implementar todos os endpoints de dossiê
- [ ] Implementar endpoints de fonte
- [ ] Implementar endpoints de perfil
- [ ] Implementar endpoints de análise
- [ ] Implementar rate limiting
- [ ] Documentar API (OpenAPI/Swagger)

### Fase 7: Segurança e QA (Semana 4-5)
- [ ] Implementar RBAC completo
- [ ] Auditar tenant isolation
- [ ] Testes unitários para domain
- [ ] Testes de integração para adapters
- [ ] Testes de API (Postman/Insomnia collection)
- [ ] Penetration test básico (auth, tenant isolation)

### Fase 8: Otimização (Semana 5)
- [ ] Implementar `clientProjections` com invalidação
- [ ] Otimizar queries Firestore
- [ ] Implementar cache em memória (LRU) para datasets frequentes
- [ ] Monitoramento de custos BDC por tenant
- [ ] Alertas de gasto anômalo

---

## ANEXOS

### Anexo A: Mapeamento Preset -> Datasets BDC

| Preset | PF Datasets | PJ Datasets | Custo PF Est. | Custo PJ Est. |
|--------|-------------|-------------|---------------|---------------|
| Compliance | basic_data, processes, kyc | basic_data, processes, kyc, relationships | R$ 0,15 | R$ 0,17 |
| Internacional | basic_data, kyc, online_presence, political_involvement | basic_data, kyc, online_presence, owners_kyc | R$ 0,18 | R$ 0,22 |
| Financeiro | basic_data, processes, financial_data, collections, government_debtors | basic_data, financial_data, government_debtors, company_evolution | R$ 0,27 | R$ 0,22 |
| Investigativo | basic_data, processes, kyc, online_presence, media_profile | basic_data, processes, kyc, online_presence, relationships | R$ 0,25 | R$ 0,22 |
| Jurídico | basic_data, processes.limit(200), owners_lawsuits | basic_data, processes, owners_lawsuits | R$ 0,22 | R$ 0,22 |
| PLD | basic_data, kyc, financial_data, collections | basic_data, kyc, relationships, financial_data | R$ 0,20 | R$ 0,15 |
| RH | basic_data, processes, kyc, occupation_data, class_organization | — | R$ 0,25 | — |

### Anexo B: Códigos de Erro da API

| Código | HTTP | Descrição |
|--------|------|-----------|
| `DOSSIER_NOT_FOUND` | 404 | Dossiê não existe ou não pertence ao tenant |
| `INVALID_DOCUMENT` | 400 | CPF/CNPJ inválido |
| `SUBJECT_NOT_FOUND` | 404 | Pessoa não encontrada |
| `SOURCE_NOT_ENTITLED` | 403 | Tenant não contratou esta fonte |
| `SOURCE_FAILED` | 502 | Fonte externa indisponível |
| `RATE_LIMITED` | 429 | Limite de requisições excedido |
| `TENANT_REQUIRED` | 403 | Tenant não identificado no token |
| `FORBIDDEN` | 403 | Permissão insuficiente |
| `VALIDATION_ERROR` | 400 | Erro de validação de input |
| `SCORE_CALCULATION_ERROR` | 500 | Erro ao calcular score |

---

**Fim do Plano**
