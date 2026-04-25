import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const catalog = JSON.parse(fs.readFileSync('d:/ComplianceHub/COMPLIANCE_HUB_V2/docs/bdc_catalog.json', 'utf8'));
const outDir = 'd:/ComplianceHub/COMPLIANCE_HUB_V2/docs/manual/bdg_scraped';
const hydratedSlugs = new Set([
  'pessoas-kyc-e-compliance',
  'empresas-kyc-e-compliance',
  'empresas-kyc-e-compliance-dos-socios',
  'empresas-kyc-e-compliance-dos-funcionarios',
  'pessoas-processos-judiciais-e-administrativos',
  'empresas-kyc-e-compliance-do-grupo-economico',
  'pessoas-presenca-online',
  'pessoas-dados-cadastrais-basicos',
  'empresas-dados-cadastrais-basicos',
  'empresas-processos-judiciais-e-administrativos',
]);

const remaining = catalog.filter(e => !hydratedSlugs.has(e.slug));
console.log(`Scraping ${remaining.length} pages...`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

let done = 0;
for (const entry of remaining) {
  const outFile = path.join(outDir, entry.slug + '.md');
  if (fs.existsSync(outFile)) {
    done++;
    continue;
  }
  try {
    await page.goto(entry.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(outFile, `# ${entry.num}. ${entry.title}\n\nURL: ${entry.url}\n\n${text}`, 'utf8');
    done++;
    console.log(`[${done}/${remaining.length}] ${entry.slug}`);
  } catch (err) {
    console.log(`[FAIL] ${entry.slug}: ${err.message}`);
  }
}

await browser.close();
console.log('Done.');
