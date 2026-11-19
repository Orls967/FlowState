/** Jenis kendaraan dan parameter perilaku (IDM + MOBIL). Nilai mengikuti rentang di literatur (Treiber & Kesting 2013). */
export const VehicleType = { Car: 0, Moto: 1, Bus: 2, Truck: 3 } as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];
export const VEHICLE_TYPES: readonly VehicleType[] = [0, 1, 2, 3];
export const VEHICLE_KEYS = ['car', 'moto', 'bus', 'truck'] as const;

export interface DriverParams {
  /** Panjang kendaraan (m). */
  length: number;
  width: number;
  /** Kecepatan maksimum kendaraan (m/s). */
  vmax: number;
  /** Faktor terhadap batas kecepatan (pengemudi bisa sedikit melebihi/di bawah). */
  v0Factor: number;
  /** Percepatan maksimum a (m/s²). */
  a: number;
  /** Perlambatan nyaman b (m/s²). */
  b: number;
  /** Headway waktu aman T (s). */
  T: number;
  /** Jarak minimum saat berhenti s0 (m). */
  s0: number;
  /** Faktor kesopanan MOBIL p. */
  politeness: number;
  /** Ambang keuntungan pindah lajur (m/s²). */
  laneThreshold: number;
  /** Emisi relatif per km (mobil = 1). */
  emissionPerKm: number;
  /** Emisi relatif per detik saat diam. */
  emissionIdle: number;
}

export const DRIVER_PARAMS: Record<VehicleType, DriverParams> = {
  [VehicleType.Car]: {
    length: 4.5,
    width: 1.8,
    vmax: 38,
    v0Factor: 1.0,
    a: 1.4,
    b: 2.0,
    T: 1.4,
    s0: 2.0,
    politeness: 0.3,
    laneThreshold: 0.15,
    emissionPerKm: 1.0,
    emissionIdle: 0.0035,
  },
  [VehicleType.Moto]: {
    length: 2.0,
    width: 0.8,
    vmax: 33,
    v0Factor: 1.05,
    a: 2.0,
    b: 2.5,
    T: 1.0,
    s0: 1.2,
    politeness: 0.1,
    laneThreshold: 0.08,
    emissionPerKm: 0.45,
    emissionIdle: 0.0015,
  },
  [VehicleType.Bus]: {
    length: 12,
    width: 2.5,
    vmax: 25,
    v0Factor: 0.9,
    a: 0.9,
    b: 1.6,
    T: 1.6,
    s0: 2.5,
    politeness: 0.5,
    laneThreshold: 0.3,
    emissionPerKm: 4.2,
    emissionIdle: 0.012,
  },
  [VehicleType.Truck]: {
    length: 10,
    width: 2.4,
    vmax: 25,
    v0Factor: 0.85,
    a: 0.8,
    b: 1.6,
    T: 1.8,
    s0: 2.5,
    politeness: 0.5,
    laneThreshold: 0.3,
    emissionPerKm: 3.4,
    emissionIdle: 0.01,
  },
};

/** Komposisi lalu lintas pribadi bergaya kota Indonesia: motor dominan. */
export const PRIVATE_MIX: readonly number[] = [0.38, 0.55, 0, 0.07];
