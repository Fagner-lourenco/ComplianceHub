import { test, expect } from '@playwright/test';

test.describe('Smoke - Paginas Demo Cliente', () => {
  test('Demo Dashboard carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/demo/client/dashboard');
    await expect(page).toHaveURL(/\/demo\/client\/dashboard/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('Demo Solicitacoes carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/demo/client/solicitacoes');
    await expect(page).toHaveURL(/\/demo\/client\/solicitacoes/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('Demo Nova Solicitacao carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/demo/client/nova-solicitacao');
    await expect(page).toHaveURL(/\/demo\/client\/nova-solicitacao/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('Demo Relatorios carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/demo/client/relatorios');
    await expect(page).toHaveURL(/\/demo\/client\/relatorios/);
    await expect(page.locator('body')).toBeVisible();
    
    expect(consoleErrors).toHaveLength(0);
  });
});
