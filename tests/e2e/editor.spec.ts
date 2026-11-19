import { test, expect } from '@playwright/test';
import { encodeCity } from '../../src/lib/city/serialize';
import { gridCity } from '../../src/lib/city/builders';

test('Editor: gambar jalan lalu undo', async ({ page }) => {
  await page.goto('./#/editor');
  const stats = page.getByTestId('editor-stats');
  await expect(stats).toBeVisible();
  const before = await stats.textContent();
  await page.getByTestId('mode-draw').click();
  const box = (await page.getByTestId('city-canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.42);
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.55);
  await expect(stats).not.toHaveText(before ?? '');
  await page.getByTestId('undo').click();
  await page.getByTestId('undo').click();
  await expect(stats).toHaveText(before ?? '');
});

test('Editor: memuat kota dari tautan bersama', async ({ page }) => {
  const city = gridCity(2, 3, 120);
  await page.goto(`./#/editor?c=${encodeCity(city)}`);
  await expect(page.getByTestId('editor-stats')).toContainText('6');
  await expect(page.getByTestId('editor-stats')).toContainText('7');
});
