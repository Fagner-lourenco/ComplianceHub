import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { queryLawsuitsSync } = require('./judit.js');

describe('queryLawsuitsSync', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('maps sync datalake payloads that return lawsuits[]', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                has_lawsuits: true,
                request_id: 'req-123',
                lawsuits: [{ code: '0202743-72.2022.8.06.0167' }],
            }),
        }));

        const result = await queryLawsuitsSync('05023290336', 'fake-api-key');

        expect(result.hasLawsuits).toBe(true);
        expect(result.requestId).toBe('req-123');
        expect(result.responseData).toEqual([{ code: '0202743-72.2022.8.06.0167' }]);
        expect(result._request.body.process_status).toBe(true);
    });
});
