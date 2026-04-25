/**
 * Normalizer: BigDataCorp Online Presence
 * Transforms BDC online_presence response into canonical digital profile data.
 */

/**
 * Normalize online presence data.
 * @param {object} bdcResult — Result[0].OnlinePresence
 * @returns {object|null}
 */
function normalizeOnlinePresence(bdcResult) {
  if (!bdcResult) return null;

  return {
    internetUsageLevel: bdcResult.InternetUsageLevel || bdcResult.InternetUsageLevel_v2 || bdcResult.InternetUsageLevel_v3 || '',
    totalWebPassages: bdcResult.TotalWebPassages || bdcResult.WebPassages || 0,
    last30DaysWebPassages: bdcResult.Last30DaysWebPassages || 0,
    last90DaysWebPassages: bdcResult.Last90DaysWebPassages || 0,
    last180DaysWebPassages: bdcResult.Last180DaysWebPassages || 0,
    last365DaysWebPassages: bdcResult.Last365DaysWebPassages || 0,
    firstWebPassageDate: bdcResult.FirstWebPassageDate || null,
    lastWebPassageDate: bdcResult.LastWebPassageDate || null,
    eSellerLevel: bdcResult.Eseller || bdcResult.Eseller_v2 || bdcResult.Eseller_v3 || '',
    eShopperLevel: bdcResult.Eshopper || bdcResult.Eshopper_v2 || bdcResult.Eshopper_v3 || '',
    creationDate: bdcResult.CreationDate || null,
    lastUpdateDate: bdcResult.LastUpdateDate || null,
  };
}

/**
 * Build an EvidenceItem content block from normalized online presence.
 * @param {object} normalized
 * @returns {object}
 */
function buildOnlinePresenceEvidenceContent(normalized) {
  if (!normalized) {
    return { text: 'Nenhum dado de presença online encontrado.' };
  }

  const paragraphs = [];

  if (normalized.internetUsageLevel) {
    paragraphs.push(`Nível de uso da internet: ${normalized.internetUsageLevel}.`);
  }
  if (normalized.totalWebPassages > 0) {
    paragraphs.push(`Total de ${normalized.totalWebPassages} passagem(ns) web registrada(s).`);
  }
  if (normalized.eSellerLevel) {
    paragraphs.push(`Perfil de vendedor online: ${normalized.eSellerLevel}.`);
  }
  if (normalized.eShopperLevel) {
    paragraphs.push(`Perfil de comprador online: ${normalized.eShopperLevel}.`);
  }

  return {
    text: paragraphs.join(' ') || 'Presença online mínima ou não detectada.',
    webPassages: {
      total: normalized.totalWebPassages,
      last30Days: normalized.last30DaysWebPassages,
      last90Days: normalized.last90DaysWebPassages,
      last365Days: normalized.last365DaysWebPassages,
    },
    levels: {
      internetUsage: normalized.internetUsageLevel,
      eSeller: normalized.eSellerLevel,
      eShopper: normalized.eShopperLevel,
    },
  };
}

module.exports = {
  normalizeOnlinePresence,
  buildOnlinePresenceEvidenceContent,
};
