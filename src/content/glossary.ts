import { z } from 'zod';
import { Bi } from './types';

export const GlossaryTerm = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  term: Bi,
  /** kata lain yang ikut ditautkan otomatis (per bahasa) */
  aliases: z.object({ id: z.array(z.string()), en: z.array(z.string()) }),
  short: Bi,
  body: Bi,
  related: z.array(z.string()).default([]),
});
export type GlossaryTerm = z.infer<typeof GlossaryTerm>;

const raw: z.input<typeof GlossaryTerm>[] = [
  {
    id: 'idm',
    term: { id: 'Intelligent Driver Model (IDM)', en: 'Intelligent Driver Model (IDM)' },
    aliases: { id: ['IDM'], en: ['IDM'] },
    short: {
      id: 'Model mengikuti kendaraan yang menentukan percepatan dari kecepatan, jarak, dan selisih kecepatan.',
      en: 'Car-following model that sets acceleration from speed, gap and speed difference.',
    },
    body: {
      id: 'IDM (Treiber dkk., 2000) memberi tiap pengemudi kecepatan yang diinginkan, jarak aman minimum, headway waktu, percepatan maksimum, dan perlambatan nyaman. Percepatan berkurang saat mendekati kecepatan yang diinginkan dan saat jarak ke kendaraan depan lebih kecil dari jarak yang diinginkan. Model ini bebas tabrakan dan cukup sederhana untuk ribuan agen.',
      en: 'IDM (Treiber et al., 2000) gives every driver a desired speed, minimum gap, time headway, maximum acceleration and comfortable deceleration. Acceleration drops as the driver nears the desired speed and when the gap to the leader is smaller than the desired gap. It is collision-free and cheap enough for thousands of agents.',
    },
    related: ['car-following', 'headway', 'mobil'],
  },
  {
    id: 'mobil',
    term: { id: 'MOBIL (model pindah lajur)', en: 'MOBIL (lane-change model)' },
    aliases: { id: ['MOBIL'], en: ['MOBIL'] },
    short: {
      id: 'Aturan pindah lajur: pindah bila aman dan menguntungkan, dengan mempertimbangkan pengemudi lain.',
      en: 'Lane-change rule: change when safe and beneficial, accounting for other drivers.',
    },
    body: {
      id: 'MOBIL (Kesting dkk., 2007) menghitung keuntungan percepatan bila pindah lajur dan kerugian yang ditimbulkan pada pengikut. Faktor kesopanan p menimbang kepentingan orang lain: p = 0 egois, p = 1 sangat sopan. Pindah juga harus aman: pengikut baru tidak boleh dipaksa mengerem terlalu keras.',
      en: 'MOBIL (Kesting et al., 2007) weighs the acceleration gain from changing lanes against the loss imposed on followers. The politeness factor p balances self-interest: p = 0 is selfish, p = 1 very polite. A change must also be safe: the new follower must not be forced to brake too hard.',
    },
    related: ['idm', 'zipper'],
  },
  {
    id: 'car-following',
    term: { id: 'Model mengikuti kendaraan', en: 'Car-following model' },
    aliases: { id: ['mengikuti kendaraan', 'car-following'], en: ['car-following'] },
    short: {
      id: 'Model mikroskopik: tiap pengemudi bereaksi terhadap kendaraan tepat di depannya.',
      en: 'Microscopic model: each driver reacts to the vehicle directly ahead.',
    },
    body: {
      id: 'Alih-alih memodelkan lalu lintas sebagai fluida, model mengikuti kendaraan mensimulasikan setiap pengemudi. Pola besar seperti gelombang macet muncul dari interaksi kecil ini.',
      en: 'Instead of modelling traffic as a fluid, car-following models simulate every driver. Large-scale patterns such as jam waves emerge from these small interactions.',
    },
    related: ['idm', 'microsim'],
  },
  {
    id: 'microsim',
    term: { id: 'Simulasi mikroskopik', en: 'Microscopic simulation' },
    aliases: {
      id: ['simulasi mikroskopik', 'mikrosimulasi'],
      en: ['microscopic simulation', 'microsimulation'],
    },
    short: {
      id: 'Simulasi yang melacak setiap kendaraan secara individual.',
      en: 'Simulation that tracks every vehicle individually.',
    },
    body: {
      id: 'FlowState adalah simulasi mikroskopik: posisi dan kecepatan setiap kendaraan diperbarui tiap 0,2 detik. Kebalikannya, model makroskopik hanya menghitung kepadatan dan aliran rata-rata per ruas.',
      en: 'FlowState is a microscopic simulation: every vehicle’s position and speed is updated every 0.2 seconds. Macroscopic models, by contrast, only track average density and flow per road.',
    },
    related: ['car-following', 'determinism'],
  },
  {
    id: 'headway',
    term: { id: 'Headway (jarak waktu)', en: 'Time headway' },
    aliases: { id: ['headway', 'jarak waktu'], en: ['headway', 'time headway'] },
    short: {
      id: 'Selang waktu antara dua kendaraan berurutan melewati satu titik.',
      en: 'Time between two consecutive vehicles passing a point.',
    },
    body: {
      id: 'Pengemudi umumnya menjaga headway 1–2 detik. Headway inilah yang membatasi kapasitas satu lajur: dengan headway 1,5 detik, paling banyak sekitar 2.400 kendaraan per jam bisa lewat — dan dalam praktik jauh lebih sedikit.',
      en: 'Drivers typically keep a 1–2 second headway. That headway caps lane capacity: at 1.5 seconds, at most about 2,400 vehicles per hour can pass — and in practice far fewer.',
    },
    related: ['capacity', 'idm'],
  },
  {
    id: 'capacity',
    term: { id: 'Kapasitas', en: 'Capacity' },
    aliases: { id: ['kapasitas'], en: ['capacity'] },
    short: {
      id: 'Aliran maksimum yang bisa dilayani suatu ruas atau simpang.',
      en: 'Maximum flow a road or intersection can serve.',
    },
    body: {
      id: 'Kapasitas tercapai pada kepadatan menengah. Bila permintaan melebihi kapasitas, antrean terbentuk dan — ironisnya — aliran yang benar-benar lewat sering turun di bawah kapasitas (capacity drop).',
      en: 'Capacity is reached at medium density. When demand exceeds capacity a queue forms and — ironically — the flow that actually gets through often drops below capacity (capacity drop).',
    },
    related: ['fundamental-diagram', 'bottleneck'],
  },
  {
    id: 'density',
    term: { id: 'Kepadatan', en: 'Density' },
    aliases: { id: ['kepadatan'], en: ['density'] },
    short: {
      id: 'Jumlah kendaraan per kilometer per lajur.',
      en: 'Number of vehicles per kilometre per lane.',
    },
    body: {
      id: 'Jalan lengang memiliki kepadatan di bawah ±20 kend/km/lajur; macet total bisa mencapai 120–150 (lebih tinggi lagi bila banyak motor). Heatmap FlowState mewarnai ruas menurut kepadatan ini.',
      en: 'A free-flowing road has below ~20 veh/km/lane; a full jam can reach 120–150 (higher still with many motorbikes). FlowState’s heatmap colours roads by this density.',
    },
    related: ['flow', 'fundamental-diagram'],
  },
  {
    id: 'flow',
    term: { id: 'Aliran (flow)', en: 'Flow' },
    aliases: { id: ['aliran', 'arus lalu lintas'], en: ['flow', 'traffic flow'] },
    short: {
      id: 'Jumlah kendaraan yang lewat per jam (per lajur).',
      en: 'Vehicles passing per hour (per lane).',
    },
    body: {
      id: 'Aliran = kepadatan × kecepatan. Karena kecepatan turun saat kepadatan naik, aliran naik lalu turun lagi — itulah diagram fundamental.',
      en: 'Flow = density × speed. Because speed falls as density rises, flow rises and then falls again — that is the fundamental diagram.',
    },
    related: ['density', 'fundamental-diagram', 'throughput'],
  },
  {
    id: 'fundamental-diagram',
    term: { id: 'Diagram fundamental', en: 'Fundamental diagram' },
    aliases: { id: ['diagram fundamental'], en: ['fundamental diagram'] },
    short: {
      id: 'Hubungan antara kepadatan dan aliran lalu lintas.',
      en: 'Relationship between traffic density and flow.',
    },
    body: {
      id: 'Di sisi kiri (lengang) aliran naik seiring kepadatan. Puncaknya adalah kapasitas. Di sisi kanan (macet) menambah kendaraan justru menurunkan aliran. Titik-titik di Analitik diambil per ruas tiap menit simulasi.',
      en: 'On the left (free flow) flow increases with density. The peak is capacity. On the right (congested) adding vehicles reduces flow. The points in Analytics are sampled per road every simulated minute.',
    },
    related: ['flow', 'density', 'capacity'],
  },
  {
    id: 'shockwave',
    term: { id: 'Gelombang kejut', en: 'Shockwave' },
    aliases: {
      id: ['gelombang kejut', 'gelombang macet'],
      en: ['shockwave', 'shock wave', 'jam wave', 'jam waves'],
    },
    short: {
      id: 'Batas antara lalu lintas lancar dan macet yang merambat — biasanya ke belakang.',
      en: 'Moving boundary between free and congested traffic — usually travelling backwards.',
    },
    body: {
      id: 'Saat satu kendaraan mengerem, pengikutnya mengerem sedikit lebih keras dan sedikit lebih lambat. Gangguan ini merambat ke belakang sekitar 15–20 km/jam, berlawanan dengan arah kendaraan. Di diagram ruang–waktu terlihat sebagai pita miring.',
      en: 'When one vehicle brakes, its follower brakes a bit harder and a bit later. The disturbance travels backwards at about 15–20 km/h, against the direction of traffic. In a space–time diagram it appears as a slanted band.',
    },
    related: ['phantom-jam', 'string-instability', 'space-time'],
  },
  {
    id: 'phantom-jam',
    term: { id: 'Macet tanpa sebab (phantom jam)', en: 'Phantom traffic jam' },
    aliases: {
      id: ['macet tanpa sebab', 'macet hantu', 'phantom jam'],
      en: ['phantom jam', 'phantom traffic jam', 'jam without a bottleneck'],
    },
    short: {
      id: 'Kemacetan yang muncul tanpa kecelakaan, penyempitan, atau lampu merah.',
      en: 'A jam that appears with no crash, bottleneck or red light.',
    },
    body: {
      id: 'Eksperimen Sugiyama (2008) menempatkan 22 mobil di lintasan melingkar 230 m. Tanpa penghalang apa pun, setelah beberapa menit muncul gelombang berhenti-jalan yang terus berputar. Penyebabnya adalah ketidakstabilan barisan pada kepadatan tinggi.',
      en: 'The Sugiyama experiment (2008) put 22 cars on a 230 m circular track. With no obstacle at all, after a few minutes a stop-and-go wave appeared and kept circling. The cause is string instability at high density.',
    },
    related: ['shockwave', 'string-instability'],
  },
  {
    id: 'string-instability',
    term: { id: 'Ketidakstabilan barisan', en: 'String instability' },
    aliases: {
      id: ['ketidakstabilan barisan', 'tidak stabil'],
      en: ['string instability', 'string-unstable'],
    },
    short: {
      id: 'Gangguan kecil yang membesar saat merambat ke belakang barisan kendaraan.',
      en: 'Small disturbances that grow as they travel back along a platoon.',
    },
    body: {
      id: 'Barisan kendaraan stabil bila gangguan mengecil ke belakang, dan tidak stabil bila membesar. Headway pendek dan reaksi lambat membuat barisan tidak stabil. Kendaraan otomatis yang mengatur jarak dengan halus bisa meredam gelombang.',
      en: 'A platoon is stable if disturbances shrink towards the back and unstable if they grow. Short headways and slow reactions make it unstable. Automated vehicles that adjust gaps smoothly can damp the waves.',
    },
    related: ['phantom-jam', 'headway'],
  },
  {
    id: 'space-time',
    term: { id: 'Diagram ruang–waktu', en: 'Space–time diagram' },
    aliases: {
      id: ['diagram ruang–waktu', 'diagram ruang-waktu'],
      en: ['space–time diagram', 'space-time diagram', 'time–space diagram'],
    },
    short: {
      id: 'Grafik posisi kendaraan terhadap waktu; kemiringan = kecepatan.',
      en: 'Plot of vehicle position against time; slope = speed.',
    },
    body: {
      id: 'Setiap titik adalah satu kendaraan pada satu waktu, diwarnai menurut kecepatannya. Area gelap/merah = kendaraan lambat. Bila area itu bergeser ke bawah seiring waktu, gelombang macet sedang merambat ke belakang.',
      en: 'Each dot is one vehicle at one moment, coloured by its speed. Dark/red areas = slow vehicles. If such an area drifts downward over time, a jam wave is travelling backwards.',
    },
    related: ['shockwave'],
  },
  {
    id: 'braess',
    term: { id: 'Paradoks Braess', en: 'Braess’s paradox' },
    aliases: {
      id: ['Paradoks Braess', 'Braess'],
      en: ['Braess’s paradox', "Braess's paradox", 'Braess paradox', 'Braess'],
    },
    short: {
      id: 'Menambah jalan bisa membuat semua orang lebih lambat.',
      en: 'Adding a road can make everyone slower.',
    },
    body: {
      id: 'Dietrich Braess (1968) menunjukkan bahwa bila setiap pengemudi memilih rute tercepat bagi dirinya sendiri, jalan pintas baru bisa menarik terlalu banyak kendaraan ke ruas-ruas sempit sehingga waktu tempuh semua orang naik. Contoh nyata: penutupan jalan di Seoul (Cheonggyecheon) dan New York yang tidak memperparah macet.',
      en: 'Dietrich Braess (1968) showed that when every driver picks the route that is fastest for themselves, a new shortcut can pull too many vehicles onto narrow links, raising everyone’s travel time. Real examples: road closures in Seoul (Cheonggyecheon) and New York that did not worsen congestion.',
    },
    related: ['user-equilibrium', 'routing'],
  },
  {
    id: 'user-equilibrium',
    term: { id: 'Keseimbangan pengguna (Wardrop)', en: 'User equilibrium (Wardrop)' },
    aliases: {
      id: ['keseimbangan pengguna', 'keseimbangan Wardrop'],
      en: ['user equilibrium', 'Wardrop equilibrium'],
    },
    short: {
      id: 'Keadaan di mana tidak ada pengemudi yang bisa lebih cepat dengan mengganti rute sendirian.',
      en: 'State where no driver can get faster by switching route alone.',
    },
    body: {
      id: 'Pada keseimbangan pengguna, semua rute yang dipakai memiliki waktu tempuh sama. Ini berbeda dari optimum sistem (total waktu semua orang minimum). Selisih keduanya disebut "harga anarki".',
      en: 'At user equilibrium, all used routes have equal travel time. This differs from the system optimum (minimum total time for everyone). The gap between them is called the "price of anarchy".',
    },
    related: ['braess', 'routing'],
  },
  {
    id: 'routing',
    term: { id: 'Rute dinamis (A*)', en: 'Dynamic routing (A*)' },
    aliases: {
      id: ['A*', 'rute dinamis', 'ganti rute'],
      en: ['A*', 'dynamic routing', 'reroute', 'reroutes'],
    },
    short: {
      id: 'Pencarian rute tercepat memakai waktu tempuh terkini; rute bisa berubah saat macet.',
      en: 'Fastest-route search using current travel times; routes can change in congestion.',
    },
    body: {
      id: 'A* menelusuri jaringan dengan biaya = perkiraan waktu tempuh tiap ruas (diperbarui dari kendaraan yang baru lewat) dan heuristik jarak lurus. Kendaraan menghitung ulang rutenya setiap ±20 detik dan berganti bila rute baru jelas lebih cepat.',
      en: 'A* searches the network with cost = estimated travel time per road (updated from vehicles that just passed) and a straight-line heuristic. Vehicles recompute their route about every 20 seconds and switch when the new one is clearly faster.',
    },
    related: ['travel-time', 'user-equilibrium'],
  },
  {
    id: 'travel-time',
    term: { id: 'Waktu tempuh', en: 'Travel time' },
    aliases: { id: ['waktu tempuh'], en: ['travel time', 'travel times'] },
    short: {
      id: 'Lama perjalanan dari asal sampai tujuan.',
      en: 'Duration of a trip from origin to destination.',
    },
    body: {
      id: 'Di FlowState, waktu tempuh rata-rata dihitung dari perjalanan yang selesai dalam 10 menit simulasi terakhir, termasuk waktu menunggu masuk jalan.',
      en: 'In FlowState, mean travel time is computed from trips completed in the last 10 simulated minutes, including time spent waiting to enter the road.',
    },
    related: ['delay'],
  },
  {
    id: 'delay',
    term: { id: 'Tundaan', en: 'Delay' },
    aliases: { id: ['tundaan'], en: ['delay'] },
    short: {
      id: 'Selisih waktu tempuh nyata dengan waktu tempuh saat jalan kosong.',
      en: 'Difference between actual and free-flow travel time.',
    },
    body: {
      id: 'Tundaan adalah ukuran utama kinerja simpang: berapa detik rata-rata kendaraan kehilangan waktu karena lampu merah, antre, atau memberi jalan.',
      en: 'Delay is the main measure of intersection performance: how many seconds vehicles lose on average to red lights, queues or yielding.',
    },
    related: ['travel-time', 'queue'],
  },
  {
    id: 'throughput',
    term: { id: 'Throughput', en: 'Throughput' },
    aliases: { id: ['throughput'], en: ['throughput'] },
    short: {
      id: 'Jumlah kendaraan yang berhasil melewati sistem per jam.',
      en: 'Number of vehicles that get through the system per hour.',
    },
    body: {
      id: 'Throughput tidak bisa melebihi permintaan maupun kapasitas. Membandingkan throughput dengan permintaan menunjukkan apakah antrean sedang tumbuh.',
      en: 'Throughput can exceed neither demand nor capacity. Comparing throughput with demand shows whether queues are growing.',
    },
    related: ['flow', 'capacity'],
  },
  {
    id: 'queue',
    term: { id: 'Antrean', en: 'Queue' },
    aliases: { id: ['antrean', 'antre'], en: ['queue', 'queues', 'queued'] },
    short: {
      id: 'Kendaraan yang berhenti atau hampir berhenti menunggu giliran.',
      en: 'Vehicles stopped or nearly stopped waiting their turn.',
    },
    body: {
      id: 'FlowState menghitung kendaraan dengan kecepatan di bawah 0,5 m/s sebagai antre. Antrean yang meluber ke simpang hulu (spillback) adalah penyebab utama kemacetan menjalar di kota.',
      en: 'FlowState counts vehicles slower than 0.5 m/s as queued. Queues that spill back into upstream intersections (spillback) are the main way congestion spreads in cities.',
    },
    related: ['delay', 'bottleneck'],
  },
  {
    id: 'bottleneck',
    term: { id: 'Bottleneck (penyempitan)', en: 'Bottleneck' },
    aliases: { id: ['bottleneck', 'penyempitan', 'leher botol'], en: ['bottleneck', 'lane drop'] },
    short: {
      id: 'Titik dengan kapasitas lebih rendah dari ruas di hulunya.',
      en: 'A point with lower capacity than the road upstream.',
    },
    body: {
      id: 'Penyempitan lajur, tanjakan, atau simpang adalah bottleneck. Antrean selalu terbentuk di hulu bottleneck bila permintaan melebihi kapasitasnya.',
      en: 'Lane drops, slopes and intersections are bottlenecks. A queue always forms upstream of a bottleneck when demand exceeds its capacity.',
    },
    related: ['zipper', 'capacity'],
  },
  {
    id: 'zipper',
    term: { id: 'Zipper merge (gabung bergantian)', en: 'Zipper merge' },
    aliases: { id: ['zipper merge', 'zipper', 'merge awal'], en: ['zipper merge', 'zipper', 'early merge'] },
    short: {
      id: 'Memakai kedua lajur sampai titik penyempitan lalu bergabung bergantian.',
      en: 'Using both lanes up to the lane drop, then merging alternately.',
    },
    body: {
      id: 'Banyak pengemudi merasa sopan bila pindah lajur jauh sebelum penyempitan (merge awal). Akibatnya satu lajur kosong dan antrean jadi dua kali lebih panjang. Dengan zipper merge, kedua lajur terisi dan penggabungan berlangsung teratur di satu titik.',
      en: 'Many drivers feel polite merging long before a lane drop (early merge). One lane then sits empty and the queue is twice as long. With a zipper merge both lanes fill up and merging happens in an orderly way at one point.',
    },
    related: ['bottleneck', 'mobil'],
  },
  {
    id: 'signal-phase',
    term: { id: 'Fase & siklus lampu', en: 'Signal phase & cycle' },
    aliases: {
      id: ['fase', 'siklus', 'lampu lalu lintas', 'lampu merah'],
      en: ['phase', 'cycle', 'traffic signal', 'traffic signals', 'red light'],
    },
    short: {
      id: 'Fase = kelompok arah yang mendapat hijau bersamaan; siklus = satu putaran semua fase.',
      en: 'Phase = group of approaches green together; cycle = one round of all phases.',
    },
    body: {
      id: 'Setiap fase berjalan hijau → kuning (3 detik) → semua merah (2 detik). Siklus panjang meningkatkan kapasitas tetapi memperpanjang tunggu. Di Editor Anda bisa mengatur durasi hijau per fase.',
      en: 'Each phase runs green → yellow (3 s) → all-red (2 s). Long cycles increase capacity but lengthen waits. In the Editor you can set green time per phase.',
    },
    related: ['green-wave', 'offset'],
  },
  {
    id: 'offset',
    term: { id: 'Offset sinyal', en: 'Signal offset' },
    aliases: { id: ['offset'], en: ['offset', 'offsets'] },
    short: {
      id: 'Pergeseran waktu awal hijau suatu lampu terhadap lampu lain.',
      en: 'Time shift of one signal’s green start relative to another.',
    },
    body: {
      id: 'Dengan offset yang tepat (jarak ÷ kecepatan), kendaraan yang mendapat hijau di satu simpang akan tiba di simpang berikutnya tepat saat hijau — itulah gelombang hijau.',
      en: 'With the right offset (distance ÷ speed), vehicles that get a green at one intersection reach the next exactly as it turns green — that is a green wave.',
    },
    related: ['green-wave', 'signal-phase'],
  },
  {
    id: 'green-wave',
    term: { id: 'Gelombang hijau', en: 'Green wave' },
    aliases: { id: ['gelombang hijau'], en: ['green wave'] },
    short: {
      id: 'Koordinasi lampu agar kendaraan bisa melaju tanpa berhenti melewati banyak simpang.',
      en: 'Coordinating signals so vehicles pass many intersections without stopping.',
    },
    body: {
      id: 'Gelombang hijau paling efektif untuk satu arah. Untuk dua arah sekaligus, jarak antar simpang dan panjang siklus harus cocok. Kecepatan progresi biasanya sedikit di bawah batas kecepatan.',
      en: 'A green wave works best in one direction. For both directions at once, intersection spacing and cycle length must match. The progression speed is usually slightly below the speed limit.',
    },
    related: ['offset', 'signal-phase'],
  },
  {
    id: 'roundabout',
    term: { id: 'Bundaran', en: 'Roundabout' },
    aliases: { id: ['bundaran'], en: ['roundabout', 'roundabouts'] },
    short: {
      id: 'Simpang melingkar: yang masuk memberi jalan kepada yang sudah di dalam.',
      en: 'Circular intersection: entering traffic yields to traffic already inside.',
    },
    body: {
      id: 'Bundaran modern mengurangi titik konflik dan tidak membuang waktu untuk lampu merah saat sepi. Pada arus sangat padat dan tidak seimbang, lampu lalu lintas bisa lebih adil. Di Indonesia (lalu lintas kiri) bundaran berputar searah jarum jam.',
      en: 'Modern roundabouts reduce conflict points and waste no time on red lights when traffic is light. With very heavy, unbalanced flows, signals can be fairer. In Indonesia (left-hand traffic) roundabouts circulate clockwise.',
    },
    related: ['critical-gap', 'signal-phase'],
  },
  {
    id: 'critical-gap',
    term: { id: 'Celah kritis', en: 'Critical gap' },
    aliases: { id: ['celah kritis', 'memberi jalan', 'yield'], en: ['critical gap', 'yield', 'yielding'] },
    short: {
      id: 'Celah waktu terkecil di arus utama yang diterima pengemudi untuk masuk/menyeberang.',
      en: 'Smallest time gap in the main stream a driver accepts to enter or cross.',
    },
    body: {
      id: 'Di simpang prioritas FlowState, kendaraan dari jalan minor menunggu sampai kendaraan di jalan utama yang lintasannya berpotongan masih ≥ 4 detik lagi dari simpang (3 detik di bundaran).',
      en: 'At FlowState priority intersections, minor-road vehicles wait until conflicting main-road vehicles are still ≥ 4 seconds from the intersection (3 seconds at roundabouts).',
    },
    related: ['roundabout'],
  },
  {
    id: 'demand',
    term: { id: 'Permintaan perjalanan', en: 'Travel demand' },
    aliases: {
      id: ['permintaan perjalanan', 'jam sibuk', 'asal–tujuan'],
      en: ['travel demand', 'peak hour', 'origin–destination'],
    },
    short: {
      id: 'Berapa banyak orang ingin bepergian, dari mana ke mana, dan kapan.',
      en: 'How many people want to travel, from where to where, and when.',
    },
    body: {
      id: 'Kota FlowState punya zona permukiman, perkantoran, sekolah, dan mal. Perjalanan dibangkitkan secara acak (Poisson) mengikuti profil jam: puncak pagi menuju kantor & sekolah, puncak sore pulang, dan belanja di malam hari.',
      en: 'FlowState cities have residential, office, school and mall zones. Trips are generated randomly (Poisson) following hourly profiles: a morning peak to offices & schools, an evening peak home, and shopping at night.',
    },
    related: ['mode-choice'],
  },
  {
    id: 'mode-choice',
    term: { id: 'Pemilihan moda', en: 'Mode choice' },
    aliases: { id: ['pemilihan moda', 'pilihan moda', 'logit'], en: ['mode choice', 'logit'] },
    short: {
      id: 'Keputusan memakai kendaraan pribadi atau angkutan umum.',
      en: 'The decision to use a private vehicle or public transport.',
    },
    body: {
      id: 'FlowState memakai model logit: tiap moda punya biaya umum (waktu dalam kendaraan + 2× waktu jalan kaki + 1,5× waktu tunggu + konstanta). Moda yang lebih murah lebih mungkin dipilih, tetapi tidak selalu — orang berbeda menilai berbeda.',
      en: 'FlowState uses a logit model: every mode has a generalised cost (in-vehicle time + 2× walking + 1.5× waiting + a constant). Cheaper modes are more likely to be chosen, but not always — people value things differently.',
    },
    related: ['brt', 'mrt', 'demand'],
  },
  {
    id: 'brt',
    term: { id: 'BRT (bus rapid transit)', en: 'BRT (bus rapid transit)' },
    aliases: { id: ['BRT', 'lajur khusus bus', 'busway'], en: ['BRT', 'bus lane', 'dedicated lane'] },
    short: {
      id: 'Bus di lajur khusus sehingga tidak ikut terjebak macet.',
      en: 'Buses in a dedicated lane so they avoid congestion.',
    },
    body: {
      id: 'Seperti TransJakarta: lajur paling tepi diambil khusus untuk bus. Mobil kehilangan satu lajur, tetapi bus menjadi cepat dan andal sehingga lebih banyak orang beralih.',
      en: 'Like TransJakarta: the curb lane is reserved for buses. Cars lose a lane, but buses become fast and reliable, so more people switch.',
    },
    related: ['mode-choice', 'mrt'],
  },
  {
    id: 'mrt',
    term: { id: 'MRT', en: 'Metro (MRT)' },
    aliases: { id: ['MRT', 'kereta'], en: ['MRT', 'metro'] },
    short: {
      id: 'Kereta berkapasitas besar di jalur terpisah dari jalan raya.',
      en: 'High-capacity rail on a track separate from roads.',
    },
    body: {
      id: 'Di FlowState jalur MRT layang tidak berbagi ruang dengan kendaraan, jadi kecepatannya tidak dipengaruhi macet. Selang keberangkatan (headway) menentukan waktu tunggu rata-rata.',
      en: 'In FlowState, elevated metro lines share no space with vehicles, so their speed is unaffected by congestion. The headway sets the average waiting time.',
    },
    related: ['brt', 'mode-choice'],
  },
  {
    id: 'emissions',
    term: { id: 'Emisi relatif', en: 'Relative emissions' },
    aliases: { id: ['emisi'], en: ['emissions'] },
    short: {
      id: 'Indeks emisi berdasarkan jarak tempuh per jenis kendaraan dan waktu diam.',
      en: 'Emission index from distance per vehicle type and idling time.',
    },
    body: {
      id: 'Bukan gram CO₂ sebenarnya, melainkan indeks pembanding: mobil = 1 per km, motor ±0,45, bus ±4,2, truk ±3,4, ditambah porsi untuk mesin menyala saat diam di antrean.',
      en: 'Not real grams of CO₂ but a comparison index: car = 1 per km, motorbike ~0.45, bus ~4.2, truck ~3.4, plus a share for engines idling in queues.',
    },
    related: ['mode-choice'],
  },
  {
    id: 'determinism',
    term: { id: 'Seed & determinisme', en: 'Seed & determinism' },
    aliases: { id: ['seed', 'deterministik'], en: ['seed', 'deterministic'] },
    short: {
      id: 'Seed yang sama selalu menghasilkan kota dan simulasi yang sama.',
      en: 'The same seed always produces the same city and simulation.',
    },
    body: {
      id: 'Semua keacakan di FlowState berasal dari pembangkit bilangan acak ber-seed, sehingga eksperimen bisa diulang persis dan dibandingkan secara adil.',
      en: 'All randomness in FlowState comes from a seeded random number generator, so experiments can be repeated exactly and compared fairly.',
    },
    related: ['microsim'],
  },
];

export const GLOSSARY: GlossaryTerm[] = raw.map((t) => GlossaryTerm.parse(t));
export const GLOSSARY_BY_ID = new Map(GLOSSARY.map((t) => [t.id, t]));
