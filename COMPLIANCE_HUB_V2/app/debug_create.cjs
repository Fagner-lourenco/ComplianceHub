const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));

  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'teste@compliancehub.com');
  await page.fill('input[type="password"]', 'Teste123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  await page.goto('http://localhost:5173/dossie/create');
  await page.waitForTimeout(5000);

  const html = await page.content();
  console.log('HTML length:', html.length);

  await page.screenshot({ path: 'D:/ComplianceHub/COMPLIANCE_HUB_V2/debug_create.png' });

  await browser.close();
})();
