/**
 * Central audit event writer — single entry point for all audit log writes.
 *
 * All 21 current write points in index.js should migrate to this helper.
 * Handles: schema v2 normalization, IP masking, searchText generation,
 * client summary interpolation, and tenant audit projection.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { AUDIT_ACTIONS } = require('./auditCatalog');

/** Lazy getter — avoids calling getFirestore() before initializeApp(). */
let _db;
function db() {
    if (!_db) _db = getFirestore();
    return _db;
}

/**
 * Interpolate a summary template with provided variables.
 * Placeholders: {varName} — missing vars become empty string.
 */
function interpolateTemplate(template, vars) {
    if (!template) return '';
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        const val = vars[key];
        return val !== undefined && val !== null ? String(val) : '';
    }).trim();
}

/**
 * Build a searchable text blob from key fields.
 */
function buildSearchText({ summary, clientSummary, actorEmail, actorName, entityLabel, action }) {
    return [summary, clientSummary, actorEmail, actorName, entityLabel, action]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .slice(0, 500);
}

/**
 * Remove undefined values from an object (Firestore rejects undefined).
 */
function stripUndefined(obj) {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && typeof value.toDate !== 'function' && !value._methodName && value.constructor === Object) {
                const nested = stripUndefined(value);
                if (Object.keys(nested).length > 0) {
                    clean[key] = nested;
                }
            } else {
                clean[key] = value;
            }
        }
    }
    return clean;
}

/**
 * Write an audit event to `auditLogs` and optionally project to `tenantAuditLogs`.
 *
 * @param {Object} params
 * @param {string} params.action          — Action key from AUDIT_ACTIONS catalog
 * @param {string|null} params.tenantId   — Tenant ID (null for ops-level events like USER_CREATED)
 * @param {Object} params.actor           — { type, id, email, displayName }
 * @param {Object} [params.entity]        — { type, id, label }
 * @param {Object} [params.related]       — { caseId, reportToken, exportId, userId }
 * @param {string} [params.summary]       — Override auto-generated summary
 * @param {string} [params.detail]        — Human-readable detail string (NOT JSON.stringify)
 * @param {Object} [params.metadata]      — Structured metadata (replaces old JSON.stringify in detail)
 * @param {Object} [params.clientMetadata] — Metadata safe for client projection
 * @param {string} [params.source]        — portal_ops | portal_client | cloud_function | system
 * @param {string} [params.ip]            — Raw client IP (stored as-is for ops audit trail)
 * @param {Object} [params.templateVars]  — Variables for summary template interpolation
 * @returns {Promise<string>} The generated event document ID
 */
async function writeAuditEvent({
    action,
    tenantId = null,
    actor = {},
    entity = {},
    related = {},
    summary = null,
    detail = null,
    metadata = null,
    clientMetadata = null,
    source = null,
    ip = null,
    templateVars = {},
}) {
    const catalogEntry = AUDIT_ACTIONS[action];
    if (!catalogEntry) {
        console.error(`writeAuditEvent: unknown action "${action}"`);
        throw new Error(`Unknown audit action: ${action}`);
    }

    // Auto-derive fields from catalog
    const { level, category, entityType, clientVisible, summaryTemplate, clientSummaryTemplate } = catalogEntry;

    // Interpolate summaries
    const vars = {
        actorName: actor.displayName || actor.email || '',
        ...templateVars,
    };
    const computedSummary = summary || interpolateTemplate(summaryTemplate, vars);
    const computedClientSummary = clientVisible
        ? interpolateTemplate(clientSummaryTemplate || summaryTemplate, vars)
        : null;

    const searchText = buildSearchText({
        summary: computedSummary,
        clientSummary: computedClientSummary,
        actorEmail: actor.email,
        actorName: actor.displayName,
        entityLabel: entity.label,
        action,
    });

    // ── Build v2 document ────────────────────────────────────────────────────
    const eventDoc = stripUndefined({
        occurredAt: FieldValue.serverTimestamp(),
        tenantId,
        level,
        category,
        action,
        source: source || null,
        clientVisible,

        actor: {
            type: actor.type || null,
            id: actor.id || null,
            email: actor.email || null,
            displayName: actor.displayName || null,
        },

        entity: {
            type: entity.type || entityType,
            id: entity.id || null,
            label: entity.label || null,
        },

        related: {
            caseId: related.caseId || null,
            reportToken: related.reportToken || null,
            exportId: related.exportId || null,
            userId: related.userId || null,
        },

        summary: computedSummary,
        detail: detail || null,
        metadata: metadata || null,
        clientMetadata: clientMetadata || null,
        clientSummary: computedClientSummary,
        searchText,
        ip: ip || null,

        // Legacy compat fields (temporary — remove after backfill)
        userId: actor.id || null,
        userEmail: actor.email || null,
        target: entity.id || null,
        timestamp: FieldValue.serverTimestamp(),
    });

    // ── Write to auditLogs ───────────────────────────────────────────────────
    const docRef = await db().collection('auditLogs').add(eventDoc);

    // ── Project to tenantAuditLogs if client-visible ─────────────────────────
    if (clientVisible && tenantId) {
        const tenantDoc = stripUndefined({
            eventId: docRef.id,
            occurredAt: FieldValue.serverTimestamp(),
            tenantId,
            category,
            action,
            source: source || null,

            actor: {
                type: actor.type || null,
                displayName: actor.displayName || null,
                email: actor.email || null,
            },

            entity: {
                type: entity.type || entityType,
                id: entity.id || null,
                label: entity.label || null,
            },

            related: {
                caseId: related.caseId || null,
                reportToken: related.reportToken || null,
                exportId: related.exportId || null,
            },

            summary: computedClientSummary || computedSummary,
            detail: detail || null,
            metadata: clientMetadata || null,
            searchText,
        });

        await db().collection('tenantAuditLogs').doc(docRef.id).set(tenantDoc)
            .catch((err) => console.warn('tenantAuditLogs projection failed:', err.message));
    }

    return docRef.id;
}

module.exports = { writeAuditEvent };

// ── Test-only exports ────────────────────────────────────────────────────────
if (process.env.FUNCTIONS_EMULATOR === 'true') {
    module.exports.__test = {
        interpolateTemplate,
        buildSearchText,
        stripUndefined,
        /** Override the lazy db() getter for testing. */
        _setDb(mockDb) { _db = mockDb; },
    };
}
