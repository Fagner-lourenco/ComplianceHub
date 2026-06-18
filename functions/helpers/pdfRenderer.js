const Chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Cache global na instância da function (persiste entre warm starts)
let browserPromise = null;

// Injeção para testes
let _puppeteer = puppeteer;
let _chromium = Chromium;

async function getBrowser() {
    if (browserPromise) {
        try {
            const browser = await browserPromise;
            // Health check: verificar se o processo ainda existe
            if (browser.process() != null) {
                return browser;
            }
        } catch {
            // Browser morreu, recriar
        }
        browserPromise = null;
    }

    console.log('[pdfRenderer] Launching Chromium (persistent instance)...');
    _chromium.graphicsMode = false;

    try {
        const executablePath = await _chromium.executablePath();
        browserPromise = _puppeteer.launch({
            args: [
                ..._chromium.args,
                '--disable-gpu',
                '--font-render-hinting=none',
            ],
            defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
            executablePath,
            headless: 'shell',
        });

        return await browserPromise;
    } catch (err) {
        browserPromise = null;
        throw err;
    }
}

/**
 * Renderiza HTML para um buffer PDF usando Puppeteer + Chromium.
 *
 * @param {string} html - HTML completo a ser renderizado.
 * @param {object} options - Opções de renderização.
 * @param {number} [options.timeoutMs=60000] - Timeout geral.
 * @param {number} [options.setContentTimeoutMs=60000] - Timeout para setContent.
 * @param {number} [options.pdfTimeoutMs=60000] - Timeout para page.pdf().
 * @returns {Promise<Buffer>} Buffer do PDF gerado.
 */
async function renderHtmlToPdfBuffer(html, options = {}) {
    if (!html || typeof html !== 'string') {
        throw new Error('renderHtmlToPdfBuffer: html obrigatorio.');
    }

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        page.setDefaultTimeout(options.timeoutMs || 60000);
        console.log('[pdfRenderer] New page created, setting content...');

        await page.emulateMediaType('print');
        await page.setContent(html, {
            waitUntil: ['load', 'domcontentloaded'],
            timeout: options.setContentTimeoutMs || 60000,
        });
        console.log('[pdfRenderer] Content set, waiting for fonts...');

        try {
            await page.evaluateHandle('document.fonts && document.fonts.ready');
        } catch (fontErr) {
            console.warn('[pdfRenderer] Font ready check failed (non-critical):', fontErr.message);
        }

        console.log('[pdfRenderer] Generating PDF...');
        const rawPdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: false,
            margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
            timeout: options.pdfTimeoutMs || 60000,
        });
        // Puppeteer 22+ returns Uint8Array; Buffer is required for .toString('base64')
        const pdfBuffer = Buffer.isBuffer(rawPdf) ? rawPdf : Buffer.from(rawPdf);
        console.log(`[pdfRenderer] PDF generated, buffer size=${pdfBuffer.length}, isBuffer=${Buffer.isBuffer(pdfBuffer)}`);
        return pdfBuffer;
    } catch (launchErr) {
        console.error('[pdfRenderer] Fatal error during PDF rendering:', launchErr.message, launchErr.stack);
        throw launchErr;
    } finally {
        // Fechar a página, mas NÃO o browser (reutilização)
        await page.close().catch((err) => console.warn('[pdfRenderer] Page close error (non-critical):', err.message));
    }
}

module.exports = {
    renderHtmlToPdfBuffer,
    __test: {
        _setPuppeteer(mock) { _puppeteer = mock; },
        _setChromium(mock) { _chromium = mock; },
        _resetBrowser() { browserPromise = null; },
    },
};
