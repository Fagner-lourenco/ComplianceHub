/**
 * Export Jobs and Public Reports Module
 *
 * Extrai do monolito functions/index.js:
 * - Export jobs (create, list, get, cancel, process)
 * - Relatórios públicos (analyst, client, preview, view)
 * - Helpers canônicos de build de relatório
 */

const { HttpsError } = require('firebase-functions/v2/https');

// =============================================================================
// Export Job Handlers
// =============================================================================

function createExportJobHandler(deps) {
    const {
        db,
        getClientUserProfile,
        assertClientManager,
        validateExportJobPayload,
        EXPORT_JOB_STATUS,
        MAX_PENDING_JOBS_PER_USER,
        FieldValue,
    } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        const profile = await getClientUserProfile(uid);
        assertClientManager(profile);

        const { format, filters } = validateExportJobPayload(request.data);
        const scopeCode = String(request.data?.scopeCode || 'ALL').toUpperCase();
        const allowedScopes = new Set(['ALL', 'DONE', 'PENDING', 'RED']);
        if (!allowedScopes.has(scopeCode)) {
            throw new HttpsError('invalid-argument', 'Escopo de exportacao invalido.');
        }

        const pendingQuery = await db.collection('exportJobs')
            .where('tenantId', '==', profile.tenantId)
            .where('createdBy', '==', uid)
            .where('status', 'in', [EXPORT_JOB_STATUS.PENDING, EXPORT_JOB_STATUS.PROCESSING])
            .count()
            .get();
        const pendingCount = pendingQuery.data().count || 0;
        if (pendingCount >= MAX_PENDING_JOBS_PER_USER) {
            throw new HttpsError('resource-exhausted', `Limite de ${MAX_PENDING_JOBS_PER_USER} jobs pendentes atingido. Aguarde ou cancele um job existente.`);
        }

        const jobRef = db.collection('exportJobs').doc();
        const now = new Date();
        await jobRef.set({
            tenantId: profile.tenantId,
            clientId: uid,
            createdBy: uid,
            status: EXPORT_JOB_STATUS.PENDING,
            format,
            scopeCode,
            filters: {
                status: String(filters?.status || scopeCode),
                dateFrom: filters?.dateFrom || null,
                dateTo: filters?.dateTo || null,
            },
            filePath: null,
            fileSizeBytes: null,
            rowCount: null,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return { jobId: jobRef.id, status: EXPORT_JOB_STATUS.PENDING };
    };
}

function createGetExportJobStatusHandler(deps) {
    const { db, getClientUserProfile, EXPORT_JOB_STATUS, getStorage } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        const profile = await getClientUserProfile(uid);

        const jobId = String(request.data?.jobId || '').trim();
        if (!jobId) throw new HttpsError('invalid-argument', 'jobId obrigatorio.');

        const jobDoc = await db.collection('exportJobs').doc(jobId).get();
        if (!jobDoc.exists) throw new HttpsError('not-found', 'Job nao encontrado.');

        const job = jobDoc.data();
        if (job.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Sem acesso a este job.');
        }

        const result = {
            jobId: jobDoc.id,
            status: job.status,
            format: job.format,
            rowCount: job.rowCount || null,
            fileSizeBytes: job.fileSizeBytes || null,
            createdAt: job.createdAt?.toDate?.() ? job.createdAt.toDate().toISOString() : null,
            completedAt: job.completedAt?.toDate?.() ? job.completedAt.toDate().toISOString() : null,
            errorMessage: job.errorMessage || null,
        };

        if (job.status === EXPORT_JOB_STATUS.DONE && job.filePath) {
            try {
                const bucket = getStorage().bucket();
                const file = bucket.file(job.filePath);
                const [url] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 15 * 60 * 1000,
                });
                result.downloadUrl = url;
            } catch (storageError) {
                console.error('[getExportJobStatus] Erro ao gerar signed URL:', storageError.message);
                result.downloadUrl = null;
            }
        }

        return result;
    };
}

function createListExportJobsHandler(deps) {
    const { db, getClientUserProfile, EXPORT_JOB_STATUS } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        const profile = await getClientUserProfile(uid);

        let query = db.collection('exportJobs')
            .where('tenantId', '==', profile.tenantId)
            .where('clientId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(50);

        const statusFilter = request.data?.status;
        if (statusFilter && Object.values(EXPORT_JOB_STATUS).includes(statusFilter)) {
            query = query.where('status', '==', statusFilter);
        }

        const snapshot = await query.get();
        const jobs = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                jobId: doc.id,
                status: data.status,
                format: data.format,
                scopeCode: data.scopeCode,
                rowCount: data.rowCount || null,
                createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : null,
                completedAt: data.completedAt?.toDate?.() ? data.completedAt.toDate().toISOString() : null,
            };
        });

        return { jobs };
    };
}

