import type { ReactNode } from 'react';

interface FieldInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
  highlightTarget?: boolean;
  helper?: string;
  preview?: string;
  error?: string;
  rightSlot?: ReactNode;
}

export function FieldInput({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  disabled = false,
  highlightTarget = false,
  helper,
  preview,
  error,
  rightSlot,
}: FieldInputProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className={`text-xs font-semibold uppercase tracking-[0.06em] ${
            highlightTarget
              ? 'text-[var(--emerald)]'
              : disabled
                ? 'text-[var(--ink-faint)]'
                : 'text-[var(--ink-muted)]'
          }`}
        >
          {label}
          {highlightTarget && (
            <span className="ml-2 border border-[var(--emerald)] bg-[var(--emerald-soft)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--emerald)]">
              INCÓGNITA
            </span>
          )}
        </label>
        {rightSlot}
      </div>

      <div
        className={`flex items-stretch border transition-colors ${
          error
            ? 'border-[var(--crimson)] bg-[var(--crimson-soft)]/30'
            : highlightTarget
              ? 'border-[var(--emerald)] bg-[var(--emerald-soft)]/50'
              : disabled
                ? 'border-[var(--line)] bg-[var(--paper-alt)]'
                : 'border-[var(--line-strong)] bg-white focus-within:border-[var(--ink)]'
        }`}
      >
        {prefix && (
          <span className="flex select-none items-center border-r border-[var(--line)] bg-[var(--paper)] px-2.5 font-mono-num text-xs font-medium text-[var(--ink-muted)]">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder={disabled ? 'Se calcula automáticamente' : placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-transparent px-3 py-2 font-mono-num text-sm outline-none placeholder:font-sans placeholder:text-xs placeholder:text-[var(--ink-faint)] ${
            disabled ? 'cursor-not-allowed text-[var(--emerald)] font-semibold' : 'text-[var(--ink)]'
          }`}
        />
        {suffix && (
          <span className="flex select-none items-center border-l border-[var(--line)] bg-[var(--paper)] px-2.5 font-mono-num text-xs font-medium text-[var(--ink-muted)]">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-xs font-medium text-[var(--crimson)]">{error}</p>
      ) : preview ? (
        <p className="font-mono-num text-[11px] text-[var(--ink-faint)]">
          Interpretado: <span className="text-[var(--ink-muted)]">{preview}</span>
        </p>
      ) : helper ? (
        <p className="text-[11px] text-[var(--ink-faint)]">{helper}</p>
      ) : null}
    </div>
  );
}
