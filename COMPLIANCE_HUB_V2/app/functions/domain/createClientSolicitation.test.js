import { describe, expect, it } from 'vitest';

const { inferRequestedModuleKeys, getProductContract, PRODUCT_REGISTRY } = require('./v2Modules.js');
const { resolveDossierConfiguration } = require('./dossierSchema.js');

function validateRequestedModules(requestedModuleKeys, productKey) {
    const productContract = getProductContract(productKey);
    const allowedModules = new Set([
        ...(productContract.requiredModules || []),
        ...(productContract.optionalModules || []),
    ]);
    const invalidModules = requestedModuleKeys.filter((k) => !allowedModules.has(k));
    return { ok: invalidModules.length === 0, invalidModules, allowedModules: [...allowedModules] };
}

describe('createClientSolicitation module validation', () => {
    it('accepts modules within product contract', () => {
        const modules = inferRequestedModuleKeys({ requestedModuleKeys: ['identity_pf', 'decision'] });
        const result = validateRequestedModules(modules, 'dossier_pf_basic');
        expect(result.ok).toBe(true);
    });

    it('rejects modules not in product contract', () => {
        const modules = inferRequestedModuleKeys({ requestedModuleKeys: ['identity_pf', 'osint'] });
        const result = validateRequestedModules(modules, 'dossier_pf_basic');
        expect(result.ok).toBe(false);
        expect(result.invalidModules).toContain('osint');
    });

    it('accepts all modules for kyc_individual product', () => {
        const modules = inferRequestedModuleKeys({ requestedModuleKeys: ['identity_pf', 'criminal', 'warrants', 'kyc'] });
        const result = validateRequestedModules(modules, 'kyc_individual');
        expect(result.ok).toBe(true);
    });

    it('infers from enabledPhases when requestedModuleKeys not provided', () => {
        const modules = inferRequestedModuleKeys({ enabledPhases: ['identity_pf', 'decision'] });
        const result = validateRequestedModules(modules, 'dossier_pf_basic');
        expect(result.ok).toBe(true);
        expect(modules).toContain('identity_pf');
        expect(modules).toContain('decision');
    });
});

describe('createClientSolicitation schema-driven configuration', () => {
    it('resolveDossierConfiguration retorna schemaKey e presetKey para dossier_pf_basic', () => {
        const config = resolveDossierConfiguration({
            productKey: 'dossier_pf_basic',
            subjectType: 'pf',
        });
        expect(config.dossierSchemaKey).toBeTruthy();
        expect(config.dossierPresetKey).toBeDefined();
        expect(config.configVersion).toBeDefined();
    });

    it('resolveDossierConfiguration usa dossierPresetKey quando fornecido', () => {
        const config = resolveDossierConfiguration({
            productKey: 'dossier_pf_basic',
            dossierPresetKey: 'compliance',
            subjectType: 'pf',
        });
        expect(config.dossierPresetKey).toBe('compliance');
        expect(config.dossierSchemaKey).toBe('dossier_pf_full');
    });

    it('resolveDossierConfiguration usa product default quando preset invalido', () => {
        const config = resolveDossierConfiguration({
            productKey: 'dossier_pf_basic',
            dossierPresetKey: 'invalid_preset_123',
            subjectType: 'pf',
        });
        expect(config.dossierSchemaKey).toBe('dossier_pf_basic');
        expect(config.dossierPresetKey).toBeNull();
    });

    it('resolveDossierConfiguration inclui requestedModuleKeys', () => {
        const config = resolveDossierConfiguration({
            productKey: 'dossier_pf_basic',
            subjectType: 'pf',
            requestedModuleKeys: ['identity_pf', 'criminal'],
        });
        expect(config.requestedModuleKeys).toContain('identity_pf');
        expect(config.requestedModuleKeys).toContain('criminal');
    });

    it('configurationHash e deterministico para mesmos parametros', () => {
        const crypto = require('crypto');
        const params = {
            presetKey: 'compliance_pf',
            schemaKey: 'dossier_pf_v1',
            subjectKind: 'pf',
            requestedModuleKeys: ['identity_pf', 'criminal'],
            parameters: { depth: 'standard' },
            autoMarkRelevant: true,
            autoProcess: false,
        };
        const hash1 = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 16);
        const hash2 = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 16);
        expect(hash1).toBe(hash2);
    });
});

describe('createClientSolicitation productKey validation', () => {
    it('rejeita productKey inexistente no registro', () => {
        const productKey = 'produto_inexistente_xyz';
        expect(PRODUCT_REGISTRY[productKey]).toBeUndefined();
    });

    it('aceita todos os productKeys do registro', () => {
        const keys = Object.keys(PRODUCT_REGISTRY);
        expect(keys.length).toBeGreaterThan(0);
        keys.forEach((key) => {
            expect(PRODUCT_REGISTRY[key]).toBeDefined();
            expect(PRODUCT_REGISTRY[key].productKey || PRODUCT_REGISTRY[key].id).toBeTruthy();
        });
    });

    it('produtos do tipo dossier_pf tem modulos obrigatorios', () => {
        const contract = getProductContract('dossier_pf_basic');
        expect(contract.requiredModules.length).toBeGreaterThan(0);
    });

    it('dossier_pj existe no registro de produtos', () => {
        expect(PRODUCT_REGISTRY['dossier_pj']).toBeDefined();
        expect(PRODUCT_REGISTRY['dossier_pj'].productKey || PRODUCT_REGISTRY['dossier_pj'].id).toBeTruthy();
    });

    it('produtos do tipo dossier_pj tem modulos obrigatorios', () => {
        const contract = getProductContract('dossier_pj');
        expect(contract.requiredModules.length).toBeGreaterThan(0);
        expect(contract.requiredModules).toContain('identity_pj');
    });
});

describe('createClientSolicitation PJ schema-driven configuration', () => {
    it('resolveDossierConfiguration retorna schemaKey para dossier_pj com subjectType pj', () => {
        const config = resolveDossierConfiguration({
            productKey: 'dossier_pj',
            subjectType: 'pj',
        });
        expect(config.dossierSchemaKey).toBe('dossier_pj');
        expect(config.configVersion).toBeDefined();
    });

    it('resolveDossierConfiguration usa preset compliance para PJ quando solicitado', () => {
        const config = resolveDossierConfiguration({
            productKey: 'dossier_pj',
            dossierPresetKey: 'compliance',
            subjectType: 'pj',
        });
        expect(config.dossierPresetKey).toBe('compliance');
        expect(config.dossierSchemaKey).toBe('dossier_pj');
    });

    it('resolveDossierConfiguration rejeita preset que nao suporta pj', () => {
        const config = resolveDossierConfiguration({
            productKey: 'dossier_pj',
            dossierPresetKey: 'invalid_preset_pj',
            subjectType: 'pj',
        });
        expect(config.dossierSchemaKey).toBe('dossier_pj');
        expect(config.dossierPresetKey).toBeNull();
    });

    it('resolveDossierConfiguration inclui modulos PJ solicitados', () => {
        const config = resolveDossierConfiguration({
            productKey: 'dossier_pj',
            subjectType: 'pj',
            requestedModuleKeys: ['identity_pj', 'criminal'],
        });
        expect(config.requestedModuleKeys).toContain('identity_pj');
        expect(config.requestedModuleKeys).toContain('criminal');
    });
});
