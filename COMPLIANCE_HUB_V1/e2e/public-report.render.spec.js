import { test, expect } from '@playwright/test';

test.describe('Relatorio Publico - Renderizacao', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/r/test-case-1');
    await page.waitForLoadState('networkidle');
  });

  test('Pagina carrega sem erros', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/demo/r/test-case-1');
    await page.waitForLoadState('networkidle');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Conteudo da pagina visivel', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(10);
  });

  test('Iframe existe (se houver conteudo)', async ({ page }) => {
    const iframes = page.locator('iframe');
    const count = await iframes.count();
    if (count > 0) {
      await expect(iframes.first()).toBeVisible();
    }
  });

  test('Nao ha erro de CSP', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/demo/r/test-case-1');
    await page.waitForLoadState('networkidle');
    const cspErrors = consoleErrors.filter(e => e.includes('Content Security') || e.includes('csp'));
    expect(cspErrors).toHaveLength(0);
  });
});
