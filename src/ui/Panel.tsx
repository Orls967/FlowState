import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen } from 'lucide-react';

/**
 * Panel kontrol yang bisa diciutkan: di desktop menempel di kanan, di HP menjadi bottom sheet.
 * `summary` tampil saat panel diciutkan di HP.
 */
export function SidePanel({
  title,
  code,
  summary,
  children,
  defaultOpen,
}: {
  title: string;
  code: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(
    () => defaultOpen ?? (typeof window === 'undefined' || window.innerWidth >= 1024),
  );
  return (
    <aside
      aria-label={title}
      className={`absolute z-20 flex flex-col border-line-strong bg-surface max-lg:inset-x-0 max-lg:bottom-0 max-lg:border-t-2 lg:right-3 lg:top-3 lg:bottom-3 lg:w-[22rem] lg:border-2 lg:shadow-[4px_4px_0_var(--fs-line-strong)] ${
        open ? 'max-lg:max-h-[62%]' : 'lg:bottom-auto'
      }`}
    >
      <div className="flex items-center gap-2 border-b-2 border-line-strong px-3 py-2">
        <span className="num border-2 border-line-strong px-1 text-[0.7rem] font-semibold">{code}</span>
        <h2 className="flex-1 truncate font-display text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? t('sim.collapse') : t('sim.expand')}
          data-testid="panel-toggle"
          className="flex h-8 w-8 items-center justify-center hover:bg-surface-2"
        >
          <span className="lg:hidden">
            {open ? <ChevronDown size={18} aria-hidden /> : <ChevronUp size={18} aria-hidden />}
          </span>
          <span className="max-lg:hidden">
            {open ? <PanelRightClose size={18} aria-hidden /> : <PanelRightOpen size={18} aria-hidden />}
          </span>
        </button>
      </div>
      {!open && summary && <div className="px-3 py-2 lg:hidden">{summary}</div>}
      {open && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">{children}</div>}
    </aside>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="station-label mb-2 border-b border-line pb-1">{title}</h3>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  unit,
  testId,
}: {
  label: string;
  value: string;
  unit?: string;
  testId?: string;
}) {
  return (
    <div className="border-l-2 border-line-strong pl-2">
      <div className="text-[0.7rem] leading-tight text-ink-2">{label}</div>
      <div className="num text-lg font-semibold leading-tight" data-testid={testId}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-ink-2">{unit}</span>}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 border-2 border-line-strong ${checked ? 'bg-accent' : 'bg-surface-2'}`}
      >
        <span
          className={`absolute left-0 top-0.5 h-4 w-4 bg-ink transition-transform ${checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5'}`}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  testId?: string;
}) {
  return (
    <label className="block py-1.5 text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="num text-ink-2">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = 'outline',
  testId,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'outline' | 'solid' | 'ghost';
  testId?: string;
  disabled?: boolean;
  title?: string;
}) {
  const cls =
    variant === 'solid'
      ? 'bg-accent text-on-accent border-2 border-accent hover:brightness-95'
      : variant === 'ghost'
        ? 'border-2 border-transparent hover:bg-surface-2'
        : 'border-2 border-line-strong hover:bg-surface-2';
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 px-3 text-sm font-semibold disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}
