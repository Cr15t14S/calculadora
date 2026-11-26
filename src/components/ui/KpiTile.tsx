import { AnimatedNumber } from './AnimatedNumber';

interface KpiTileProps {
  label: string;
  value: number;
  formatter: (v: number) => string;
  caption?: string;
  tone?: 'default' | 'emerald' | 'ochre' | 'crimson' | 'cobalt';
  large?: boolean;
}

const TONE_BORDER: Record<NonNullable<KpiTileProps['tone']>, string> = {
  default: 'border-t-[var(--ink)]',
  emerald: 'border-t-[var(--emerald)]',
  ochre: 'border-t-[var(--ochre)]',
  crimson: 'border-t-[var(--crimson)]',
  cobalt: 'border-t-[var(--cobalt)]',
};

const TONE_TEXT: Record<NonNullable<KpiTileProps['tone']>, string> = {
  default: 'text-[var(--ink)]',
  emerald: 'text-[var(--emerald)]',
  ochre: 'text-[var(--ochre)]',
  crimson: 'text-[var(--crimson)]',
  cobalt: 'text-[var(--cobalt)]',
};

export function KpiTile({
  label,
  value,
  formatter,
  caption,
  tone = 'default',
  large = false,
}: KpiTileProps) {
  return (
    <div
      className={`min-w-0 border border-[var(--line)] border-t-2 bg-white px-4 py-3.5 ${TONE_BORDER[tone]}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-muted)]">
        {label}
      </div>
      <div
        className={`mt-1.5 overflow-x-auto whitespace-nowrap font-semibold tracking-tight ${
          large ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
        } ${TONE_TEXT[tone]}`}
      >
        <AnimatedNumber value={value} formatter={formatter} />
      </div>
      {caption && (
        <div className="mt-1 truncate text-xs text-[var(--ink-faint)]" title={caption}>
          {caption}
        </div>
      )}
    </div>
  );
}
