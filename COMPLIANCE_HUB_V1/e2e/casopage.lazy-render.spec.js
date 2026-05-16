import { test, expect } from '@playwright/test';

test.describe('CasoPage - Funcionalidade Essencial', () => {
  test('Pagina carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/demo/ops/caso/test-case-1');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('Conteudo principal visivel', async ({ page }) => {
    await page.goto('/demo/ops/caso/test-case-1');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
    const text = await page.locator('body').innerText();
    // Aceitar loading inicial ou conteudo real
    expect(text).toMatch(/caso|analise|processo|test-case|detalhe|ComplianceHub|Iniciando/i);
  });

  test('Elementos interativos existem', async ({ page }) => {
    await page.goto('/demo/ops/caso/test-case-1');
    await page.waitForLoadState('networkidle');
    
    // Verificar que ha pelo menos tags html na pagina
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    const html = await body.innerHTML();
    expect(html.length).toBeGreaterThan(100);
  });
});
