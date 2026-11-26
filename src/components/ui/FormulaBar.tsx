interface FormulaBarProps {
  titulo?: string;
  simbolica: string;
  sustituida: string;
  extra?: string;
}

export function FormulaBar({
  titulo = 'Desarrollo de fórmula',
  simbolica,
  sustituida,
  extra,
}: FormulaBarProps) {
  return (
    <div className="border border-[var(--line)] bg-[var(--paper-alt)] px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          {titulo}
        </span>
        <span className="font-mono-num text-xs font-semibold text-[var(--ink)]">
          {simbolica}
        </span>
      </div>
      <div className="mt-2 overflow-x-auto font-mono-num text-xs text-[var(--ink-muted)] sm:text-[13px]">
        {sustituida}
      </div>
      {extra && (
        <div className="mt-1.5 font-mono-num text-[11px] text-[var(--ink-faint)]">
          {extra}
        </div>
      )}
    </div>
  );
}
