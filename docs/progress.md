# Progres FlowState

| Fase | Isi | Status |
| --- | --- | --- |
| 1 | Scaffold, design tokens, i18n, tema, layout, routing, workflow deploy | ✅ |
| 2 | Inti simulasi di Worker + test (IDM, graf jalan, routing, sinyal) | ✅ |
| 3 | Generator kota + rendering instanced + Kota Hidup | ✅ |
| 4 | Editor Jalan + simpan/muat/bagikan | ✅ |
| 5 | Lab Fenomena | ✅ |
| 6 | Transportasi Umum | ✅ |
| 7 | Analitik & perbandingan skenario | ✅ |
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

## Fase 3 — catatan
- `src/lib/city/generator.ts`: grid berjitter ber-seed dengan hierarki jalan (arteri 2–3 lajur, lokal 1 lajur), ruas lokal dihapus
  acak tanpa memutus graf, pasangan jalan satu arah, lampu di simpang arteri, bundaran di pinggiran, zona berlapis dari pusat.
- `src/lib/city/decor.ts`: gedung, taman, pohon, lampu jalan ditempatkan di sepanjang jalan (berlaku untuk kota apa pun, termasuk buatan editor).
- Scene R3F: jalan/marka/zebra/lajur bus digabung jadi satu `BufferGeometry`; gedung `InstancedMesh` dengan shader jendela
  yang menyala saat malam; kendaraan `InstancedMesh` per jenis + interpolasi antar-tick + LOD (kotak sederhana di jauh) + culling frustum;
  lampu kendaraan & lampu jalan di malam hari; bloom hanya di tema gelap & kualitas ≥ sedang.
- Kualitas otomatis: tebakan awal dari perangkat + pemantau FPS yang menurunkan kualitas (DPR, bayangan, bloom, batas kendaraan, jarak LOD).
- Kota Hidup: kontrol waktu (jeda/1×/4×/16×, spasi), siklus siang–malam dari jam simulasi, klik kendaraan → info, rute, kamera mengikuti.

## Fase 4 — catatan
- `src/lib/city/edit.ts`: operasi murni (tambah/bagi/hapus simpang & ruas, ubah properti, cari terdekat) — diuji unit.
- `src/lib/city/serialize.ts`: JSON (divalidasi Zod) dan bentuk ringkas terkompresi lz-string untuk tautan `#/editor?c=…`.
- Editor: mode Pilih/Gambar/Hapus/Zona/Simulasikan (pintasan V/D/E/Z/S), undo/redo (Ctrl/⌘+Z, Shift+Z, Y) berbasis snapshot,
  titik baru menempel ke simpang atau membagi ruas terdekat, properti ruas (lajur, batas kecepatan, satu arah, lajur bus)
  dan simpang (kontrol, zebra cross, durasi hijau per fase, offset, zona & bobot).
- Simpan/muat JSON, salin tautan bagikan, kanvas kosong / dari generator, lanjut ke Analitik.

## Fase 5 — catatan
- Enam eksperimen terpandu (`src/content/phenomena.ts` + `src/content/scenarios.ts`): Sugiyama, rem mendadak,
  Paradoks Braess, zipper vs merge awal, gelombang hijau, bundaran vs lampu. Tiap eksperimen punya varian, slider,
  langkah Coba/Amati, penjelasan, batasan, dan tabel hasil per varian (rata-rata setelah pemanasan).
- Efek tiap fenomena dikunci dengan unit test (`tests/unit/scenarios.test.ts`) — mis. jalan pintas Braess
  menaikkan waktu tempuh ±10% pada 1.500 kend/jam, zipper memperpendek antrean, gelombang hijau mengurangi berhenti.
- Diagram ruang–waktu bergulir (canvas) untuk koridor; tombol rem mendadak.
- Glosarium dwibahasa (32 istilah, Zod) + autolink istilah di semua teks (singkatan kapital seperti MOBIL tidak cocok dengan kata "mobil").
- Perbaikan model: konflik gabung (merge) di simpang prioritas hanya memblokir bila lajur tujuan sama dan belum melewati titik gabung;
  sesama pendekat utama bergiliran berdasarkan waktu tiba; penghitung "berhenti" memakai histeresis; metrik panjang antrean koridor.
- Kamera membingkai jaringan sesuai rasio layar; `near` kamera & kabut mengikuti jarak (menghindari z-fighting lapisan jalan).

## Fase 6 — catatan
- Halaman Transportasi Umum: jalur bus/BRT (ketuk simpang sebagai halte) dan MRT layang (ketuk peta sebagai stasiun),
  contoh cepat koridor BRT & MRT utara–selatan, selang keberangkatan 2–30 menit, lajur khusus BRT (ruas ≥ 2 lajur ditandai lajur bus).
- Pilihan moda langsung (bar porsi mobil/motor/bus/MRT), penumpang per jalur, heatmap.
- Perbandingan tanpa tampilan: dua Worker paralel (tanpa vs dengan jalur, seed sama, 1 jam mulai 06.45, permintaan jam sibuk tetap) →
  waktu tempuh, kecepatan, kepadatan, emisi relatif per perjalanan, jumlah kendaraan, porsi moda.
  Contoh (kota bawaan, BRT + MRT): kendaraan −10%, kepadatan −11%, emisi/perjalanan −6%.
- Model akses feeder/ojek untuk jarak > 400 m; konstanta logit dikalibrasi untuk peragaan (lihat model-notes).

## Fase 7 — catatan
- Analitik: dua skenario (sumber: Kota Hidup / generator ber-seed / Editor / skenario Lab dari tautan kontekstual),
  pengali permintaan, pengali durasi hijau, angkutan umum on/off, durasi 30/60/120 menit, jam mulai.
- Dua Worker berjalan paralel tanpa tampilan; hasil: tabel ringkasan dengan selisih B − A, grafik waktu tempuh, throughput,
  kendaraan antre (garis 2 px, crosshair + tooltip, legenda + label langsung, tampilan tabel), diagram fundamental (pencar),
  dan heatmap 3D kepadatan akhir per skenario.
- Palet seri A/B divalidasi (CVD & kontras) untuk tema terang dan gelap (`--fs-series-*`).

## Fase 8 — catatan
- Glosarium: saring istilah, tautan langsung `#/glossary#<id>`, "lihat juga"; autolink istilah di seluruh konten.
- Tentang: model & sumber, batasan, privasi, kredit; penegasan alat edukasi (konten dwibahasa Zod, diuji).
- Pencarian global Ctrl/⌘+K mencakup modul, eksperimen, istilah, dan tindakan (ganti tema/bahasa).
- Performa HP: `AdaptiveDpr` saat kamera bergerak, simulasi dijeda saat tab tersembunyi, kualitas otomatis + LOD + culling.
- Test: 64 unit test (Vitest) dan 10 skenario Playwright × 2 proyek (desktop & Pixel 7) — tiap modul, ganti bahasa & tema,
  pencarian, glosarium, eksperimen Lab, Editor, Transportasi Umum, Analitik.
- README lengkap.

## Status akhir
Semua 8 fase selesai. Deploy membutuhkan GitHub Pages diaktifkan dengan sumber **GitHub Actions** (Settings → Pages).
