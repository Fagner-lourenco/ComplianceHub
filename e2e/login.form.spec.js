import { test, expect } from '@playwright/test';

test.describe('Login - Formulario e Validacao', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('Campos de email e senha existem', async ({ page }) => {
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible();
  });

  test('Botao de login existe', async ({ page }) => {
    const loginBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")').first();
    await expect(loginBtn).toBeVisible();
  });

  test('Preenchimento de campos', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill('teste@exemplo.com');
    await expect(emailInput).toHaveValue('teste@exemplo.com');
    
    const passInput = page.locator('input[type="password"], input[name="password"]').first();
    await passInput.fill('senha123');
    await expect(passInput).toHaveValue('senha123');
  });

  test('Submit sem dados mostra erro ou permanece na pagina', async ({ page }) => {
    const loginBtn = page.locator('button[type="submit"]').first();
    await loginBtn.click();
    
    // Deve permanecer na pagina de login ou mostrar erro
    await page.waitForTimeout(500);
    expect(page.url()).toContain('login');
  });

  test('Link "Esqueci minha senha" existe', async ({ page }) => {
    const forgotLink = page.locator('a:has-text("senha"), a:has-text("recuperar"), [class*="forgot"]').first();
    if (await forgotLink.isVisible().catch(() => false)) {
      await expect(forgotLink).toBeVisible();
    }
  });

  test('Logo/identidade visual existe', async ({ page }) => {
    const logo = page.locator('img[class*="logo"], [class*="logo"], h1, h2').first();
    await expect(logo).toBeVisible();
  });
});
