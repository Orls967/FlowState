# FlowState

**Simulasi lalu lintas & kota 3D yang interaktif untuk edukasi.** Ribuan kendaraan dengan model perilaku pengemudi dari
riset transportasi (IDM + MOBIL), rute dinamis A*, lampu lalu lintas, bundaran, zebra cross, dan angkutan umum —
semuanya berjalan 100% di peramban. Tanpa backend, akun, atau pelacakan; tetap bisa dipakai offline setelah dimuat.

> FlowState adalah **alat edukasi, bukan alat perencanaan resmi**. Modelnya disederhanakan dan tidak dikalibrasi dengan
> data kota mana pun. Lihat [docs/model-notes.md](docs/model-notes.md) untuk model, sumber, dan batasannya.

Bahasa: Indonesia (bawaan) / English · Tema: Terang (peta kertas) / Gelap (kota malam) / Ikuti sistem.

## Modul

| Kode | Modul | Isi |
| --- | --- | --- |
| M1 | **Kota Hidup** | Kota prosedural ber-seed, siklus siang–malam, kontrol waktu (jeda/1×/4×/16×), klik kendaraan untuk mengikutinya beserta rute & sisa waktu tempuh, heatmap kepadatan. |
| M2 | **Editor Jalan** | Gambar/hapus jalan, atur lajur, batas kecepatan, satu arah, lajur bus; pasang lampu/bundaran/prioritas/zebra cross; durasi hijau & offset per fase; zona. Undo/redo, simpan/muat JSON (divalidasi Zod), bagikan lewat URL (lz-string). |
| M3 | **Lab Fenomena** | Eksperimen terpandu: macet tanpa sebab (Sugiyama), rem mendadak, Paradoks Braess, zipper vs merge awal, gelombang hijau, bundaran vs lampu — dengan varian, diagram ruang–waktu, dan tabel hasil. |
| M4 | **Transportasi Umum** | Jalur bus/BRT dengan lajur khusus dan MRT layang, selang keberangkatan, pilihan moda (logit), emisi relatif, perbandingan dengan/ tanpa angkutan umum. |
| M5 | **Analitik** | Dua skenario berdampingan: waktu tempuh, throughput, antrean, diagram fundamental, heatmap 3D. |
| M6 | **Glosarium** | 30+ istilah dwibahasa, tertaut otomatis di semua penjelasan. |
| i | **Tentang** | Model & sumber, batasan, privasi, kredit. |

Navigasi kontekstual: fenomena → *Buka di Editor* → *Lihat di Analitik*. Pencarian global: **Ctrl/⌘ + K**.

## Teknologi

Vite · React 19 · TypeScript (strict, tanpa `any`) · three.js lewat @react-three/fiber, drei, postprocessing ·
Tailwind CSS v4 (design tokens CSS variables) · Zustand · React Router (HashRouter) · Zod · i18next ·
d3-scale/d3-shape · lucide-react · @fontsource (Jost, Public Sans, JetBrains Mono) · Web Worker · lz-string ·
Vitest · Playwright · ESLint + Prettier.

## Arsitektur singkat

```
src/
  lib/sim/      logika simulasi murni & teruji: RNG ber-seed, IDM, MOBIL, graf jalan, A*, sinyal, permintaan, mesin
  lib/city/     skema kota (Zod), generator ber-seed, dekorasi, operasi editor, serialisasi, angkutan umum
  workers/      runtime fixed-timestep di Web Worker (+ cadangan thread utama bila Worker tidak tersedia)
  scene/        R3F: jalan (satu BufferGeometry), gedung & kendaraan instanced, LOD, culling, siang–malam, heatmap
  content/      teks & data dwibahasa (glosarium, fenomena, skenario Lab, Tentang) — divalidasi Zod
  ui/ pages/ store/ i18n/
tests/unit      Vitest: IDM, MOBIL, routing, sinyal, determinisme seed, generator, serialisasi, skenario, konten, i18n
tests/e2e       Playwright: tiap modul, ganti bahasa & tema, jalankan skenario (desktop & HP)
docs/           progress.md, model-notes.md
```

- Simulasi berjalan di Web Worker dengan langkah tetap 0,2 s. Posisi kendaraan dikirim tiap frame sebagai `Float32Array`
  yang **di-transfer** (tanpa SharedArrayBuffer, karena GitHub Pages tidak bisa mengatur header COOP/COEP).
- Thread utama menginterpolasi posisi antar-tick; kendaraan digambar dengan `InstancedMesh` per jenis, LOD kotak sederhana
  di kejauhan, dan culling frustum.
- Kualitas grafis otomatis: tebakan awal dari perangkat + pemantau FPS yang menurunkan DPR, bayangan, bloom, jarak LOD,
  dan batas kendaraan (±2.600 di desktop kualitas tinggi, ±600 di HP).
- Seed + konfigurasi yang sama selalu menghasilkan simulasi identik (diuji).

## Menjalankan

Butuh Node 20+.

```bash
npm install
npm run dev          # server pengembangan
npm run build        # typecheck + build produksi ke dist/
npm test             # unit test (Vitest)
npm run test:e2e     # smoke test Playwright (build + preview otomatis)
npm run lint
```

## Deploy ke GitHub Pages

Workflow `.github/workflows/deploy.yml` menjalankan lint → unit test → build → deploy setiap push ke `main`.
Sekali saja, aktifkan Pages di **Settings → Pages → Build and deployment → Source: GitHub Actions**.
`base` Vite sudah diset ke `/FlowState/` dan routing memakai HashRouter, jadi tidak perlu konfigurasi server.

## Privasi

Tidak ada analitik, cookie pelacak, atau permintaan ke pihak ketiga. Preferensi disimpan di `localStorage` perangkat;
kota yang dibagikan tersimpan di dalam URL itu sendiri.

## Kredit

Model: Treiber dkk. (IDM), Kesting dkk. (MOBIL), Hart dkk. (A*), Sugiyama dkk. (2008), Braess (1968), Wardrop (1952).
Pustaka sumber terbuka sebagaimana tercantum di atas; huruf di bawah SIL Open Font License. Semua aset 3D dibuat
secara prosedural di kode. Struktur multi-modul terinspirasi proyek edukasi BumiLapis3D.
