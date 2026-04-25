/**
 * Normalizer: BigDataCorp Media Profile and Exposure
 */

function normalizeMediaProfile(bdcResult) {
  if (!bdcResult) return null;

  return {
    mediaExposureLevel: bdcResult.MediaExposureLevel || null,
    celebrityLevel: bdcResult.CelebrityLevel || null,
    unpopularityLevel: bdcResult.UnpopularityLevel || null,
    newsItems: bdcResult.NewsItems || [],
    searchLabels: bdcResult.SearchLabels || null,
    totalPages: bdcResult.TotalPages || 0,
    entityStatistics: bdcResult.EntityStatistics || null,
  };
}

function buildMediaProfileEvidence(profile) {
  if (!profile) return null;
  const parts = [];
  if (profile.mediaExposureLevel) parts.push(`Exposição Mídia: ${profile.mediaExposureLevel}`);
  if (profile.celebrityLevel) parts.push(`Celebridade: ${profile.celebrityLevel}`);
  if (profile.unpopularityLevel) parts.push(`Impopularidade: ${profile.unpopularityLevel}`);
  if (profile.newsItems?.length) parts.push(`${profile.newsItems.length} notícias`);
  return parts.length ? parts.join(' | ') : null;
}

module.exports = {
  normalizeMediaProfile,
  buildMediaProfileEvidence,
};
