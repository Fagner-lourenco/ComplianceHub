/**
 * Controller: Profile REST API
 */

const { getFirestore } = require('firebase-admin/firestore');
const { DOSSIER_PRESET_REGISTRY } = require('../../../domain/dossierSchema');
const { execute: createCustomProfile } = require('../../../application/profile/createCustomProfile');

const db = getFirestore();

async function profileController(req, res) {
  const method = req.method;
  const path = req.routePath || '/';

  if (method === 'GET' && path === '/') {
    return await listProfiles(req, res);
  }
  if (method === 'POST' && path === '/') {
    return await createProfile(req, res);
  }
  if (method === 'DELETE' && /^\/[^/]+$/.test(path)) {
    return await deleteProfile(req, res);
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
  });
}

async function listProfiles(req, res) {
  const tenantId = req.tenantId;
  const { subjectType } = req.query;

  // Standard presets
  const presets = Object.values(DOSSIER_PRESET_REGISTRY)
    .filter(p => !subjectType || p.subjectTypes.includes(subjectType))
    .map(p => ({
      id: p.presetKey,
      type: 'preset',
      key: p.presetKey,
      name: p.label,
      title: p.label,
      subjectTypes: p.subjectTypes,
      personTypes: p.subjectTypes,
    }));

  // Custom profiles
  let customQuery = db.collection('customProfiles').where('isActive', '==', true);
  if (tenantId !== 'all') {
    customQuery = customQuery.where('tenantId', '==', tenantId);
  }
  if (subjectType) {
    customQuery = customQuery.where('subjectType', '==', subjectType);
  }

  // When tenantId === 'all', skip orderBy to avoid index requirement;
  // sort in memory instead.
  if (tenantId !== 'all') {
    customQuery = customQuery.orderBy('createdAt', 'desc');
  }

  const customSnap = await customQuery.get();
  let custom = customSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type: 'custom',
      key: d.id,
      title: data.name || '',
      name: data.name || '',
      description: data.description || '',
      subjectTypes: data.subjectType ? [data.subjectType] : ['pf', 'pj'],
      personTypes: data.subjectType ? [data.subjectType] : ['pf', 'pj'],
      sourceKeys: data.sourceKeys || [],
      ...data,
    };
  });

  if (tenantId === 'all') {
    custom.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
      const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
      return bTime - aTime;
    });
  }

  res.json({ success: true, data: { presets, custom } });
}

async function createProfile(req, res) {
  const tenantId = req.tenantId;
  const uid = req.uid;
  const profile = req.userProfile;
  const body = req.body || {};

  try {
    const result = await createCustomProfile({
      tenantId,
      createdBy: uid,
      name: body.name,
      description: body.description,
      subjectType: body.subjectType,
      sourceKeys: body.sourceKeys || body.sources || [],
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

async function deleteProfile(req, res) {
  const tenantId = req.tenantId;
  const profileId = req.routePath.split('/')[1];

  const ref = db.collection('customProfiles').doc(profileId);
  const doc = await ref.get();

  if (!doc.exists || (tenantId !== 'all' && doc.data().tenantId !== tenantId)) {
    return res.status(404).json({
      success: false,
      error: { code: 'PROFILE_NOT_FOUND', message: 'Perfil não encontrado.' },
    });
  }

  await ref.update({ isActive: false, updatedAt: new Date() });

  res.json({ success: true, data: { id: profileId, deleted: true } });
}

module.exports = { profileController };