function createCancelExportJobHandler(deps) {
    const { db, getClientUserProfile, EXPORT_JOB_STATUS, FieldValue } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        const profile = await getClientUserProfile(uid);

        const jobId = String(request.data?.jobId || '').trim();
        if (!jobId) throw new HttpsError('invalid-argument', 'jobId obrigatorio.');

        const jobRef = db.collection('exportJobs').doc(jobId);
        const jobDoc = await jobRef.get();
        if (!jobDoc.exists) throw new HttpsError('not-found', 'Job nao encontrado.');

        const job = jobDoc.data();
        if (job.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Sem acesso a este job.');
        }

        if (job.status === EXPORT_JOB_STATUS.DONE) {
            throw new HttpsError('failed-precondition', 'Nao e possivel cancelar um job ja concluido.');
        }

        await jobRef.update({
            status: EXPORT_JOB_STATUS.CANCELLED,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return { jobId, status: EXPORT_JOB_STATUS.CANCELLED };
    };
}

function createProcessExportJobHandler(deps) {
    const {
        db,
        getClientUserProfile,
        assertClientManager,
        EXPORT_JOB_STATUS,
        buildCsvContent,
        buildExportFilename,
        getStorage,
        FieldValue,
        serializeClientCaseDocument,
        matchesClientCaseFilters,
    } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        const profile = await getClientUserProfile(uid);
        assertClientManager(profile);

        const jobId = String(request.data?.jobId || '').trim();
        if (!jobId) throw new HttpsError('invalid-argument', 'jobId obrigatorio.');

        const jobRef = db.collection('exportJobs').doc(jobId);
        const jobDoc = await jobRef.get();
        if (!jobDoc.exists) throw new HttpsError('not-found', 'Job nao encontrado.');

        const job = jobDoc.data();
        if (job.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Sem acesso a este job.');
        }
        if (job.status !== EXPORT_JOB_STATUS.PENDING) {
            throw new HttpsError('failed-precondition', `Job nao esta pendente (status: ${job.status}).`);
        }

        await jobRef.update({
            status: EXPORT_JOB_STATUS.PROCESSING,
            startedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        try {
            const cases = [];
            let lastDoc = null;
            const batchSize = 500;
            const filters = job.filters || {};
            const scopeCode = job.scopeCode || 'ALL';

            while (true) {
                const currentJob = await jobRef.get();
                if (currentJob.data()?.status === EXPORT_JOB_STATUS.CANCELLED) {
                    return { jobId, status: EXPORT_JOB_STATUS.CANCELLED, message: 'Job cancelado durante processamento.' };
                }

                let q = db.collection('clientCases')
                    .where('tenantId', '==', profile.tenantId)
                    .orderBy('createdAt', 'desc')
                    .limit(batchSize);
                if (lastDoc) q = q.startAfter(lastDoc);
                const snap = await q.get();
                const docs = snap.docs || [];

                docs.forEach((docSnap) => {
                    const caseData = serializeClientCaseDocument(docSnap);
                    if (matchesClientCaseFilters(caseData, filters)) {
                        if (scopeCode === 'RED') {
                            if (caseData.riskLevel === 'RED' || caseData.riskLevel === 'HIGH') {
                                cases.push(caseData);
                            }
                        } else {
                            cases.push(caseData);
                        }
                    }
                });

                if (docs.length < batchSize) break;
                lastDoc = docs[docs.length - 1];
            }

            const headers = ['caseId', 'candidateName', 'status', 'riskLevel', 'finalVerdict', 'createdAt'];
            const rows = cases.map((c) => ({
                caseId: c.caseId || c.id,
                candidateName: c.candidateName || '',
                status: c.status || '',
                riskLevel: c.riskLevel || '',
                finalVerdict: c.finalVerdict || '',
                createdAt: c.createdAt || '',
            }));
            const csvContent = buildCsvContent(rows, headers);

            const bucket = getStorage().bucket();
            const filePath = buildExportFilename(profile.tenantId, 'csv');
            const file = bucket.file(filePath);
            await file.save(csvContent, {
                contentType: 'text/csv; charset=utf-8',
                metadata: {
                    tenantId: profile.tenantId,
                    jobId,
                    createdBy: uid,
                },
            });

            const [metadata] = await file.getMetadata();
            await jobRef.update({
                status: EXPORT_JOB_STATUS.DONE,
                filePath,
                fileSizeBytes: Number(metadata.size) || 0,
                rowCount: cases.length,
                completedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            return {
                jobId,
                status: EXPORT_JOB_STATUS.DONE,
                rowCount: cases.length,
                fileSizeBytes: Number(metadata.size) || 0,
            };
        } catch (error) {
            console.error('[processExportJob] Erro:', error);
            await jobRef.update({
                status: EXPORT_JOB_STATUS.ERROR,
                errorMessage: String(error.message || 'Erro desconhecido'),
                updatedAt: FieldValue.serverTimestamp(),
            });
            throw new HttpsError('internal', `Erro ao processar exportacao: ${error.message}`);
        }
    };
}

// =============================================================================
// Public Report Helpers (pure)
// =============================================================================

function resolvePublicReportStatus(reportData, now = new Date()) {
    const expiresAt = asDate(reportData?.expiresAt);
    const active = reportData?.active !== false;

    if (!active) return 'REVOKED';
    if (expiresAt && expiresAt < now) return 'EXPIRED';
    return 'ACTIVE';
}

function serializeManagedPublicReport(docSnap) {
    const reportData = docSnap.data() || {};
    const createdAt = asDate(reportData.createdAt);
    const expiresAt = asDate(reportData.expiresAt);

    return {
        id: docSnap.id,
        token: docSnap.id,
        caseId: reportData.caseId || null,
        tenantId: reportData.tenantId || null,
        candidateName: String(reportData.candidateName || '').slice(0, 160),
        active: reportData.active !== false,
        status: resolvePublicReportStatus(reportData),
        createdAt: createdAt ? createdAt.toISOString() : null,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        reportBuildVersion: reportData.reportBuildVersion || null,
        publicSnapshotHash: reportData.publicSnapshotHash || null,
    };
}

function sanitizePublicReportMeta(meta = {}) {
    return {
        type: ['single', 'batch'].includes(meta.type) ? meta.type : 'single',
        candidateName: String(meta.candidateName || '').trim().slice(0, 160),
    };
}

// =============================================================================
// Public Report Handlers
// =============================================================================

function createAnalystPublicReportHandler(deps) {
    const {
        db,
        getOpsUserProfile,
        assertOpsCanAccessCase,
        syncPublicResultLatest,
        hasPublicReportMinimumContent,
        computePublicSnapshotHash,
        buildCanonicalReportHtml,
        sanitizePublicReportHtml,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
        REPORT_BUILD_VERSION,
        FieldValue,
        PUBLIC_REPORT_TTL_MS,
    } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const meta = sanitizePublicReportMeta(request.data?.meta || {});
        const caseId = typeof request.data?.caseId === 'string' ? request.data.caseId.trim() : '';
        const TTL_DAYS = 14;
        const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
        const reportRef = db.collection('publicReports').doc();

        let reportTenantId = profile.tenantId || null;
        let caseSnap = null;
        let html = '';
        let publicSnapshot = null;
        let publicSnapshotHash = null;
        if (caseId) {
            const caseRef = db.collection('cases').doc(caseId);
            caseSnap = await caseRef.get();
            if (caseSnap.exists) {
                const caseData = caseSnap.data() || {};
                assertOpsCanAccessCase(profile, caseData, caseId);
                if (caseData.status !== 'DONE') {
                    throw new HttpsError('failed-precondition', 'Relatorio publico so pode ser gerado para casos concluidos.');
                }
                reportTenantId = caseData.tenantId || reportTenantId;
                publicSnapshot = await syncPublicResultLatest(caseId, caseData, {}, {
                    concludedAtOverride: caseData.concludedAt || caseData.updatedAt || new Date(),
                });
                if (!hasPublicReportMinimumContent(caseData, publicSnapshot)) {
                    throw new HttpsError('failed-precondition', 'Relatorio ainda nao possui conteudo minimo para publicacao.');
                }
                publicSnapshotHash = computePublicSnapshotHash(publicSnapshot);

                if (caseData.publicReportToken) {
                    const existingRef = db.collection('publicReports').doc(caseData.publicReportToken);
                    const existingSnap = await existingRef.get();
                    if (existingSnap.exists) {
                        const existing = existingSnap.data();
                        const expiresDate = existing.expiresAt?.toDate ? existing.expiresAt.toDate() : new Date(existing.expiresAt);
                        if (existing.active !== false && expiresDate > new Date()) {
                            const versionMatch = existing.reportBuildVersion === REPORT_BUILD_VERSION;
                            const hashMatch = existing.publicSnapshotHash === publicSnapshotHash;
                            if (versionMatch && hashMatch) {
                                return { token: caseData.publicReportToken, expiresAt: expiresDate.toISOString() };
                            }
                            const freshHtml = await buildCanonicalReportHtml(caseId, caseData, publicSnapshot, false);
                            const newExpiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
                            await existingRef.update({
                                html: freshHtml,
                                createdAt: FieldValue.serverTimestamp(),
                                expiresAt: newExpiresAt,
                                reportBuildVersion: REPORT_BUILD_VERSION,
                                publicSnapshotHash,
                                tenantId: reportTenantId,
                                candidateName: String(caseData.candidateName || meta.candidateName || '').slice(0, 160),
                            });
                            return { token: caseData.publicReportToken, expiresAt: newExpiresAt.toISOString() };
                        }
                    }
                }

                html = await buildCanonicalReportHtml(caseId, caseData, publicSnapshot, false);
            }
        }

        if (!html) {
            const rawHtml = String(request.data?.html || '');
            if (!rawHtml.trim()) {
                throw new HttpsError('invalid-argument', 'HTML do relatorio ausente.');
            }
            html = sanitizePublicReportHtml(rawHtml);
            if (!html.trim()) {
                throw new HttpsError('invalid-argument', 'HTML do relatorio ficou vazio apos sanitizacao.');
            }
        }

        await reportRef.set({
            html,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt,
            active: true,
            tenantId: reportTenantId,
            createdBy: uid,
            reportBuildVersion: REPORT_BUILD_VERSION,
            publicSnapshotHash,
            caseId: caseId || null,
            candidateName: String((caseSnap?.data?.()?.candidateName) || meta.candidateName || '').slice(0, 160),
            ...meta,
        });

        if (caseId && caseSnap && caseSnap.exists) {
            const caseRef = db.collection('cases').doc(caseId);
            await caseRef.update({
                publicReportToken: reportRef.id,
                reportReady: publicSnapshot?.reportReady !== false,
                reportSlug: publicSnapshot?.reportSlug || FieldValue.delete(),
            });
        }

        await writeAuditEvent({
            action: 'PUBLIC_REPORT_CREATED',
            tenantId: reportTenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'REPORT_PUBLIC', id: reportRef.id, label: meta.candidateName || reportRef.id },
            related: { caseId, reportToken: reportRef.id },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Relatorio publico gerado${meta.candidateName ? ` para ${meta.candidateName}` : ''}`,
        });

        return {
            token: reportRef.id,
            expiresAt: expiresAt.toISOString(),
        };
    };
}

function createClientPublicReportHandler(deps) {
    const {
        db,
        getClientUserProfile,
        assertClientManager,
        hasPublicReportMinimumContent,
        prepareCanonicalReport,
        REPORT_BUILD_VERSION,
        FieldValue,
        PUBLIC_REPORT_TTL_MS,
        asDate,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
    } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        assertClientManager(profile);
        const caseId = String(request.data?.caseId || '').trim();
        if (!caseId) {
            throw new HttpsError('invalid-argument', 'caseId ausente.');
        }

        const caseRef = db.collection('cases').doc(caseId);
        const caseSnap = await caseRef.get();
        if (!caseSnap.exists) {
            throw new HttpsError('not-found', 'Caso nao encontrado.');
        }
        const caseData = caseSnap.data();
        if (caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Caso nao pertence ao seu tenant.');
        }
        if (caseData.status !== 'DONE') {
            throw new HttpsError('failed-precondition', 'Relatorio disponivel apenas para casos concluidos.');
        }
        if (!hasPublicReportMinimumContent(caseData)) {
            throw new HttpsError('failed-precondition', 'Relatorio ainda nao possui conteudo minimo para publicacao.');
        }

        if (caseData.publicReportToken) {
            const existingRef = db.collection('publicReports').doc(caseData.publicReportToken);
            const existingSnap = await existingRef.get();
            if (existingSnap.exists) {
                const existing = existingSnap.data();
                const expiresDate = existing.expiresAt?.toDate ? existing.expiresAt.toDate() : new Date(existing.expiresAt);
                const sameTenant = !existing.tenantId || existing.tenantId === profile.tenantId;
                const sameCase = !existing.caseId || existing.caseId === caseId;
                if (sameTenant && sameCase && existing.active !== false && expiresDate > new Date()) {
                    const reportCreated = existing.createdAt?.toDate ? existing.createdAt.toDate() : new Date(existing.createdAt || 0);
                    const caseUpdated = asDate(caseData.updatedAt) || new Date(0);
                    const versionMatch = existing.reportBuildVersion === REPORT_BUILD_VERSION;
                    if (reportCreated >= caseUpdated && versionMatch) {
                        return { token: caseData.publicReportToken, expiresAt: expiresDate.toISOString() };
                    }
                    const {
                        html: freshHtml,
                        publicSnapshotHash: freshHash,
                    } = await prepareCanonicalReport(caseId, caseData);
                    const newExpiresAt = new Date(Date.now() + PUBLIC_REPORT_TTL_MS);
                    await existingRef.update({
                        html: freshHtml,
                        createdAt: FieldValue.serverTimestamp(),
                        expiresAt: newExpiresAt,
                        reportBuildVersion: REPORT_BUILD_VERSION,
                        publicSnapshotHash: freshHash,
                        tenantId: profile.tenantId,
                        caseId,
                        candidateName: String(caseData.candidateName || '').slice(0, 160),
                    });
                    return { token: caseData.publicReportToken, expiresAt: newExpiresAt.toISOString() };
                }
            }
        }

        const {
            html,
            publicSnapshot: _publicSnapshot,
            publicSnapshotHash,
        } = await prepareCanonicalReport(caseId, caseData);

        const expiresAt = new Date(Date.now() + PUBLIC_REPORT_TTL_MS);
        const reportRef = db.collection('publicReports').doc();

        await reportRef.set({
            html,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt,
            active: true,
            tenantId: profile.tenantId,
            createdBy: uid,
            caseId,
            candidateName: String(caseData.candidateName || '').slice(0, 160),
            reportBuildVersion: REPORT_BUILD_VERSION,
            publicSnapshotHash,
        });

        await caseRef.update({ publicReportToken: reportRef.id, reportReady: true });

        await writeAuditEvent({
            action: 'CLIENT_PUBLIC_REPORT_CREATED',
            tenantId: profile.tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'REPORT_PUBLIC', id: reportRef.id, label: caseData.candidateName || caseId },
            related: { caseId, reportToken: reportRef.id },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Relatorio publico gerado pelo cliente para ${caseData.candidateName || caseId}`,
        });

        return {
            token: reportRef.id,
            expiresAt: expiresAt.toISOString(),
        };
    };
}

function createGetClientCaseReportHtmlHandler(deps) {
    const { db, getClientUserProfile, prepareCanonicalReport } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        if (!profile?.tenantId) {
            throw new HttpsError('permission-denied', 'Perfil do cliente sem tenant.');
        }
        const caseId = String(request.data?.caseId || '').trim();
        if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

        const caseSnap = await db.collection('cases').doc(caseId).get();
        if (!caseSnap.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseSnap.data() || {};

        if (caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Caso nao pertence ao seu tenant.');
        }

        const { html, publicSnapshot, publicSnapshotHash, reportBuildVersion } = await prepareCanonicalReport(caseId, caseData);

        return {
            html,
            caseId,
            candidateName: publicSnapshot.candidateName || caseData.candidateName || '',
            publicSnapshotHash,
            reportBuildVersion,
            reportReady: true,
            generatedAt: new Date().toISOString(),
        };
    };
}

function createGetOpsCaseReportHtmlHandler(deps) {
    const { db, getOpsUserProfile, assertOpsCanAccessCase, prepareCanonicalReport } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

        const caseSnap = await db.collection('cases').doc(caseId).get();
        if (!caseSnap.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseSnap.data() || {};

        assertOpsCanAccessCase(profile, caseData, caseId);

        const { html, publicSnapshot, publicSnapshotHash, reportBuildVersion } = await prepareCanonicalReport(caseId, caseData);

        return {
            html,
            caseId,
            candidateName: publicSnapshot.candidateName || caseData.candidateName || '',
            tenantId: caseData.tenantId || null,
            publicSnapshotHash,
            reportBuildVersion,
            generatedAt: new Date().toISOString(),
        };
    };
}

function createGetOpsCaseReportPreviewHandler(deps) {
    const {
        db,
        getOpsUserProfile,
        assertOpsCanAccessCase,
        buildSanitizedPublicResultSnapshot,
        buildCanonicalReportHtml,
        ALLOWED_DRAFT_FIELDS,
        hasMeaningfulValue,
    } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

        const caseSnap = await db.collection('cases').doc(caseId).get();
        if (!caseSnap.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseSnap.data() || {};

        assertOpsCanAccessCase(profile, caseData, caseId);

        const reviewDraft = caseData.reviewDraft || {};
        const enrichedCaseData = { ...caseData };
        for (const field of ALLOWED_DRAFT_FIELDS) {
            if (!hasMeaningfulValue(enrichedCaseData[field]) && hasMeaningfulValue(reviewDraft[field])) {
                enrichedCaseData[field] = reviewDraft[field];
            }
        }
        const previewSnapshot = buildSanitizedPublicResultSnapshot(caseId, enrichedCaseData, {}, {});
        const html = await buildCanonicalReportHtml(caseId, enrichedCaseData, previewSnapshot, true);

        const previewBanner = '<div style="background:#f59e0b;color:#fff;padding:12px 16px;text-align:center;font-weight:bold;font-size:14px;border-radius:0 0 8px 8px;margin-bottom:16px;position:sticky;top:0;z-index:1000;">⚠️ PRÉVIA — RELATÓRIO NÃO FINALIZADO</div>';
        const htmlWithBanner = previewBanner + html;

        return {
            html: htmlWithBanner,
            caseId,
            candidateName: caseData.candidateName || '',
            tenantId: caseData.tenantId || null,
            isPreview: true,
            generatedAt: new Date().toISOString(),
        };
    };
}

async function getPublicReportViewInner(tokenInput, deps) {
    const { db, REPORT_BUILD_VERSION, asDate } = deps;

    const token = String(tokenInput || '').trim();
    if (!token) throw new HttpsError('invalid-argument', 'Token obrigatorio.');

    const reportSnap = await db.collection('publicReports').doc(token).get();
    if (!reportSnap.exists) throw new HttpsError('not-found', 'Relatorio nao encontrado.');

    const reportData = reportSnap.data() || {};
    const status = resolvePublicReportStatus(reportData);

    if (status === 'REVOKED') throw new HttpsError('failed-precondition', 'Relatorio revogado.');
    if (status === 'EXPIRED') throw new HttpsError('failed-precondition', 'Link expirado.');

    if (!reportData.caseId) throw new HttpsError('failed-precondition', 'Relatorio sem caso vinculado.');

    const caseSnap = await db.collection('cases').doc(reportData.caseId).get();
    if (!caseSnap.exists) throw new HttpsError('not-found', 'Caso vinculado nao encontrado.');
    const caseData = caseSnap.data() || {};

    if (caseData.status !== 'DONE') {
        throw new HttpsError('failed-precondition', 'Relatorio em revisao.');
    }

    if (reportData.reportBuildVersion !== REPORT_BUILD_VERSION) {
        throw new HttpsError(
            'failed-precondition',
            'Relatorio desatualizado. Solicite a geracao de um novo link.',
        );
    }

    if (!reportData.html) throw new HttpsError('internal', 'HTML do relatorio indisponivel.');

    const createdAt = asDate(reportData.createdAt);
    const expiresAt = asDate(reportData.expiresAt);

    return {
        html: reportData.html,
        token: token.slice(-12),
        candidateName: reportData.candidateName || caseData.candidateName || '',
        caseId: reportData.caseId,
        tenantId: reportData.tenantId || null,
        createdAt: createdAt ? createdAt.toISOString() : null,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        reportBuildVersion: reportData.reportBuildVersion || REPORT_BUILD_VERSION,
        publicSnapshotHash: reportData.publicSnapshotHash || null,
    };
}

function createGetPublicReportViewHandler(deps) {
    return async (request) => {
        return getPublicReportViewInner(request.data?.token, deps);
    };
}

// =============================================================================
// Canonical Report Build
// =============================================================================

async function buildCanonicalReportHtml(caseId, caseData, sanitizedPayload = null, isPreview = false, deps = {}) {
    const { db, REPORT_BUILD_VERSION, sanitizePublicReportHtml, buildSourceSummary } = deps;

    if (!isPreview && caseData?.status !== 'DONE') {
        throw new HttpsError('failed-precondition', `Relatório só pode ser gerado para casos concluídos (status: ${caseData?.status || 'desconhecido'}).`);
    }

    let publicResultData;
    if (sanitizedPayload) {
        publicResultData = sanitizedPayload;
    } else {
        const prRef = db.collection('cases').doc(caseId).collection('publicResult').doc('latest');
        const prSnap = await prRef.get();
        publicResultData = prSnap.exists ? prSnap.data() : {};
    }

    let candidateExtras = {};
    if (caseData.candidateId) {
        try {
            const candSnap = await db.collection('candidates').doc(caseData.candidateId).get();
            if (candSnap.exists) {
                const c = candSnap.data() || {};
                candidateExtras = {
                    department: c.department || '',
                    email: c.email || '',
                    phone: c.phone || '',
                };
            }
        } catch {
            // Non-critical: proceed without candidate extras
        }
    }

    let timelineEvents = publicResultData.timelineEvents || caseData.timelineEvents;
    if (!Array.isArray(timelineEvents) || timelineEvents.length === 0) {
        timelineEvents = [
            caseData.createdAt && { type: 'created', status: 'done', title: 'Solicitação enviada', at: caseData.createdAt?.toDate ? caseData.createdAt.toDate().toISOString() : (typeof caseData.createdAt === 'string' ? caseData.createdAt : '') },
            caseData.analysisStartedAt && { type: 'analysis_started', status: 'done', title: 'Processamento iniciado', at: caseData.analysisStartedAt?.toDate ? caseData.analysisStartedAt.toDate().toISOString() : (typeof caseData.analysisStartedAt === 'string' ? caseData.analysisStartedAt : '') },
            caseData.concludedAt && { type: 'concluded', status: 'done', title: 'Análise concluída', at: caseData.concludedAt?.toDate ? caseData.concludedAt.toDate().toISOString() : (typeof caseData.concludedAt === 'string' ? caseData.concludedAt : '') },
        ].filter(Boolean);
    }

    const sourceSummaryFallback = publicResultData.sourceSummary ? '' : buildSourceSummary(caseData);

    const reportData = {
        ...candidateExtras,
        tenantName: caseData.tenantName || '',
        id: caseId,
        ...publicResultData,
        timelineEvents,
        sourceSummary: publicResultData.sourceSummary || sourceSummaryFallback,
        statusSummary: publicResultData.statusSummary || 'Análise concluída e pronta para consulta e compartilhamento.',
    };
    const { buildCaseReportHtml } = require('../reportBuilder.cjs');
    const rawHtml = buildCaseReportHtml(reportData);
    const html = sanitizePublicReportHtml(rawHtml);
    if (!html.trim()) {
        throw new HttpsError('internal', 'Falha ao gerar HTML do relatorio.');
    }
    return html;
}

async function prepareCanonicalReport(caseId, caseData, deps = {}) {
    const {
        REPORT_BUILD_VERSION,
        syncPublicResultLatest,
        hasPublicReportMinimumContent,
        computePublicSnapshotHash,
        buildCanonicalReportHtml: buildHtmlFn,
    } = deps;

    if (!caseId) {
        throw new HttpsError('invalid-argument', 'caseId obrigatório.');
    }
    if (caseData?.status !== 'DONE') {
        throw new HttpsError('failed-precondition', 'Relatório disponível apenas para casos concluídos.');
    }

    const publicSnapshot = await syncPublicResultLatest(caseId, caseData, {}, {
        concludedAtOverride: caseData.concludedAt || caseData.updatedAt || new Date(),
    });

    if (!hasPublicReportMinimumContent(caseData, publicSnapshot)) {
        throw new HttpsError('failed-precondition', 'Relatório ainda não possui conteúdo mínimo para publicação.');
    }

    const publicSnapshotHash = computePublicSnapshotHash(publicSnapshot);
    const html = await buildHtmlFn(caseId, caseData, publicSnapshot, false);

    return {
        html,
        publicSnapshot,
        publicSnapshotHash,
        reportBuildVersion: REPORT_BUILD_VERSION,
    };
}

// =============================================================================
// asDate helper (duplicated from index.js for self-containment)
// =============================================================================

function asDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function createListClientPublicReportsHandler(deps) {
    const { db, getClientUserProfile, assertClientManager } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        assertClientManager(profile);
        const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 50, 1), 200);
        const lastCreatedAt = request.data?.lastCreatedAt || null;

        let q = db.collection('publicReports')
            .where('tenantId', '==', profile.tenantId)
            .orderBy('createdAt', 'desc')
            .limit(pageSize);
        if (lastCreatedAt) {
            q = q.startAfter(new Date(lastCreatedAt));
        }
        const snapshot = await q.get();

        const reports = snapshot.docs.map(serializeManagedPublicReport);
        const lastReport = reports[reports.length - 1];

        return {
            reports,
            hasMore: reports.length === pageSize,
            nextCursor: lastReport?.createdAt || null,
        };
    };
}

