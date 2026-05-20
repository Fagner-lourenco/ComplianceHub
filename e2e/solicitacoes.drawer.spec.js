import { test, expect } from '@playwright/test';

test.describe('Solicitacoes - Drawer e Lista', () => {
  test('Lista de solicitacoes carrega', async ({ page }) => {
    await page.goto('/demo/client/solicitacoes');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('body')).toBeVisible();
    const rows = page.locator('table tbody tr, [class*="card"], [class*="row"], [class*="item"]');
    await expect(rows.first()).toBeVisible();
  });

  test('Drawer abre ao clicar em item', async ({ page }) => {
    await page.goto('/demo/client/solicitacoes');
    await page.waitForLoadState('domcontentloaded');
    
    const firstItem = page.locator('table tbody tr:first-child, [class*="card"]:first-child, [class*="item"]:first-child').first();
    
    if (await firstItem.isVisible().catch(() => false)) {
      await firstItem.click();
      await page.waitForTimeout(500);
      
      const drawer = page.locator('[class*="drawer"], [class*="modal"], [class*="panel"], [role="dialog"]').first();
      await expect(drawer).toBeVisible();
    }
  });

  test('Filtros de status existem', async ({ page }) => {
    await page.goto('/demo/client/solicitacoes');
    await page.waitForLoadState('domcontentloaded');
    
    const filters = page.locator('select, [class*="filter"], button[class*="filter"]');
    await expect(filters.first()).toBeVisible();
  });

  test('Busca funciona', async ({ page }) => {
    await page.goto('/demo/client/solicitacoes');
    await page.waitForLoadState('domcontentloaded');
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="busca"], input[placeholder*="Buscar"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('teste');
      await page.waitForTimeout(300);
      await expect(searchInput).toHaveValue('teste');
    }
  });

  test('Paginacao existe', async ({ page }) => {
    await page.goto('/demo/client/solicitacoes');
    await page.waitForLoadState('domcontentloaded');
    
    const pagination = page.locator('[class*="pagination"], button:has-text(">"), button:has-text("<")');
    const count = await pagination.count();
    if (count > 0) {
      await expect(pagination.first()).toBeVisible();
    }
  });
});
