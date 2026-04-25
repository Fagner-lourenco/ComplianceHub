const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'teste@compliancehub.com');
  await page.fill('input[type="password"]', 'Teste123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  await page.goto('http://localhost:5173/dossie/create');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'D:/ComplianceHub/COMPLIANCE_HUB_V2/screenshot_create_wait.png' });

  await page.goto('http://localhost:5173/hub');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'D:/ComplianceHub/COMPLIANCE_HUB_V2/screenshot_hub_wait.png' });

  await page.goto('http://localhost:5173/dossie');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'D:/ComplianceHub/COMPLIANCE_HUB_V2/screenshot_list_wait.png' });

  await page.goto('http://localhost:5173/analyse/dossier_pf_basic');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'D:/ComplianceHub/COMPLIANCE_HUB_V2/screenshot_pipeline_wait.png' });

  await browser.close();
  console.log('Done');
})();
