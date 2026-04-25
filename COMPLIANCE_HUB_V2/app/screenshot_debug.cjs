const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const logs = [];
  page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => logs.push(`PAGE ERROR: ${err.message}`));

  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'teste@compliancehub.com');
  await page.fill('input[type="password"]', 'Teste123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Go to create page
  await page.goto('http://localhost:5173/dossie/create');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'D:/ComplianceHub/COMPLIANCE_HUB_V2/screenshot_create_debug.png' });

  console.log('=== CONSOLE LOGS ===');
  logs.forEach(l => console.log(l));

  await browser.close();
})();
