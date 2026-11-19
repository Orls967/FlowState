# CLAUDE.md — aturan kerja repo FlowState

## Aturan Git (WAJIB)
- Commit sesedikit mungkin: SATU commit per fase (total ±8 commit). Jangan commit untuk perbaikan kecil di tengah fase; kumpulkan dulu, commit saat fase selesai dan build + test lulus.
- Pesan commit singkat dan jelas, format: `feat: fase N — <ringkasan>` (atau `fix:` / `docs:` bila perlu).
- JANGAN tambahkan baris `Co-Authored-By`, "Generated with ...", tautan sesi, atau atribusi AI apa pun di pesan commit, deskripsi PR, README, maupun file lain. Commit hanya atas nama pemilik repo.
- Push langsung ke branch `main` kecuali diminta lain.

## Ringkasan proyek
- Vite + React + TypeScript strict (tanpa `any`), three.js via @react-three/fiber.
- 100% client-side; tanpa backend, akun, atau tracking. HashRouter + `base: '/FlowState/'` untuk GitHub Pages.
- Logika simulasi murni ada di `src/lib/sim` dan `src/lib/city` (tanpa DOM/React) dan diuji dengan Vitest di `tests/unit`.
- Semua teks UI lewat kunci i18next (`src/i18n/locales`), konten dwibahasa `{ id, en }` di `src/content` divalidasi Zod.
- Jangan pakai SharedArrayBuffer (Pages tidak bisa set COOP/COEP). Data frame dikirim sebagai typed array yang di-transfer.

## Perintah
- `npm run dev` — server pengembangan
- `npm run build` — typecheck + build produksi
- `npm test` — unit test (Vitest)
- `npm run test:e2e` — smoke test Playwright
- `npm run lint` — ESLint
