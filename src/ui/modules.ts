import type { LucideIcon } from 'lucide-react';
import { Building2, PenTool, FlaskConical, TramFront, ChartSpline, BookOpenText, Info } from 'lucide-react';

export type ModuleKey = 'city' | 'editor' | 'lab' | 'transit' | 'analytics' | 'glossary' | 'about';

export interface ModuleDef {
  key: ModuleKey;
  path: string;
  /** Kode stasiun ala peta MRT. */
  code: string;
  icon: LucideIcon;
  main: boolean;
}

export const MODULES: readonly ModuleDef[] = [
  { key: 'city', path: '/city', code: 'M1', icon: Building2, main: true },
  { key: 'editor', path: '/editor', code: 'M2', icon: PenTool, main: true },
  { key: 'lab', path: '/lab', code: 'M3', icon: FlaskConical, main: true },
  { key: 'transit', path: '/transit', code: 'M4', icon: TramFront, main: true },
  { key: 'analytics', path: '/analytics', code: 'M5', icon: ChartSpline, main: true },
  { key: 'glossary', path: '/glossary', code: 'M6', icon: BookOpenText, main: true },
  { key: 'about', path: '/about', code: 'i', icon: Info, main: false },
];
