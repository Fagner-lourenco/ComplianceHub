import { test, expect } from '@playwright/test';

test.describe('Smoke - Login e Relatorio Publico', () => {
  test('Login page carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('Demo Relatorio Publico carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/demo/r/test-case-1');
    await expect(page).toHaveURL(/\/demo\/r\/test-case-1/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });
});
