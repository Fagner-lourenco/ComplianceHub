const Chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

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

    let browser = null;
    try {
        console.log('[pdfRenderer] Resolving Chromium executable path...');
        // Disable graphics to avoid swiftshader extraction issues in serverless
        Chromium.graphicsMode = false;
        const executablePath = await Chromium.executablePath();
        console.log(`[pdfRenderer] Chromium path resolved: ${executablePath}`);

        const launchArgs = [
            ...Chromium.args,
            '--disable-gpu',
            '--font-render-hinting=none',
        ];

        console.log(`[pdfRenderer] Launching Puppeteer with ${launchArgs.length} args, headless=shell...`);
        browser = await puppeteer.launch({
            args: launchArgs,
            defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
            executablePath,
            headless: 'shell',
        });
        console.log('[pdfRenderer] Browser launched successfully');

        const page = await browser.newPage();
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
        if (browser) {
            console.log('[pdfRenderer] Closing browser...');
            await browser.close().catch((err) => console.warn('[pdfRenderer] Browser close error (non-critical):', err.message));
        }
    }
}

module.exports = { renderHtmlToPdfBuffer };
