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
  return `$\u00A0${formatearCO(x, 2)}`;
}

/**
 * Formatea en vivo un campo de monto: solo admite dígitos y una coma decimal
 * (máx. 2 decimales) e inserta automáticamente puntos de miles.
 * Rechaza letras, signos y caracteres especiales.
 */
export function formatearEntradaMonto(raw: string): string {
  // Quitamos puntos (son separadores automáticos) y cualquier carácter que no sea dígito o coma
  const sinPuntos = raw.replace(/\./g, '');
  let limpio = '';
  let tieneComa = false;

  for (const ch of sinPuntos) {
    if (ch >= '0' && ch <= '9') {
      limpio += ch;
    } else if (ch === ',' && !tieneComa) {
      tieneComa = true;
      limpio += ',';
    }
  }

  if (!limpio) return '';

  const [entCrudo, fracCrudo] = limpio.split(',');
  let ent = entCrudo.replace(/^0+(?=\d)/, '');
  if (!ent && tieneComa) ent = '0';
  // Limita a 15 dígitos enteros para evitar overflow en IEEE-754
  ent = ent.slice(0, 15);

  const conMiles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (!tieneComa) return conMiles;

  const frac = (fracCrudo ?? '').slice(0, 2);
  return `${conMiles},${frac}`;
}

/**
 * Formatea en vivo un campo decimal positivo (ej. tasas en %, periodos decimales):
 * solo admite dígitos y un separador decimal (convierte '.' a ',').
 */
export function formatearEntradaDecimal(raw: string, maxDec = 6): string {
  let limpio = '';
  let tieneComa = false;

  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      limpio += ch;
    } else if ((ch === ',' || ch === '.') && !tieneComa) {
      tieneComa = true;
      limpio += ',';
    }
  }

  if (!limpio) return '';

  const [entCrudo, fracCrudo] = limpio.split(',');
  let ent = entCrudo.replace(/^0+(?=\d)/, '');
  if (!ent && tieneComa) ent = '0';
  ent = ent.slice(0, 9);

  if (!tieneComa) return ent;
  return `${ent},${(fracCrudo ?? '').slice(0, maxDec)}`;
}

/**
 * Formatea en vivo un campo entero no negativo: solo admite dígitos 0-9.
 */
export function formatearEntradaEntero(raw: string, maxDigitos = 4): string {
  const digitos = raw.replace(/\D/g, '');
  if (!digitos) return '';
  const sinCeros = digitos.replace(/^0+(?=\d)/, '');
  return sinCeros.slice(0, maxDigitos);
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
