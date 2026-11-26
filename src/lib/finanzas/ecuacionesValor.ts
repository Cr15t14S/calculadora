import { ErrorFinanciero, parsearNumero, validarTasa } from './formato';

export type TipoFlujo = 'Deuda' | 'Pago';
export type OperacionFF = 'Capitaliza' | 'Descuenta' | 'En la FF';

export interface FlujoEntrada {
  id: string;
  tipo: TipoFlujo;
  monto: number;
  periodo: number;
}

export interface FlujoDetalle extends FlujoEntrada {
  operacion: OperacionFF;
  exponente: number;
  factor: number;
  valorFF: number;
}

export interface ResultadoBalanceFF {
  detalle: FlujoDetalle[];
  totalDeudasFF: number;
  totalPagosFF: number;
  diferencia: number;
  estado: 'balanceada' | 'falta' | 'favor';
}

export function moverAFF(
  monto: number,
  periodo: number,
  i: number,
  ff: number
): { valorFF: number; factor: number; exponente: number; operacion: OperacionFF } {
  validarTasa(i);
  const exponente = ff - periodo;
  const factor = Math.pow(1 + i, exponente);
  if (!Number.isFinite(factor)) {
    throw new ErrorFinanciero('El factor de capitalización/descuento excede el rango numérico.');
  }
  const operacion: OperacionFF =
    periodo < ff ? 'Capitaliza' : periodo > ff ? 'Descuenta' : 'En la FF';
  return {
    valorFF: monto * factor,
    factor,
    exponente,
    operacion,
  };
}

export function balanceFF(
  flujos: FlujoEntrada[],
  i: number,
  ff: number
): ResultadoBalanceFF {
  if (flujos.length === 0) {
    throw new ErrorFinanciero('Agregue al menos una deuda o un pago para calcular el balance.');
  }
  validarTasa(i);

  let totalDeudasFF = 0;
  let totalPagosFF = 0;

  const detalle: FlujoDetalle[] = flujos.map((flujo) => {
    const { valorFF, factor, exponente, operacion } = moverAFF(flujo.monto, flujo.periodo, i, ff);
    if (flujo.tipo === 'Deuda') {
      totalDeudasFF += valorFF;
    } else {
      totalPagosFF += valorFF;
    }
    return {
      ...flujo,
      operacion,
      exponente,
      factor,
      valorFF,
    };
  });

  const diferencia = totalDeudasFF - totalPagosFF;
  const estado =
    Math.abs(diferencia) < 0.005 ? 'balanceada' : diferencia > 0 ? 'falta' : 'favor';

  return {
    detalle,
    totalDeudasFF,
    totalPagosFF,
    diferencia,
    estado,
  };
}

/** X tal que X · (1+i)^(FF-k) = diferencia */
export function pagoUnicoFaltante(
  diferencia: number,
  i: number,
  ff: number,
  k: number
): { x: number; factor: number; exponente: number } {
  validarTasa(i);
  const exponente = ff - k;
  const factor = Math.pow(1 + i, exponente);
  if (!Number.isFinite(factor) || factor === 0) {
    throw new ErrorFinanciero('No se puede despejar X con el periodo y tasa indicados.');
  }
  return {
    x: diferencia / factor,
    factor,
    exponente,
  };
}

/** R tal que R · Σ (1+i)^(FF-k) = diferencia */
export function cuotasIguales(
  diferencia: number,
  i: number,
  ff: number,
  periodos: number[]
): { r: number; sumaFactores: number; factores: Array<{ periodo: number; factor: number }> } {
  if (periodos.length === 0) {
    throw new ErrorFinanciero('Indique al menos un periodo para las cuotas R.');
  }
  validarTasa(i);
  const factores = periodos.map((k) => {
    const factor = Math.pow(1 + i, ff - k);
    if (!Number.isFinite(factor)) {
      throw new ErrorFinanciero('Uno de los periodos genera un factor fuera de rango.');
    }
    return { periodo: k, factor };
  });
  const sumaFactores = factores.reduce((acc, item) => acc + item.factor, 0);
  if (sumaFactores === 0) {
    throw new ErrorFinanciero('La suma de factores es cero.');
  }
  return {
    r: diferencia / sumaFactores,
    sumaFactores,
    factores,
  };
}

/**
 * Parsea expresiones como "1-12", "3;6;9", "2-4;8", "1-6, 9, 12".
 * También reporta periodos repetidos para avisar al usuario en la UI.
 */
export function parsearPeriodos(texto: string): { periodos: number[]; duplicados: number[] } {
  const limpio = (texto ?? '').trim();
  if (!limpio) {
    throw new ErrorFinanciero('Escriba los periodos de las cuotas (ej.: 1-12 ó 3;6;9).');
  }

  const periodos: number[] = [];
  const partes = limpio.split(/[;,\s]+/).filter(Boolean);

  for (const parte of partes) {
    const rango = /^(\d+)\s*-\s*(\d+)$/.exec(parte);
    if (rango) {
      const a = Number(rango[1]);
      const b = Number(rango[2]);
      if (a > b) {
        throw new ErrorFinanciero(`Rango inválido «${parte}»: el inicio es mayor que el final.`);
      }
      if (b - a > 600) {
        throw new ErrorFinanciero(`El rango «${parte}» excede el límite de 600 periodos.`);
      }
      for (let p = a; p <= b; p++) {
        periodos.push(p);
      }
    } else {
      periodos.push(parsearNumero(parte, 'Periodos de las cuotas'));
    }
  }

  const vistos = new Set<number>();
  const duplicadosSet = new Set<number>();
  for (const p of periodos) {
    if (vistos.has(p)) duplicadosSet.add(p);
    vistos.add(p);
  }

  return {
    periodos,
    duplicados: Array.from(duplicadosSet).sort((a, b) => a - b),
  };
}
