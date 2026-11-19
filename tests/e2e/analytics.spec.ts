import { test, expect } from '@playwright/test';

test('Analitik: jalankan perbandingan skenario Lab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#/analytics?lab=roundabout&v=signal');
  await expect(page.getByTestId('scenario-a')).toBeVisible();
  await page.getByTestId('analytics-run').click();
  await expect(page.getByTestId('analytics-summary')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('analytics-results').locator('svg').first()).toBeVisible();
  expect(errors).toEqual([]);
});
