/**
 * Normalizer: BigDataCorp Relationships (QSA)
 * Transforms BDC relationships response into canonical graph nodes/edges.
 */

/**
 * Normalize relationships data (QSA).
 * @param {object} bdcResult — Result[0].Relationships or Result[0].DynamicQsaData
 * @returns {object|null}
 */
function normalizeRelationships(bdcResult) {
  if (!bdcResult) return null;

  const relationships = Array.isArray(bdcResult)
    ? bdcResult
    : bdcResult.Relationships || bdcResult.Qsa || [];

  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  function getNodeId(document, name) {
    const key = `${document}_${name}`;
    if (!nodeMap.has(key)) {
      const id = `node_${nodeMap.size}`;
      nodeMap.set(key, id);
      nodes.push({
        id,
        type: document.length === 11 ? 'pf' : 'pj',
        name,
        document,
      });
    }
    return nodeMap.get(key);
  }

  for (const rel of relationships) {
    const fromId = getNodeId(rel.TaxId || rel.Doc || '', rel.Name || '');
    const toId = getNodeId(rel.RelatedTaxId || '', rel.RelatedName || '');

    edges.push({
      from: fromId,
      to: toId,
      relation: rel.Type || 'Sócio',
      percentage: rel.OwnershipPercentage || null,
      startDate: rel.StartDate || null,
    });
  }

  return { nodes, edges, count: relationships.length };
}

/**
 * Build an EvidenceItem content block from normalized relationships.
 * @param {object} normalized
 * @returns {object}
 */
function buildRelationshipEvidenceContent(normalized) {
  if (!normalized || normalized.count === 0) {
    return { text: 'Nenhum relacionamento societário encontrado.' };
  }

  return {
    text: `${normalized.count} relacionamento(s) societário(s) encontrado(s).`,
    relationshipGraph: {
      nodes: normalized.nodes,
      edges: normalized.edges,
    },
  };
}

module.exports = { normalizeRelationships, buildRelationshipEvidenceContent };
