/**
 * Helper: Hash
 * SHA-256 generation for docHash (BDC privacy) and cache keys.
 */

const crypto = require('crypto');

/**
 * Generate SHA-256 hash of a string.
 * @param {string} input
 * @returns {string} hex-encoded hash
 */
function sha256(input) {
  return crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');
}

/**
 * Generate docHash for BigDataCorp queries.
 * BDC accepts dochash{SHA256} instead of doc{CPF} for privacy.
 * @param {string} document — CPF or CNPJ (digits only)
 * @returns {string} SHA-256 hash
 */
function docHash(document) {
  return sha256(String(document).trim());
}

/**
 * Generate cache key for Provider Ledger.
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.provider
 * @param {string} params.endpoint
 * @param {string} params.dataset
 * @param {string} params.docHash
 * @returns {string}
 */
function providerCacheKey({ tenantId, provider, endpoint, dataset, docHash }) {
  return sha256(`${tenantId}:${provider}:${endpoint}:${dataset}:${docHash}`);
}

module.exports = { sha256, docHash, providerCacheKey };
