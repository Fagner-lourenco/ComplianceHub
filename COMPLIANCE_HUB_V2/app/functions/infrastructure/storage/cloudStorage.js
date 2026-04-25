/**
 * Infrastructure: Cloud Storage
 * Helpers for uploading/downloading large payloads and PDFs.
 */

const { getStorage } = require('firebase-admin/storage');

const storage = getStorage();
const bucket = storage.bucket();

/**
 * Upload a JSON payload to Cloud Storage if it exceeds max size.
 * @param {string} path — GCS path (e.g. 'raw-snapshots/tenantId/docId.json')
 * @param {object} payload
 * @param {number} [maxSizeBytes=1_048_576] — 1MB default
 * @returns {Promise<{stored: boolean, path?: string, size: number}>}
 */
async function uploadJsonIfLarge(path, payload, maxSizeBytes = 1_048_576) {
  const jsonString = JSON.stringify(payload);
  const size = Buffer.byteLength(jsonString, 'utf8');

  if (size <= maxSizeBytes) {
    return { stored: false, size };
  }

  const file = bucket.file(path);
  await file.save(jsonString, {
    contentType: 'application/json',
    metadata: { size },
  });

  return { stored: true, path: `gs://${bucket.name}/${path}`, size };
}

/**
 * Download a JSON payload from Cloud Storage.
 * @param {string} path — GCS path
 * @returns {Promise<object>}
 */
async function downloadJson(path) {
  const file = bucket.file(path.replace(`gs://${bucket.name}/`, ''));
  const [content] = await file.download();
  return JSON.parse(content.toString('utf8'));
}

module.exports = { uploadJsonIfLarge, downloadJson };
