# Produto V2 refinado

## 1. Definicao curta

O **ComplianceHub V2** e uma plataforma investigativa de due diligence e decisao de risco para pessoas fisicas e juridicas.

Ela transforma dados externos e internos em:

- dossies investigativos;
- evidencias rastreaveis;
- fatos e vinculos estruturados;
- sinais de risco;
- decisoes revisadas por analistas;
- relatorios comerciais seguros e auditaveis.

## 2. Categoria do produto

**Categoria recomendada:** plataforma investigativa de risco e compliance orientada a evidencias.

Ela nao deve ser posicionada apenas como:

- consultador de dados;
- CRM de casos;
- motor generico de decisao;
- ferramenta generica de KYC;
- gerador de relatorio.

Ela deve ser posicionada como:

> **Uma plataforma para transformar consultas, evidencias e revisao humana em decisoes defensaveis e relatorios profissionais.**

## 3. Problema que resolve

Empresas que precisam avaliar pessoas, empresas, socios, fornecedores, candidatos, clientes ou parceiros sofrem com:

- dados dispersos em fontes diferentes;
- consultas manuais e repetitivas;
- falta de trilha de evidencia;
- decisoes sem justificativa padronizada;
- relatorios inconsistentes;
- dificuldade de auditar quem consultou, revisou, alterou e aprovou;
- risco juridico, reputacional, operacional e comercial;
- retrabalho em analises recorrentes;
- baixa confianca no processo quando ha divergencia entre fontes.

O ComplianceHub V2 resolve esse problema ao organizar o processo inteiro:

`Demanda -> Sujeito -> Consulta -> Evidencia -> Fato -> Relacao -> Sinal -> Revisao -> Decisao -> Relatorio -> Projecao cliente-safe`

## 4. Para quem resolve

### Compradores

- areas de compliance;
- juridico;
- RH;
- credito e cadastro;
- operacoes;
- franquias e redes;
- empresas com alto volume de due diligence;
- empresas que vendem analise como servico;
- negocios que precisam justificar decisoes de aceite, rejeicao, atencao ou revisao.

### Usuarios internos

- analista operacional;
- analista senior;
- coordenador de risco;
- auditor interno;
- administrador de tenant/franquia;
- gestor comercial/operacional.

### Usuarios externos

- cliente solicitante;
- gestor do cliente;
- auditor do cliente;
- area que consome relatorio para decisao.

## 5. O que o cliente compra de fato

O cliente nao compra "uma API" nem "uma tela de consulta".

Ele compra:

- **decisoes mais seguras**;
- **relatorios comerciais padronizados**;
- **dossies com evidencias rastreaveis**;
- **revisao humana com governanca**;
- **modulos de analise ativados conforme necessidade**;
- **operacao escalavel de due diligence**;
- **reducao de retrabalho e risco de erro**.

## 6. Unidade principal de valor

**Unidade de valor principal:** uma analise concluida e defensavel.

Essa analise pode se materializar como:

- caso revisado;
- dossie PF;
- dossie PJ;
- decisao de risco;
- relatorio publico seguro;
- evidencia auditavel;
- historico de revisao.

## 7. Modelo comercial recomendado

### 7.1 Modelo hibrido recomendado

O modelo mais natural para o ComplianceHub e:

> **SaaS + consumo de consultas + valor agregado por dossie/relatorio + monitoramento futuro.**

Essa estrutura evita dois erros:

- vender apenas acesso ao sistema, ignorando custo real de provedores;
- vender apenas consulta, reduzindo o produto a uma camada comoditizada.

### 7.2 Camadas de cobranca

