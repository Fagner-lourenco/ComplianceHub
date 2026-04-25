const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'teste@compliancehub.com');
  await page.fill('input[type="password"]', 'Teste123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/dossie/create');
  await page.waitForTimeout(3000);

  const styles = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const main = document.querySelector('main');
    const body = document.body;
    return {
      h1Color: h1 ? getComputedStyle(h1).color : 'no h1',
      h1Bg: h1 ? getComputedStyle(h1).backgroundColor : 'no h1',
      mainBg: main ? getComputedStyle(main).backgroundColor : 'no main',
      bodyBg: getComputedStyle(body).backgroundColor,
      bodyColor: getComputedStyle(body).color,
    };
  });

  console.log(styles);
  await browser.close();
})();
