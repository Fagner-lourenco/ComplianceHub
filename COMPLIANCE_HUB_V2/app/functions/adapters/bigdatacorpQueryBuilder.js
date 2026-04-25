/**
 * BigDataCorp Query Builder
 * Constructs BDC Datasets strings and request bodies programmatically.
 *
 * BDC Datasets syntax:
 *   basic_data{Name,TaxId,BirthDate}
 *   processes.limit(100).filter(party_type=defendant)
 *   emails.order(LastSeen=descending)
 *   media_profile_and_exposure.next(AoJw14Wy...)
 */

class BdcQueryBuilder {
  constructor() {
    this.datasetExpressions = [];
  }

  /**
   * Add a dataset with optional modifiers.
   * @param {string} datasetKey — e.g. 'basic_data', 'processes'
   * @param {object} options
   * @param {string[]} [options.fields] — Field selection: {field1,field2}
   * @param {string} [options.filter] — Filter expression
   * @param {string} [options.order] — Order expression
   * @param {number} [options.limit] — Max records
   * @param {string} [options.next] — Pagination token
   * @returns {BdcQueryBuilder}
   */
  addDataset(datasetKey, options = {}) {
    let expr = datasetKey;

    if (options.fields?.length) {
      expr += `{${options.fields.join(',')}}`;
    }
    if (options.filter) {
      expr += `.filter(${options.filter})`;
    }
    if (options.order) {
      expr += `.order(${options.order})`;
    }
    if (options.limit && options.limit > 0) {
      expr += `.limit(${options.limit})`;
    }
    if (options.next) {
      expr += `.next(${options.next})`;
    }

    this.datasetExpressions.push(expr);
    return this;
  }

  /**
   * Add multiple datasets at once.
   * @param {Array<{key: string, options?: object}>} datasets
   * @returns {BdcQueryBuilder}
   */
  addDatasets(datasets) {
    for (const ds of datasets) {
      this.addDataset(ds.key, ds.options);
    }
    return this;
  }

  /**
   * Build the complete request body.
   * @param {string} queryKey — e.g. 'doc{05023290336}' or 'dochash{SHA256...}'
   * @param {object} [options]
   * @param {number} [options.limit=1] — Max entities returned
   * @param {object} [options.tags] — Tracking tags
   * @returns {object} BDC request body
   */
  buildBody(queryKey, options = {}) {
    const body = {
      q: `${queryKey} returnupdates{false}`,
      Datasets: this.datasetExpressions.join(','),
      Limit: options.limit || 1,
    };

    if (options.tags && Object.keys(options.tags).length > 0) {
      body.Tags = options.tags;
    }

    return body;
  }

  /**
   * Get the raw Datasets string (for debugging).
   * @returns {string}
   */
  buildDatasetsString() {
    return this.datasetExpressions.join(',');
  }

  /**
   * Reset the builder.
   * @returns {BdcQueryBuilder}
   */
  reset() {
    this.datasetExpressions = [];
    return this;
  }
}

// =============================================================================
// Preset-based builders
// =============================================================================

/**
 * Build a combined query for a preset.
 * @param {string} presetKey
 * @param {'pf' | 'pj'} subjectType
 * @param {string} document — CPF or CNPJ (digits only)
 * @param {object} [options]
 * @returns {object} { body, cost }
 */
function buildPresetQuery(presetKey, subjectType, document, options = {}) {
  const { getDatasetsForPreset, getCost } = require('./bigdatacorpCatalog');
  const datasetKeys = getDatasetsForPreset(presetKey, subjectType);

  const builder = new BdcQueryBuilder();
  for (const key of datasetKeys) {
    const dsOptions = {};
    if (key === 'processes') {
      dsOptions.limit = options.processLimit || 100;
    }
    builder.addDataset(key, dsOptions);
  }

  const useHash = options.useHash !== false;
  const queryKey = useHash
    ? `dochash{${require('../helpers/hash').docHash(document)}}`
    : `doc{${document}}`;

  const body = builder.buildBody(queryKey, {
    tags: {
      host: 'compliance-hub-v2',
      process: 'dossier_enrichment',
      environment: process.env.NODE_ENV || 'production',
      dossierId: options.dossierId || '',
    },
  });

  const cost = datasetKeys.reduce((sum, key) => sum + getCost(key, subjectType), 0);

  return { body, cost, datasetKeys };
}

module.exports = { BdcQueryBuilder, buildPresetQuery };
