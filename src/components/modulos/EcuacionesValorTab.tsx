import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, GripVertical, Plus, Trash2, X } from 'lucide-react';
import {
  ErrorFinanciero,
  balanceFF,
  cuotasIguales,
  fmtDinero,
  fmtDineroCorto,
  fmtNum,
  fmtPct,
  formatearEntradaEntero,
  formatearEntradaMonto,
  pagoUnicoFaltante,
  parsearNumero,
  parsearTasa,
  type FlujoDetalle,
  type FlujoEntrada,
  type TipoFlujo,
} from '../../lib/finanzas';
import { ExpandButton, ExpandableModal } from '../ui/ExpandableModal';
import { FieldInput } from '../ui/FieldInput';
import { FormulaBar } from '../ui/FormulaBar';
import { KpiTile } from '../ui/KpiTile';

interface Props {
  tasaTransferida?: { valorPct: string; token: number } | null;
}

function DiagramaFlujoCajaSVG({
  detalle,
  ff,
  hoverId,
  onHover,
  onChangeFF,
  solucion,
  expandido = false,
}: {
  detalle: FlujoDetalle[];
  ff: number;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onChangeFF: (nuevoFF: number) => void;
  solucion?:
    | { tipo: 'unico'; k: number; valor: number }
    | { tipo: 'cuotas'; periodos: number[]; valor: number }
    | null;
  expandido?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const todosPeriodos = [
    ff,
    ...detalle.map((d) => d.periodo),
    ...(solucion?.tipo === 'unico' ? [solucion.k] : []),
    ...(solucion?.tipo === 'cuotas' ? solucion.periodos : []),
  ];
  const minP = Math.min(0, ...todosPeriodos);
  const maxP = Math.max(minP + 1, ...todosPeriodos);
  const spanP = maxP - minP || 1;

  const padX = expandido ? 64 : 48;
  const W = expandido ? Math.max(1080, padX * 2 + spanP * 48) : 680;
  const H = expandido ? 360 : 272;
  const axisY = expandido ? 190 : 144;

  const xOf = (p: number) => padX + ((p - minP) / spanP) * (W - padX * 2);

  const periodoDesdeClienteX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return ff;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    const frac = Math.max(0, Math.min(1, (relX - padX) / (W - padX * 2)));
    return Math.round(minP + frac * spanP);
  };

  const iniciarArrastre = (e: React.PointerEvent<SVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastrando(true);
    onChangeFF(periodoDesdeClienteX(e.clientX));
  };

  const moverArrastre = (e: React.PointerEvent<SVGElement>) => {
    if (!arrastrando) return;
    const p = periodoDesdeClienteX(e.clientX);
    if (p !== ff) onChangeFF(p);
  };

  const terminarArrastre = (e: React.PointerEvent<SVGElement>) => {
    if (!arrastrando) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setArrastrando(false);
  };

  const maxMonto = Math.max(
    1,
    ...detalle.map((d) => d.monto),
    solucion ? Math.abs(solucion.valor) : 0
  );
  const lenOf = (m: number) => (expandido ? 38 : 28) + (Math.abs(m) / maxMonto) * (expandido ? 82 : 58);

  const paso = expandido ? 1 : spanP > 18 ? Math.ceil(spanP / 12) : 1;
  const ticks: number[] = [];
  for (let p = Math.ceil(minP); p <= Math.floor(maxP); p += paso) {
    ticks.push(p);
  }

  return (
    <div className="chart-grid-bg overflow-x-auto p-2 ledger-scroll">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={expandido ? { minWidth: `${W}px` } : undefined}
        className={`h-auto w-full select-none touch-none ${expandido ? '' : 'min-w-[540px]'} ${
          arrastrando ? 'cursor-ew-resize' : ''
        }`}
        onPointerMove={moverArrastre}
        onPointerUp={terminarArrastre}
        onPointerCancel={terminarArrastre}
      >
        <rect
          x={padX - 10}
          y={axisY - 14}
          width={W - padX * 2 + 20}
          height={36}
          fill="transparent"
          className="cursor-pointer"
          onPointerDown={iniciarArrastre}
        />

        <line
          x1={padX - 12}
          x2={W - padX + 12}
          y1={axisY}
          y2={axisY}
          stroke="#171614"
          strokeWidth="2"
          pointerEvents="none"
        />

        {ticks.map((t) => {
          const esFF = Math.abs(t - ff) < 1e-6;
          return (
            <g key={t} className="cursor-pointer" onClick={() => onChangeFF(t)}>
              <line
                x1={xOf(t)}
                x2={xOf(t)}
                y1={axisY - 5}
                y2={axisY + 5}
                stroke={esFF ? '#b45309' : '#5c584f'}
                strokeWidth={esFF ? 2 : 1.2}
              />
              <text
                x={xOf(t)}
                y={axisY + 18}
                textAnchor="middle"
                className={`font-mono-num text-[10px] ${
                  esFF ? 'fill-[#b45309] font-bold' : 'fill-[#5c584f]'
                }`}
              >
                {t}
              </text>
            </g>
          );
        })}

        {detalle.map((d) => {
          if (Math.abs(d.periodo - ff) < 1e-6) return null;
          const x1 = xOf(d.periodo);
          const x2 = xOf(ff);
          const midX = (x1 + x2) / 2;
          const esDeuda = d.tipo === 'Deuda';
          const arcOffset = Math.min(54, Math.abs(x2 - x1) * 0.25 + 16);
          const ctrlY = esDeuda ? axisY - arcOffset - 18 : axisY + arcOffset + 18;
          const destacado = hoverId === null || hoverId === d.id;
          const color = esDeuda ? '#9f1239' : '#0d5c46';
          return (
            <path
              key={`arc-${d.id}`}
              d={`M ${x1.toFixed(1)},${axisY} Q ${midX.toFixed(1)},${ctrlY.toFixed(1)} ${x2.toFixed(1)},${axisY}`}
              fill="none"
              stroke={color}
              strokeWidth={hoverId === d.id ? 2.4 : 1.3}
              strokeOpacity={destacado ? 0.72 : 0.18}
              strokeDasharray={d.operacion === 'Descuenta' ? '4 3' : undefined}
              pointerEvents="none"
            />
          );
        })}

        {detalle.map((d) => {
          const x = xOf(d.periodo);
          const len = lenOf(d.monto);
          const esDeuda = d.tipo === 'Deuda';
          const yEnd = esDeuda ? axisY - len : axisY + len;
          const color = esDeuda ? '#9f1239' : '#0d5c46';
          const op = hoverId === null || hoverId === d.id ? 1 : 0.28;

          return (
            <g
              key={d.id}
              opacity={op}
              className="cursor-pointer"
              onMouseEnter={() => onHover(d.id)}
              onMouseLeave={() => onHover(null)}
            >
              <line x1={x} x2={x} y1={axisY} y2={yEnd} stroke={color} strokeWidth="2.8" />
              {esDeuda ? (
                <polygon points={`${x},${yEnd - 7} ${x - 5},${yEnd + 2} ${x + 5},${yEnd + 2}`} fill={color} />
              ) : (
                <polygon points={`${x},${yEnd + 7} ${x - 5},${yEnd - 2} ${x + 5},${yEnd - 2}`} fill={color} />
              )}
              <text
                x={x}
                y={esDeuda ? yEnd - 11 : yEnd + 18}
                textAnchor="middle"
                className="font-mono-num text-[10px] font-semibold"
                fill={color}
              >
                {fmtDineroCorto(d.monto)}
              </text>
            </g>
          );
        })}

        {solucion && solucion.tipo === 'unico' && Math.abs(solucion.valor) > 0.01 && (
          <g pointerEvents="none">
            {(() => {
              const x = xOf(solucion.k);
              const len = lenOf(solucion.valor);
              const yEnd = axisY + len;
              return (
                <>
                  <line x1={x} x2={x} y1={axisY} y2={yEnd} stroke="#1d4ed8" strokeWidth="3" strokeDasharray="4 2" />
                  <polygon points={`${x},${yEnd + 7} ${x - 5.5},${yEnd - 2} ${x + 5.5},${yEnd - 2}`} fill="#1d4ed8" />
                  <text
                    x={x}
                    y={yEnd + 19}
                    textAnchor="middle"
                    className="fill-[#1d4ed8] font-mono-num text-[10px] font-bold"
                  >
                    X = {fmtDineroCorto(solucion.valor)}
                  </text>
                </>
              );
            })()}
          </g>
        )}

        {solucion &&
          solucion.tipo === 'cuotas' &&
          Math.abs(solucion.valor) > 0.01 &&
          (expandido ? solucion.periodos : solucion.periodos.slice(0, 24)).map((p, idx) => {
            const x = xOf(p);
            const len = Math.min(expandido ? 88 : 64, lenOf(solucion.valor));
            const yEnd = axisY + len;
            return (
              <g key={`r-${p}-${idx}`} pointerEvents="none">
                <line x1={x} x2={x} y1={axisY} y2={yEnd} stroke="#1d4ed8" strokeWidth="2.2" />
                <polygon points={`${x},${yEnd + 6} ${x - 4},${yEnd - 1} ${x + 4},${yEnd - 1}`} fill="#1d4ed8" />
                {(expandido || idx === 0) && (
                  <text
                    x={x}
                    y={yEnd + 18}
                    textAnchor="middle"
                    className="fill-[#1d4ed8] font-mono-num text-[10px] font-bold"
                  >
                    {idx === 0 ? `R=${fmtDineroCorto(solucion.valor)}` : fmtDineroCorto(solucion.valor)}
                  </text>
                )}
              </g>
            );
          })}

        <g className="cursor-ew-resize" onPointerDown={iniciarArrastre}>
          <rect x={xOf(ff) - 14} y={4} width={28} height={H - 16} fill="transparent" />
          <line
            x1={xOf(ff)}
            x2={xOf(ff)}
            y1={28}
            y2={H - 16}
            stroke="#b45309"
            strokeWidth={arrastrando ? 2.8 : 2}
            strokeDasharray="6 4"
          />
          <rect
            x={xOf(ff) - 34}
            y={6}
            width="68"
            height="22"
            fill={arrastrando ? '#92400e' : '#b45309'}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          <text
            x={xOf(ff)}
            y={20}
            textAnchor="middle"
            className="fill-white font-mono-num text-[10px] font-semibold"
          >
            ⇄ FF = {fmtNum(ff, 0)}
          </text>
          <circle
            cx={xOf(ff)}
            cy={axisY}
            r={arrastrando ? 6.5 : 5}
            fill="#b45309"
            stroke="#ffffff"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
}

function DiagramaFlujoCaja(props: {
  detalle: FlujoDetalle[];
  ff: number;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onChangeFF: (nuevoFF: number) => void;
  solucion?:
    | { tipo: 'unico'; k: number; valor: number }
    | { tipo: 'cuotas'; periodos: number[]; valor: number }
    | null;
}) {
  const [ampliado, setAmpliado] = useState(false);

  return (
    <>
      <div className="border border-[var(--line)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <div>
            <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
              Diagrama de flujo de caja y Fecha Focal interactiva (FF = {fmtNum(props.ff, 0)})
            </h3>
            <p className="text-[11px] text-[var(--ink-faint)]">
              Arrastre la bandera FF o haga clic sobre el eje temporal para cambiar la Fecha Focal desde el gráfico
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink-muted)]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 bg-[var(--crimson)]" /> Deuda ↑
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 bg-[var(--emerald)]" /> Pago ↓
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 bg-[var(--cobalt)]" /> Incógnita X / R
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 bg-[var(--ochre)]" /> Fecha Focal
            </span>
            <ExpandButton onClick={() => setAmpliado(true)} />
          </div>
        </div>

        <DiagramaFlujoCajaSVG {...props} />
      </div>

      <ExpandableModal
        open={ampliado}
        onClose={() => setAmpliado(false)}
        title={`Diagrama de flujo de caja — Fecha Focal FF = ${fmtNum(props.ff, 0)}`}
        subtitle="Se muestran todos los periodos y cuotas · Arrastre la bandera ⇄ FF o haga clic en el eje"
      >
        <div className="border border-[var(--line)] bg-white">
          <DiagramaFlujoCajaSVG {...props} expandido />
        </div>
      </ExpandableModal>
    </>
  );
}

