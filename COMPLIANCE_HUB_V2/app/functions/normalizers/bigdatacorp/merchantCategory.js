function normalizeMerchantCategory(bdcResult) {
  if (!bdcResult) return null;
  return {
    merchantCategory: bdcResult.MerchantCategory || null,
    mcc: bdcResult.MCC || null,
  };
}
function buildMerchantCategoryEvidence(data) {
  if (!data || !data.merchantCategory) return null;
  return `Categoria: ${data.merchantCategory}`;
}
module.exports = { normalizeMerchantCategory, buildMerchantCategoryEvidence };
