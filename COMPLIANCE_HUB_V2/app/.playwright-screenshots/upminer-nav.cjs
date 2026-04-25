const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('https://app.getdemo.com.br/d/dossies#####');
  await page.waitForTimeout(2000);

  // Try to remove/hide the modal via JS
  await page.evaluate(() => {
    const modals = document.querySelectorAll('[role="dialog"], .modal, .overlay, [class*="modal"], [class*="overlay"]');
    modals.forEach(m => m.remove());
    // Also remove backdrop/blur
    const backdrops = document.querySelectorAll('[class*="backdrop"], [class*="blur"]');
    backdrops.forEach(b => b.remove());
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.playwright-screenshots/upminer-02.png', fullPage: true });

  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.playwright-screenshots/upminer-03.png', fullPage: false });

  await page.evaluate(() => window.scrollTo(0, 1800));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.playwright-screenshots/upminer-04.png', fullPage: false });

  await browser.close();
})();
