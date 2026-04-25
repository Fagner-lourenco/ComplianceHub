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

    it('returns empty responseData when no lawsuits', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                has_lawsuits: false,
                request_id: 'req-456',
                lawsuits: [],
            }),
        }));

        const result = await queryLawsuitsSync('05023290336', 'fake-api-key');
        expect(result.hasLawsuits).toBe(false);
        expect(result.responseData).toEqual([]);
    });

    it('sets api-key header with apiKey', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ has_lawsuits: false, request_id: 'req-000', lawsuits: [] }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await queryLawsuitsSync('05023290336', 'my-secret-key');
        const headers = fetchMock.mock.calls[0][1].headers;
        expect(headers['api-key']).toBe('my-secret-key');
    });

    it('formats CPF in search.search_key of request body', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ has_lawsuits: false, request_id: 'req-789', lawsuits: [] }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await queryLawsuitsSync('05023290336', 'fake-api-key');
        const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(requestBody.search.search_key).toBe('050.232.903-36');
    });

    it('includes process_status in request body', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ has_lawsuits: false, request_id: 'req-999', lawsuits: [] }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await queryLawsuitsSync('05023290336', 'fake-api-key');
        const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(requestBody.process_status).toBe(true);
    });
});
