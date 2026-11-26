import { ErrorFinanciero, validarTasa } from './formato';

export interface FrecuenciaTasa {
  id: string;
  label: string;
  corto: string;
  sigla: string;
  m: number;
}

export const FRECUENCIAS_TASA: FrecuenciaTasa[] = [
  { id: 'anual', label: 'Anual (EA)', corto: 'Anual', sigla: 'EA', m: 1 },
  { id: 'semestral', label: 'Semestral', corto: 'Semestral', sigla: 'ES', m: 2 },
  { id: 'cuatrimestral', label: 'Cuatrimestral', corto: 'Cuatrim.', sigla: 'EC', m: 3 },
  { id: 'trimestral', label: 'Trimestral', corto: 'Trimestral', sigla: 'ET', m: 4 },
  { id: 'bimestral', label: 'Bimestral', corto: 'Bimestral', sigla: 'EB', m: 6 },
  { id: 'mensual', label: 'Mensual', corto: 'Mensual', sigla: 'EM', m: 12 },
  { id: 'quincenal', label: 'Quincenal', corto: 'Quincenal', sigla: 'EQ', m: 24 },
  { id: 'diaria360', label: 'Diaria (360)', corto: 'Diaria 360', sigla: 'ED', m: 360 },
  { id: 'diaria365', label: 'Diaria (365)', corto: 'Diaria 365', sigla: 'ED', m: 365 },
];

export interface ResultadoNominal {
  j: number;
  m: number;
  anticipada: boolean;
  ip: number;
  iv: number;
  ea: number;
  nominalVencida: number;
}

export interface FilaEquivalencia {
  label: string;
  sigla: string;
  m: number;
  periodicaVencida: number;
  periodicaAnticipada: number;
  nominalVencida: number;
}

/** iv = ia / (1 - ia) */
export function anticipadaAVencida(ia: number): number {
  if (!Number.isFinite(ia)) {
    throw new ErrorFinanciero('La tasa anticipada debe ser un número finito.');
  }
  if (ia >= 1) {
    throw new ErrorFinanciero('La tasa anticipada debe ser menor que 100 % (1 - ia ≠ 0).');
  }
  if (ia <= -1) {
    throw new ErrorFinanciero('La tasa anticipada debe ser mayor que -100 %.');
  }
  return ia / (1 - ia);
}

/** ia = iv / (1 + iv) */
export function vencidaAAnticipada(iv: number): number {
  validarTasa(iv, 'La tasa vencida');
  return iv / (1 + iv);
}

/**
 * Nominal anual j capitalizable m veces al año -> (ip, iv, EA, nominalVencida).
 * Si es anticipada: ia = j/m, iv = ia/(1-ia), EA = (1+iv)^m - 1.
 */
export function nominalAPeriodica(j: number, m: number, anticipada = false): ResultadoNominal {
  if (!Number.isFinite(m) || m <= 0) {
    throw new ErrorFinanciero('m (capitalizaciones por año) debe ser mayor que cero.');
  }
  const ip = j / m;
  const iv = anticipada ? anticipadaAVencida(ip) : (validarTasa(ip, 'La tasa periódica'), ip);
  const ea = Math.pow(1 + iv, m) - 1;
  if (!Number.isFinite(ea)) {
    throw new ErrorFinanciero('La tasa efectiva anual excede el rango numérico permitido.');
  }
  return {
    j,
    m,
    anticipada,
    ip,
    iv,
    ea,
    nominalVencida: iv * m,
  };
}

/** i_buscada = (1 + i_conocida)^(n_conocida / n_buscada) - 1 */
export function tasaEquivalente(iConocida: number, nConocida: number, nBuscada: number): number {
  if (!Number.isFinite(nConocida) || !Number.isFinite(nBuscada) || nConocida <= 0 || nBuscada <= 0) {
    throw new ErrorFinanciero('Los periodos por año deben ser mayores que cero.');
  }
  validarTasa(iConocida, 'La tasa conocida');
  const res = Math.pow(1 + iConocida, nConocida / nBuscada) - 1;
  if (!Number.isFinite(res)) {
    throw new ErrorFinanciero('La tasa equivalente excede el rango numérico permitido.');
  }
  return res;
}

/** Genera la tabla comparativa de tasas equivalentes a partir de una Efectiva Anual. */
export function tablaEquivalenciasDesdeEA(ea: number): FilaEquivalencia[] {
  validarTasa(ea, 'La tasa efectiva anual');
  const seleccion = FRECUENCIAS_TASA.filter((f) => [1, 2, 4, 6, 12, 360].includes(f.m));
  return seleccion.map((f) => {
    const iv = tasaEquivalente(ea, 1, f.m);
    const ia = vencidaAAnticipada(iv);
    return {
      label: f.corto,
      sigla: f.sigla,
      m: f.m,
      periodicaVencida: iv,
      periodicaAnticipada: ia,
      nominalVencida: iv * f.m,
    };
  });
}
