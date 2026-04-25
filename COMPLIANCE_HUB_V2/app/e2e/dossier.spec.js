import { test, expect } from '@playwright/test';

test.describe('Dossiê / Análises', () => {
  test('página de listagem renderiza estados', async ({ page }) => {
    await page.goto('/dossie');
    // Se não autenticado, redireciona para login
    if (page.url().includes('/login')) {
      await expect(page.getByRole('heading', { name: /compliancehub/i })).toBeVisible();
      return;
    }
    await expect(page.getByRole('heading', { name: /análises/i })).toBeVisible();
  });

  test('navegação para criação de análise', async ({ page }) => {
    await page.goto('/dossie');
    if (page.url().includes('/login')) return;
    await page.getByRole('button', { name: /criar nova análise/i }).click();
    await expect(page).toHaveURL(/\/dossie\/create/);
  });
});
