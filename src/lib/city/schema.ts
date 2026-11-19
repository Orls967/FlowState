import { z } from 'zod';

/** Skema dokumen kota (format simpan/muat/bagikan). Semua masukan eksternal divalidasi di sini. */
export const ZONES = ['none', 'home', 'office', 'school', 'mall'] as const;
export type Zone = (typeof ZONES)[number];
export const CONTROLS = ['auto', 'priority', 'signal', 'roundabout', 'allway'] as const;
export type Control = (typeof CONTROLS)[number];

const finite = z.number().finite();

export const NodeSchema = z.object({
  id: z.number().int().nonnegative(),
  x: finite.min(-20000).max(20000),
  y: finite.min(-20000).max(20000),
  control: z.enum(CONTROLS).default('auto'),
  crosswalk: z.boolean().default(false),
  zone: z.enum(ZONES).default('none'),
  weight: finite.min(0).max(10).default(1),
  /** Durasi hijau per fase (detik). Panjang larik menyesuaikan jumlah fase otomatis. */
  greens: z.array(finite.min(5).max(180)).max(8).optional(),
  /** Offset siklus lampu (detik) — untuk koordinasi gelombang hijau. */
  offset: finite.min(0).max(600).default(0),
});
export type CityNode = z.infer<typeof NodeSchema>;

export const RoadSchema = z.object({
  id: z.number().int().nonnegative(),
  a: z.number().int().nonnegative(),
  b: z.number().int().nonnegative(),
  /** Jumlah lajur per arah. */
  lanes: z.number().int().min(1).max(4),
  /** Batas kecepatan (km/jam). */
  speed: finite.min(10).max(120),
  /** Satu arah a → b. */
  oneway: z.boolean().default(false),
  /** Lajur paling tepi khusus bus (butuh ≥2 lajur). */
  busLane: z.boolean().default(false),
});
export type CityRoad = z.infer<typeof RoadSchema>;

export const BusLineSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().max(40),
  stops: z.array(z.number().int().nonnegative()).min(2).max(40),
  /** Selang keberangkatan (detik). */
  headway: finite.min(60).max(3600),
  /** BRT: lajur khusus di sepanjang rute. */
  dedicated: z.boolean().default(false),
});
export type BusLine = z.infer<typeof BusLineSchema>;

export const MrtLineSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().max(40),
  stations: z
    .array(z.object({ x: finite.min(-20000).max(20000), y: finite.min(-20000).max(20000) }))
    .min(2)
    .max(30),
  headway: finite.min(60).max(3600),
});
export type MrtLine = z.infer<typeof MrtLineSchema>;

export const CityDocSchema = z
  .object({
    version: z.literal(1),
    name: z.string().max(80).default(''),
    seed: z.number().int().nonnegative().optional(),
    nodes: z.array(NodeSchema).max(5000),
    roads: z.array(RoadSchema).max(10000),
    transit: z
      .object({
        bus: z.array(BusLineSchema).max(20).default([]),
        mrt: z.array(MrtLineSchema).max(10).default([]),
      })
      .default({ bus: [], mrt: [] }),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<number>();
    for (const n of doc.nodes) {
      if (ids.has(n.id)) ctx.addIssue({ code: 'custom', message: `duplicate node id ${n.id}` });
      ids.add(n.id);
    }
    const rids = new Set<number>();
    for (const r of doc.roads) {
      if (rids.has(r.id)) ctx.addIssue({ code: 'custom', message: `duplicate road id ${r.id}` });
      rids.add(r.id);
      if (!ids.has(r.a) || !ids.has(r.b))
        ctx.addIssue({ code: 'custom', message: `road ${r.id} references missing node` });
      if (r.a === r.b) ctx.addIssue({ code: 'custom', message: `road ${r.id} is a loop` });
    }
    for (const l of doc.transit.bus) {
      for (const s of l.stops)
        if (!ids.has(s)) ctx.addIssue({ code: 'custom', message: `bus line ${l.id} stop missing` });
    }
  });

export type CityDoc = z.infer<typeof CityDocSchema>;
export type CityDocInput = z.input<typeof CityDocSchema>;
