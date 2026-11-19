/**
 * MOBIL — Minimizing Overall Braking Induced by Lane changes (Kesting, Treiber & Helbing, 2007).
 * Pindah lajur bila:
 *   keselamatan:  ã_n ≥ −b_safe   (pengikut baru tidak perlu mengerem terlalu keras)
 *   insentif:     ã_c − a_c + p[(ã_n − a_n) + (ã_o − a_o)] > Δa_th + bias
 */
export interface MobilInput {
  /** percepatan saya sekarang & setelah pindah */
  accSelf: number;
  accSelfNew: number;
  /** pengikut baru: sebelum & sesudah saya masuk */
  accNewFollower: number;
  accNewFollowerAfter: number;
  /** pengikut lama: sebelum & sesudah saya pergi */
  accOldFollower: number;
  accOldFollowerAfter: number;
  politeness: number;
  threshold: number;
  /** bias ke lajur target (positif = lebih ingin pindah), mis. untuk pindah lajur wajib */
  bias: number;
  bSafe: number;
}

export interface MobilResult {
  safe: boolean;
  incentive: number;
  change: boolean;
}

export function mobilDecision(m: MobilInput): MobilResult {
  const safe = m.accNewFollowerAfter >= -m.bSafe && m.accSelfNew >= -m.bSafe;
  const incentive =
    m.accSelfNew -
    m.accSelf +
    m.politeness * (m.accNewFollowerAfter - m.accNewFollower + (m.accOldFollowerAfter - m.accOldFollower));
  return { safe, incentive, change: safe && incentive > m.threshold - m.bias };
}
