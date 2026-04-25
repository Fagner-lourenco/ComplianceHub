/**
 * Normalizer: BigDataCorp Government Debtors
 * Transforms BDC government_debtors response into canonical debt data.
 */

/**
 * Normalize government debtors data.
 * @param {object} bdcResult — Result[0].GovernmentDebtors
 * @returns {object|null}
 */
function normalizeGovernmentDebtors(bdcResult) {
  if (!bdcResult) return null;

  return {
    isGovernmentDebtor: bdcResult.IsGovernmentDebtor === true,
    debtAmount: bdcResult.DebtAmount || null,
    debtType: bdcResult.DebtType || '',
    organ: bdcResult.Organ || '',
    description: bdcResult.Description || '',
    referenceDate: bdcResult.ReferenceDate || null,
  };
}

/**
 * Build an EvidenceItem content block from normalized government debtors.
 * @param {object} normalized
 * @returns {object}
 */
function buildGovernmentDebtorsEvidenceContent(normalized) {
  if (!normalized) {
    return { text: 'Nenhum dado de dívida com o governo encontrado.' };
  }

  if (!normalized.isGovernmentDebtor) {
    return { text: 'Nenhuma dívida ativa com o governo identificada.' };
  }

  const paragraphs = [
    `Dívida com o governo detectada: ${normalized.debtType || 'não especificado'}.`,
  ];

  if (normalized.debtAmount) {
    paragraphs.push(`Valor: R$ ${normalized.debtAmount}.`);
  }
  if (normalized.organ) {
    paragraphs.push(`Órgão credor: ${normalized.organ}.`);
  }

  return {
    text: paragraphs.join(' '),
    isGovernmentDebtor: normalized.isGovernmentDebtor,
    debtAmount: normalized.debtAmount,
    debtType: normalized.debtType,
    organ: normalized.organ,
  };
}

module.exports = {
  normalizeGovernmentDebtors,
  buildGovernmentDebtorsEvidenceContent,
};
