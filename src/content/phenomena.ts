import { z } from 'zod';
import { Bi } from './types';

export const Phenomenon = z.object({
  id: z.string(),
  code: z.string(),
  title: Bi,
  summary: Bi,
  steps: z.array(z.object({ kind: z.enum(['try', 'observe']), text: Bi })).min(2),
  why: Bi,
  caveat: Bi,
  variants: z.array(z.object({ key: z.string(), label: Bi })).min(1),
  /** istilah glosarium utama (dikecualikan dari autolink judul) */
  term: z.string().optional(),
  source: z.string().optional(),
});
export type Phenomenon = z.infer<typeof Phenomenon>;

const raw: z.input<typeof Phenomenon>[] = [
  {
    id: 'sugiyama',
    code: 'L1',
    title: { id: 'Macet tanpa sebab di jalan melingkar', en: 'Jams without a cause on a ring road' },
    summary: {
      id: 'Replikasi eksperimen Sugiyama: 22 mobil di lintasan melingkar 230 m. Tidak ada lampu, tidak ada penyempitan — tetapi macet tetap muncul.',
      en: 'A replica of the Sugiyama experiment: 22 cars on a 230 m circular track. No lights, no bottleneck — yet a jam still appears.',
    },
    steps: [
      {
        kind: 'try',
        text: {
          id: 'Jalankan pada 16× dengan varian "Pengemudi manusia" dan tunggu 2–3 menit simulasi.',
          en: 'Run at 16× with the "Human drivers" variant and wait 2–3 simulated minutes.',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Di diagram ruang–waktu muncul pita gelap yang bergerak ke bawah: gelombang macet merambat ke belakang sambil kendaraan tetap maju.',
          en: 'In the space–time diagram dark bands appear and drift downward: a jam wave travels backwards while the cars keep moving forward.',
        },
      },
      {
        kind: 'try',
        text: {
          id: 'Ganti ke "Pengemudi halus" (percepatan responsif, seperti adaptive cruise control). Lalu ubah jumlah kendaraan.',
          en: 'Switch to "Smooth drivers" (responsive acceleration, like adaptive cruise control). Then change the number of vehicles.',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Variasi kecepatan turun drastis. Dengan sedikit kendaraan, bahkan pengemudi manusia pun lancar — ketidakstabilan hanya muncul pada kepadatan tertentu.',
          en: 'Speed variation drops sharply. With few vehicles even human drivers flow smoothly — instability only appears at certain densities.',
        },
      },
    ],
    why: {
      id: 'Pada kepadatan tinggi barisan kendaraan mengalami ketidakstabilan barisan: pengemudi bereaksi terlambat dan sedikit berlebihan terhadap pengereman kendaraan di depannya. Gangguan kecil (derau acak dalam percepatan) membesar setiap kali diteruskan, sampai ada yang berhenti. IDM dengan percepatan maksimum kecil dan headway panjang tidak stabil; percepatan yang lebih responsif meredam gangguan.',
      en: 'At high density the platoon suffers string instability: drivers react late and slightly too strongly to the braking ahead. Small disturbances (random noise in acceleration) grow each time they are passed on, until someone stops. IDM with low maximum acceleration and long headways is unstable; more responsive acceleration damps the disturbances.',
    },
    caveat: {
      id: 'Panjang kendaraan dan jarak minimum di sini adalah nilai rata-rata; di eksperimen asli kecepatan rata-rata sedikit lebih tinggi. Polanya — bukan angkanya — yang ingin ditunjukkan.',
      en: 'Vehicle lengths and minimum gaps are averages; the original experiment had a slightly higher mean speed. The pattern — not the numbers — is what matters here.',
    },
    variants: [
      { key: 'human', label: { id: 'Pengemudi manusia', en: 'Human drivers' } },
      { key: 'smooth', label: { id: 'Pengemudi halus', en: 'Smooth drivers' } },
    ],
    term: 'phantom-jam',
    source: 'Sugiyama et al. (2008), New J. Phys. 10, 033001',
  },
  {
    id: 'phantom-brake',
    code: 'L2',
    title: { id: 'Efek satu kendaraan mengerem mendadak', en: 'One vehicle brakes suddenly' },
    summary: {
      id: 'Jalan lurus satu lajur 2 km dengan arus padat. Satu kendaraan mengerem 4 detik — lalu lihat berapa lama efeknya bertahan.',
      en: 'A straight single-lane 2 km road with heavy flow. One vehicle brakes for 4 seconds — then see how long the effect lasts.',
    },
    steps: [
      {
        kind: 'try',
        text: {
          id: 'Tunggu arus stabil (±3 menit simulasi), lalu tekan "Rem mendadak sekarang".',
          en: 'Wait for the flow to settle (~3 simulated minutes), then press "Brake suddenly now".',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Gelombang kejut lahir di titik pengereman dan merambat ke hulu jauh lebih lama dari 4 detik pengereman itu.',
          en: 'A shockwave is born at the braking point and travels upstream for far longer than the 4-second brake itself.',
        },
      },
      {
        kind: 'try',
        text: {
          id: 'Turunkan permintaan, lalu ulangi. Coba juga varian "Pengemudi halus".',
          en: 'Lower the demand, then repeat. Also try the "Smooth drivers" variant.',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Pada arus rendah gangguan cepat hilang; pada arus padat ia bisa bertahan bermenit-menit.',
          en: 'At low flow the disturbance fades quickly; at heavy flow it can persist for minutes.',
        },
      },
    ],
    why: {
      id: 'Kendaraan di belakang harus mengerem lebih keras karena ia melihat pengereman sedikit terlambat dan jaraknya sudah tipis. Bila arus mendekati kapasitas, tidak ada "cadangan" jarak untuk menyerap gangguan, sehingga gelombang kejut bertahan dan merambat ke belakang sekitar 15–20 km/jam.',
      en: 'Each following vehicle must brake harder because it sees the braking slightly late and its gap is already thin. When flow is near capacity there is no spare gap to absorb the disturbance, so the shockwave persists and travels backwards at about 15–20 km/h.',
    },
    caveat: {
      id: 'Tanpa pindah lajur dan tanpa motor yang menyelip — di jalan nyata gelombang sering lebih kacau.',
      en: 'No lane changes and no filtering motorbikes — on real roads the waves are often messier.',
    },
    variants: [
      { key: 'human', label: { id: 'Pengemudi manusia', en: 'Human drivers' } },
      { key: 'smooth', label: { id: 'Pengemudi halus', en: 'Smooth drivers' } },
    ],
    term: 'shockwave',
  },
  {
    id: 'braess',
    code: 'L3',
    title: {
      id: 'Paradoks Braess: jalan baru justru memperlambat',
      en: 'Braess’s paradox: a new road makes things slower',
    },
    summary: {
      id: 'Dua rute setara dari kiri ke kanan, masing-masing punya satu ruas sempit-cepat dan satu ruas lebar-lambat. Apa yang terjadi bila kita menambah jalan pintas di tengah?',
      en: 'Two equal routes from left to right, each with one narrow-fast link and one wide-slow link. What happens if we add a shortcut in the middle?',
    },
    steps: [
      {
        kind: 'try',
        text: {
          id: 'Jalankan varian "Tanpa jalan pintas" pada 16× sampai waktu tempuh rata-rata stabil (±10 menit simulasi).',
          en: 'Run "Without shortcut" at 16× until the mean travel time settles (~10 simulated minutes).',
        },
      },
      {
        kind: 'try',
        text: {
          id: 'Ganti ke "Dengan jalan pintas" dan tunggu lagi. Hasil kedua varian tercatat di tabel perbandingan.',
          en: 'Switch to "With shortcut" and wait again. Both results are recorded in the comparison table.',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Dengan jalan pintas, banyak pengemudi memakai kedua ruas sempit sekaligus. Ruas sempit jenuh, antrean menumpuk, dan waktu tempuh rata-rata naik.',
          en: 'With the shortcut many drivers use both narrow links at once. The narrow links saturate, queues build, and the mean travel time rises.',
        },
      },
      {
        kind: 'try',
        text: {
          id: 'Ubah permintaan. Pada arus rendah jalan pintas benar-benar membantu; paradoks hanya muncul di rentang permintaan tertentu.',
          en: 'Change the demand. At low flow the shortcut genuinely helps; the paradox only appears within a certain demand range.',
        },
      },
    ],
    why: {
      id: 'Setiap pengemudi memilih rute tercepat bagi dirinya (rute dinamis A*), sehingga jaringan menuju keseimbangan pengguna. Jalan pintas membuat rute "sempit–pintas–sempit" tampak paling cepat bagi tiap individu, padahal setiap kendaraan tambahan di ruas sempit memperlambat semua orang di ruas itu. Tidak ada yang bisa lebih cepat dengan berganti rute sendirian, tetapi semua lebih lambat daripada sebelumnya.',
      en: 'Each driver picks the route fastest for themselves (dynamic A* routing), so the network moves towards user equilibrium. The shortcut makes the "narrow–shortcut–narrow" route look fastest to each individual, even though every extra vehicle on a narrow link slows everyone on it. Nobody can do better by switching alone, yet everyone is slower than before.',
    },
    caveat: {
      id: 'Efeknya di simulasi ini moderat (±5–15%) dan bergantung pada permintaan serta seed. Di jaringan nyata, paradoks ini sulit dibuktikan dan bukan alasan umum untuk menolak jalan baru — tetapi alasan untuk menganalisisnya dengan hati-hati.',
      en: 'The effect here is moderate (~5–15%) and depends on demand and seed. In real networks the paradox is hard to prove and is not a general argument against new roads — but it is a reason to analyse them carefully.',
    },
    variants: [
      { key: 'without', label: { id: 'Tanpa jalan pintas', en: 'Without shortcut' } },
      { key: 'with', label: { id: 'Dengan jalan pintas', en: 'With shortcut' } },
    ],
    term: 'braess',
    source: 'Braess (1968); Wardrop (1952)',
  },
  {
    id: 'zipper',
    code: 'L4',
    title: { id: 'Zipper merge vs merge awal', en: 'Zipper merge vs early merge' },
    summary: {
      id: 'Dua lajur menyempit menjadi satu. Haruskah pengemudi pindah lajur sedini mungkin, atau memakai kedua lajur sampai titik penyempitan lalu bergantian?',
      en: 'Two lanes narrow to one. Should drivers change lanes as early as possible, or use both lanes up to the lane drop and then alternate?',
    },
    steps: [
      {
        kind: 'try',
        text: {
          id: 'Jalankan varian "Merge awal": kendaraan di lajur tepi berhenti di rambu 280 m sebelum penyempitan dan menunggu celah.',
          en: 'Run "Early merge": vehicles in the curb lane stop at a sign 280 m before the lane drop and wait for a gap.',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Perhatikan panjang antrean (dari titik penyempitan ke kendaraan lambat paling belakang).',
          en: 'Watch the queue length (from the lane drop to the last slow vehicle).',
        },
      },
      {
        kind: 'try',
        text: {
          id: 'Ganti ke "Zipper": kedua lajur dipakai sampai ujung dan kendaraan bergabung bergantian.',
          en: 'Switch to "Zipper": both lanes are used to the end and vehicles merge alternately.',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Throughput hampir sama — kapasitas tetap ditentukan satu lajur — tetapi antrean lebih pendek karena kedua lajur menyimpan kendaraan.',
          en: 'Throughput is about the same — capacity is still set by one lane — but the queue is shorter because both lanes store vehicles.',
        },
      },
    ],
    why: {
      id: 'Penyempitan adalah bottleneck: kapasitasnya satu lajur, apa pun strategi menggabungnya. Bedanya ada di penyimpanan antrean dan kelancaran penggabungan. Merge awal membiarkan satu lajur kosong dan memaksa penggabungan dari keadaan berhenti di banyak titik.',
      en: 'The lane drop is a bottleneck: its capacity is one lane whatever the merging strategy. The difference lies in queue storage and merging smoothness. Early merging leaves one lane empty and forces merges from a standstill at many points.',
    },
    caveat: {
      id: 'Model pindah lajur MOBIL di sini sopan dan rapi; di dunia nyata keberhasilan zipper bergantung pada budaya berkendara dan rambu yang jelas.',
      en: 'The MOBIL lane-change model here is polite and tidy; in reality zipper merging depends on driving culture and clear signage.',
    },
    variants: [
      { key: 'early', label: { id: 'Merge awal', en: 'Early merge' } },
      { key: 'zipper', label: { id: 'Zipper', en: 'Zipper' } },
    ],
    term: 'zipper',
  },
  {
    id: 'green-wave',
    code: 'L5',
    title: { id: 'Gelombang hijau', en: 'Green wave' },
    summary: {
      id: 'Jalan arteri dengan enam lampu lalu lintas berjarak 260 m. Lampu bisa diatur acak, atau dikoordinasi agar kendaraan mendapat hijau berturut-turut.',
      en: 'An arterial with six traffic signals 260 m apart. Signals can be timed randomly, or coordinated so vehicles get consecutive greens.',
    },
    steps: [
      {
        kind: 'try',
        text: {
          id: 'Jalankan "Tanpa koordinasi" dan amati diagram ruang–waktu.',
          en: 'Run "Uncoordinated" and watch the space–time diagram.',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Garis-garis kendaraan patah berkali-kali: berhenti di hampir setiap lampu.',
          en: 'Vehicle trails break repeatedly: stopping at almost every light.',
        },
      },
      {
        kind: 'try',
        text: {
          id: 'Ganti ke "Gelombang hijau" (offset = jarak ÷ 45 km/jam).',
          en: 'Switch to "Green wave" (offset = distance ÷ 45 km/h).',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Peleton kendaraan dari barat melaju lurus. Jumlah berhenti per kendaraan dan tundaan turun. Arah sebaliknya tidak selalu ikut diuntungkan.',
          en: 'Platoons from the west roll straight through. Stops per vehicle and delay fall. The opposite direction does not always benefit.',
        },
      },
    ],
    why: {
      id: 'Semua lampu memakai siklus yang sama. Dengan offset yang tepat, awal hijau di setiap simpang bergeser tepat sebesar waktu tempuh dari simpang sebelumnya, sehingga peleton tiba saat hijau. Ini koordinasi gratis: tidak ada jalan yang dilebarkan.',
      en: 'All signals share the same cycle. With the right offsets, the start of green at each intersection shifts by exactly the travel time from the previous one, so platoons arrive on green. It is free coordination: no road is widened.',
    },
    caveat: {
      id: 'Gelombang hijau dua arah hanya bisa sempurna untuk jarak dan siklus tertentu. Antrean dari jalan samping dan kendaraan yang berbelok merusak peleton.',
      en: 'A two-way green wave is only perfect for certain spacings and cycles. Queues from side streets and turning vehicles break up platoons.',
    },
    variants: [
      { key: 'uncoordinated', label: { id: 'Tanpa koordinasi', en: 'Uncoordinated' } },
      { key: 'coordinated', label: { id: 'Gelombang hijau', en: 'Green wave' } },
    ],
    term: 'green-wave',
  },
  {
    id: 'roundabout',
    code: 'L6',
    title: { id: 'Bundaran vs lampu lalu lintas', en: 'Roundabout vs traffic signal' },
    summary: {
      id: 'Simpang empat kaki dengan arus seimbang. Mana yang membuat kendaraan lebih sedikit menunggu: bundaran atau lampu?',
      en: 'A four-leg intersection with balanced flows. Which makes vehicles wait less: a roundabout or a signal?',
    },
    steps: [
      {
        kind: 'try',
        text: {
          id: 'Bandingkan tundaan rata-rata kedua varian pada permintaan bawaan (1.200 kend/jam).',
          en: 'Compare the mean delay of both variants at the default demand (1,200 veh/h).',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Bundaran biasanya menang: kendaraan tidak menunggu lampu merah saat arah lain kosong.',
          en: 'The roundabout usually wins: vehicles do not wait at red when the other direction is empty.',
        },
      },
      {
        kind: 'try',
        text: {
          id: 'Naikkan permintaan mendekati 2.000+ kend/jam dan bandingkan lagi.',
          en: 'Raise demand to 2,000+ veh/h and compare again.',
        },
      },
      {
        kind: 'observe',
        text: {
          id: 'Pada arus sangat padat, celah di lingkar bundaran makin jarang dan antrean di pendekat bisa memanjang; lampu membagi waktu secara lebih tegas.',
          en: 'At very heavy flow gaps in the circle become rare and approach queues can grow; signals share time more decisively.',
        },
      },
    ],
    why: {
      id: 'Lampu lalu lintas selalu "membuang" sebagian siklus untuk kuning dan semua-merah, dan memaksa berhenti walau simpang kosong. Bundaran bekerja dengan celah kritis: kendaraan masuk begitu ada celah cukup di lingkar, sehingga pada arus rendah–sedang tundaannya kecil.',
      en: 'Signals always "waste" part of the cycle on yellow and all-red, and force stops even when the junction is empty. Roundabouts work with critical gaps: vehicles enter as soon as there is a big enough gap in the circle, so delay is small at low-to-medium flow.',
    },
    caveat: {
      id: 'Bundaran di sini satu lajur dan arus seimbang dari empat arah. Arus tidak seimbang, pejalan kaki, dan bundaran multi-lajur mengubah hasilnya.',
      en: 'The roundabout here is single-lane with balanced flows from four directions. Unbalanced flows, pedestrians and multi-lane roundabouts change the outcome.',
    },
    variants: [
      { key: 'signal', label: { id: 'Lampu lalu lintas', en: 'Traffic signal' } },
      { key: 'roundabout', label: { id: 'Bundaran', en: 'Roundabout' } },
    ],
    term: 'roundabout',
  },
];

export const PHENOMENA: Phenomenon[] = raw.map((p) => Phenomenon.parse(p));
export const PHENOMENON_BY_ID = new Map(PHENOMENA.map((p) => [p.id, p]));