| Camada | O que cobra | Por que existe | Observacao |
|---|---|---|---|
| Consumo de consultas | CPF, CNPJ, processos, vinculos, modulos ativados | Cobre custo de provedores e margem | Deve ser transparente internamente, mas nao expor API sensivel ao cliente |
| Dossie investigativo | PF simples, PF completo, PJ, societario, reputacional | Produto real de valor | Principal unidade comercial recomendada |
| Plataforma SaaS | usuarios, tenant, franquias, cockpit, historico, auditoria | Recorrencia e acesso operacional | Sustenta o uso continuo |
| Relatorio | emissao, revisao, link seguro, exportacao | Output comercial | Pode estar incluso no dossie ou cobrado por pacote |
| Monitoramento futuro | watchlist, alertas, reconsultas, mudancas | Receita premium | Apenas apos V2 vendavel madura |

### 7.3 Produtos dentro da plataforma

O sistema deve ser organizado em produtos claros, nao apenas em features:

| Produto | Entrada | Saida | Valor | Fase |
|---|---|---|---|---|
| Consulta/enriquecimento | CPF/CNPJ/dados cadastrais | dados brutos e normalizados | baixo isoladamente, necessario como insumo | V2 minima |
| Dossie investigativo | sujeito + modulos | contexto consolidado, evidencias e narrativa | alto, core comercial | V2 minima/vendavel |
| Analise/decisao | dossie + evidencias | sinais, score, veredito e justificativa | transforma dado em decisao | V2 minima/vendavel |
| Relatorio | decisao aprovada | versao cliente-safe, snapshot e link seguro | output comercial compartilhavel | V2 minima |
| Plataforma operacional | casos, filas, revisoes | cockpit, auditoria, produtividade | fideliza operacao B2B | V2 vendavel |
| Monitoramento | sujeitos em carteira | alertas e mudancas | receita premium recorrente | V2 premium |

### 7.4 Pacotes de dossie sugeridos

**Dossie PF Essencial**

- identificacao;
- dados cadastrais normalizados;
- modulos contratados basicos;
- sinais principais;
- decisao revisada;
- relatorio seguro.

**Dossie PF Completo**

- tudo do essencial;
- processos;
- mandados/alertas quando aplicavel;
- midia negativa/listas quando contratado;
- timeline;
- evidencias organizadas;
- parecer executivo.

**Dossie PJ**

- identificacao da empresa;
- quadro societario/vinculos;
- contexto cadastral e operacional;
- sinais de risco;
- relatorio executivo.

**Dossie Societario/Reputacional**

- foco em relacionamentos;
- participacoes;
- vinculos relevantes;
- alertas reputacionais;
- justificativa de risco.

### 7.5 Regra comercial principal

O ComplianceHub nao deve vender "acesso a API".

Deve vender:

> **dossie investigativo pronto, confiavel, revisado e auditavel.**

### V2 minima

Venda como:

- pacote de analises revisadas;
- portal cliente + portal operacional;
- relatorios seguros;
- modulos basicos de verificacao PF/PJ;
- controle de status e auditoria.

### V2 vendavel/intermediaria

Venda como:

- plataforma de due diligence com dossie PF/PJ;
- modulos configuraveis por cliente;
- relatorio executivo revisado;
- timeline de evidencias;
- governanca por franquia/cliente/operacao.

### V2 premium

Venda como:

- cockpit investigativo avancado;
- monitoramento continuo;
- watchlists;
- grafo de vinculos;
- alertas historicos;
- inteligencia operacional e analitica.

## 8. O que diferencia de um consultador de dados

Um consultador de dados responde "o que a fonte retornou".

O ComplianceHub V2 deve responder:

- o que foi consultado;
- quando foi consultado;
- de qual fonte veio;
- qual evidencia sustenta cada apontamento;
- qual fato canonico foi extraido;
- qual risco esse fato representa;
- qual foi a decisao;
- quem revisou;
- qual versao foi publicada;
- qual relatorio foi entregue ao cliente.

Essa diferenca e essencial. O produto nao termina na consulta; ele termina na decisao defensavel.

## 9. Diferenca em relacao ao Marble

**Confirmado nos inventarios Marble:** os documentos em `02_inventario_marble/` identificam um produto forte em AML, decisioning, screening, cases, workflows, data model e continuous screening. Evidencias citadas incluem dominios como `Decision`, `Case`, `CaseEvent`, `Screening`, `Workflow`, `DataModel` e rotas como `/decisions`, `/screenings`, `/continuous-screenings`, `/cases`, `/client360`.

