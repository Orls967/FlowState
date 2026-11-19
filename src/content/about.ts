import { z } from 'zod';
import { Bi } from './types';

export const AboutSection = z.object({
  id: z.string(),
  title: Bi,
  body: Bi,
  items: z.array(z.object({ title: Bi, text: Bi })).default([]),
});
export type AboutSection = z.infer<typeof AboutSection>;

const raw: z.input<typeof AboutSection>[] = [
  {
    id: 'what',
    title: { id: 'Apa ini?', en: 'What is this?' },
    body: {
      id: 'FlowState adalah alat edukasi untuk memahami lalu lintas kota: kenapa macet muncul, kenapa menambah jalan tidak selalu menolong, dan bagaimana lampu, bundaran, serta angkutan umum mengubah aliran. Semua simulasi berjalan di peramban Anda — tidak ada server, akun, iklan, atau pelacakan. Setelah dimuat sekali, aplikasi tetap bisa dipakai offline.\n\nFlowState BUKAN alat perencanaan resmi. Angka-angkanya berasal dari model yang disederhanakan dan tidak dikalibrasi dengan data kota mana pun. Gunakan untuk memahami pola, bukan untuk mengambil keputusan.',
      en: 'FlowState is an educational tool for understanding city traffic: why jams appear, why adding roads does not always help, and how signals, roundabouts and public transport change the flow. All simulation runs in your browser — no server, account, ads or tracking. Once loaded, the app keeps working offline.\n\nFlowState is NOT an official planning tool. Its numbers come from simplified models that are not calibrated against any real city. Use it to understand patterns, not to make decisions.',
    },
  },
  {
    id: 'models',
    title: { id: 'Model yang dipakai', en: 'Models used' },
    body: {
      id: 'FlowState adalah simulasi mikroskopik: setiap kendaraan dihitung satu per satu dengan langkah tetap 0,2 detik di Web Worker. Detail teknis ada di docs/model-notes.md di repositori.',
      en: 'FlowState is a microscopic simulation: every vehicle is computed individually with a fixed 0.2-second step in a Web Worker. Technical details are in docs/model-notes.md in the repository.',
    },
    items: [
      {
        title: { id: 'Mengikuti kendaraan — IDM', en: 'Car-following — IDM' },
        text: {
          id: 'Treiber, Hennecke & Helbing (2000), Phys. Rev. E 62, 1805. Pembaruan balistik menurut Treiber & Kanagaraj (2015).',
          en: 'Treiber, Hennecke & Helbing (2000), Phys. Rev. E 62, 1805. Ballistic update after Treiber & Kanagaraj (2015).',
        },
      },
      {
        title: { id: 'Pindah lajur — MOBIL', en: 'Lane changing — MOBIL' },
        text: {
          id: 'Kesting, Treiber & Helbing (2007), Transportation Research Record 1999.',
          en: 'Kesting, Treiber & Helbing (2007), Transportation Research Record 1999.',
        },
      },
      {
        title: { id: 'Rute — A* dengan biaya dinamis', en: 'Routing — A* with dynamic costs' },
        text: {
          id: 'Hart, Nilsson & Raphael (1968). Biaya = waktu tempuh terkini; kendaraan bisa berganti rute saat macet.',
          en: 'Hart, Nilsson & Raphael (1968). Cost = current travel time; vehicles may reroute in congestion.',
        },
      },
      {
        title: { id: 'Simpang', en: 'Intersections' },
        text: {
          id: 'Lampu berfase dengan kuning & semua-merah, prioritas dengan celah kritis, bundaran searah jarum jam (lalu lintas kiri), zebra cross dengan pejalan kaki Poisson.',
          en: 'Phased signals with yellow & all-red, priority with critical gaps, clockwise roundabouts (left-hand traffic), zebra crossings with Poisson pedestrians.',
        },
      },
      {
        title: { id: 'Permintaan & moda', en: 'Demand & mode choice' },
        text: {
          id: 'Perjalanan Poisson antar-zona dengan profil jam sibuk; pilihan moda logit multinomial (Ben-Akiva & Lerman, 1985) dengan konstanta yang dikalibrasi untuk peragaan.',
          en: 'Poisson trips between zones with peak-hour profiles; multinomial logit mode choice (Ben-Akiva & Lerman, 1985) with constants tuned for demonstration.',
        },
      },
      {
        title: { id: 'Fenomena', en: 'Phenomena' },
        text: {
          id: 'Sugiyama dkk. (2008) New J. Phys. 10; Braess (1968) Unternehmensforschung 12; Wardrop (1952).',
          en: 'Sugiyama et al. (2008) New J. Phys. 10; Braess (1968) Unternehmensforschung 12; Wardrop (1952).',
        },
      },
    ],
  },
  {
    id: 'limits',
    title: { id: 'Batasan yang perlu Anda tahu', en: 'Limitations you should know' },
    body: {
      id: 'Kami berusaha jujur soal apa yang tidak dimodelkan:',
      en: 'We try to be honest about what is not modelled:',
    },
    items: [
      {
        title: { id: 'Motor tidak menyelip', en: 'Motorbikes do not filter' },
        text: {
          id: 'Motor berperilaku seperti kendaraan kecil dalam lajur; perilaku menyelip khas Indonesia tidak dimodelkan.',
          en: 'Motorbikes behave as small in-lane vehicles; Indonesian-style lane filtering is not modelled.',
        },
      },
      {
        title: { id: 'Tanpa pelanggaran & hambatan samping', en: 'No violations or side friction' },
        text: {
          id: 'Tidak ada parkir di badan jalan, angkot ngetem, pedagang kaki lima, atau pelanggaran lampu merah.',
          en: 'No on-street parking, stopping minibuses, street vendors, or red-light running.',
        },
      },
      {
        title: { id: 'Konflik di dalam fase', en: 'Conflicts within a phase' },
        text: {
          id: 'Di simpang bersinyal, belok kanan dan arus lurus berlawanan dalam fase yang sama tidak saling menunggu.',
          en: 'At signals, right turns and opposing through traffic in the same phase do not yield to each other.',
        },
      },
      {
        title: { id: 'Penumpang agregat', en: 'Aggregate passengers' },
        text: {
          id: 'Penumpang bus/MRT dihitung sebagai jumlah, bukan agen yang berjalan ke halte; tidak ada transfer antarjalur.',
          en: 'Bus/metro riders are counted, not simulated walking to stops; there are no transfers between lines.',
        },
      },
      {
        title: { id: 'Emisi relatif', en: 'Relative emissions' },
        text: {
          id: 'Indeks pembanding, bukan gram CO₂ sebenarnya.',
          en: 'A comparison index, not real grams of CO₂.',
        },
      },
      {
        title: { id: 'Satu seed, satu cerita', en: 'One seed, one story' },
        text: {
          id: 'Setiap angka berasal dari satu jalan simulasi ber-seed. Ulangi dengan seed lain sebelum menarik kesimpulan.',
          en: 'Every number comes from a single seeded run. Repeat with other seeds before drawing conclusions.',
        },
      },
    ],
  },
  {
    id: 'privacy',
    title: { id: 'Privasi', en: 'Privacy' },
    body: {
      id: 'Tidak ada analitik, cookie pelacak, atau permintaan ke server pihak ketiga. Preferensi (bahasa, tema, kualitas grafis) disimpan di localStorage perangkat Anda. Kota yang dibagikan lewat tautan disimpan di dalam URL itu sendiri.',
      en: 'No analytics, tracking cookies or requests to third-party servers. Preferences (language, theme, graphics quality) are stored in your device’s localStorage. Cities shared via link live inside the URL itself.',
    },
  },
  {
    id: 'credits',
    title: { id: 'Kredit', en: 'Credits' },
    body: {
      id: 'Dibangun dengan perangkat lunak sumber terbuka. Semua aset 3D dibuat secara prosedural di kode — tidak ada model atau tekstur pihak ketiga.',
      en: 'Built with open-source software. All 3D assets are generated procedurally in code — no third-party models or textures.',
    },
    items: [
      {
        title: { id: 'Grafis 3D', en: '3D graphics' },
        text: {
          id: 'three.js, React Three Fiber, drei, postprocessing (MIT).',
          en: 'three.js, React Three Fiber, drei, postprocessing (MIT).',
        },
      },
      {
        title: { id: 'Aplikasi', en: 'Application' },
        text: {
          id: 'React, Vite, TypeScript, Tailwind CSS, Zustand, React Router, Zod, i18next, d3-scale/d3-shape, lz-string, Lucide (MIT/ISC/BSD).',
          en: 'React, Vite, TypeScript, Tailwind CSS, Zustand, React Router, Zod, i18next, d3-scale/d3-shape, lz-string, Lucide (MIT/ISC/BSD).',
        },
      },
      {
        title: { id: 'Huruf', en: 'Typefaces' },
        text: {
          id: 'Jost, Public Sans, JetBrains Mono — SIL Open Font License, disajikan dari paket @fontsource (tanpa CDN).',
          en: 'Jost, Public Sans, JetBrains Mono — SIL Open Font License, served from @fontsource packages (no CDN).',
        },
      },
      {
        title: { id: 'Inspirasi struktur', en: 'Structural inspiration' },
        text: {
          id: 'Proyek edukasi multi-modul BumiLapis3D.',
          en: 'The multi-module educational project BumiLapis3D.',
        },
      },
    ],
  },
];

export const ABOUT: AboutSection[] = raw.map((s) => AboutSection.parse(s));