function createRevokeClientPublicReportHandler(deps) {
    const {
        db,
        getClientUserProfile,
        assertClientManager,
        FieldValue,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
    } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        assertClientManager(profile);
        const token = String(request.data?.token || '').trim();
        if (!token) throw new HttpsError('invalid-argument', 'Token do relatorio ausente.');

        const reportRef = db.collection('publicReports').doc(token);
        const reportSnap = await reportRef.get();
        if (!reportSnap.exists) throw new HttpsError('not-found', 'Relatorio nao encontrado.');

        const reportData = reportSnap.data() || {};
        let caseRef = null;
        let caseData = null;

        if (reportData.caseId) {
            caseRef = db.collection('cases').doc(reportData.caseId);
            const caseSnap = await caseRef.get();
            if (caseSnap.exists) {
                caseData = caseSnap.data() || {};
            }
        }

        const effectiveTenantId = reportData.tenantId || caseData?.tenantId || null;
        if (!effectiveTenantId || effectiveTenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Relatorio nao pertence ao seu tenant.');
        }

        if (reportData.active === false) {
            return { success: true, alreadyRevoked: true };
        }

        await reportRef.update({ active: false });

        if (caseRef && caseData?.publicReportToken === token) {
            await caseRef.update({ publicReportToken: FieldValue.delete() });
        }

        await writeAuditEvent({
            action: 'CLIENT_PUBLIC_REPORT_REVOKED',
            tenantId: effectiveTenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'REPORT_PUBLIC', id: token, label: reportData.candidateName || token },
            related: { reportToken: token },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Relatorio publico revogado pelo cliente${reportData.candidateName ? ` (${reportData.candidateName})` : ''}`,
        });

        return { success: true };
    };
}

function createRevokePublicReportHandler(deps) {
    const {
        db,
        getOpsUserProfile,
        FieldValue,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
    } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const token = String(request.data?.token || '').trim();
        if (!token) throw new HttpsError('invalid-argument', 'Token do relatorio ausente.');

        const reportRef = db.collection('publicReports').doc(token);
        const reportSnap = await reportRef.get();
        if (!reportSnap.exists) throw new HttpsError('not-found', 'Relatorio nao encontrado.');

        const reportData = reportSnap.data();

        const reportTenantId = reportData.tenantId || null;
        if (reportTenantId && reportTenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Relatorio nao pertence ao seu tenant.');
        }

        if (reportData.active === false) {
            return { success: true, alreadyRevoked: true };
        }

        await reportRef.update({ active: false });

        if (reportData.caseId) {
            const caseRef = db.collection('cases').doc(reportData.caseId);
            const caseSnap = await caseRef.get();
            if (caseSnap.exists && caseSnap.data()?.publicReportToken === token) {
                await caseRef.update({ publicReportToken: FieldValue.delete() });
            }
        }

        await writeAuditEvent({
            action: 'PUBLIC_REPORT_REVOKED',
            tenantId: reportData.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'REPORT_PUBLIC', id: token, label: reportData.candidateName || token },
            related: { reportToken: token },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Relatorio publico revogado${reportData.candidateName ? ` (${reportData.candidateName})` : ''}`,
        });

        return { success: true };
    };
}

