/**
 * pdfGeneration.js — Geração de PDFs server-side com Puppeteer
 * Extraído do monolito index.js durante refatoração Phase C
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const PDF_EXPIRY_MS = 15 * 60 * 1000;
const PDF_SIGNED_URL_ACTION = 'read';

function makeSafePdfFilename(value) {
    const base = String(value || 'relatorio')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\-_\s]/g, '_')
        .replace(/_+/g, '_')
        .trim()
        .slice(0, 80);
    return base || 'relatorio';
}

function asIsoForFilename(date) {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function savePdfAndCreateSignedUrl({ pdfBuffer, storagePath, filename, metadata = {}, expiresMs = PDF_EXPIRY_MS }) {
    const bucket = getStorage().bucket();
    const filePath = `${storagePath}/${filename}`;
    const file = bucket.file(filePath);

    await file.save(pdfBuffer, {
        metadata: {
            contentType: 'application/pdf',
            metadata: {
                ...metadata,
                generatedAt: new Date().toISOString(),
            },
        },
    });

    try {
        const [signedUrl] = await file.getSignedUrl({
            action: PDF_SIGNED_URL_ACTION,
            expires: Date.now() + expiresMs,
            responseDisposition: `attachment; filename="${filename}"`,
        });
        return { signedUrl, filePath, filename };
    } catch (signErr) {
        console.error(`[savePdfAndCreateSignedUrl] Signed URL generation failed for ${filePath}:`, signErr.message);
        throw new Error(
            `Falha ao gerar URL assinada para o PDF. ` +
            `Verifique se a service account tem a permissao 'iam.serviceAccounts.signBlob'. ` +
            `Erro original: ${signErr.message}`,
        );
    }
}

async function generateClientCasePdfLogic({
    db,
    caseId,
    uid,
    profile,
    request,
    prepareCanonicalReport,
    renderHtmlToPdfBuffer,
    injectPdfExportCss,
    hasPublicReportMinimumContent,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
    savePdfAndCreateSignedUrl: savePdfFn = savePdfAndCreateSignedUrl,
}) {
    const caseRef = db.collection('cases').doc(caseId);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
    const caseData = caseSnap.data() || {};

    if (caseData.tenantId !== profile.tenantId) {
        throw new HttpsError('permission-denied', 'Caso nao pertence ao seu tenant.');
    }
    if (caseData.status !== 'DONE') {
        throw new HttpsError('failed-precondition', 'PDF disponivel apenas para casos concluidos.');
    }
    if (!hasPublicReportMinimumContent(caseData)) {
        throw new HttpsError('failed-precondition', 'Relatorio ainda nao possui conteudo minimo para exportacao.');
    }

    console.log(`[generateClientCasePdf] caseId=${caseId} tenant=${profile.tenantId} — starting HTML build`);
    const { html } = await prepareCanonicalReport(caseId, caseData);
    console.log(`[generateClientCasePdf] caseId=${caseId} — HTML built, length=${html?.length || 0}`);
    const pdfHtml = injectPdfExportCss(html, { includeWatermark: false });
    console.log(`[generateClientCasePdf] caseId=${caseId} — CSS injected`);

    console.log(`[generateClientCasePdf] caseId=${caseId} — launching Chromium via Puppeteer`);
    const pdfBuffer = await renderHtmlToPdfBuffer(pdfHtml, {
        timeoutMs: 90000,
        setContentTimeoutMs: 90000,
        pdfTimeoutMs: 90000,
    });
    console.log(`[generateClientCasePdf] caseId=${caseId} — PDF rendered, buffer size=${pdfBuffer?.length || 0}`);

    const tenantId = profile.tenantId;
    const candidateName = makeSafePdfFilename(caseData.candidateName);
    const timestamp = asIsoForFilename(new Date());
    const filename = `${candidateName}_${timestamp}.pdf`;

    let signedUrl = null;
    let filePath = null;
    let storageFailed = false;
    try {
        const storagePath = `tenants/${tenantId}/cases/${caseId}/pdfExports`;
        const uploadResult = await savePdfFn({
            pdfBuffer,
            storagePath,
            filename,
            metadata: {
                caseId,
                tenantId,
                generatedBy: uid,
                candidateName: caseData.candidateName || '',
            },
        });
        signedUrl = uploadResult.signedUrl;
        filePath = uploadResult.filePath;
        console.log(`[generateClientCasePdf] caseId=${caseId} — uploaded to ${filePath}`);
    } catch (storageErr) {
        const isBucketMissing = storageErr?.message?.includes('bucket does not exist') ||
            storageErr?.code === 404 ||
            storageErr?.status === 404;
        const isSignBlobDenied = storageErr?.message?.includes('signBlob') ||
            storageErr?.message?.includes('iam.serviceAccounts.signBlob');
        if (isBucketMissing || isSignBlobDenied) {
            console.warn(`[generateClientCasePdf] caseId=${caseId} — Storage/signBlob unavailable (${storageErr.message?.slice(0, 120)}), falling back to base64 data URL`);
            storageFailed = true;
        } else {
            throw storageErr;
        }
    }

    if (!storageFailed && signedUrl) {
        const exportRef = caseRef.collection('pdfExports').doc();
        await exportRef.set({
            filePath,
            filename,
            generatedAt: FieldValue.serverTimestamp(),
            generatedBy: uid,
            generatedByEmail: profile.email || uid,
            candidateName: caseData.candidateName || '',
            tenantId,
            caseId,
            signedUrl,
            signedUrlExpiresAt: new Date(Date.now() + PDF_EXPIRY_MS),
        });

        await writeAuditEvent({
            action: 'CLIENT_REPORT_PDF_GENERATED',
            tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid, displayName: profile.displayName || null },
            entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
            related: { caseId, exportId: exportRef.id, filePath },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `PDF do relatorio gerado para ${caseData.candidateName || caseId}`,
            clientMetadata: { filePath, filename },
        });

        return { url: signedUrl, expiresInSeconds: Math.floor(PDF_EXPIRY_MS / 1000) };
    }

    const safePdfBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const base64Pdf = safePdfBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;
    console.log(`[generateClientCasePdf] caseId=${caseId} — returning base64 data URL, length=${dataUrl.length}, bufferBytes=${safePdfBuffer.length}`);

    await writeAuditEvent({
        action: 'CLIENT_REPORT_PDF_GENERATED',
        tenantId,
        actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid, displayName: profile.displayName || null },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_CLIENT,
        ip: getClientIp(request),
        detail: `PDF do relatorio gerado (base64 fallback) para ${caseData.candidateName || caseId}`,
        clientMetadata: { filename, fallback: 'base64' },
    });

    return { url: dataUrl, expiresInSeconds: 0, filename, fallback: 'base64' };
}

async function generatePublicReportPdfLogic({
    db,
    token,
    request,
    renderHtmlToPdfBuffer,
    injectPdfExportCss,
    resolvePublicReportStatus,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
    savePdfAndCreateSignedUrl: savePdfFn = savePdfAndCreateSignedUrl,
}) {
    const reportRef = db.collection('publicReports').doc(token);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) throw new HttpsError('not-found', 'Relatorio nao encontrado.');

    const reportData = reportSnap.data() || {};
    const status = resolvePublicReportStatus(reportData);
    if (status === 'REVOKED') throw new HttpsError('failed-precondition', 'Relatorio revogado.');
    if (status === 'EXPIRED') throw new HttpsError('failed-precondition', 'Link expirado.');

    const caseId = reportData.caseId;
    if (caseId) {
        const caseSnap = await db.collection('cases').doc(caseId).get();
        if (caseSnap.exists) {
            const caseData = caseSnap.data() || {};
            if (caseData.status !== 'DONE') {
                throw new HttpsError('failed-precondition', 'Caso nao esta concluido.');
            }
        }
    }

    let html = reportData.html || '';
    if (!html.trim()) {
        throw new HttpsError('internal', 'HTML do relatorio indisponivel.');
    }

    html = injectPdfExportCss(html, { includeWatermark: false });

    const pdfBuffer = await renderHtmlToPdfBuffer(html, {
        timeoutMs: 90000,
        setContentTimeoutMs: 90000,
        pdfTimeoutMs: 90000,
    });

    const candidateName = makeSafePdfFilename(reportData.candidateName);
    const timestamp = asIsoForFilename(new Date());
    const filename = `${candidateName}_${timestamp}.pdf`;
    const storagePath = `publicReports/${token}/pdfExports`;

    let signedUrl = null;
    let filePath = null;
    let returnUrl;

    try {
        const uploadResult = await savePdfFn({
            pdfBuffer,
            storagePath,
            filename,
            metadata: {
                token,
                caseId: reportData.caseId || '',
                candidateName: reportData.candidateName || '',
                generatedBy: reportData.createdBy || 'public',
            },
        });
        signedUrl = uploadResult.signedUrl;
        filePath = uploadResult.filePath;
        returnUrl = signedUrl;
    } catch (storageErr) {
        const isSignBlobDenied = storageErr?.message?.includes('signBlob') ||
            storageErr?.message?.includes('iam.serviceAccounts.signBlob');
        const isBucketMissing = storageErr?.message?.includes('bucket does not exist') ||
            storageErr?.code === 404 || storageErr?.status === 404;
        if (isSignBlobDenied || isBucketMissing) {
            const safePdfBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
            console.warn(`[generatePublicReportPdf] Storage/signBlob unavailable (${storageErr.message?.slice(0, 120)}), falling back to base64 (bufferBytes=${safePdfBuffer.length})`);
            returnUrl = `data:application/pdf;base64,${safePdfBuffer.toString('base64')}`;
        } else {
            throw storageErr;
        }
    }

    if (filePath) {
        const exportRef = reportRef.collection('pdfExports').doc();
        await exportRef.set({
            filePath,
            filename,
            generatedAt: FieldValue.serverTimestamp(),
            candidateName: reportData.candidateName || '',
            token,
            caseId: reportData.caseId || null,
            signedUrl,
            signedUrlExpiresAt: new Date(Date.now() + PDF_EXPIRY_MS),
        });
    }

    try {
        await writeAuditEvent({
            action: 'PUBLIC_REPORT_PDF_GENERATED',
            tenantId: reportData.tenantId || null,
            actor: { type: ACTOR_TYPE.PUBLIC_LINK, id: token },
            entity: { type: 'REPORT_PUBLIC', id: token, label: reportData.candidateName || token },
            related: { caseId: reportData.caseId || null, token, filePath },
            source: SOURCE.PUBLIC_REPORT,
            ip: getClientIp(request),
            detail: `PDF do relatorio publico gerado${reportData.candidateName ? ` para ${reportData.candidateName}` : ''}`,
            clientMetadata: { filePath, filename },
        });
    } catch {
        // Non-blocking
    }

    return { url: returnUrl, expiresInSeconds: signedUrl ? Math.floor(PDF_EXPIRY_MS / 1000) : 0 };
}

/* =========================================================
   Factories — criam os handlers onCall para index.js
   ========================================================= */

function createGenerateClientCasePdfHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 120, memory: '2GiB', cors: true },
        async (request) => {
            const uid = request.auth?.uid;
            if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

            const profile = await deps.getClientUserProfile(uid);
            deps.assertClientManager(profile);
            const caseId = String(request.data?.caseId || '').trim();
            if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

            try {
                return await generateClientCasePdfLogic({
                    db: deps.db,
                    caseId,
                    uid,
                    profile,
                    request,
                    prepareCanonicalReport: deps.prepareCanonicalReport,
                    renderHtmlToPdfBuffer: deps.renderHtmlToPdfBuffer,
                    injectPdfExportCss: deps.injectPdfExportCss,
                    hasPublicReportMinimumContent: deps.hasPublicReportMinimumContent,
                    writeAuditEvent: deps.writeAuditEvent,
                    ACTOR_TYPE: deps.ACTOR_TYPE,
                    SOURCE: deps.SOURCE,
                    getClientIp: deps.getClientIp,
                });
            } catch (err) {
                if (err instanceof HttpsError) throw err;
                console.error(`[generateClientCasePdf] caseId=${caseId} tenant=${profile.tenantId} error:`, err.message, err.stack);
                throw new HttpsError('internal', `Falha ao gerar PDF: ${err.message}`);
            }
        },
    );
}

function createGeneratePublicReportPdfHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 120, memory: '1GiB', cors: true },
        async (request) => {
            const token = String(request.data?.token || '').trim();
            if (!token) throw new HttpsError('invalid-argument', 'Token do relatorio obrigatorio.');

            try {
                return await generatePublicReportPdfLogic({
                    db: deps.db,
                    token,
                    request,
                    renderHtmlToPdfBuffer: deps.renderHtmlToPdfBuffer,
                    injectPdfExportCss: deps.injectPdfExportCss,
                    resolvePublicReportStatus: deps.resolvePublicReportStatus,
                    writeAuditEvent: deps.writeAuditEvent,
                    ACTOR_TYPE: deps.ACTOR_TYPE,
                    SOURCE: deps.SOURCE,
                    getClientIp: deps.getClientIp,
                });
            } catch (err) {
                if (err instanceof HttpsError) throw err;
                console.error(`[generatePublicReportPdf] token=${token} error:`, err.message, err.stack);
                throw new HttpsError('internal', `Falha ao gerar PDF: ${err.message}`);
            }
        },
    );
}

module.exports = {
    // Lógica pura
    makeSafePdfFilename,
    asIsoForFilename,
    savePdfAndCreateSignedUrl,
    generateClientCasePdfLogic,
    generatePublicReportPdfLogic,
    // Factories
    createGenerateClientCasePdfHandler,
    createGeneratePublicReportPdfHandler,
};
