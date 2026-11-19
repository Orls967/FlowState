import { test, expect } from '@playwright/test';

test('beranda tampil, bahasa & tema bisa diganti', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('macet');
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');

  await page.getByTestId('settings-button').click();
  await page.getByRole('radio', { name: 'EN', exact: true }).last().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toContainText('jam');

  await page.getByRole('radio', { name: 'Dark', exact: true }).last().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
