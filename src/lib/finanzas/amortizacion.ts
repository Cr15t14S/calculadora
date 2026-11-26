import { EPS, ErrorFinanciero, fmtDinero, parsearNumero, validarTasa } from './formato';

export type ModoPrestamo = 'cuota' | 'plazo';

export interface MovimientoExtraItem {
  id: string;
  periodo: number;
  monto: number; // positivo = abono extra / depósito; negativo = desembolso / retiro
}

export interface FilaPrestamo {
  periodo: number;
  saldoInicial: number | null;
  cuota: number | null;
  interes: number | null;
  abono: number | null;
  extra: number | null;
  saldoFinal: number;
}

export interface ResultadoPrestamo {
  filas: FilaPrestamo[];
  filasBase: FilaPrestamo[];
  cuotaInicial: number;
  cuotaFinal: number;
  periodosPagados: number;
  totalIntereses: number;
  totalInteresesBase: number;
  ahorroIntereses: number;
  periodosAhorrados: number;
  totalCuotas: number;
  totalExtra: number;
  advertencias: string[];
}

export interface FilaCuenta {
  periodo: number;
  saldoInicial: number | null;
  interes: number | null;
  movimiento: number | null;
  saldoFinal: number;
}

export interface ResultadoCuenta {
  filas: FilaCuenta[];
  saldoFinal: number;
  totalIntereses: number;
  netoMovimientos: number;
}

/** R = VP · [ i / (1 - (1+i)^(-n)) ]  (si i = 0, R = VP / n) */
export function cuotaFija(vp: number, i: number, n: number): number {
  if (!Number.isFinite(n) || n <= 0) {
    throw new ErrorFinanciero('El número de periodos n debe ser mayor que cero.');
  }
  if (i === 0) {
    return vp / n;
  }
  validarTasa(i);
  const denom = 1 - Math.pow(1 + i, -n);
  if (denom === 0 || !Number.isFinite(denom)) {
    throw new ErrorFinanciero('No se pudo calcular la cuota fija con esa tasa y plazo.');
  }
  return vp * (i / denom);
}

/** Lee líneas "periodo: monto" (separadores válidos: ':', '=' o ';'). */
export function parsearMovimientosTexto(texto: string): Record<number, number> {
  const movs: Record<number, number> = {};
  const lineas = (texto ?? '').split(/\r?\n/);
  lineas.forEach((cruda, idx) => {
    const linea = cruda.trim();
    if (!linea || linea.startsWith('#')) return;
    const m = /^(\d+)\s*[:=;]\s*(.+)$/.exec(linea);
    if (!m) {
      throw new ErrorFinanciero(
        `Línea ${idx + 1} inválida: «${linea}». Use el formato periodo: monto (ej. 6: 500000 ó 9: -200000).`
      );
    }
    const k = Number(m[1]);
    if (k < 1) {
      throw new ErrorFinanciero(`Línea ${idx + 1}: el periodo debe ser 1 o mayor.`);
    }
    const monto = parsearNumero(m[2], `monto línea ${idx + 1}`, { esMonto: true });
    movs[k] = (movs[k] ?? 0) + monto;
  });
  return movs;
}

export function agruparMovimientos(items: MovimientoExtraItem[]): Record<number, number> {
  const mapa: Record<number, number> = {};
  for (const item of items) {
    if (!Number.isInteger(item.periodo) || item.periodo < 1) continue;
    if (!Number.isFinite(item.monto) || item.monto === 0) continue;
    mapa[item.periodo] = (mapa[item.periodo] ?? 0) + item.monto;
  }
  return mapa;
}

function simularPrestamoInterno(
  vp: number,
  i: number,
  n: number,
  movimientos: Record<number, number>,
  modo: ModoPrestamo
): { filas: FilaPrestamo[]; cuotaInicial: number; advertencias: string[] } {
  let R = cuotaFija(vp, i, n);
  const cuotaInicial = R;
  const advertencias: string[] = [];

  const filas: FilaPrestamo[] = [
    {
      periodo: 0,
      saldoInicial: null,
      cuota: null,
      interes: null,
      abono: null,
      extra: null,
      saldoFinal: vp,
    },
  ];

  let saldo = vp;
  let k = 0;
  const limite = modo === 'cuota' ? n : n * 10 + 1200;

  while (saldo > EPS && k < limite) {
    k += 1;
    const interes = saldo * i;

    if (modo === 'plazo' && R <= interes + EPS) {
      throw new ErrorFinanciero(
        `En el periodo ${k} la cuota (${fmtDinero(R)}) no cubre los intereses (${fmtDinero(interes)}); el crédito nunca se pagaría. Use «Reducir cuota / recalcular».`
      );
    }

    const cuota = modo === 'cuota' && k === n ? saldo + interes : Math.min(R, saldo + interes);
    const abono = cuota - interes;
    const saldoTrasCuota = saldo - abono;

    let extra = movimientos[k] ?? 0;
    if (extra > saldoTrasCuota) {
      advertencias.push(
        `En el periodo ${k} el abono extra (${fmtDinero(extra)}) superó el saldo pendiente y se ajustó a ${fmtDinero(saldoTrasCuota)}.`
      );
      extra = saldoTrasCuota;
    }

    if (modo === 'cuota' && k === n && extra < -EPS) {
      advertencias.push(
        `En el último periodo (${n}) hay un desembolso adicional de ${fmtDinero(Math.abs(extra))} sin periodos posteriores para amortizarlo; el saldo cierra en ${fmtDinero(Math.abs(extra))}.`
      );
    }

    let saldoFinal = saldoTrasCuota - extra;
    if (Math.abs(saldoFinal) < EPS) {
      saldoFinal = 0;
    }

    filas.push({
      periodo: k,
      saldoInicial: saldo,
      cuota,
      interes,
      abono,
      extra,
      saldoFinal,
    });

    saldo = saldoFinal;

    if (modo === 'cuota' && Math.abs(extra) > EPS && k < n && saldo > EPS) {
      R = cuotaFija(saldo, i, n - k);
    }
  }

  if (modo === 'plazo' && saldo > EPS) {
    throw new ErrorFinanciero(
      'El préstamo no se termina de pagar en un número razonable de periodos.'
    );
  }

  return { filas, cuotaInicial, advertencias };
}

