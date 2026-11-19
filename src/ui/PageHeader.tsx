import type { ReactNode } from 'react';

export function PageHeader({ code, title, children }: { code: string; title: string; children?: ReactNode }) {
  return (
    <div className="border-b-2 border-line-strong px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="num border-2 border-line-strong px-1.5 text-xs font-semibold">{code}</span>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
