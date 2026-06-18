/**
 * correct-verdicts-after-escavador2-audit.cjs
 *
 * Script one-off para correção administrativa de vereditos após auditoria do Escavador2.
 * Pode ser reutilizado quando a auditoria completa dos ~1173 casos terminar.
 *
 * Regras de negócio aplicadas (conforme alinhado com o usuário):
 * - Criminal material (exceto trânsito/ambiental): 1 processo onde candidato é réu/
 *   investigado/autor do fato/indiciado/denunciado -> NOT_RECOMMENDED.
 * - Trabalhista como autor/reclamante/requerente/exequente/recorrente (polo ativo):
 *   1 -> ATTENTION; >=2 -> NOT_RECOMMENDED.
 * - Trabalhista como réu/executado/requerido/recorrido (polo passivo): NÃO muda veredito.
 * - Trânsito/Ambiental isolado: NÃO muda veredito (mantém FIT).
 * - DJEN é fonte COMPLEMENTAR de processos já conhecidos (busca por nome). NUNCA
 *   é usado como única fonte para mudar um veredito criminal. Apenas confirma
 *   achados de fontes com identificação por CPF (BigDataCorp, Judit, Escavador).
 * - Casos já NOT_RECOMMENDED/ATTENTION com novos achados do Escavador2: documentar
 *   os achados sem alterar o veredito.
 *
 * Modos:
 *   --dry-run    Gera o relatório de propostas sem escrever no Firestore.
 *   --apply      Executa as correções no Firestore (requer --yes).
 *
 * Uso:
 *   node scripts/correct-verdicts-after-escavador2-audit.cjs --dry-run
 *   node scripts/correct-verdicts-after-escavador2-audit.cjs --apply --yes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const PROJECT_ID = 'compliance-hub-br';
const OUTPUT_DIR = path.join(__dirname, '..', 'results', 'escavador2-audit-madero-br');
const AUDIT_CASES_DIR = path.join(OUTPUT_DIR, 'cases');
const PLAN_OUTPUT = path.join(OUTPUT_DIR, 'correction-plan.json');
const SELECTED_PLAN_OUTPUT = path.join(OUTPUT_DIR, 'correction-plan-selected.json');
const REPORT_OUTPUT = path.join(OUTPUT_DIR, 'correction-report.json');
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

// Fontes que identificam o candidato por CPF e podem, sozinhas, sustentar uma
// mudanca de veredito. DJEN e excluido propositalmente: ele e busca por nome e
// serve apenas para complementar processos ja conhecidos de outras fontes.
const INDEPENDENT_RISK_SOURCES = new Set(['bigdatacorp', 'judit', 'escavador', 'escavador2']);

// =============================================================================
// UTILITÁRIOS
// =============================================================================

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function processText(process) {
  return normalizeText([
    process.area,
    process.classe,
    process.tipo,
    process.natureza,
    process.assunto,
    process.assuntoPrincipal,
    process.subject,
    process.cnjSubject,
    process.cnjBroadSubject,
    Array.isArray(process.subjects) ? process.subjects.join(' ') : '',
    Array.isArray(process.classifications) ? process.classifications.join(' ') : '',
  ].join(' '));
}

function getRole(process) {
  return normalizeText(process.specificRole || process.tipoNormalizado || process.tipoPrincipal || process.polo || process.role || process.personType || '');
}

function getCnj(process) {
  return process.numeroCnj || process.cnj || process.numeroProcesso || process.processNumber || 'N/A';
}

function getClasse(process) {
  if (Array.isArray(process.classifications) && process.classifications.length > 0) {
    return process.classifications.join(' | ');
  }
  return process.classe || process.tipo || process.natureza || 'Processo';
}

function getAssunto(process) {
  if (Array.isArray(process.subjects) && process.subjects.length > 0) {
    return process.subjects.join(' | ');
  }
  return process.assunto || process.assuntoPrincipal || process.subject || process.cnjSubject || process.cnjBroadSubject || 'Sem assunto';
}

function getTribunal(process) {
  return process.tribunalSigla || process.tribunal || process.courtName || process.court || 'N/A';
}

function hasMaterialCriminalFinding(item) {
  return item.materialFindings.some(f => f.type === 'criminal');
}

// =============================================================================
// REGRAS DE CLASSIFICAÇÃO DE PROCESSOS
// =============================================================================

function isTrabalhista(process) {
  const text = processText(process);
  const hasStrongLabor = /TRABALHISTA|RECLAMACAO TRABALHISTA|ACAO TRABALHISTA|JUSTICA DO TRABALHO|TRT\b|TRT-\d|VARA DO TRABALHO|PROCESSO DO TRABALHO|HTE\b|ATSum\b|ADS\b|RITO SUMARISSIMO.*TRABALH|DIREITO DO TRABALHO/.test(text);
  if (!hasStrongLabor) return false;
  // Descartar cível de consumidor/responsabilidade civil disfarçado
  if (/DIREITO DO CONSUMIDOR|RESPONSABILIDADE CIVIL|INDENIZACAO POR DANO|ACIDENTE DE TRANSITO|CARTAO DE CREDITO|INCLUSAO INDEVIDA|ALUGUEIS|DESPEJO|OBRAS SOCIAIS|PATRIMONIO CULTURAL/.test(text)) return false;
  return true;
}

function isCriminal(process) {
  if (isTransito(process) || isAmbiental(process)) return false;
  const text = processText(process);
  // Descartar cível/consumidor/cobrança, mesmo quando Escavador2 marca area=CRIMINAL
  const civilExclusion = /DIREITO DO CONSUMIDOR|RESPONSABILIDADE CIVIL|INDENIZACAO POR DANO|ACIDENTE DE TRANSITO|CARTAO DE CREDITO|INCLUSAO INDEVIDA|ALUGUEIS|DESPEJO|NOTA PROMISSORIA|COBRANCA|COMPRA E VENDA|JUIZADO ESPECIAL CIVEL|PROCEDIMENTO COMUM CIVEL|DIREITO CIVIL|DUPLICATA|TITULO EXTRAJUDICIAL|EXECUCAO DE TITULO|OBRIGACOES|ADIANTAMENTO A DEPOSITARIO|REINTEGRACAO DE POSSE|CONDOMINIO|REVISIONAL/;
  if (civilExclusion.test(text)) return false;
  // Exigir indicador criminal forte em classe/assunto (não confiar apenas na area do Escavador2)
  const criminalIndicator = /ACAO PENAL|INQUERITO POLICIAL|PROCESSO CRIMINAL|TERMO CIRCUNSTANCIADO|FLAGRANTE|ESTUPRO|ROUBO|FURTO|TRAFICO|DROGAS|HOMICIDIO|VIOLENCIA DOMESTICA|MARIA DA PENHA|LEI ANTITOXICOS|APURACAO|LESAO CORPORAL|AMEACA|CONSTRANGIMENTO|PERSEGUIM|EXECUCAO PENAL|PENA/;
  return criminalIndicator.test(text);
}

function isTransito(process) {
  const text = processText(process);
  return /TRANSITO|CTB|EMBRIAGUEZ|DIRECAO|DIRIGIR|CRIME(S)? DE TRANSITO|INFRACAO DE TRANSITO|LEI 9503/.test(text) && !/HOMICIDIO/.test(text);
}

function isAmbiental(process) {
  const text = processText(process);
  return /AMBIENTAL|MEIO AMBIENTE|LEI 9605|CRIME AMBIENT/.test(text);
}

function hasIdentifiableClassOrSubject(process) {
  const classe = normalizeText(getClasse(process));
  const assunto = normalizeText(getAssunto(process));
  if (classe === 'PROCESSO' && (assunto === 'SEM ASSUNTO' || assunto === '')) return false;
  return classe !== '' || assunto !== '';
}

function isHte(process) {
  const classe = normalizeText(getClasse(process));
  return /HOMOLOGACAO DA TRANSACAO|HOMOLOGACAO DE TRANSACAO|HTE/.test(classe);
}

function isCartaPrecatoriaCriminalNoise(process) {
  const classe = normalizeText(getClasse(process));
  const assunto = normalizeText(getAssunto(process));
  return /CARTA PRECATORIA CRIMINAL/.test(classe) && /INTIMACAO|NOTIFICACAO|DEPONIMENTO|PROVAS|CITACAO/.test(assunto);
}

function isMaterialCriminalProcess(process) {
  if (!hasIdentifiableClassOrSubject(process)) return false;
  if (isTransito(process) || isAmbiental(process)) return false;
  if (isCartaPrecatoriaCriminalNoise(process)) return false;
  if (!isCriminal(process)) return false;
  const role = getRole(process);
  if (/VITIMA/.test(role)) return false;
  return process.isDefendant === true || /REU|INVESTIGAD|ACUSAD|INDICIAD|AUTOR DO FATO|EXECUTAD|DENUNCIAD|FLAGRANTEADO|RECORRIDO|REQUERIDO|DENUNCIADO/.test(role);
}

function isActiveLaborPartyProcess(process) {
  if (!isTrabalhista(process)) return false;
  if (isHte(process)) return false;
  const role = getRole(process);
  return /RECLAMANTE|AUTOR|REQUERENTE|EXEQUENTE|RECORRENTE|POLO ATIVO|ATIVO|RECLAMANTE-RECORRENTE|AUTOR-RECORRENTE/.test(role);
}

function isPassiveLaborPartyProcess(process) {
  if (!isTrabalhista(process)) return false;
  const role = getRole(process);
  return /RECLAMAD|REU|REQUERID|EXECUTAD|POLO PASSIVO|PASSIVO|RECORRIDO/.test(role);
}

// =============================================================================
// AGREGAÇÃO DE PROCESSOS DE TODAS AS FONTES
// =============================================================================

function extractAllProcesses(caseData) {
  const all = [];
  const sources = [
    { key: 'bigdatacorpProcessos', source: 'bigdatacorp' },
    { key: 'juditProcessos', source: 'judit' },
    { key: 'juditRoleSummary', source: 'juditRoleSummary' },
    { key: 'escavadorProcessos', source: 'escavador' },
    { key: 'djenComunicacoes', source: 'djen' },
  ];
  for (const { key, source } of sources) {
    const list = Array.isArray(caseData[key]) ? caseData[key] : [];
    for (const p of list) {
      if (!p) continue;
      all.push({ ...p, _source: source });
    }
  }
  // Escavador2 vem do esc2.processos, não do caseData diretamente
  const esc2List = Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : [];
  for (const p of esc2List) {
    if (!p) continue;
    all.push({ ...p, _source: 'escavador2' });
  }
  return all;
}

// =============================================================================
// CÁLCULO DE RISCO (mirror de functions/shared/riskCalculator.js)
// =============================================================================

const BASE_SCORES = {
  NEGATIVE: 0, NOT_FOUND: 5, INCONCLUSIVE: 40, POSITIVE: 90,
  LOW: 0, UNKNOWN: 20, MEDIUM: 50, HIGH: 90,
};

function calculateRisk(form) {
  const phaseScores = [];

  let criminalScore = BASE_SCORES[form.criminalFlag] || 0;
  if (form.criminalFlag === 'POSITIVE') {
    if (form.criminalSeverity === 'HIGH') criminalScore = 95;
    else if (form.criminalSeverity === 'LOW') criminalScore = 75;
  }
  phaseScores.push(criminalScore);

  let laborScore = BASE_SCORES[form.laborFlag] || 0;
  if (form.laborFlag === 'POSITIVE') {
    if (form.laborSeverity === 'HIGH') laborScore = 95;
    else if (form.laborSeverity === 'LOW') laborScore = 50;
  }
  phaseScores.push(laborScore);

  phaseScores.push(BASE_SCORES[form.warrantFlag] || 0);
  phaseScores.push(BASE_SCORES[form.osintLevel] || 0);
  phaseScores.push(BASE_SCORES[form.socialStatus] || 0);
  phaseScores.push(BASE_SCORES[form.digitalFlag] || 0);
  phaseScores.push(BASE_SCORES[form.conflictInterest] || 0);

  let riskScore = Math.max(...phaseScores, 0);

  const yellowSignals = [
    form.criminalFlag === 'INCONCLUSIVE',
    form.laborFlag === 'INCONCLUSIVE',
    form.warrantFlag === 'INCONCLUSIVE',
    form.osintLevel === 'MEDIUM',
    form.socialStatus === 'CONCERN',
    form.digitalFlag === 'ALERT',
    form.cpfPendingRegularization === true,
  ].filter(Boolean).length;

  if (yellowSignals >= 2) riskScore = Math.min(100, riskScore + 15);

  let riskLevel = 'GREEN';
  if (riskScore >= 70) riskLevel = 'RED';
  else if (riskScore >= 30) riskLevel = 'YELLOW';

  if (form.cpfPendingRegularization === true && riskScore < 30) {
    riskScore = 30;
    riskLevel = 'YELLOW';
  }

  let suggestedVerdict = 'FIT';
  if (riskScore >= 70) suggestedVerdict = 'NOT_RECOMMENDED';
  else if (riskScore >= 30) suggestedVerdict = 'ATTENTION';
  if (form.cpfPendingRegularization === true && suggestedVerdict === 'FIT') suggestedVerdict = 'ATTENTION';

  return { riskScore, riskLevel, suggestedVerdict };
}

// =============================================================================
// GERAÇÃO DE NARRATIVAS
// =============================================================================

// Configuração de discrição: se true, omite menções a Escavador2/auditoria/correção
// das narrativas visíveis ao cliente (executiveSummary, keyFindings, statusSummary,
// nextSteps, timelineEvents). Menções técnicas permanecem em criminalNotes/laborNotes
// e analystComment (uso interno).
const DISCRETE_MODE = true;

function formatCnj(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 20) {
    return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
  }
  return raw || 'N/A';
}

function buildCriminalNotes(materialCriminal, passiveLabor, trafficEnvOnly) {
  const parts = [];

  if (materialCriminal.length === 0) {
    parts.push('Nao foram identificados apontamentos criminais/penais relevantes para o candidato.');
  } else {
    parts.push(`Criminal POSITIVO: ${materialCriminal.length} processo(s) criminal(is) material(is) identificado(s).`);
    parts.push('');
    parts.push('Detalhamento dos apontamentos criminais:');
    for (let i = 0; i < materialCriminal.length; i++) {
      const p = materialCriminal[i];
      parts.push('');
      parts.push(`${i + 1}. ${formatCnj(getCnj(p))}`);
      parts.push(`   Processo: ${getClasse(p)}`);
      parts.push(`   Assunto: ${getAssunto(p)}`);
      parts.push(`   Tribunal: ${getTribunal(p)}`);
      parts.push(`   Papel do candidato: ${getRole(p)}`);
      if (p.roleDetails && /VITIMA/.test(normalizeText(p.roleDetails))) {
        parts.push('   ATENCAO: papel inclui vitima; recomenda-se revisao manual antes de qualquer decisao final.');
      }
      if (p.dataInicio || p.distributionDate || p.data) {
        parts.push(`   Data de inicio: ${p.dataInicio || p.distributionDate || p.data || 'N/A'}`);
      }
      if (p.status || p.statusPredicted) {
        parts.push(`   Status: ${p.status || p.statusPredicted || 'N/A'}`);
      }
    }
  }

  if (passiveLabor.length > 0) {
    parts.push('');
    parts.push(`Tambem foram localizados ${passiveLabor.length} processo(s) trabalhista(s) em que o candidato figura como parte passiva (reu/reclamado/executado). Estes nao alteram isoladamente o veredito, mas sao documentados para compleude.`);
  }

  if (trafficEnvOnly.length > 0) {
    parts.push('');
    parts.push(`Foram localizados ${trafficEnvOnly.length} apontamento(s) de transito/ambiental. De acordo com a politica vigente, este tipo de apontamento isolado nao altera o veredito final.`);
  }

  return parts.join('\n');
}

function buildLaborNotes(activeLabor, passiveLabor, finalVerdict) {
  const parts = [];

  if (activeLabor.length === 0) {
    parts.push('Nao foram identificados processos trabalhistas em que o candidato figure como parte ativa (autor/reclamante/requerente).');
  } else {
    const policyText = finalVerdict === 'NOT_RECOMMENDED'
      ? 'os apontamentos trabalhistas ativos sustentam o veredito de Nao Recomendado'
      : 'os apontamentos trabalhistas ativos permanecem documentados como pontos de Atencao';
    parts.push(`Trabalhista POSITIVO: ${activeLabor.length} processo(s) como parte ativa identificado(s). Pela politica interna, ${policyText}.`);
    parts.push('');
    parts.push('Detalhamento dos processos trabalhistas (polo ativo):');
    for (let i = 0; i < activeLabor.length; i++) {
      const p = activeLabor[i];
      parts.push('');
      parts.push(`${i + 1}. ${formatCnj(getCnj(p))}`);
      parts.push(`   Processo: ${getClasse(p)}`);
      parts.push(`   Assunto: ${getAssunto(p)}`);
      parts.push(`   Tribunal: ${getTribunal(p)}`);
      parts.push(`   Papel do candidato: ${getRole(p)}`);
      if (p.dataInicio || p.distributionDate || p.data) {
        parts.push(`   Data de inicio: ${p.dataInicio || p.distributionDate || p.data || 'N/A'}`);
      }
      if (p.status || p.statusPredicted) {
        parts.push(`   Status: ${p.status || p.statusPredicted || 'N/A'}`);
      }
    }
  }

  if (passiveLabor.length > 0) {
    parts.push('');
    parts.push(`Foram localizados ${passiveLabor.length} processo(s) trabalhista(s) em que o candidato figura como parte passiva (reu/reclamado/executado/recorrido). Estes nao sao considerados materialis para alteracao do veredito isoladamente.`);
  }

  return parts.join('\n');
}

function buildKeyFindings(materialCriminal, activeLabor, passiveLabor, trafficEnvOnly) {
  const findings = [];

  if (materialCriminal.length > 0) {
    findings.push(`${materialCriminal.length} processo(s) criminal(is) material(is) identificado(s).`);
  }

  if (activeLabor.length > 0) {
    findings.push(`${activeLabor.length} processo(s) trabalhista(s) como parte ativa.`);
  }

  if (passiveLabor.length > 0) {
    findings.push(`${passiveLabor.length} processo(s) trabalhista(s) como parte passiva documentado(s).`);
  }

  if (trafficEnvOnly.length > 0) {
    findings.push(`${trafficEnvOnly.length} apontamento(s) de transito/ambiental documentado(s) (nao altera veredito isoladamente).`);
  }

  return findings.slice(0, 7);
}

function buildExecutiveSummary(finalVerdict, materialCriminal, activeLabor) {
  const parts = [];
  if (finalVerdict === 'NOT_RECOMMENDED') {
    parts.push('Analise concluida com indicacao de nao recomendacao.');
  } else if (finalVerdict === 'ATTENTION') {
    parts.push('Analise concluida com pontos de atencao que exigem validacao complementar antes de qualquer decisao final.');
  } else {
    parts.push('Analise concluida sem impeditivos materiais para continuidade do fluxo interno, observados os limites das fontes consultadas.');
  }

  if (materialCriminal.length > 0) {
    parts.push(`Foram identificados ${materialCriminal.length} processo(s) criminal(is) material(is).`);
  }

  if (activeLabor.length > 0) {
    parts.push(`Foram identificados ${activeLabor.length} processo(s) trabalhista(s) em que o candidato figura como parte ativa.`);
  }

  return parts.join(' ');
}

function buildStatusSummary(verdict) {
  if (verdict === 'NOT_RECOMMENDED') return 'Concluido com indicacao de nao recomendacao.';
  if (verdict === 'ATTENTION') return 'Concluido com pontos de atencao.';
  return 'Concluido sem impeditivos materiais.';
}

function buildSourceSummary() {
  return 'Analise automatizada e revisao operacional concluidas.';
}

function buildNextSteps(verdict) {
  if (verdict === 'NOT_RECOMMENDED') return ['Revisar apontamentos materiais antes de prosseguir.'];
  if (verdict === 'ATTENTION') return ['Validar pontos de atencao identificados antes da decisao final.'];
  return ['Prosseguir com o fluxo interno.'];
}

function buildTimelineEvents(verdict, concludedAt) {
  return [
    {
      date: concludedAt || new Date().toISOString(),
      status: verdict === 'NOT_RECOMMENDED' ? 'risk' : verdict === 'ATTENTION' ? 'attention' : 'ok',
      title: verdict === 'NOT_RECOMMENDED' ? 'Caso concluido como Nao Recomendado' : verdict === 'ATTENTION' ? 'Caso concluido com Atencao' : 'Caso concluido como Apto',
      description: 'Caso concluido e revisado pela equipe operacional.',
    },
  ];
}

// =============================================================================
// MOTOR DE DECISÃO
// =============================================================================

function determineVerdictAndFlags(caseData) {
  const allProcesses = extractAllProcesses(caseData);

  const materialCriminal = allProcesses.filter(isMaterialCriminalProcess);
  const activeLabor = allProcesses.filter(isActiveLaborPartyProcess);
  const passiveLabor = allProcesses.filter(isPassiveLaborPartyProcess);
  const trafficEnvOnly = allProcesses.filter(p => isTransito(p) || isAmbiental(p));

  // DJEN nunca e fonte primaria. Filtra achados criminais que so existem no DJEN.
  const independentCriminal = materialCriminal.filter(p =>
    p._source !== 'djen' || materialCriminal.some(other => other !== p && getCnj(other) === getCnj(p))
  );
  const criminalForDecision = independentCriminal.length > 0 ? independentCriminal : [];

  // Para trabalhista ativo tambem exigimos ao menos uma fonte independente,
  // mas atualmente nao ha casos de labor_active exclusivo do DJEN.
  const independentLabor = activeLabor.filter(p =>
    p._source !== 'djen' || activeLabor.some(other => other !== p && getCnj(other) === getCnj(p))
  );
  const laborForDecision = independentLabor.length > 0 ? independentLabor : [];

  let finalVerdict = caseData.finalVerdict || 'FIT';
  let criminalFlag = caseData.criminalFlag || 'NEGATIVE';
  let criminalSeverity = caseData.criminalSeverity || null;
  let laborFlag = caseData.laborFlag || 'NEGATIVE';
  let laborSeverity = caseData.laborSeverity || null;

  const materialFindings = [];

  if (criminalForDecision.length > 0) {
    finalVerdict = 'NOT_RECOMMENDED';
    criminalFlag = 'POSITIVE';
    criminalSeverity = 'HIGH';
    for (const p of criminalForDecision) {
      materialFindings.push({
        type: 'criminal',
        source: p._source,
        cnj: getCnj(p),
        description: `${getClasse(p)} - ${getAssunto(p)} (${getTribunal(p)}). Papel: ${getRole(p)}.`,
      });
    }
  }

  // Documenta achados criminais que vieram apenas do DJEN sem mudar veredito
  const djenOnlyCriminal = materialCriminal.filter(p =>
    p._source === 'djen' && !criminalForDecision.includes(p)
  );
  if (djenOnlyCriminal.length > 0) {
    for (const p of djenOnlyCriminal) {
      materialFindings.push({
        type: 'criminal_djen_complementary',
        source: p._source,
        cnj: getCnj(p),
        description: `${getClasse(p)} - ${getAssunto(p)} (${getTribunal(p)}). Papel: ${getRole(p)}. Apontamento complementar do DJEN (busca por nome); nao altera veredito isoladamente.`,
      });
    }
  }

  if (laborForDecision.length > 0) {
    // Politica operacional para este saneamento:
    // - FIT com 2+ trabalhistas ativos sobe para NOT_RECOMMENDED.
    // - FIT com 1 trabalhista ativo sobe para ATTENTION.
    // - Casos que ja estavam em ATTENTION e so agregam trabalhistas permanecem
    //   em ATTENTION; atualizamos apenas prefill/notas com os novos achados.
    if (finalVerdict === 'FIT') {
      finalVerdict = laborForDecision.length >= 2 ? 'NOT_RECOMMENDED' : 'ATTENTION';
    }
    laborFlag = 'POSITIVE';
    laborSeverity = caseData.finalVerdict === 'ATTENTION' && criminalForDecision.length === 0
      ? (caseData.laborSeverity || 'MEDIUM')
      : laborForDecision.length >= 2 ? 'HIGH' : 'MEDIUM';
    for (const p of laborForDecision) {
      materialFindings.push({
        type: 'labor_active',
        source: p._source,
        cnj: getCnj(p),
        description: `${getClasse(p)} - ${getAssunto(p)} (${getTribunal(p)}). Papel: ${getRole(p)} (polo ativo).`,
      });
    }
  }

  // Documenta trabalhista ativo exclusivo do DJEN sem mudar veredito
  const djenOnlyLabor = activeLabor.filter(p =>
    p._source === 'djen' && !laborForDecision.includes(p)
  );
  if (djenOnlyLabor.length > 0) {
    for (const p of djenOnlyLabor) {
      materialFindings.push({
        type: 'labor_active_djen_complementary',
        source: p._source,
        cnj: getCnj(p),
        description: `${getClasse(p)} - ${getAssunto(p)} (${getTribunal(p)}). Papel: ${getRole(p)} (polo ativo). Apontamento complementar do DJEN (busca por nome); nao altera veredito isoladamente.`,
      });
    }
  }

  // Trabalhista como polo passivo: documenta sem mudar veredito
  if (passiveLabor.length > 0) {
    for (const p of passiveLabor) {
      materialFindings.push({
        type: 'labor_passive',
        source: p._source,
        cnj: getCnj(p),
        description: `${getClasse(p)} - ${getAssunto(p)} (${getTribunal(p)}). Papel: ${getRole(p)} (polo passivo). Nao altera veredito isoladamente.`,
      });
    }
  }

  // Trânsito/ambiental isolado: documenta sem mudar veredito
  if (trafficEnvOnly.length > 0) {
    for (const p of trafficEnvOnly) {
      materialFindings.push({
        type: 'traffic_env',
        source: p._source,
        cnj: getCnj(p),
        description: `${getClasse(p)} - ${getAssunto(p)} (${getTribunal(p)}). Papel: ${getRole(p)}. Nao altera veredito isoladamente.`,
      });
    }
  }

  const riskResult = calculateRisk({
    criminalFlag,
    criminalSeverity,
    laborFlag,
    laborSeverity,
    warrantFlag: caseData.warrantFlag || 'NEGATIVE',
    osintLevel: caseData.osintLevel || 'NEGATIVE',
    socialStatus: caseData.socialStatus || 'NEUTRAL',
    digitalFlag: caseData.digitalFlag || 'NEGATIVE',
    conflictInterest: caseData.conflictInterest || 'NEGATIVE',
    cpfPendingRegularization: caseData.cpfPendingRegularization === true,
  });

  return {
    finalVerdict,
    criminalFlag,
    criminalSeverity,
    laborFlag,
    laborSeverity,
    ...riskResult,
    materialFindings,
    materialCriminal: criminalForDecision,
    activeLabor: laborForDecision,
    passiveLabor,
    trafficEnvOnly,
  };
}

// =============================================================================
// CARREGAMENTO DE CASOS DA AUDITORIA
// =============================================================================

function loadAuditCaseFile(caseId) {
  const file = path.join(AUDIT_CASES_DIR, `${caseId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function mergeCaseData(auditFile) {
  const caseMeta = auditFile.caseMeta || {};
  const caseData = auditFile.caseData || {};
  const esc2 = auditFile.esc2 || {};

  return {
    ...caseMeta,
    ...caseData,
    status: caseData.status || caseMeta.status || null,
    finalVerdict: caseData.finalVerdict || caseMeta.finalVerdict || null,
    candidateName: caseData.candidateName || caseMeta.candidateName || null,
    cpf: caseData.cpf || caseMeta.cpf || null,
    escavador2Processos: esc2.processos || [],
  };
}

function listAuditCaseIds() {
  if (!fs.existsSync(AUDIT_CASES_DIR)) return [];
  return fs.readdirSync(AUDIT_CASES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

// =============================================================================
// MONTAGEM DO PLANO DE CORREÇÃO
// =============================================================================

function buildCorrectionPlan() {
  const caseIds = listAuditCaseIds();
  const plan = [];

  for (const caseId of caseIds) {
    const auditFile = loadAuditCaseFile(caseId);
    if (!auditFile) continue;

    const caseData = mergeCaseData(auditFile);
    if (caseData.status !== 'DONE') continue;

    const decision = determineVerdictAndFlags(caseData);

    // Detecta novos achados do Escavador2 (do esc2.processos) para documentar
    const esc2New = (caseData.escavador2Processos || []).filter(p => p.isNewEscavador2Finding === true && !p.isDuplicate);
    const hasNewEscavador2Finding = esc2New.length > 0;

    const verdictChanged = decision.finalVerdict !== caseData.finalVerdict;
    const needsReinforcement = caseData.finalVerdict !== 'FIT' && hasNewEscavador2Finding;

    if (!verdictChanged && !needsReinforcement) continue;

    plan.push({
      caseId,
      candidateName: caseData.candidateName,
      cpf: caseData.cpf,
      currentVerdict: caseData.finalVerdict,
      proposedVerdict: decision.finalVerdict,
      verdictChanged,
      needsReinforcement,
      flags: {
        criminalFlag: decision.criminalFlag,
        criminalSeverity: decision.criminalSeverity,
        laborFlag: decision.laborFlag,
        laborSeverity: decision.laborSeverity,
      },
      risk: {
        riskScore: decision.riskScore,
        riskLevel: decision.riskLevel,
        suggestedVerdict: decision.suggestedVerdict,
      },
      materialFindings: decision.materialFindings,
      newEscavador2Findings: esc2New.map(p => ({
        cnj: getCnj(p),
        classe: getClasse(p),
        assunto: getAssunto(p),
        tribunal: getTribunal(p),
        role: getRole(p),
      })),
      publicReportToken: caseData.publicReportToken || null,
      proposedNarratives: {
        executiveSummary: buildExecutiveSummary(decision.finalVerdict, decision.materialCriminal, decision.activeLabor),
        keyFindings: buildKeyFindings(decision.materialCriminal, decision.activeLabor, decision.passiveLabor, decision.trafficEnvOnly),
        criminalNotes: buildCriminalNotes(decision.materialCriminal, decision.passiveLabor, decision.trafficEnvOnly),
        laborNotes: buildLaborNotes(decision.activeLabor, decision.passiveLabor, decision.finalVerdict),
        statusSummary: buildStatusSummary(decision.finalVerdict),
        sourceSummary: buildSourceSummary(),
        nextSteps: buildNextSteps(decision.finalVerdict),
        timelineEvents: buildTimelineEvents(decision.finalVerdict, caseData.concludedAt),
        analystComment: `Revisao operacional de apontamentos processuais. ${decision.materialFindings.filter(f => f.type === 'criminal' || f.type === 'labor_active').map(f => f.description).join(' ')}`,
      },
    });
  }

  return plan;
}

// =============================================================================
// FIRESTORE REST HELPERS
// =============================================================================

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Firebase CLI config nao encontrado: ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) throw new Error('Refresh token nao encontrado no Firebase CLI config.');

  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
  }).toString();

  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);

  if (res.status !== 200) {
    throw new Error('Falha ao renovar access token: ' + JSON.stringify(res.body));
  }
  return res.body.access_token;
}

function fromFirestoreValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if (v.mapValue) {
    const obj = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = fromFirestoreValue(val);
    return obj;
  }
  if (v.geoPointValue) return v.geoPointValue;
  if (v.referenceValue) return v.referenceValue;
  if (v.bytesValue) return v.bytesValue;
  return v;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

async function firestoreGet(token, docPath) {
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (res.status !== 200) {
    throw new Error(`Falha ao buscar ${docPath}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const data = {};
  for (const [k, v] of Object.entries(res.body.fields || {})) data[k] = fromFirestoreValue(v);
  return data;
}

async function firestorePatch(token, docPath, fields) {
  const payload = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    payload.fields[k] = toFirestoreValue(v);
  }
  const body = JSON.stringify(payload);
  const updateMask = Object.keys(fields)
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?${updateMask}`,
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, body);
  if (res.status !== 200) {
    throw new Error(`Falha ao atualizar ${docPath}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function firestoreCreate(token, docPath, fields) {
  const payload = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    payload.fields[k] = toFirestoreValue(v);
  }
  const body = JSON.stringify(payload);
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, body);
  if (res.status !== 200) {
    throw new Error(`Falha ao criar ${docPath}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

// =============================================================================
// MONTAGEM DOS PAYLOADS DE ATUALIZACAO
// =============================================================================

function buildCoreUpdateFields(item, nowIso) {
  return {
    finalVerdict: item.proposedVerdict,
    criminalFlag: item.flags.criminalFlag,
    criminalSeverity: item.flags.criminalSeverity,
    laborFlag: item.flags.laborFlag,
    laborSeverity: item.flags.laborSeverity,
    riskScore: item.risk.riskScore,
    riskLevel: item.risk.riskLevel,
    suggestedVerdict: item.risk.suggestedVerdict,
    executiveSummary: item.proposedNarratives.executiveSummary,
    keyFindings: item.proposedNarratives.keyFindings,
    criminalNotes: item.proposedNarratives.criminalNotes,
    laborNotes: item.proposedNarratives.laborNotes,
    statusSummary: item.proposedNarratives.statusSummary,
    sourceSummary: item.proposedNarratives.sourceSummary,
    nextSteps: item.proposedNarratives.nextSteps,
    timelineEvents: item.proposedNarratives.timelineEvents,
    analystComment: item.proposedNarratives.analystComment,
    updatedAt: nowIso,
  };
}

function mergePrefillNarratives(existingPrefill, item) {
  if (!existingPrefill || typeof existingPrefill !== 'object') return undefined;
  return {
    ...existingPrefill,
    executiveSummary: item.proposedNarratives.executiveSummary,
    keyFindings: item.proposedNarratives.keyFindings,
    criminalNotes: item.proposedNarratives.criminalNotes,
    laborNotes: item.proposedNarratives.laborNotes,
    statusSummary: item.proposedNarratives.statusSummary,
    sourceSummary: item.proposedNarratives.sourceSummary,
    nextSteps: item.proposedNarratives.nextSteps,
    timelineEvents: item.proposedNarratives.timelineEvents,
    analystComment: item.proposedNarratives.analystComment,
  };
}

async function writeAuditLog(token, item, tenantId) {
  const eventId = `verdict_update_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const event = {
    occurredAt: new Date().toISOString(),
    tenantId: tenantId || 'madero-br',
    level: 'AUDIT',
    category: 'CASE',
    action: 'CASE_VERDICT_UPDATED',
    source: 'system',
    clientVisible: false,
    actor: {
      type: 'SYSTEM',
      id: 'correct-verdicts-script',
      email: null,
      displayName: 'Correcao de Vereditos',
    },
    entity: {
      type: 'CASE',
      id: item.caseId,
      label: item.candidateName || item.caseId,
    },
    related: {
      caseId: item.caseId,
      reportToken: item.publicReportToken,
      exportId: null,
      userId: null,
    },
    summary: `Veredito atualizado para ${item.proposedVerdict} apos revisao operacional de apontamentos processuais.`,
    detail: `Veredito alterado de ${item.currentVerdict} para ${item.proposedVerdict}. ${item.materialFindings.length} apontamento(s) material(is) considerado(s).`,
    metadata: {
      previousVerdict: item.currentVerdict,
      newVerdict: item.proposedVerdict,
      flags: item.flags,
      materialFindingsCount: item.materialFindings.length,
    },
    searchText: `veredito atualizado ${item.caseId} ${item.candidateName || ''} ${item.currentVerdict} ${item.proposedVerdict}`,
  };
  await firestoreCreate(token, `auditLogs/${eventId}`, event);
}

// =============================================================================
// EXECUCAO NO FIRESTORE
// =============================================================================

async function executeCorrections(plan) {
  const token = await getAccessToken();
  const report = {
    startedAt: new Date().toISOString(),
    total: plan.length,
    successful: [],
    failed: [],
    skipped: [],
  };

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    console.log(`\n[${i + 1}/${plan.length}] Processando ${item.caseId} (${item.candidateName || 'sem nome'})...`);

    try {
      // 1. Buscar case
      const caseData = await firestoreGet(token, `cases/${item.caseId}`);
      if (!caseData) {
        report.skipped.push({ caseId: item.caseId, reason: 'case not found' });
        console.log('  ⚠️  Pulado: case nao encontrado');
        continue;
      }
      if (caseData.status !== 'DONE') {
        report.skipped.push({ caseId: item.caseId, reason: `status is ${caseData.status}` });
        console.log(`  ⚠️  Pulado: status ${caseData.status}`);
        continue;
      }
      if (caseData.finalVerdict !== item.currentVerdict) {
        report.skipped.push({
          caseId: item.caseId,
          reason: `current verdict ${caseData.finalVerdict} != expected ${item.currentVerdict}`,
        });
        console.log(`  ⚠️  Pulado: veredito atual ${caseData.finalVerdict} != esperado ${item.currentVerdict}`);
        continue;
      }

      const nowIso = new Date();
      const coreFields = buildCoreUpdateFields(item, nowIso);

      // 2. Atualizar cases/{caseId}
      const caseUpdate = { ...coreFields };
      const prefill = mergePrefillNarratives(caseData.prefillNarratives, item);
      if (prefill) caseUpdate.prefillNarratives = prefill;
      await firestorePatch(token, `cases/${item.caseId}`, caseUpdate);

      // 3. Atualizar cases/{caseId}/publicResult/latest se existir
      const publicResult = await firestoreGet(token, `cases/${item.caseId}/publicResult/latest`);
      if (publicResult) {
        await firestorePatch(token, `cases/${item.caseId}/publicResult/latest`, coreFields);
        console.log('  ✅ publicResult/latest atualizado');
      } else {
        console.log('  ℹ️  publicResult/latest nao existe, ignorado');
      }

      // 4. Atualizar clientCases/{caseId} se existir
      const clientCase = await firestoreGet(token, `clientCases/${item.caseId}`);
      if (clientCase) {
        await firestorePatch(token, `clientCases/${item.caseId}`, coreFields);
        console.log('  ✅ clientCases atualizado');
      } else {
        console.log('  ℹ️  clientCases nao existe, ignorado');
      }

      // 5. Escrever audit log
      await writeAuditLog(token, item, caseData.tenantId);

      report.successful.push({ caseId: item.caseId, from: item.currentVerdict, to: item.proposedVerdict });
      console.log(`  ✅ cases atualizado: ${item.currentVerdict} -> ${item.proposedVerdict}`);
    } catch (err) {
      console.error(`  ❌ Erro: ${err.message}`);
      report.failed.push({ caseId: item.caseId, error: err.message });
    }

    // Rate limiting
    await new Promise((r) => setTimeout(r, 150));
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_OUTPUT, JSON.stringify(report, null, 2));
  console.log(`\nRelatorio de execucao salvo em ${REPORT_OUTPUT}`);
  console.log(`Sucesso: ${report.successful.length} | Falhas: ${report.failed.length} | Pulados: ${report.skipped.length}`);
}

// =============================================================================
// ARTEFATOS DO PLANO (resumos para revisao humana)
// =============================================================================

function generateSummaryMarkdown(plan) {
  const verdictChanges = plan.filter(p => p.verdictChanged);
  const reinforcements = plan.filter(p => p.needsReinforcement);
  const byVerdict = {};
  for (const item of plan) {
    byVerdict[item.proposedVerdict] = (byVerdict[item.proposedVerdict] || 0) + 1;
  }

  const transitions = {};
  for (const item of verdictChanges) {
    const key = `${item.currentVerdict} -> ${item.proposedVerdict}`;
    transitions[key] = (transitions[key] || 0) + 1;
  }

  const priorityFit = plan.filter(p => p.currentVerdict === 'FIT' && p.newEscavador2Findings.length > 0);

  const lines = [];
  lines.push('# Resumo do Plano de Correcao de Vereditos - Escavador2 Audit');
  lines.push('');
  lines.push(`**Data de geracao:** ${new Date().toISOString()}`);
  lines.push(`**Total de casos no plano:** ${plan.length}`);
  lines.push(`**Casos com mudanca de veredito:** ${verdictChanges.length}`);
  lines.push(`**Casos para reforco (ja negativos com novos achados):** ${reinforcements.length}`);
  lines.push('');
  lines.push('## Distribuicao por veredito proposto');
  for (const [verdict, count] of Object.entries(byVerdict)) {
    lines.push(`- ${verdict}: ${count}`);
  }
  lines.push('');
  lines.push('## Mudancas de veredito');
  for (const [transition, count] of Object.entries(transitions)) {
    lines.push(`- ${transition}: ${count}`);
  }
  lines.push('');
  lines.push(`## Casos FIT prioritarios (novos achados Escavador2)`);
  lines.push(`Total: ${priorityFit.length}`);
  lines.push('');
  for (const item of priorityFit) {
    lines.push(`### ${item.caseId} | ${item.candidateName} | CPF: ${item.cpf}`);
    lines.push(`- **Veredito atual:** ${item.currentVerdict}`);
    lines.push(`- **Veredito proposto:** ${item.proposedVerdict}`);
    lines.push(`- **Flags propostas:** criminal=${item.flags.criminalFlag}(${item.flags.criminalSeverity || 'null'}), labor=${item.flags.laborFlag}(${item.flags.laborSeverity || 'null'})`);
    lines.push(`- **Risco:** ${item.risk.riskLevel} (${item.risk.riskScore})`);
    lines.push('- **Achados materiais:**');
    for (const f of item.materialFindings) {
      lines.push(`  - [${f.source}] ${f.type}: ${f.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function escapeCsv(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  if (/[",\n]/.test(str)) return `"${str}"`;
  return str;
}

function generatePriorityFitCsv(plan) {
  const priorityFit = plan.filter(p => p.currentVerdict === 'FIT' && p.newEscavador2Findings.length > 0);
  const header = ['caseId', 'candidateName', 'cpf', 'currentVerdict', 'proposedVerdict', 'criminalFlag', 'criminalSeverity', 'laborFlag', 'laborSeverity', 'riskScore', 'riskLevel', 'newEscavador2Count', 'materialFindings'];
  const lines = [header.join(',')];
  for (const item of priorityFit) {
    const findings = item.materialFindings.map(f => `[${f.source}] ${f.type}: ${f.description}`).join(' | ');
    lines.push([
      escapeCsv(item.caseId),
      escapeCsv(item.candidateName),
      escapeCsv(item.cpf),
      escapeCsv(item.currentVerdict),
      escapeCsv(item.proposedVerdict),
      escapeCsv(item.flags.criminalFlag),
      escapeCsv(item.flags.criminalSeverity),
      escapeCsv(item.flags.laborFlag),
      escapeCsv(item.flags.laborSeverity),
      escapeCsv(item.risk.riskScore),
      escapeCsv(item.risk.riskLevel),
      escapeCsv(item.newEscavador2Findings.length),
      escapeCsv(findings),
    ].join(','));
  }
  return lines.join('\n');
}

function generateSummaryJson(plan) {
  const verdictChanges = plan.filter(p => p.verdictChanged);
  const reinforcements = plan.filter(p => p.needsReinforcement);
  const byVerdict = {};
  for (const item of plan) {
    byVerdict[item.proposedVerdict] = (byVerdict[item.proposedVerdict] || 0) + 1;
  }
  const transitions = {};
  for (const item of verdictChanges) {
    const key = `${item.currentVerdict} -> ${item.proposedVerdict}`;
    transitions[key] = (transitions[key] || 0) + 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    totalCases: plan.length,
    verdictChanges: verdictChanges.length,
    reinforcements: reinforcements.length,
    byProposedVerdict: byVerdict,
    transitions,
    priorityFitCases: plan
      .filter(p => p.currentVerdict === 'FIT' && p.newEscavador2Findings.length > 0)
      .map(p => ({
        caseId: p.caseId,
        candidateName: p.candidateName,
        cpf: p.cpf,
        currentVerdict: p.currentVerdict,
        proposedVerdict: p.proposedVerdict,
        newEscavador2FindingsCount: p.newEscavador2Findings.length,
      })),
  };
}

function savePlanArtifacts(plan) {
  const summaryMd = generateSummaryMarkdown(plan);
  const priorityCsv = generatePriorityFitCsv(plan);
  const summaryJson = generateSummaryJson(plan);

  const summaryMdPath = path.join(OUTPUT_DIR, 'correction-plan-summary.md');
  const priorityCsvPath = path.join(OUTPUT_DIR, 'priority-fit-corrections.csv');
  const summaryJsonPath = path.join(OUTPUT_DIR, 'correction-summary.json');

  fs.writeFileSync(summaryMdPath, summaryMd);
  fs.writeFileSync(priorityCsvPath, priorityCsv);
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summaryJson, null, 2));

  console.log(`\nArtefatos de revisao salvos:`);
  console.log(`  - ${summaryMdPath}`);
  console.log(`  - ${priorityCsvPath}`);
  console.log(`  - ${summaryJsonPath}`);
}

function parseOption(args, name) {
  const prefix = `--${name}=`;
  const match = args.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function parseCaseIds(args) {
  const values = [];
  for (const arg of args) {
    if (arg.startsWith('--case-id=')) values.push(arg.slice('--case-id='.length));
    if (arg.startsWith('--case-ids=')) {
      values.push(...arg.slice('--case-ids='.length).split(',').map(s => s.trim()).filter(Boolean));
    }
  }
  return new Set(values);
}

function filterPlan(plan, args) {
  const group = parseOption(args, 'group') || 'all';
  const limitRaw = parseOption(args, 'limit');
  const limit = limitRaw ? Number(limitRaw) : null;
  const caseIds = parseCaseIds(args);

  let selected = plan;
  if (caseIds.size > 0) {
    selected = selected.filter(item => caseIds.has(item.caseId));
  }

  if (group !== 'all') {
    selected = selected.filter((item) => {
      if (group === 'fit-not') return item.currentVerdict === 'FIT' && item.proposedVerdict === 'NOT_RECOMMENDED';
      if (group === 'fit-attention') return item.currentVerdict === 'FIT' && item.proposedVerdict === 'ATTENTION';
      if (group === 'attention-not') return item.currentVerdict === 'ATTENTION' && item.proposedVerdict === 'NOT_RECOMMENDED';
      if (group === 'reinforce-attention') return item.currentVerdict === 'ATTENTION' && item.proposedVerdict === 'ATTENTION';
      if (group === 'reinforce-not') return item.currentVerdict === 'NOT_RECOMMENDED' && item.proposedVerdict === 'NOT_RECOMMENDED';
      if (group === 'changes') return item.verdictChanged;
      if (group === 'reinforcements') return !item.verdictChanged && item.needsReinforcement;
      if (group === 'criminal') return hasMaterialCriminalFinding(item);
      throw new Error(`Grupo desconhecido: ${group}`);
    });
  }

  if (limit !== null) {
    if (!Number.isInteger(limit) || limit <= 0) throw new Error('--limit deve ser um inteiro positivo.');
    selected = selected.slice(0, limit);
  }

  return { selected, group, limit, caseIds };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  const yes = args.includes('--yes');

  if (!dryRun && !apply) {
    console.error('Uso: node scripts/correct-verdicts-after-escavador2-audit.cjs --dry-run');
    console.error('     node scripts/correct-verdicts-after-escavador2-audit.cjs --apply --yes');
    process.exit(1);
  }

  console.log('[1/3] Montando plano de correcao...');
  const plan = buildCorrectionPlan();
  fs.writeFileSync(PLAN_OUTPUT, JSON.stringify(plan, null, 2));
  const { selected, group, limit, caseIds } = filterPlan(plan, args);
  fs.writeFileSync(SELECTED_PLAN_OUTPUT, JSON.stringify(selected, null, 2));
  savePlanArtifacts(selected);
  console.log(`Plano completo salvo em ${PLAN_OUTPUT} (${plan.length} casos).`);
  console.log(`Lote selecionado salvo em ${SELECTED_PLAN_OUTPUT} (${selected.length} casos).`);
  console.log(`Filtro: group=${group}${limit ? `, limit=${limit}` : ''}${caseIds.size > 0 ? `, caseIds=${[...caseIds].join(',')}` : ''}`);

  const byVerdict = {};
  const reinforcements = [];
  for (const item of selected) {
    byVerdict[item.proposedVerdict] = (byVerdict[item.proposedVerdict] || 0) + 1;
    if (!item.verdictChanged && item.needsReinforcement) reinforcements.push(item);
  }

  console.log('\nResumo do plano:');
  console.log('  Total de casos:', selected.length);
  console.log('  Mudancas de veredito:', selected.filter(p => p.verdictChanged).length);
  console.log('  Reforcos em NOT_RECOMMENDED/ATTENTION:', reinforcements.length);
  console.log('  Distribuicao de vereditos propostos:', byVerdict);

  if (dryRun) {
    console.log('\nModo dry-run. Nenhuma alteracao foi feita no Firestore.');
    return;
  }

  if (apply && !yes) {
    console.error('Erro: --apply requer --yes para confirmar a execucao real.');
    process.exit(1);
  }

  console.log('\n[2/3] Executando correcoes no Firestore...');
  await executeCorrections(selected);

  console.log('[3/3] Concluido. Relatorio salvo em', REPORT_OUTPUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
