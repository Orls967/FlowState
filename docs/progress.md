# Progres FlowState

| Fase | Isi | Status |
| --- | --- | --- |
| 1 | Scaffold, design tokens, i18n, tema, layout, routing, workflow deploy | ✅ |
| 2 | Inti simulasi di Worker + test (IDM, graf jalan, routing, sinyal) | ✅ |
| 3 | Generator kota + rendering instanced + Kota Hidup | ⏳ |
| 4 | Editor Jalan + simpan/muat/bagikan | ⏳ |
| 5 | Lab Fenomena | ⏳ |
| 6 | Transportasi Umum | ⏳ |
| 7 | Analitik & perbandingan skenario | ⏳ |
| 8 | Glosarium, pencarian, Tentang, optimasi HP, test, README | ⏳ |

## Fase 1 — catatan
- Vite 8 + React 19 + TypeScript strict; Tailwind v4 dengan token di `src/styles/index.css` (CSS variables per tema).
- Tema Terang/Gelap/Ikuti sistem diterapkan oleh skrip inline di `index.html` sebelum render pertama (tanpa kedip).
- Bahasa ID (default) / EN lewat i18next; preferensi di localStorage (dibungkus try/catch); `lang` di `<html>` ikut berubah.
- HashRouter, halaman di-lazy-load; error boundary per halaman; pencarian global Ctrl/⌘+K.
- Service worker runtime-cache (`public/sw.js`) agar bisa offline setelah dimuat.
- Workflow `.github/workflows/deploy.yml`: lint → unit test → build → deploy ke GitHub Pages.
  Di Settings → Pages repo, sumber harus diset ke **GitHub Actions**.

## Fase 2 — catatan
- `src/lib/sim`: RNG sfc32 ber-seed, IDM + skema balistik, MOBIL, kompilasi graf jalan (link berarah, lajur, geometri simpang,
  tabel konflik movement), A* berbasis link, lampu berfase + offset gelombang hijau, permintaan zona berprofil jam, mesin `Simulation`.
- Persimpangan: lampu, prioritas/yield (celah kritis), semua-mengalah, bundaran, zebra cross dengan pejalan kaki.
- Angkutan umum: bus/BRT (lajur khusus, halte, dwell), MRT (posisi kereta analitis), pemilihan moda logit.
- Worker: `src/workers/runtime.ts` (loop fixed-timestep, frame `Float32Array` di-transfer, statistik 4 Hz, mode headless),
  `simHost.ts` dengan cadangan thread utama bila Worker tidak tersedia. Tanpa SharedArrayBuffer.
- Benchmark lokal: ±2.500 kendaraan aktif ≈ 3 ms per langkah 0,2 s (Node 22).
- Detail model & sumber: [model-notes.md](model-notes.md).
