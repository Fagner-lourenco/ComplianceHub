/**
 * Normalizer: BigDataCorp Collections
 * Transforms BDC collections response into canonical collection/debt data.
 */

/**
 * Normalize collections data.
 * @param {object} bdcResult — Result[0].Collections
 * @returns {object|null}
 */
function normalizeCollections(bdcResult) {
  if (!bdcResult) return null;

  const companies = Array.isArray(bdcResult.CollectionCompanies)
    ? bdcResult.CollectionCompanies.map(c => ({
        name: c.Name || '',
        cnpj: c.CNPJ || c.TaxId || '',
        startDate: c.StartDate || null,
        endDate: c.EndDate || null,
        isActive: c.IsActive === true || !c.EndDate,
      }))
    : [];

  return {
    isPresentInCollection: bdcResult.IsPresentInCollection === true,
    collectionCompanies: companies,
    totalCompanies: companies.length,
    activeCompanies: companies.filter(c => c.isActive).length,
  };
}

/**
 * Build an EvidenceItem content block from normalized collections.
 * @param {object} normalized
 * @returns {object}
 */
function buildCollectionsEvidenceContent(normalized) {
  if (!normalized) {
    return { text: 'Nenhum dado de cobrança encontrado.' };
  }

  if (!normalized.isPresentInCollection) {
    return { text: 'Nenhuma presença em empresas de cobrança identificada.' };
  }

  const paragraphs = [
    `Presença em ${normalized.totalCompanies} empresa(s) de cobrança detectada.`,
  ];

  if (normalized.activeCompanies > 0) {
    paragraphs.push(`${normalized.activeCompanies} relacionamento(s) ativo(s) atualmente.`);
  }

  return {
    text: paragraphs.join(' '),
    isPresentInCollection: normalized.isPresentInCollection,
    totalCompanies: normalized.totalCompanies,
    activeCompanies: normalized.activeCompanies,
    companies: normalized.collectionCompanies,
  };
}

module.exports = {
  normalizeCollections,
  buildCollectionsEvidenceContent,
};
