const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'teste@compliancehub.com');
  await page.fill('input[type="password"]', 'Teste123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  const pages = [
    { url: 'http://localhost:5173/dossie', name: 'list' },
    { url: 'http://localhost:5173/dossie/create', name: 'create' },
    { url: 'http://localhost:5173/hub', name: 'hub' },
    { url: 'http://localhost:5173/analyse/dossier_pf_basic', name: 'pipeline' },
  ];

  for (const p of pages) {
    await page.goto(p.url);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `D:/ComplianceHub/COMPLIANCE_HUB_V2/screenshot_${p.name}_v2.png` });
    console.log(`Screenshot: ${p.name}`);
  }

  await browser.close();
  console.log('Done');
})();
