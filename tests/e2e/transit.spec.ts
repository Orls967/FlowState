import { test, expect } from '@playwright/test';

test('Transportasi Umum: tambah koridor BRT & MRT contoh', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#/transit');
  if (isMobile) await page.getByTestId('panel-toggle').click();
  await page.getByTestId('preset-brt').click();
  await page.getByTestId('preset-mrt').click();
  await expect(page.getByTestId('transit-lines')).toContainText('K1');
  await expect(page.getByTestId('transit-lines')).toContainText('MRT 1');
  await expect(page.getByTestId('mode-share')).toBeVisible();
  expect(errors).toEqual([]);
});
