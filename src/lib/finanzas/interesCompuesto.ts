import { ErrorFinanciero, fmtDinero, fmtNum, validarTasa } from './formato';

export type IncognitaIC = 'VF' | 'VP' | 'i' | 'n';

export interface PuntoSerieIC {
  t: number;
  compuesto: number;
  simple: number;
  capital: number;
}

export interface ResultadoInteresCompuesto {
  incognita: IncognitaIC;
  valor: number;
  vp: number;
  vf: number;
  i: number;
  n: number;
  factor: number;
  intereses: number;
  formulaSimbolica: string;
  formulaSustituida: string;
  enteroSuperiorN?: number;
  advertencia?: string;
  serie: PuntoSerieIC[];
}

export function calcVF(vp: number, i: number, n: number): number {
  validarTasa(i);
  const res = vp * Math.pow(1 + i, n);
  if (!Number.isFinite(res)) {
    throw new ErrorFinanciero('El resultado es demasiado grande. Revise la tasa y el número de periodos.');
  }
  return res;
}

export function calcVP(vf: number, i: number, n: number): number {
  validarTasa(i);
  const res = vf / Math.pow(1 + i, n);
  if (!Number.isFinite(res)) {
    throw new ErrorFinanciero('El resultado excede el rango numérico permitido.');
  }
  return res;
}

export function calcTasa(vp: number, vf: number, n: number): number {
  if (vp <= 0 || vf <= 0) {
    throw new ErrorFinanciero('VP y VF deben ser mayores que cero para calcular la tasa.');
  }
  if (n <= 0) {
    throw new ErrorFinanciero('El número de periodos n debe ser mayor que cero.');
  }
  const res = Math.pow(vf / vp, 1 / n) - 1;
  if (!Number.isFinite(res)) {
    throw new ErrorFinanciero('No se pudo calcular la tasa con los valores ingresados.');
  }
  return res;
}

export function calcN(vp: number, vf: number, i: number): number {
  if (vp <= 0 || vf <= 0) {
    throw new ErrorFinanciero('VP y VF deben ser mayores que cero para calcular n.');
  }
  validarTasa(i);
  if (i === 0) {
    throw new ErrorFinanciero('Con tasa 0 % no se puede calcular n (ln(1) = 0).');
  }
  const res = Math.log(vf / vp) / Math.log(1 + i);
  if (!Number.isFinite(res)) {
    throw new ErrorFinanciero('No se pudo calcular el número de periodos n.');
  }
  return res;
}

function construirSerie(vp: number, i: number, n: number): PuntoSerieIC[] {
  if (!Number.isFinite(vp) || !Number.isFinite(i) || !Number.isFinite(n) || n <= 0) {
    return [];
  }
  const pasos = Math.min(Math.max(Math.ceil(n), 2), 60);
  const serie: PuntoSerieIC[] = [];
  for (let idx = 0; idx <= pasos; idx++) {
    const t = (n * idx) / pasos;
    const compuesto = vp * Math.pow(1 + i, t);
    const simple = vp * (1 + i * t);
    if (!Number.isFinite(compuesto)) break;
    serie.push({ t, compuesto, simple, capital: vp });
  }
  return serie;
}

export function resolverInteresCompuesto(params: {
  incognita: IncognitaIC;
  vp?: number;
  vf?: number;
  i?: number;
  n?: number;
}): ResultadoInteresCompuesto {
  const { incognita } = params;

  if (incognita === 'VF') {
    const vp = params.vp!;
    const i = params.i!;
    const n = params.n!;
    const vf = calcVF(vp, i, n);
    const factor = Math.pow(1 + i, n);
    return {
      incognita,
      valor: vf,
      vp,
      vf,
      i,
      n,
      factor,
      intereses: vf - vp,
      formulaSimbolica: 'VF = VP · (1 + i)ⁿ',
      formulaSustituida: `VF = ${fmtDinero(vp)} · (1 + ${fmtNum(i, 6)})^${fmtNum(n, 2)}`,
      serie: construirSerie(vp, i, n),
    };
  }

  if (incognita === 'VP') {
    const vf = params.vf!;
    const i = params.i!;
    const n = params.n!;
    const vp = calcVP(vf, i, n);
    const factor = Math.pow(1 + i, -n);
    return {
      incognita,
      valor: vp,
      vp,
      vf,
      i,
      n,
      factor,
      intereses: vf - vp,
      formulaSimbolica: 'VP = VF / (1 + i)ⁿ',
      formulaSustituida: `VP = ${fmtDinero(vf)} / (1 + ${fmtNum(i, 6)})^${fmtNum(n, 2)}`,
      serie: construirSerie(vp, i, n),
    };
  }

  if (incognita === 'i') {
    const vp = params.vp!;
    const vf = params.vf!;
    const n = params.n!;
    const i = calcTasa(vp, vf, n);
    const factor = Math.pow(1 + i, n);
    return {
      incognita,
      valor: i,
      vp,
      vf,
      i,
      n,
      factor,
      intereses: vf - vp,
      formulaSimbolica: 'i = (VF / VP)^(1/n) - 1',
      formulaSustituida: `i = (${fmtDinero(vf)} / ${fmtDinero(vp)})^(1 / ${fmtNum(n, 2)}) - 1`,
      advertencia: vf < vp ? 'VF es menor que VP, por lo que la tasa periódica resulta negativa (decrecimiento).' : undefined,
      serie: construirSerie(vp, i, n),
    };
  }

  const vp = params.vp!;
  const vf = params.vf!;
  const i = params.i!;
  const n = calcN(vp, vf, i);
  const factor = vf / vp;
  return {
    incognita: 'n',
    valor: n,
    vp,
    vf,
    i,
    n,
    factor,
    intereses: vf - vp,
    formulaSimbolica: 'n = ln(VF / VP) / ln(1 + i)',
    formulaSustituida: `n = ln(${fmtNum(vf / vp, 6)}) / ln(${fmtNum(1 + i, 6)})`,
    enteroSuperiorN: Math.ceil(n - 1e-9),
    advertencia:
      n < 0
        ? 'El número de periodos es negativo porque VF y el signo de la tasa apuntan en sentido contrario.'
        : undefined,
    serie: construirSerie(vp, i, Math.abs(n)),
  };
}