function createListOpsPublicReportsHandler(deps) {
    const { db, getOpsUserProfile } = deps;

    return async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const requestedTenantId = String(request.data?.tenantId || '').trim() || null;
        const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 100, 1), 200);

        const isGlobal = !profile.tenantId && ['admin', 'owner'].includes(profile.role);
        const effectiveTenantId = isGlobal ? requestedTenantId : (profile.tenantId || null);

        let q;
        if (effectiveTenantId) {
            q = db.collection('publicReports')
                .where('tenantId', '==', effectiveTenantId)
                .orderBy('createdAt', 'desc')
                .limit(pageSize);
        } else {
            q = db.collection('publicReports')
                .orderBy('createdAt', 'desc')
                .limit(pageSize);
        }

        const snap = await q.get();
        return {
            reports: snap.docs.map(serializeManagedPublicReport),
        };
    };
}

module.exports = {
    // Pure helpers
    resolvePublicReportStatus,
    serializeManagedPublicReport,
    sanitizePublicReportMeta,
    asDate,

    // Inner functions
    getPublicReportViewInner,
    buildCanonicalReportHtml,
    prepareCanonicalReport,

    // Handler factories
    createExportJobHandler,
    createGetExportJobStatusHandler,
    createListExportJobsHandler,
    createCancelExportJobHandler,
    createProcessExportJobHandler,
    createAnalystPublicReportHandler,
    createClientPublicReportHandler,
    createGetClientCaseReportHtmlHandler,
    createGetOpsCaseReportHtmlHandler,
    createGetOpsCaseReportPreviewHandler,
    createGetPublicReportViewHandler,
    createListClientPublicReportsHandler,
    createRevokeClientPublicReportHandler,
    createRevokePublicReportHandler,
    createListOpsPublicReportsHandler,
};
