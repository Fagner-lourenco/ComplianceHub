/**
 * Application: Add Comment Use Case
 */

const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

/**
 * Add a comment to a dossier.
 * @param {object} params
 * @param {string} params.caseId
 * @param {string} params.tenantId
 * @param {string} params.authorId
 * @param {string} params.authorName
 * @param {string} params.authorRole
 * @param {string} params.text
 * @param {'comment'|'analysis'|'review'} [params.type='comment']
 * @param {string} [params.evidenceItemId]
 * @param {string} [params.sectionKey]
 * @param {boolean} [params.isRelevant=false]
 * @param {boolean} [params.isConclusive=false]
 * @returns {Promise<object>}
 */
async function execute(params) {
  const {
    caseId,
    tenantId,
    authorId,
    authorName,
    authorRole,
    text,
    type = 'comment',
    evidenceItemId,
    sectionKey,
    isRelevant = false,
    isConclusive = false,
  } = params;

  if (!text || text.trim().length === 0) {
    const error = new Error('Texto do comentário é obrigatório.');
    error.code = 'INVALID_ARGUMENT';
    error.statusCode = 400;
    throw error;
  }

  const commentRef = db.collection('comments').doc();
  const now = new Date();

  const data = {
    tenantId,
    caseId,
    type,
    text: text.trim(),
    authorId,
    authorName,
    authorRole,
    evidenceItemId: evidenceItemId || null,
    sectionKey: sectionKey || null,
    isRelevant,
    isConclusive,
    createdAt: now,
    updatedAt: now,
  };

  await commentRef.set(data);

  // If conclusive, update case analysis
  if (isConclusive) {
    await db.collection('cases').doc(caseId).update({
      'analysis.conclusive': text.trim(),
      updatedAt: now,
    });
  }

  return { id: commentRef.id, ...data };
}

module.exports = { execute };
