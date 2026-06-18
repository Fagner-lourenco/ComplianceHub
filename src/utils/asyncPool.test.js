import { describe, it, expect } from 'vitest';
import { asyncPool } from './asyncPool';

describe('asyncPool', () => {
    it('processa todos os itens', async () => {
        const items = [1, 2, 3, 4, 5];
        const result = await asyncPool(2, items, async (x) => x * 2);
        expect(result).toEqual([2, 4, 6, 8, 10]);
    });

    it('limita concorrência', async () => {
        const items = [1, 2, 3, 4, 5];
        let concurrent = 0;
        let maxConcurrent = 0;

        await asyncPool(2, items, async () => {
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await new Promise((resolve) => setTimeout(resolve, 10));
            concurrent -= 1;
            return 1;
        });

        expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('mantém ordem dos resultados', async () => {
        const items = ['a', 'b', 'c'];
        const result = await asyncPool(2, items, async (x) => x.toUpperCase());
        expect(result).toEqual(['A', 'B', 'C']);
    });

    it('funciona com concorrência 1 (sequencial)', async () => {
        const items = [1, 2, 3];
        const result = await asyncPool(1, items, async (x) => x + 1);
        expect(result).toEqual([2, 3, 4]);
    });
});
