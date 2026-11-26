import { ErrorFinanciero, fmtDinero, fmtNum, fmtPct, validarTasa } from './formato';
import { tasaEquivalente } from './tasas';

export type TipoAnualidad = 'vencida' | 'anticipada' | 'diferida' | 'general';
export type ObjetivoAnualidad = 'VP' | 'VF' | 'R_desde_VP' | 'R_desde_VF';

export interface ParametrosAnualidad {
  tipo: TipoAnualidad;
  objetivo: ObjetivoAnualidad;
  monto: number; // R si objetivo es VP/VF; VP si R_desde_VP; VF si R_desde_VF
  i: number; // tasa en decimal
  n: number; // número de pagos
  gracia?: number; // periodos de gracia k (para diferida: primer pago en k+1)
  mTasa?: number; // capitalizaciones/año de la tasa (para general)
  mPago?: number; // pagos/año (para general)
  generalAnticipada?: boolean;
}

export interface ResultadoAnualidad {
  tipo: TipoAnualidad;
  objetivo: ObjetivoAnualidad;
  valor: number;
  vp: number;
  vf: number;
  r: number;
  iEfectivaPago: number;
  n: number;
  gracia: number;
  totalPagos: number;
  interesesImplicito: number;
  formulaSimbolica: string;
  formulaSustituida: string;
  notaConversion?: string;
  periodosPago: number[];
}

export function resolverAnualidad(p: ParametrosAnualidad): ResultadoAnualidad {
  const { tipo, objetivo, monto, n } = p;
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new ErrorFinanciero('El monto ingresado debe ser mayor que cero.');
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw new ErrorFinanciero('El número de pagos n debe ser un entero mayor que cero.');
  }
  if (n > 600) {
    throw new ErrorFinanciero('El máximo permitido es de 600 pagos.');
  }

  let iPago = p.i;
  validarTasa(iPago, 'La tasa');

  let notaConversion: string | undefined;
  if (tipo === 'general') {
    const mTasa = p.mTasa ?? 12;
    const mPago = p.mPago ?? 4;
    iPago = tasaEquivalente(p.i, mTasa, mPago);
    notaConversion = `Tasa convertida de ${fmtPct(p.i)} (${mTasa}/año) → ${fmtPct(iPago)} por periodo de pago (${mPago}/año).`;
  }

  const gracia = tipo === 'diferida' ? Math.max(0, Math.round(p.gracia ?? 0)) : 0;
  const esAnticipada = tipo === 'anticipada' || (tipo === 'general' && Boolean(p.generalAnticipada));

  // Factores base de anualidad ordinaria (vencida)
  const factorVPBase = iPago === 0 ? n : (1 - Math.pow(1 + iPago, -n)) / iPago;
  const factorVFBase = iPago === 0 ? n : (Math.pow(1 + iPago, n) - 1) / iPago;

  const multAnticipada = esAnticipada ? 1 + iPago : 1;
  const multDiferida = tipo === 'diferida' ? Math.pow(1 + iPago, -gracia) : 1;

  const factorVP = factorVPBase * multAnticipada * multDiferida;
  const factorVF = factorVFBase * multAnticipada;

  let vp: number;
  let vf: number;
  let r: number;
  let valor: number;
  let formulaSimbolica: string;
  let formulaSustituida: string;

  const sufijoAnt = esAnticipada ? ' · (1 + i)' : '';
  const sufijoDif = tipo === 'diferida' && gracia > 0 ? ` · (1 + i)^(-${gracia})` : '';

  if (objetivo === 'VP') {
    r = monto;
    vp = r * factorVP;
    vf = r * factorVF;
    valor = vp;
    formulaSimbolica = `VP = R · [(1 - (1 + i)^(-n)) / i]${sufijoAnt}${sufijoDif}`;
    formulaSustituida = `VP = ${fmtDinero(r)} · ${fmtNum(factorVP, 6)}`;
  } else if (objetivo === 'VF') {
    r = monto;
    vf = r * factorVF;
    vp = r * factorVP;
    valor = vf;
    formulaSimbolica = `VF = R · [((1 + i)ⁿ - 1) / i]${sufijoAnt}`;
    formulaSustituida = `VF = ${fmtDinero(r)} · ${fmtNum(factorVF, 6)}`;
  } else if (objetivo === 'R_desde_VP') {
    vp = monto;
    r = vp / factorVP;
    vf = r * factorVF;
    valor = r;
    formulaSimbolica = `R = VP / ([(1 - (1 + i)^(-n)) / i]${sufijoAnt}${sufijoDif})`;
    formulaSustituida = `R = ${fmtDinero(vp)} / ${fmtNum(factorVP, 6)}`;
  } else {
    vf = monto;
    r = vf / factorVF;
    vp = r * factorVP;
    valor = r;
    formulaSimbolica = `R = VF / ([((1 + i)ⁿ - 1) / i]${sufijoAnt})`;
    formulaSustituida = `R = ${fmtDinero(vf)} / ${fmtNum(factorVF, 6)}`;
  }

  const totalPagos = r * n;
  const interesesImplicito =
    objetivo === 'VF' || objetivo === 'R_desde_VF' ? vf - totalPagos : totalPagos - vp;

  // Periodos donde cae cada pago (para el diagrama de flujo de caja)
  const periodosPago: number[] = [];
  if (esAnticipada) {
    for (let t = 0; t < n; t++) periodosPago.push(t);
  } else if (tipo === 'diferida') {
    for (let t = 1; t <= n; t++) periodosPago.push(gracia + t);
  } else {
    for (let t = 1; t <= n; t++) periodosPago.push(t);
  }

  return {
    tipo,
    objetivo,
    valor,
    vp,
    vf,
    r,
    iEfectivaPago: iPago,
    n,
    gracia,
    totalPagos,
    interesesImplicito,
    formulaSimbolica,
    formulaSustituida,
    notaConversion,
    periodosPago,
  };
}
