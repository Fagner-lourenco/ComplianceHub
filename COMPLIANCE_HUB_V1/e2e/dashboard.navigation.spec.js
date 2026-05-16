import { test, expect } from '@playwright/test';

test.describe('Dashboard - Navegacao', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/client/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('Pagina carrega sem erros', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/demo/client/dashboard');
    await page.waitForLoadState('networkidle');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Cards ou metricas visiveis', async ({ page }) => {
    const cards = page.locator('article, [class*="card"], [class*="metric"], [class*="stat"]');
    await expect(cards.first()).toBeVisible();
  });

  test('Links de navegacao existem', async ({ page }) => {
    const links = page.locator('a[href*="solicitacoes"], a[href*="nova"], a[href*="relatorio"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Header ou titulo visivel', async ({ page }) => {
    const header = page.locator('h1, h2, [class*="header"], [class*="title"]').first();
    await expect(header).toBeVisible();
  });
});