export function EcuacionesValorTab({ tasaTransferida }: Props) {
  const [flujos, setFlujos] = useState<FlujoEntrada[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState<TipoFlujo>('Deuda');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevoPeriodo, setNuevoPeriodo] = useState('');
  const [errorIngreso, setErrorIngreso] = useState<string | null>(null);

  const [iStr, setIStr] = useState('');
  const [ffStr, setFfStr] = useState('');
  const [modoRes, setModoRes] = useState<'unico' | 'cuotas'>('unico');
  const [kStr, setKStr] = useState('');

  // Cuotas iguales R: Rango (inicio -> fin) o Periodos puntuales (chips)
  const [modoPeriodos, setModoPeriodos] = useState<'rango' | 'puntuales'>('rango');
  const [rangoInicio, setRangoInicio] = useState('');
  const [rangoFin, setRangoFin] = useState('');
  const [nuevoPeriodoCuota, setNuevoPeriodoCuota] = useState('');
  const [periodosPuntuales, setPeriodosPuntuales] = useState<number[]>([]);
  const [errorPeriodoCuota, setErrorPeriodoCuota] = useState<string | null>(null);

  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    if (tasaTransferida) {
      setIStr(tasaTransferida.valorPct);
    }
  }, [tasaTransferida]);

  const agregarFlujo = () => {
    try {
      const monto = parsearNumero(nuevoMonto, 'Monto', { esMonto: true });
      const periodo = parsearNumero(nuevoPeriodo, 'Periodo');
      if (monto <= 0) throw new ErrorFinanciero('El monto debe ser mayor que cero.');
      if (!Number.isInteger(periodo) || periodo < 0) {
        throw new ErrorFinanciero('El periodo debe ser un entero mayor o igual a cero.');
      }
      setFlujos((prev) => [
        ...prev,
        { id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tipo: nuevoTipo, monto, periodo },
      ]);
      setNuevoMonto('');
      setNuevoPeriodo('');
      setErrorIngreso(null);
    } catch (e) {
      setErrorIngreso(e instanceof ErrorFinanciero ? e.message : 'Dato inválido.');
    }
  };

  const agregarPeriodoPuntual = () => {
    if (!nuevoPeriodoCuota.trim()) {
      setErrorPeriodoCuota('Escriba un número de periodo.');
      return;
    }
    const p = Number(nuevoPeriodoCuota);
    if (!Number.isInteger(p) || p < 0) {
      setErrorPeriodoCuota('El periodo debe ser un entero mayor o igual a cero.');
      return;
    }
    if (periodosPuntuales.includes(p)) {
      setErrorPeriodoCuota(`El periodo ${p} ya está agregado.`);
      return;
    }
    setPeriodosPuntuales((prev) => [...prev, p].sort((a, b) => a - b));
    setNuevoPeriodoCuota('');
    setErrorPeriodoCuota(null);
  };

  const calculo = useMemo(() => {
    if (flujos.length === 0 || !iStr.trim() || !ffStr.trim()) {
      return { estado: 'vacio' as const };
    }

    try {
      const i = parsearTasa(iStr, 'Tasa periódica i');
      const ff = parsearNumero(ffStr, 'Fecha focal FF');
      const balance = balanceFF(flujos, i, ff);

      let solucion:
        | {
            tipo: 'unico';
            k: number;
            valor: number;
            factor: number;
            exponente: number;
            formulaSimbolica: string;
            formulaSustituida: string;
          }
        | {
            tipo: 'cuotas';
            periodos: number[];
            valor: number;
            sumaFactores: number;
            formulaSimbolica: string;
            formulaSustituida: string;
          }
        | null = null;
      let errorSolucion: string | null = null;

      if (balance.estado !== 'balanceada') {
        if (modoRes === 'unico') {
          if (kStr.trim()) {
            try {
              const k = parsearNumero(kStr, 'Periodo del pago único');
              const res = pagoUnicoFaltante(balance.diferencia, i, ff, k);
              solucion = {
                tipo: 'unico',
                k,
                valor: res.x,
                factor: res.factor,
                exponente: res.exponente,
                formulaSimbolica: 'X = Diferencia / (1 + i)^(FF - k)',
                formulaSustituida: `X = ${fmtDinero(balance.diferencia)} / (1 + ${fmtNum(i, 6)})^(${fmtNum(ff - k, 0)}) = ${fmtDinero(res.x)}`,
              };
            } catch (e) {
              errorSolucion = e instanceof ErrorFinanciero ? e.message : 'Revise el periodo k.';
            }
          }
        } else if (modoPeriodos === 'rango') {
          if (rangoInicio.trim() && rangoFin.trim()) {
            const a = Number(rangoInicio);
            const b = Number(rangoFin);
            if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
              errorSolucion = 'El periodo inicial y final deben ser números enteros válidos.';
            } else if (a > b) {
              errorSolucion = `Rango inválido: el periodo inicial (${a}) no puede ser mayor que el final (${b}).`;
            } else if (b - a > 600) {
              errorSolucion = 'El rango supera el máximo permitido de 600 cuotas.';
            } else {
              try {
                const periodos: number[] = [];
                for (let p = a; p <= b; p++) periodos.push(p);
                const res = cuotasIguales(balance.diferencia, i, ff, periodos);
                solucion = {
                  tipo: 'cuotas',
                  periodos,
                  valor: res.r,
                  sumaFactores: res.sumaFactores,
                  formulaSimbolica: 'R = Diferencia / Σ (1 + i)^(FF - k)',
                  formulaSustituida: `R = ${fmtDinero(balance.diferencia)} / ${fmtNum(res.sumaFactores, 6)} = ${fmtDinero(res.r)}`,
                };
              } catch (e) {
                errorSolucion = e instanceof ErrorFinanciero ? e.message : 'Error en el rango de cuotas.';
              }
            }
          }
        } else if (periodosPuntuales.length > 0) {
          try {
            const res = cuotasIguales(balance.diferencia, i, ff, periodosPuntuales);
            solucion = {
              tipo: 'cuotas',
              periodos: periodosPuntuales,
              valor: res.r,
              sumaFactores: res.sumaFactores,
              formulaSimbolica: 'R = Diferencia / Σ (1 + i)^(FF - k)',
              formulaSustituida: `R = ${fmtDinero(balance.diferencia)} / ${fmtNum(res.sumaFactores, 6)} = ${fmtDinero(res.r)}`,
            };
          } catch (e) {
            errorSolucion = e instanceof ErrorFinanciero ? e.message : 'Error en los periodos seleccionados.';
          }
        }
      }

      return { estado: 'ok' as const, i, ff, balance, solucion, errorSolucion };
    } catch (e) {
      return {
        estado: 'error' as const,
        error: e instanceof ErrorFinanciero ? e.message : 'Revise los parámetros.',
      };
    }
  }, [flujos, iStr, ffStr, modoRes, kStr, modoPeriodos, rangoInicio, rangoFin, periodosPuntuales]);

  return (
    <div className="animate-panel space-y-6">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="font-mono-num text-[11px] uppercase tracking-[0.12em] text-[var(--emerald)]">
          Módulo 03 · Equivalencia en el Tiempo
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Ecuaciones de valor y fecha focal
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          <div className="space-y-3 border border-[var(--line)] bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
                1. Flujos de deuda y pago
              </h3>
              {flujos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFlujos([])}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-[var(--ink-faint)] hover:text-[var(--crimson)]"
                >
                  <Eraser className="h-3 w-3" /> Vaciar lista
                </button>
              )}
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                  Tipo
                </label>
                <div className="grid grid-cols-2 border border-[var(--line-strong)]">
                  {(['Deuda', 'Pago'] as TipoFlujo[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNuevoTipo(t)}
                      className={`cursor-pointer py-2 text-xs font-semibold transition-colors ${
                        nuevoTipo === t
                          ? t === 'Deuda'
                            ? 'bg-[var(--crimson)] text-white'
                            : 'bg-[var(--emerald)] text-white'
                          : 'bg-white text-[var(--ink-muted)]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-5">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                  Monto ($)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={nuevoMonto}
                  onChange={(e) => setNuevoMonto(formatearEntradaMonto(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && agregarFlujo()}
                  placeholder="Ej. 1.500.000"
                  className="w-full border border-[var(--line-strong)] px-2.5 py-2 font-mono-num text-xs outline-none focus:border-[var(--ink)]"
                />
              </div>
              <div className="col-span-3">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                  Per.
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={nuevoPeriodo}
                  onChange={(e) => setNuevoPeriodo(formatearEntradaEntero(e.target.value, 4))}
                  onKeyDown={(e) => e.key === 'Enter' && agregarFlujo()}
                  placeholder="Ej. 4"
                  className="w-full border border-[var(--line-strong)] px-2.5 py-2 font-mono-num text-xs outline-none focus:border-[var(--ink)]"
                />
              </div>
            </div>

            {errorIngreso && <p className="text-xs text-[var(--crimson)]">{errorIngreso}</p>}

            <button
              type="button"
              onClick={agregarFlujo}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 border border-[var(--ink)] bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-[var(--emerald)] hover:bg-[var(--emerald)]"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar {nuevoTipo.toLowerCase()}
            </button>

            <div className="max-h-44 overflow-y-auto border-t border-[var(--line)] pt-2 ledger-scroll">
              {flujos.length === 0 ? (
                <p className="py-3 text-center text-xs text-[var(--ink-faint)]">
                  Agregue al menos una deuda o un pago para comenzar.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {flujos.map((f) => (
                    <li
                      key={f.id}
                      onMouseEnter={() => setHoverId(f.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className={`flex items-center justify-between py-1.5 text-xs transition-colors ${
                        hoverId === f.id ? 'bg-[var(--paper)]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-14 border px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase ${
                            f.tipo === 'Deuda'
                              ? 'border-[var(--crimson)] bg-[var(--crimson-soft)] text-[var(--crimson)]'
                              : 'border-[var(--emerald)] bg-[var(--emerald-soft)] text-[var(--emerald)]'
                          }`}
                        >
                          {f.tipo}
                        </span>
                        <span className="font-mono-num font-semibold text-[var(--ink)]">
                          {fmtDinero(f.monto)}
                        </span>
                        <span className="font-mono-num text-[var(--ink-faint)]">
                          en t = {fmtNum(f.periodo, 0)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFlujos((prev) => prev.filter((item) => item.id !== f.id))}
                        className="cursor-pointer p-1 text-[var(--ink-faint)] hover:text-[var(--crimson)]"
                        aria-label="Eliminar flujo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
              2. Tasa y Fecha Focal (FF)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FieldInput
                id="ev-i"
                label="Tasa periódica i"
                kind="decimal"
                suffix="%"
                value={iStr}
                onChange={setIStr}
                placeholder="Ej. 2"
              />
              <FieldInput
                id="ev-ff"
                label="Fecha focal (FF)"
                kind="entero"
                suffix="per."
                value={ffStr}
                onChange={setFfStr}
                placeholder="Ej. 6"
              />
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--ink-faint)]">
              <GripVertical className="h-3.5 w-3.5 text-[var(--ochre)]" />
              También puede mover la Fecha Focal arrastrándola directamente sobre la gráfica.
            </p>

            <div className="space-y-3 border-t border-[var(--line)] pt-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                3. Resolver lo faltante por pagar (opcional)
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setModoRes('unico')}
                  className={`cursor-pointer border px-2.5 py-2 text-xs font-semibold ${
                    modoRes === 'unico'
                      ? 'border-[var(--cobalt)] bg-[var(--cobalt)] text-white'
                      : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]'
                  }`}
                >
                  Pago único X
                </button>
                <button
                  type="button"
                  onClick={() => setModoRes('cuotas')}
                  className={`cursor-pointer border px-2.5 py-2 text-xs font-semibold ${
                    modoRes === 'cuotas'
                      ? 'border-[var(--cobalt)] bg-[var(--cobalt)] text-white'
                      : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]'
                  }`}
                >
                  Cuotas iguales R
                </button>
              </div>

              {modoRes === 'unico' ? (
                <FieldInput
                  id="ev-k"
                  label="Periodo del pago único (k)"
                  kind="entero"
                  suffix="per."
                  value={kStr}
                  onChange={setKStr}
                  placeholder="Ej. 10"
                />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 border border-[var(--line)] text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setModoPeriodos('rango')}
                      className={`cursor-pointer py-1.5 ${
                        modoPeriodos === 'rango'
                          ? 'bg-[var(--ink)] text-white'
                          : 'bg-[var(--paper)] text-[var(--ink-muted)]'
                      }`}
                    >
                      Rango (Inicio – Fin)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoPeriodos('puntuales')}
                      className={`cursor-pointer py-1.5 ${
                        modoPeriodos === 'puntuales'
                          ? 'bg-[var(--ink)] text-white'
                          : 'bg-[var(--paper)] text-[var(--ink-muted)]'
                      }`}
                    >
                      Periodos específicos
                    </button>
                  </div>

                  {modoPeriodos === 'rango' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <FieldInput
                        id="ev-rango-ini"
                        label="Desde (inicio)"
                        kind="entero"
                        suffix="per."
                        value={rangoInicio}
                        onChange={setRangoInicio}
                        placeholder="Ej. 1"
                      />
                      <FieldInput
                        id="ev-rango-fin"
                        label="Hasta (fin)"
                        kind="entero"
                        suffix="per."
                        value={rangoFin}
                        onChange={setRangoFin}
                        placeholder="Ej. 4"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={nuevoPeriodoCuota}
                          onChange={(e) => {
                            setNuevoPeriodoCuota(formatearEntradaEntero(e.target.value, 4));
                            setErrorPeriodoCuota(null);
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && agregarPeriodoPuntual()}
                          placeholder="Periodo (ej. 3)"
                          className="w-full border border-[var(--line-strong)] px-2.5 py-2 font-mono-num text-xs outline-none focus:border-[var(--ink)]"
                        />
                        <button
                          type="button"
                          onClick={agregarPeriodoPuntual}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 border border-[var(--ink)] bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-white hover:border-[var(--emerald)] hover:bg-[var(--emerald)]"
                        >
                          <Plus className="h-3.5 w-3.5" /> Agregar
                        </button>
                      </div>
                      {errorPeriodoCuota && (
                        <p className="text-xs text-[var(--crimson)]">{errorPeriodoCuota}</p>
                      )}
                      {periodosPuntuales.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {periodosPuntuales.map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1 border border-[var(--cobalt)] bg-[var(--cobalt-soft)] px-2 py-0.5 font-mono-num text-xs font-semibold text-[var(--cobalt)]"
                            >
                              P{p}
                              <button
                                type="button"
                                onClick={() =>
                                  setPeriodosPuntuales((prev) => prev.filter((x) => x !== p))
                                }
                                className="cursor-pointer hover:text-[var(--crimson)]"
                                aria-label={`Quitar periodo ${p}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-7">
          {calculo.estado === 'vacio' ? (
            <div className="chart-grid-bg flex min-h-[380px] flex-col items-center justify-center border border-[var(--line)] p-8 text-center">
              <p className="font-editorial text-lg font-semibold text-[var(--ink)]">
                Construya su ecuación de valor
              </p>
              <p className="mt-1.5 max-w-md text-xs text-[var(--ink-muted)]">
                Agregue al menos una deuda o pago, ingrese la tasa periódica i (%) y la Fecha Focal
                (FF). Una vez generado el diagrama podrá arrastrar la línea FF directamente sobre el
                gráfico o ampliarlo a pantalla completa.
              </p>
            </div>
          ) : calculo.estado === 'error' ? (
            <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] p-5 text-sm text-[var(--crimson)]">
              {calculo.error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile
                  label="Σ Deudas en la FF"
                  value={calculo.balance.totalDeudasFF}
                  formatter={fmtDinero}
                  tone="crimson"
                />
                <KpiTile
                  label="Σ Pagos en la FF"
                  value={calculo.balance.totalPagosFF}
                  formatter={fmtDinero}
                  tone="emerald"
                />
                <KpiTile
                  label="Diferencia en la FF"
                  value={calculo.balance.diferencia}
                  formatter={fmtDinero}
                  caption={
                    calculo.balance.estado === 'balanceada'
                      ? 'Ecuación balanceada'
                      : calculo.balance.estado === 'falta'
                        ? 'Falta por pagar'
                        : 'Saldo a favor'
                  }
                  tone="ochre"
                />
              </div>

              {calculo.errorSolucion ? (
                <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] px-4 py-2.5 text-xs text-[var(--crimson)]">
                  {calculo.errorSolucion}
                </div>
              ) : calculo.solucion ? (
                <div className="space-y-2.5">
                  <KpiTile
                    label={
                      calculo.solucion.tipo === 'unico'
                        ? `Pago único X en el periodo ${fmtNum(calculo.solucion.k, 0)}`
                        : `Cuota igual R (${calculo.solucion.periodos.length} cuotas)`
                    }
                    value={calculo.solucion.valor}
                    formatter={fmtDinero}
                    caption={
                      calculo.solucion.tipo === 'cuotas'
                        ? `Σ factores = ${fmtNum(calculo.solucion.sumaFactores, 6)}`
                        : `Factor (1+i)^(${fmtNum(calculo.solucion.exponente, 0)}) = ${fmtNum(calculo.solucion.factor, 6)}`
                    }
                    tone="cobalt"
                    large
                  />
                  <FormulaBar
                    simbolica={calculo.solucion.formulaSimbolica}
                    sustituida={calculo.solucion.formulaSustituida}
                  />
                </div>
              ) : null}

              <DiagramaFlujoCaja
                detalle={calculo.balance.detalle}
                ff={calculo.ff}
                hoverId={hoverId}
                onHover={setHoverId}
                onChangeFF={(nuevoFF) => setFfStr(String(Math.max(0, nuevoFF)))}
                solucion={calculo.solucion}
              />

              <div className="border border-[var(--line)] bg-white">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
                  <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
                    Detalle de flujos trasladados a t = {fmtNum(calculo.ff, 0)}
                  </h3>
                  <span className="font-mono-num text-[11px] text-[var(--ink-faint)]">
                    i = {fmtPct(calculo.i, 4)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--line)] bg-[var(--paper-alt)] text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2 text-right">Monto</th>
                        <th className="px-3 py-2 text-center">Per.</th>
                        <th className="px-3 py-2">Operación</th>
                        <th className="px-3 py-2 text-right">Factor</th>
                        <th className="px-3 py-2 text-right">Valor en FF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)] font-mono-num">
                      {calculo.balance.detalle.map((d) => (
                        <tr
                          key={d.id}
                          onMouseEnter={() => setHoverId(d.id)}
                          onMouseLeave={() => setHoverId(null)}
                          className={`transition-colors ${hoverId === d.id ? 'bg-[var(--paper)]' : ''}`}
                        >
                          <td className="px-3 py-2 font-sans font-semibold">
                            <span className={d.tipo === 'Deuda' ? 'text-[var(--crimson)]' : 'text-[var(--emerald)]'}>
                              {d.tipo}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{fmtDinero(d.monto)}</td>
                          <td className="px-3 py-2 text-center">{fmtNum(d.periodo, 0)}</td>
                          <td className="px-3 py-2 font-sans text-[var(--ink-muted)]">
                            {d.operacion}{' '}
                            <span className="font-mono-num text-[10px] text-[var(--ink-faint)]">
                              ({d.exponente >= 0 ? '+' : ''}
                              {fmtNum(d.exponente, 0)})
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-[var(--ink-muted)]">
                            {fmtNum(d.factor, 6)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{fmtDinero(d.valorFF)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
