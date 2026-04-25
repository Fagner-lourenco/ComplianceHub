import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test('página de login é renderizada', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /compliancehub/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('redireciona não autenticado para login', async ({ page }) => {
    await page.goto('/dossie');
    await expect(page).toHaveURL(/\/login/);
  });
});
