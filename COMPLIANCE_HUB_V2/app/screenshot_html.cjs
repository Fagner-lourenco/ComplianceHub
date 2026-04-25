const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'teste@compliancehub.com');
  await page.fill('input[type="password"]', 'Teste123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/dossie/create');
  await page.waitForTimeout(3000);

  const html = await page.content();
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('=== BODY TEXT ===');
  console.log(bodyText.substring(0, 500));
  console.log('=== HTML (first 2000 chars) ===');
  console.log(html.substring(0, 2000));

  await browser.close();
})();
