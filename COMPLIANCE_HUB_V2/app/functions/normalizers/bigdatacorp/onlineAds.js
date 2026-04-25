/**
 * Normalizer for BDC online_ads dataset (PJ)
 */

function normalizeOnlineAds(raw) {
    if (!raw || typeof raw !== 'object') {
        return { hasAds: false, platforms: [], adCount: 0 };
    }

    const ads = raw.Ads || raw.ads || [];
    const platforms = raw.Platforms || raw.platforms || [];

    return {
        hasAds: Array.isArray(ads) && ads.length > 0,
        platforms: Array.isArray(platforms) ? platforms : [],
        adCount: Array.isArray(ads) ? ads.length : 0,
        rawSummary: raw.Summary || raw.summary || null,
    };
}

function buildOnlineAdsEvidence(data) {
    if (!data || !data.hasAds) return null;
    const platforms = data.platforms.join(', ');
    return `Anúncios online detectados: ${data.adCount} anúncio(s) em ${platforms}.`;
}

module.exports = {
    normalizeOnlineAds,
    buildOnlineAdsEvidence,
};
