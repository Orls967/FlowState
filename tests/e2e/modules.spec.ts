import { test, expect } from '@playwright/test';

const ROUTES = [
  '/',
  '/city',
  '/editor',
  '/lab',
  '/lab/braess',
  '/transit',
  '/analytics',
  '/glossary',
  '/about',
];

test('setiap modul terbuka tanpa galat, di kedua bahasa', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  for (const r of ROUTES) {
    await page.goto(`./#${r}`);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1').first()).toBeAttached();
  }
  await page.evaluate(() => localStorage.setItem('flowstate.lang', 'en'));
  for (const r of ['/glossary', '/about', '/lab']) {
    await page.goto(`./#${r}`);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  }
  await expect(page.locator('h1').first()).toContainText('Phenomena');
  expect(errors).toEqual([]);
});

test('pencarian global Ctrl+K menemukan istilah & membuka glosarium', async ({ page }) => {
  await page.goto('./#/');
  await expect(page.locator('h1').first()).toBeVisible();
  await page.keyboard.press('Control+k');
  const input = page.getByPlaceholder(/Cari modul|Search modules/);
  await expect(input).toBeFocused();
  await input.fill('braess');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/lab\/braess|glossary/);
});

test('glosarium bisa disaring dan tautan langsung ke istilah', async ({ page }) => {
  await page.goto('./#/glossary#zipper');
  await expect(page.getByTestId('term-zipper')).toBeVisible();
  await page.getByTestId('glossary-filter').fill('bundaran');
  await expect(page.getByTestId('term-roundabout')).toBeVisible();
  await expect(page.getByTestId('term-idm')).toHaveCount(0);
});
