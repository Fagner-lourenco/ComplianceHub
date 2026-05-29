import { describe, it, expect, vi, beforeEach } from 'vitest';

const { renderHtmlToPdfBuffer, __test } = require('./pdfRenderer');

describe('pdfRenderer', () => {
    const mockBrowser = {
        newPage: vi.fn(),
        process: vi.fn(() => ({ pid: 123 })),
        close: vi.fn(),
    };

    const mockPage = {
        setDefaultTimeout: vi.fn(),
        emulateMediaType: vi.fn(),
        setContent: vi.fn(),
        evaluateHandle: vi.fn(),
        pdf: vi.fn(() => Buffer.from('mock-pdf')),
        close: vi.fn(() => Promise.resolve()),
    };

    const mockPuppeteer = {
        launch: vi.fn(() => Promise.resolve(mockBrowser)),
    };

    const mockChromium = {
        executablePath: vi.fn(() => Promise.resolve('/mock/chromium')),
        args: ['--no-sandbox'],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockBrowser.newPage.mockResolvedValue(mockPage);
        __test._setPuppeteer(mockPuppeteer);
        __test._setChromium(mockChromium);
        __test._resetBrowser();
    });

    it('renderiza HTML básico para PDF', async () => {
        const result = await renderHtmlToPdfBuffer('<html><body>Hello</body></html>');

        expect(result).toBeInstanceOf(Buffer);
        expect(result.toString()).toBe('mock-pdf');
        expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
        expect(mockPage.close).toHaveBeenCalledTimes(1);
        expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it('rejeita HTML inválido', async () => {
        await expect(renderHtmlToPdfBuffer(null)).rejects.toThrow('html obrigatorio');
        await expect(renderHtmlToPdfBuffer(123)).rejects.toThrow('html obrigatorio');
    });

    it('reutiliza instância do browser em chamadas subsequentes', async () => {
        await renderHtmlToPdfBuffer('<html><body>1</body></html>');
        await renderHtmlToPdfBuffer('<html><body>2</body></html>');

        expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
        expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
    });

    it('fecha página mas não o browser', async () => {
        await renderHtmlToPdfBuffer('<html><body>Test</body></html>');

        expect(mockPage.close).toHaveBeenCalledTimes(1);
        expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it('lida com erro de launch', async () => {
        mockPuppeteer.launch.mockRejectedValueOnce(new Error('Launch failed'));

        await expect(renderHtmlToPdfBuffer('<html><body></body></html>'))
            .rejects.toThrow('Launch failed');
    });

    it('tenta relancar browser depois de erro transiente de launch', async () => {
        mockPuppeteer.launch
            .mockRejectedValueOnce(new Error('Launch failed'))
            .mockResolvedValueOnce(mockBrowser);

        await expect(renderHtmlToPdfBuffer('<html><body></body></html>'))
            .rejects.toThrow('Launch failed');

        const result = await renderHtmlToPdfBuffer('<html><body>Retry</body></html>');

        expect(result).toBeInstanceOf(Buffer);
        expect(mockPuppeteer.launch).toHaveBeenCalledTimes(2);
    });
});
