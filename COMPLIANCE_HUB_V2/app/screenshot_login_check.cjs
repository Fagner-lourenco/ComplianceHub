const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:5173/login');
  console.log('Before login URL:', page.url());

  await page.fill('input[type="email"]', 'teste@compliancehub.com');
  await page.fill('input[type="password"]', 'Teste123!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(5000);
  console.log('After login URL:', page.url());

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text:', bodyText.substring(0, 300));

  await page.screenshot({ path: 'D:/ComplianceHub/COMPLIANCE_HUB_V2/screenshot_after_login.png' });

  await browser.close();
})();
