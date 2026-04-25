import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeBillingPeriod, _setDb } from './v2BillingEngine.js';

function makeDb(meters = []) {
    const set = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({
        docs: meters.map((meter) => ({
            id: meter.id,
            data: () => meter,
        })),
    });
    const whereMonth = vi.fn(() => ({ get }));
    const whereTenant = vi.fn(() => ({ where: whereMonth }));
    const collection = vi.fn((name) => {
        if (name === 'usageMeters') return { where: whereTenant };
        if (name === 'billingSettlements') return { doc: vi.fn(() => ({ set })) };
        throw new Error(`unexpected collection ${name}`);
    });
    return { db: { collection }, set, get, whereTenant, whereMonth };
}

describe('v2BillingEngine.closeBillingPeriod', () => {
    afterEach(() => {
        _setDb(null);
    });

    it('fecha periodo mensal consultando usageMeters por tenantId e monthKey', async () => {
        const { db, set, whereTenant, whereMonth } = makeDb([
            {
                id: 'meter-1',
                tenantId: 'tenant-1',
                monthKey: '2026-04',
                moduleKey: 'criminal',
                unit: 'module_execution',
                quantity: 2,
                commercialBillable: true,
            },
        ]);
        _setDb(db);

        const result = await closeBillingPeriod('tenant-1', '2026-04');

        expect(whereTenant).toHaveBeenCalledWith('tenantId', '==', 'tenant-1');
        expect(whereMonth).toHaveBeenCalledWith('monthKey', '==', '2026-04');
        expect(set).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            monthKey: '2026-04',
            itemCount: 1,
            status: 'PENDING_REVIEW',
            source: 'usageMeters',
        }), { merge: true });
        expect(result.summary.source).toBe('usageMeters');
        expect(result.summary.totalQuantity).toBe(2);
    });

    it('retorna entryCount 0 quando nao ha meters', async () => {
        const { db, set } = makeDb([]);
        _setDb(db);

        const result = await closeBillingPeriod('tenant-1', '2026-04');

        expect(result.summary.entryCount).toBe(0);
        expect(result.summary.totalQuantity).toBe(0);
        expect(set).toHaveBeenCalledWith(expect.objectContaining({
            itemCount: 0,
            summary: expect.objectContaining({ entryCount: 0, totalQuantity: 0 }),
        }), { merge: true });
    });

    it('soma quantities de multiplos meters', async () => {
        const { db } = makeDb([
            { id: 'm1', tenantId: 't1', monthKey: '2026-04', moduleKey: 'criminal', unit: 'module_execution', quantity: 2, commercialBillable: true, internalCost: true },
            { id: 'm2', tenantId: 't1', monthKey: '2026-04', moduleKey: 'labor', unit: 'module_execution', quantity: 3, commercialBillable: true, internalCost: true },
        ]);
        _setDb(db);

        const result = await closeBillingPeriod('t1', '2026-04');
        expect(result.summary.totalQuantity).toBe(5);
        expect(result.summary.entryCount).toBe(2);
    });

    it('ignora custo interno quando internalCost nao esta ativo', async () => {
        const { db } = makeDb([
            { id: 'm1', tenantId: 't1', monthKey: '2026-04', moduleKey: 'criminal', unit: 'module_execution', quantity: 2, commercialBillable: true, internalCost: false },
        ]);
        _setDb(db);

        const result = await closeBillingPeriod('t1', '2026-04');
        expect(result.summary.totalQuantity).toBe(2);
        expect(result.summary.totalInternalCostBrl).toBe(0);
    });
});
