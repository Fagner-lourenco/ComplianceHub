const { isExcludedCrimeType, hasCriminalIndicator } = require('./crimeTypeFilter');
const { classifyRole, normalizeSideForClassifier, normalizeLegalText } = require('./roleClassifier');

const ATTENTION_EXCLUSION_REASONS = new Set(['TRANSITO', 'AMBIENTAL', 'HTE', 'CARTA_PRECATORIA_NOISE']);
const IGNORE_ROLE_CATEGORIES = new Set(['VICTIM', 'WITNESS', 'LAWYER', 'AUTHORITY']);
const MATERIAL_ROLE_CATEGORIES = new Set(['DEFENDANT']);
// Papéis compostos vindos crus dos providers ("VITIMA DE ESTELIONATO",
// "TESTEMUNHA DE DEFESA") não casam as regexes ancoradas do roleClassifier.
const LOW_RISK_ROLE_TEXT_PATTERN = /\b(VITIMA|OFENDID[OA]|PREJUDICAD[OA]|AGRAVIAD[OA]|LESAD[OA]|TESTEMUNHA|INFORMANTE)\b/;

function resolveRoleText(process = {}) {
  return process.specificRole
    || process.matchedRole
    || process.tipoPrincipal
    || process.tipoNormalizado
    || process.personType
    || process.partyType
    || process.polo
    || process.role
    || null;
}

function resolveAreaText(process = {}) {
  if (process.isCriminal === true) return 'Criminal';
  return process.area
    || process.courtType
    || process.cnjBroadSubject
    || process.justice
    || '';
}

function inferIsCriminal(process = {}) {
  if (process.isCriminal === true) return true;
  // Flag explícita do normalizer tem precedência: cível/trabalhista com
  // palavra-chave criminal no assunto NÃO vira criminal por inferência.
  if (process.isCriminal === false) return false;
  return hasCriminalIndicator(process);
}

function classifyCriminalMateriality(process = {}) {
  if (process
    && typeof process.isMaterial === 'boolean'
    && typeof process.requiresAttention === 'boolean'
    && typeof process.isLowRiskRole === 'boolean') {
    return process;
  }

  const isCriminal = inferIsCriminal(process);
  const exclusionReason = isExcludedCrimeType(process);
  const roleText = resolveRoleText(process);
  const roleClassification = process.roleClassification || classifyRole(
    roleText,
    resolveAreaText(process),
    normalizeSideForClassifier(process.side || process.polo),
  );
  const roleCategory = roleClassification.category || null;
  const roleRiskLevel = roleClassification.riskLevel || null;
  const isLowRiskRole = process.isVictim === true
    || process.isWitness === true
    || IGNORE_ROLE_CATEGORIES.has(roleCategory)
    || LOW_RISK_ROLE_TEXT_PATTERN.test(normalizeLegalText(roleText));
  // riskLevel HIGH sozinho não basta: reclamante trabalhista também é HIGH.
  const hasMaterialRole = process.isDefendant === true
    || MATERIAL_ROLE_CATEGORIES.has(roleCategory)
    || process.isMaterialRisk === true;
  const isReviewWorthyExclusion = ATTENTION_EXCLUSION_REASONS.has(exclusionReason);
  const isExcluded = Boolean(exclusionReason);
  const isMaterial = isCriminal
    && !isLowRiskRole
    && !isExcluded
    && hasMaterialRole;
  const requiresAttention = isCriminal
    && !isLowRiskRole
    && (isMaterial || isReviewWorthyExclusion || roleCategory === 'OTHER' || roleCategory === 'UNKNOWN');

  return {
    isCriminal,
    isMaterial,
    requiresAttention,
    isLowRiskRole,
    isExcluded,
    exclusionReason: exclusionReason || null,
    roleCategory,
    roleRiskLevel,
    materialReason: isMaterial ? 'Papel material em processo criminal' : null,
    reviewReason: requiresAttention && !isMaterial
      ? (exclusionReason ? `Revisar achado criminal classificado como ${exclusionReason}` : 'Papel criminal neutro ou indeterminado requer revisão')
      : null,
  };
}

function isCriminalMaterial(process = {}) {
  return classifyCriminalMateriality(process).isMaterial === true;
}

function requiresCriminalAttention(process = {}) {
  return classifyCriminalMateriality(process).requiresAttention === true;
}

module.exports = {
  classifyCriminalMateriality,
  isCriminalMaterial,
  requiresCriminalAttention,
};