export function tablaPrestamo(
  vp: number,
  i: number,
  n: number,
  movimientos: Record<number, number> = {},
  modo: ModoPrestamo = 'cuota'
): ResultadoPrestamo {
  if (!Number.isFinite(vp) || vp <= 0) {
    throw new ErrorFinanciero('El monto del préstamo debe ser mayor que cero.');
  }
  if (!Number.isFinite(i) || i < 0) {
    throw new ErrorFinanciero('La tasa del préstamo no puede ser negativa.');
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw new ErrorFinanciero('El número de periodos n debe ser un entero mayor que cero.');
  }
  if (n > 1200) {
    throw new ErrorFinanciero('El plazo máximo permitido es de 1.200 periodos.');
  }

  if (modo === 'cuota') {
    const fuera = Object.keys(movimientos)
      .map(Number)
      .filter((k) => k > n)
      .sort((a, b) => a - b);
    if (fuera.length > 0) {
      throw new ErrorFinanciero(
        `Hay movimientos en periodos mayores que n = ${n}: ${fuera.join(', ')}.`
      );
    }
  }

  const { filas, cuotaInicial, advertencias } = simularPrestamoInterno(vp, i, n, movimientos, modo);
  const { filas: filasBase } = simularPrestamoInterno(vp, i, n, {}, 'cuota');

  const sinCero = filas.slice(1);
  const totalIntereses = sinCero.reduce((s, f) => s + (f.interes ?? 0), 0);
  const totalInteresesBase = filasBase.slice(1).reduce((s, f) => s + (f.interes ?? 0), 0);
  const totalCuotas = sinCero.reduce((s, f) => s + (f.cuota ?? 0), 0);
  const totalExtra = sinCero.reduce((s, f) => s + (f.extra ?? 0), 0);
  const periodosPagados = sinCero.length;
  const cuotaFinal = sinCero.length > 0 ? (sinCero[sinCero.length - 1].cuota ?? cuotaInicial) : cuotaInicial;

  return {
    filas,
    filasBase,
    cuotaInicial,
    cuotaFinal,
    periodosPagados,
    totalIntereses,
    totalInteresesBase,
    ahorroIntereses: totalInteresesBase - totalIntereses,
    periodosAhorrados: n - periodosPagados,
    totalCuotas,
    totalExtra,
    advertencias,
  };
}

export function tablaCuenta(
  saldo0: number,
  i: number,
  n: number,
  movimientos: Record<number, number> = {},
  depositoFijo = 0
): ResultadoCuenta {
  if (!Number.isFinite(saldo0) || saldo0 < 0) {
    throw new ErrorFinanciero('El saldo inicial no puede ser negativo.');
  }
  validarTasa(i);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ErrorFinanciero('El número de periodos n debe ser un entero mayor que cero.');
  }
  if (n > 1200) {
    throw new ErrorFinanciero('El máximo permitido es de 1.200 periodos.');
  }

  const fuera = Object.keys(movimientos)
    .map(Number)
    .filter((k) => k > n)
    .sort((a, b) => a - b);
  if (fuera.length > 0) {
    throw new ErrorFinanciero(
      `Hay movimientos en periodos mayores que n = ${n}: ${fuera.join(', ')}.`
    );
  }

  const filas: FilaCuenta[] = [
    {
      periodo: 0,
      saldoInicial: null,
      interes: null,
      movimiento: null,
      saldoFinal: saldo0,
    },
  ];

  let saldo = saldo0;
  for (let k = 1; k <= n; k++) {
    const interes = saldo * i;
    const mov = depositoFijo + (movimientos[k] ?? 0);
    const saldoFinalRaw = saldo + interes + mov;
    if (saldoFinalRaw < -EPS) {
      throw new ErrorFinanciero(
        `El retiro del periodo ${k} supera el saldo disponible (${fmtDinero(saldo + interes)}).`
      );
    }
    const saldoFinal = Math.max(saldoFinalRaw, 0);
    filas.push({
      periodo: k,
      saldoInicial: saldo,
      interes,
      movimiento: mov,
      saldoFinal,
    });
    saldo = saldoFinal;
  }

  const sinCero = filas.slice(1);
  return {
    filas,
    saldoFinal: filas[filas.length - 1].saldoFinal,
    totalIntereses: sinCero.reduce((s, f) => s + (f.interes ?? 0), 0),
    netoMovimientos: sinCero.reduce((s, f) => s + (f.movimiento ?? 0), 0),
  };
}
