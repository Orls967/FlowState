import type { id } from './id';

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

/** Bentuk pesan UI; en.ts wajib memenuhi tipe ini sehingga kunci yang hilang = galat kompilasi. */
export type Messages = Widen<typeof id>;
