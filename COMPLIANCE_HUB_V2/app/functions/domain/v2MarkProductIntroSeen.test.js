import { describe, expect, it } from 'vitest';

const { PRODUCT_REGISTRY } = require('./v2Modules.js');

function validateProductKey(productKey) {
    if (!productKey || typeof productKey !== 'string') {
        return { ok: false, reason: 'missing' };
    }
    const safeKey = productKey.replace(/[^a-zA-Z0-9_-]/g, '');
    if (safeKey !== productKey) {
        return { ok: false, reason: 'invalid-chars' };
    }
    if (!PRODUCT_REGISTRY[safeKey]) {
        return { ok: false, reason: 'unknown' };
    }
    return { ok: true, safeKey };
}

describe('v2MarkProductIntroSeen productKey validation', () => {
    it('rejects injected path traversal', () => {
        const result = validateProductKey('injected/../../admin');
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('invalid-chars');
    });

    it('accepts a valid productKey from registry', () => {
        const result = validateProductKey('dossier_pf_full');
        expect(result.ok).toBe(true);
        expect(result.safeKey).toBe('dossier_pf_full');
    });

    it('rejects unknown productKey', () => {
        const result = validateProductKey('unknown_product_123');
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('unknown');
    });

    it('rejects empty productKey', () => {
        const result = validateProductKey('');
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('missing');
    });

    it('rejects productKey with special chars', () => {
        const result = validateProductKey('product<script>');
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('invalid-chars');
    });
});
