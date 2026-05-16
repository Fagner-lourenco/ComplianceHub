import { test, expect } from '@playwright/test';

test.describe('Smoke - Paginas Demo Ops', () => {
  test('Demo Fila carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/demo/ops/fila');
    await expect(page).toHaveURL(/\/demo\/ops\/fila/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('Demo Casos carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/demo/ops/casos');
    await expect(page).toHaveURL(/\/demo\/ops\/casos/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('Demo CasoPage carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/demo/ops/caso/CASE-001');
    await expect(page).toHaveURL(/\/demo\/ops\/caso\/CASE-001/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });
});