**Diferenca recomendada:** ComplianceHub nao deve competir tentando ser um Marble brasileiro de AML transacional. Deve aproveitar inspiracoes de case management, decisioning, auditabilidade e screening, mas focar em due diligence investigativa brasileira, dossie PF/PJ, BigDataCorp-first e relatorio comercial revisado.

## 10. Diferenca em relacao ao Ballerine

**Confirmado nos inventarios Ballerine:** os documentos em `03_inventario_ballerine/` identificam foco em KYC/KYB, workflow runtime, backoffice, documentos, revisao manual, collection flows, apps e packages. Evidencias citadas incluem `WorkflowDefinition`, `WorkflowRuntimeData`, `EndUser`, `Business`, `Document`, `BusinessReport`, `Alert`, `workflows-service`, `backoffice-v2` e `kyb-app`.

**Diferenca recomendada:** ComplianceHub nao deve virar um Ballerine de onboarding/documentos. Deve aproveitar a disciplina de workflow e revisao manual, mas manter foco em investigacao, evidencias, fatos, relacoes, sinais, decisao e relatorio.

## 11. Diferenca em relacao a plataformas investigativas comerciais

**Observacao:** comparacoes com plataformas como Kronoos aqui sao referenciais e comerciais; nao foram analisados repositorios internos dessas plataformas.

O ComplianceHub deve se diferenciar por:

- foco em realidade brasileira;
- modulos ativaveis por necessidade do cliente;
- BigDataCorp como fonte central de enriquecimento;
- revisao humana como etapa de qualidade;
- relatorio seguro e compartilhavel;
- trilha de auditoria e explainability desde o primeiro desenho;
- integracao entre operacao interna e portal cliente.

## 12. Proposta de valor por camada

### 12.1 V2 minima

**Proposta:** "Sua empresa solicita uma analise, o ComplianceHub consulta fontes qualificadas, organiza evidencias, apoia a revisao humana e entrega um relatorio seguro e auditavel."

**Valor:** reduz tempo, padroniza conclusao e evita relatorio vazio/inconsistente.

### 12.2 V2 vendavel/intermediaria

**Proposta:** "Uma central de due diligence PF/PJ com dossies reutilizaveis, timeline de evidencias, auditoria e modulos configuraveis por cliente."

**Valor:** transforma operacao de compliance em processo escalavel e vendavel.

### 12.3 V2 premium

**Proposta:** "Um cockpit investigativo completo para vinculos, monitoramento, alertas, watchlists e inteligencia continua."

**Valor:** aproxima o produto de uma plataforma investigativa corporativa de categoria superior.

## 13. Oferta principal recomendada

Oferta de entrada:

> **ComplianceHub Due Diligence PF/PJ**
>
> Plataforma para solicitar, revisar e entregar analises de risco com evidencias, revisao humana, auditoria e relatorios seguros.

Pacotes possiveis:

- **Essencial:** solicitacoes, verificacoes basicas, revisao, relatorio.
- **Profissional:** modulos PF/PJ, dossie, timeline, auditoria avancada, portal cliente.
- **Investigativo:** vinculos, alertas, watchlist, monitoramento, cockpit avancado.

## 14. Mensagem comercial de entrada

> Transforme dados dispersos em decisoes confiaveis, revisadas e auditaveis.
>
> O ComplianceHub centraliza solicitacoes, consultas, evidencias, analise humana e relatorios profissionais em uma unica plataforma segura.

## 15. Nao prometer cedo demais

Na comunicacao da V2 minima, evitar prometer:

- grafo completo de relacionamentos;
- monitoramento continuo;
- rule builder visual;
- score universal automatico;
- substituicao total da revisao humana;
- cobertura perfeita de todas as fontes;
- consulta em tempo real ilimitada;
- inferencias sem evidencia rastreavel.

O produto deve vender confiabilidade, rastreabilidade e qualidade operacional, nao magia.
