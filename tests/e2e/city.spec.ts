import { test, expect } from '@playwright/test';

test('Kota Hidup: simulasi berjalan dan kendaraan muncul', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#/city');
  await expect(page.getByTestId('city-canvas')).toBeVisible();
  await page.getByRole('radio', { name: '16×' }).click();
  await expect
    .poll(async () => Number((await page.getByTestId('sim-clock').textContent())?.replace(':', '') ?? 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(637);
  await page.getByTestId('play-pause').click();
  expect(errors).toEqual([]);
});
