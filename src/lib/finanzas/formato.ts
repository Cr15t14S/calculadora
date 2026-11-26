export const EPS = 1e-7;

export class ErrorFinanciero extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorFinanciero';
  }
}

export function validarTasa(i: number, nombre = 'La tasa'): void {
  if (!Number.isFinite(i)) {
    throw new ErrorFinanciero(`${nombre} debe ser un número finito.`);
  }
  if (i <= -1) {
    throw new ErrorFinanciero(`${nombre} debe ser mayor que -100 %.`);
  }
}

/**
 * Convierte texto de un campo numérico a number, aceptando coma o punto decimal.
 * Si esMonto=true, un único separador seguido de exactamente 3 dígitos se interpreta
 * como separador de miles (ej. "150.000" -> 150000).
 */
export function parsearNumero(
  texto: string,
  nombre: string,
  opciones?: { esMonto?: boolean }
): number {
  const esMonto = opciones?.esMonto ?? false;
  let s = (texto ?? '').trim().replace(/[$%\s]/g, '');
  if (!s) {
    throw new ErrorFinanciero(`El campo «${nombre}» está vacío.`);
  }

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',') || s.includes('.')) {
    const sep = s.includes(',') ? ',' : '.';
    const count = s.split(sep).length - 1;
    if (count > 1) {
      s = s.split(sep).join('');
    } else if (esMonto && /^-?\d{1,3}[.,]\d{3}$/.test(s)) {
      s = s.replace(sep, '');
    } else {
      s = s.replace(',', '.');
    }
  }

  const valor = Number(s);
  if (!Number.isFinite(valor)) {
    throw new ErrorFinanciero(`El campo «${nombre}» no es un número válido: «${texto}».`);
  }
  return valor;
}

/** Lee una tasa escrita en porcentaje y la devuelve en decimal (2 -> 0.02). */
export function parsearTasa(texto: string, nombre: string): number {
  return parsearNumero(texto, nombre) / 100;
}

export function parsearEnteroPositivo(texto: string, nombre: string): number {
  const v = parsearNumero(texto, nombre);
  if (v <= 0 || Math.abs(v - Math.round(v)) > 1e-9) {
    throw new ErrorFinanciero(`«${nombre}» debe ser un número entero mayor que cero.`);
  }
  return Math.round(v);
}

/** Formato colombiano: 1234567.89 -> "1.234.567,89" */
export function formatearCO(x: number, dec = 2): string {
  if (!Number.isFinite(x)) return '—';
  const limpio = Math.abs(x) < 1e-12 ? 0 : x;
  const fixed = limpio.toFixed(dec);
  const [ent, frac] = fixed.split('.');
  const neg = ent.startsWith('-');
  const digitos = neg ? ent.slice(1) : ent;
  const conMiles = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const prefijo = neg ? '-' : '';
  return dec > 0 ? `${prefijo}${conMiles},${frac}` : `${prefijo}${conMiles}`;
}

export function fmtDinero(x: number): string {
  if (!Number.isFinite(x)) return '—';
  return `$ ${formatearCO(x, 2)}`;
}

/** Formato abreviado para ejes de gráficas: $1,2M / $450k */
export function fmtDineroCorto(x: number): string {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  const sign = x < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${formatearCO(abs / 1_000_000_000, 1)}MM`;
  if (abs >= 1_000_000) return `${sign}$${formatearCO(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}$${formatearCO(abs / 1_000, 0)}k`;
  return `${sign}$${formatearCO(abs, 0)}`;
}

export function fmtPct(x: number, dec = 4): string {
  if (!Number.isFinite(x)) return '—';
  return `${formatearCO(x * 100, dec)} %`;
}

export function fmtNum(x: number, dec = 4): string {
  return formatearCO(x, dec);
}

/** Número para CSV en Excel en español: sin miles y con coma decimal. */
export function numCsv(x: number | null | undefined, dec = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '';
  return x.toFixed(dec).replace('.', ',');
}
