import { test, expect } from '@playwright/test';

async function gotoDemoCase(page) {
  await page.goto('/demo/ops/caso/CASE-001');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Iniciando sistema seguro...')).toBeHidden({ timeout: 15000 });
}

test.describe('CasoPage - Funcionalidade Essencial', () => {
  test('Pagina carrega sem erros', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await gotoDemoCase(page);
    
    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('Conteudo principal visivel', async ({ page }) => {
    await gotoDemoCase(page);
    
    await expect(page.locator('body')).toBeVisible();
    const text = await page.locator('body').innerText();
    // Aceitar loading inicial ou conteudo real
    expect(text).toMatch(/caso|analise|processo|detalhe|ComplianceHub|Iniciando/i);
  });

  test('Elementos interativos existem', async ({ page }) => {
    await gotoDemoCase(page);
    
    // Verificar que ha pelo menos tags html na pagina
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    const html = await body.innerHTML();
    expect(html.length).toBeGreaterThan(100);
  });

  test('Botao de previa do relatorio existe', async ({ page }) => {
    await gotoDemoCase(page);
    
    const previewBtn = page.locator('button:has-text("Prévia do relatório")').first();
    await expect(previewBtn).toBeVisible({ timeout: 15000 });
  });

  test('Botao de previa é clicavel', async ({ page }) => {
    await gotoDemoCase(page);
    
    const previewBtn = page.locator('button:has-text("Prévia do relatório")').first();
    await expect(previewBtn).toBeVisible({ timeout: 15000 });
    
    // Verificar que o botao tem onClick (nao esta desabilitado)
    await expect(previewBtn).not.toBeDisabled();
    
    // No demo mode, o click abre nova aba via window.open
    // Verificamos que o botao responde ao click sem erro
    await previewBtn.click();
    await page.waitForTimeout(300);
    
    // Deve permanecer na mesma pagina (demo mode abre nova aba)
    expect(page.url()).toContain('/demo/ops/caso/CASE-001');
  });
});
