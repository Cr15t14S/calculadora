import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  formatearEntradaDecimal,
  formatearEntradaEntero,
  formatearEntradaMonto,
} from '../../lib/finanzas';

export type InputKind = 'monto' | 'decimal' | 'entero' | 'text';

interface FieldInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  kind?: InputKind;
  maxDigitos?: number;
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

export function sanitizarPorTipo(raw: string, kind: InputKind, maxDigitos?: number): string {
  if (kind === 'monto') return formatearEntradaMonto(raw);
  if (kind === 'decimal') return formatearEntradaDecimal(raw);
  if (kind === 'entero') return formatearEntradaEntero(raw, maxDigitos ?? 4);
  return raw;
}

export function FieldInput({
  id,
  label,
  value,
  onChange,
  kind = 'text',
  maxDigitos,
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretTargetRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caretTargetRef.current !== null && inputRef.current) {
      const pos = caretTargetRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      caretTargetRef.current = null;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (kind === 'monto') {
      const selStart = e.target.selectionStart ?? raw.length;
      // Contamos dígitos y comas antes del cursor para preservar la posición al insertar puntos
      const tokensAntes = raw.slice(0, selStart).replace(/[^0-9,]/g, '').length;
      const formateado = formatearEntradaMonto(raw);

      let nuevaPos = formateado.length;
      if (tokensAntes === 0) {
        nuevaPos = 0;
      } else {
        let vistos = 0;
        for (let idx = 0; idx < formateado.length; idx++) {
          if (formateado[idx] !== '.') vistos++;
          if (vistos === tokensAntes) {
            nuevaPos = idx + 1;
            break;
          }
        }
      }
      caretTargetRef.current = nuevaPos;
      onChange(formateado);
      return;
    }

    onChange(sanitizarPorTipo(raw, kind, maxDigitos));
  };

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
          ref={inputRef}
          id={id}
          type="text"
          inputMode={kind === 'entero' ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={disabled ? 'Se calcula automáticamente' : placeholder}
          onChange={handleChange}
          className={`w-full bg-transparent px-3 py-2 font-mono-num text-sm outline-none placeholder:font-sans placeholder:text-xs placeholder:text-[var(--ink-faint)] ${
            disabled ? 'cursor-not-allowed font-semibold text-[var(--emerald)]' : 'text-[var(--ink)]'
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
