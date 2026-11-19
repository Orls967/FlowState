import { test, expect } from '@playwright/test';

test('Lab: buka eksperimen, ganti varian, rem mendadak', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#/lab');
  await page.getByTestId('lab-item-sugiyama').click();
  await expect(page.getByTestId('results-table')).toBeVisible();
  await expect(page.getByTestId('space-time')).toBeVisible();
  await page.getByRole('radio', { name: '16×' }).click();
  await page.getByTestId('brake-now').click();
  await page.getByTestId('variant-smooth').click();
  await expect(page.getByTestId('variant-smooth')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('live-metrics')).toContainText(/\d/);
  // istilah glosarium tertaut otomatis
  await expect(page.locator('article a[href*="glossary#"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});
