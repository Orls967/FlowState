# Catatan model FlowState

FlowState adalah **alat edukasi**. Model di bawah dipilih karena mapan di literatur dan cukup ringan untuk ribuan agen di peramban,
bukan karena dikalibrasi untuk kota tertentu. Hasilnya menunjukkan *kecenderungan kualitatif*, bukan angka perencanaan.

## Gerak longitudinal — IDM
Intelligent Driver Model (Treiber, Hennecke & Helbing, 2000):

    a = a_max [ 1 − (v / v0)^4 − (s* / s)² ],   s* = s0 + max(0, v·T + v·Δv / (2·√(a_max·b)))

Pembaruan memakai skema balistik (Treiber & Kanagaraj, 2015) dengan langkah tetap 0,2 s; kecepatan tak pernah negatif,
perlambatan dibatasi 9 m/s². Parameter per jenis kendaraan ada di `src/lib/sim/vehicles.ts`
(mobil, motor, bus, truk) dengan variasi ±10% per pengemudi.

## Pindah lajur — MOBIL
Kesting, Treiber & Helbing (2007). Pindah bila aman (pengikut baru tidak perlu mengerem > 4 m/s²) dan
keuntungan percepatan diri + p × (perubahan percepatan pengikut) melebihi ambang. Pindah lajur wajib
(lajur berakhir, lajur bus) dimodelkan sebagai *bias* pada insentif dan rintangan virtual di ujung lajur.

## Persimpangan
- **Lampu lalu lintas**: fase berurutan hijau → kuning (3 s) → semua merah (2 s). Pendekat berhadapan dikelompokkan otomatis ke satu fase.
  Saat kuning, kendaraan berhenti bila bisa mengerem nyaman; selain itu melaju.
- **Prioritas/yield**: pendekat minor menunggu celah ≥ 4 s pada pendekat utama yang lintasannya berpotongan.
  Konflik lintasan dihitung geometris (tali busur di lingkar simpang yang berpotongan atau bergabung).
- **Semua mengalah**: berhenti dulu, siapa datang duluan jalan duluan.
- **Bundaran**: searah jarum jam (lalu lintas kiri); kendaraan masuk bila tidak ada kendaraan di lingkar yang akan melewati titik masuk dalam 3 s.
- **Zebra cross**: pejalan kaki (proses Poisson) menyeberang saat kendaraan terdekat masih bisa berhenti; di simpang bersinyal saat pendekat merah.
- **"Jangan menutup simpang"**: kendaraan tidak masuk simpang bila tidak ada ruang di link tujuan.

## Rute
A* berbasis link (agar larangan putar balik dihormati). Biaya link = waktu tempuh dinamis: rata-rata bergerak (EMA) waktu tempuh
kendaraan yang keluar dari link, dipadukan dengan kecepatan rata-rata saat ini, ditambah perkiraan tundaan sinyal.
Kendaraan menghitung ulang rute paling cepat tiap ±20 s saat memasuki link baru dan berganti bila ≥10% lebih cepat.

## Permintaan perjalanan
Zona (permukiman, kantor, sekolah, mal) pada simpang. Tujuan perjalanan punya profil jam berbentuk gaussian
(puncak pagi ±07.30, sekolah ±06.40, sore ±17.30, belanja malam). Kedatangan perjalanan = proses Poisson.
Komposisi kendaraan pribadi bergaya kota Indonesia: ±55% motor.

## Pemilihan moda
Logit multinomial atas biaya umum (detik): pribadi = waktu tempuh A* + 4 menit (parkir/biaya);
bus/BRT/MRT = waktu dalam kendaraan + 2×jalan kaki + 1,5×menunggu (½ selang) + konstanta moda.

## Emisi relatif
Indeks relatif (mobil = 1 per km) ditambah komponen diam (idle). Bukan gram CO₂ sesungguhnya.

## Determinisme
Semua keacakan lewat RNG sfc32 ber-seed; urutan iterasi tetap. Seed + konfigurasi yang sama = hasil identik (diuji di `tests/unit/engine.test.ts`).

## Batasan yang disadari
- Konflik di dalam simpang bersinyal (belok kanan vs lurus lawan) tidak dimodelkan; dalam satu fase semua gerakan dianggap terlindungi.
- Motor tidak menyelip di antara lajur (perilaku khas Indonesia yang sulit dimodelkan dengan IDM/MOBIL standar).
- Tidak ada parkir di badan jalan, angkot ngetem, ojek, atau pelanggaran lalu lintas.
- Penumpang angkutan umum dihitung agregat, bukan agen individual di dalam bus.

## Sumber
- Treiber, M., Hennecke, A., & Helbing, D. (2000). Congested traffic states in empirical observations and microscopic simulations. *Phys. Rev. E* 62, 1805.
- Kesting, A., Treiber, M., & Helbing, D. (2007). General lane-changing model MOBIL for car-following models. *Transp. Res. Rec.* 1999, 86–94.
- Treiber, M., & Kesting, A. (2013). *Traffic Flow Dynamics*. Springer.
- Treiber, M., & Kanagaraj, V. (2015). Comparing numerical integration schemes for time-continuous car-following models. *Physica A* 419.
- Sugiyama, Y. et al. (2008). Traffic jams without bottlenecks. *New J. Phys.* 10, 033001.
- Braess, D. (1968). Über ein Paradoxon aus der Verkehrsplanung. *Unternehmensforschung* 12.
