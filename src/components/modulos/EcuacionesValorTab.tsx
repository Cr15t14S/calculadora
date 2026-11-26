import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  ErrorFinanciero,
  balanceFF,
  cuotasIguales,
  fmtDinero,
  fmtDineroCorto,
  fmtNum,
  fmtPct,
  pagoUnicoFaltante,
  parsearNumero,
  parsearPeriodos,
  parsearTasa,
  type FlujoDetalle,
  type FlujoEntrada,
  type TipoFlujo,
} from '../../lib/finanzas';
import { FieldInput } from '../ui/FieldInput';
import { FormulaBar } from '../ui/FormulaBar';
import { KpiTile } from '../ui/KpiTile';

interface Props {
  tasaTransferida?: { valorPct: string; token: number } | null;
}

function DiagramaFlujoCaja({
  detalle,
  ff,
  hoverId,
  onHover,
  onChangeFF,
  solucion,
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
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const W = 680;
  const H = 272;
  const padX = 48;
  const axisY = 144;

  const todosPeriodos = [
    ff,
    ...detalle.map((d) => d.periodo),
    ...(solucion?.tipo === 'unico' ? [solucion.k] : []),
    ...(solucion?.tipo === 'cuotas' ? solucion.periodos : []),
  ];
  const minP = Math.min(0, ...todosPeriodos);
  const maxP = Math.max(minP + 1, ...todosPeriodos);
  const spanP = maxP - minP || 1;

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
  const lenOf = (m: number) => 28 + (Math.abs(m) / maxMonto) * 58;

  const paso = spanP > 18 ? Math.ceil(spanP / 12) : 1;
  const ticks: number[] = [];
  for (let p = Math.ceil(minP); p <= Math.floor(maxP); p += paso) {
    ticks.push(p);
  }

  return (
    <div className="border border-[var(--line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <div>
          <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
            Diagrama de flujo de caja y Fecha Focal interactiva (FF = {fmtNum(ff, 1)})
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
        </div>
      </div>

      <div className="chart-grid-bg overflow-x-auto p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`h-auto min-w-[540px] w-full select-none touch-none ${
            arrastrando ? 'cursor-ew-resize' : ''
          }`}
          onPointerMove={moverArrastre}
          onPointerUp={terminarArrastre}
          onPointerCancel={terminarArrastre}
        >
          {/* Zona interactiva clicable sobre el eje para reubicar la FF */}
          <rect
            x={padX - 10}
            y={axisY - 14}
            width={W - padX * 2 + 20}
            height={36}
            fill="transparent"
            className="cursor-pointer"
            onPointerDown={iniciarArrastre}
          />

          {/* Eje temporal */}
          <line
            x1={padX - 12}
            x2={W - padX + 12}
            y1={axisY}
            y2={axisY}
            stroke="#171614"
            strokeWidth="2"
            pointerEvents="none"
          />

          {/* Ticks clicables */}
          {ticks.map((t) => {
            const esFF = Math.abs(t - ff) < 1e-6;
            return (
              <g
                key={t}
                className="cursor-pointer"
                onClick={() => onChangeFF(t)}
              >
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

          {/* Arcos de proyección hacia la FF */}
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

          {/* Flechas de Deudas (arriba) y Pagos (abajo) */}
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

          {/* Flechas de la incógnita resuelta (X o cuotas R) */}
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
            solucion.periodos.slice(0, 24).map((p, idx) => {
              const x = xOf(p);
              const len = Math.min(64, lenOf(solucion.valor));
              const yEnd = axisY + len;
              return (
                <g key={`r-${p}-${idx}`} pointerEvents="none">
                  <line x1={x} x2={x} y1={axisY} y2={yEnd} stroke="#1d4ed8" strokeWidth="2.2" />
                  <polygon points={`${x},${yEnd + 6} ${x - 4},${yEnd - 1} ${x + 4},${yEnd - 1}`} fill="#1d4ed8" />
                  {idx === 0 && (
                    <text
                      x={x}
                      y={yEnd + 18}
                      textAnchor="middle"
                      className="fill-[#1d4ed8] font-mono-num text-[10px] font-bold"
                    >
                      R={fmtDineroCorto(solucion.valor)}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Línea y manija arrastrable de Fecha Focal (encima para fácil agarre) */}
          <g
            className="cursor-ew-resize"
            onPointerDown={iniciarArrastre}
          >
            {/* Área táctil ampliada para agarrar la línea fácilmente */}
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
              ⇄ FF = {fmtNum(ff, ff % 1 === 0 ? 0 : 1)}
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
    </div>
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
  const [periodosStr, setPeriodosStr] = useState('');
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
            duplicados: number[];
            valor: number;
            sumaFactores: number;
            formulaSimbolica: string;
            formulaSustituida: string;
          }
        | null = null;
      let errorSolucion: string | null = null;

      if (balance.estado !== 'balanceada') {
        const tieneEntradaSol =
          modoRes === 'unico' ? Boolean(kStr.trim()) : Boolean(periodosStr.trim());
        if (tieneEntradaSol) {
          try {
            if (modoRes === 'unico') {
              const k = parsearNumero(kStr, 'Periodo del pago único');
              const res = pagoUnicoFaltante(balance.diferencia, i, ff, k);
              solucion = {
                tipo: 'unico',
                k,
                valor: res.x,
                factor: res.factor,
                exponente: res.exponente,
                formulaSimbolica: 'X = Diferencia / (1 + i)^(FF - k)',
                formulaSustituida: `X = ${fmtDinero(balance.diferencia)} / (1 + ${fmtNum(i, 6)})^(${fmtNum(ff - k, 2)}) = ${fmtDinero(res.x)}`,
              };
            } else {
              const { periodos, duplicados } = parsearPeriodos(periodosStr);
              const res = cuotasIguales(balance.diferencia, i, ff, periodos);
              solucion = {
                tipo: 'cuotas',
                periodos,
                duplicados,
                valor: res.r,
                sumaFactores: res.sumaFactores,
                formulaSimbolica: 'R = Diferencia / Σ (1 + i)^(FF - k)',
                formulaSustituida: `R = ${fmtDinero(balance.diferencia)} / ${fmtNum(res.sumaFactores, 6)} = ${fmtDinero(res.r)}`,
              };
            }
          } catch (e) {
            errorSolucion = e instanceof ErrorFinanciero ? e.message : 'Revise el parámetro de resolución.';
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
  }, [flujos, iStr, ffStr, modoRes, kStr, periodosStr]);

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
                  value={nuevoMonto}
                  onChange={(e) => setNuevoMonto(e.target.value)}
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
                  value={nuevoPeriodo}
                  onChange={(e) => setNuevoPeriodo(e.target.value)}
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
                          en t = {fmtNum(f.periodo, 1)}
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
                suffix="%"
                value={iStr}
                onChange={setIStr}
                placeholder="Ej. 2"
              />
              <FieldInput
                id="ev-ff"
                label="Fecha focal (FF)"
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
                  suffix="per."
                  value={kStr}
                  onChange={setKStr}
                  placeholder="Ej. 10"
                />
              ) : (
                <FieldInput
                  id="ev-per"
                  label="Periodos de las cuotas R"
                  value={periodosStr}
                  onChange={setPeriodosStr}
                  placeholder="Ej. 1-12 ó 3;6;9 ó 2-4;8"
                  helper="Acepta rangos (1-12) y listas (3;6;9) combinables."
                />
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
                gráfico.
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
                        ? `Pago único X en el periodo ${fmtNum(calculo.solucion.k, 1)}`
                        : `Cuota igual R (${calculo.solucion.periodos.length} cuotas)`
                    }
                    value={calculo.solucion.valor}
                    formatter={fmtDinero}
                    caption={
                      calculo.solucion.tipo === 'cuotas'
                        ? `Σ factores = ${fmtNum(calculo.solucion.sumaFactores, 6)}`
                        : `Factor (1+i)^(${fmtNum(calculo.solucion.exponente, 2)}) = ${fmtNum(calculo.solucion.factor, 6)}`
                    }
                    tone="cobalt"
                    large
                  />
                  {calculo.solucion.tipo === 'cuotas' && calculo.solucion.duplicados.length > 0 && (
                    <div className="border border-[var(--ochre)] bg-[var(--ochre-soft)] px-3 py-2 text-xs text-[var(--ochre)]">
                      Aviso: los periodos {calculo.solucion.duplicados.join(', ')} están repetidos en la lista y se contabilizan múltiples veces.
                    </div>
                  )}
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
                onChangeFF={(nuevoFF) => setFfStr(String(nuevoFF))}
                solucion={calculo.solucion}
              />

              <div className="border border-[var(--line)] bg-white">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
                  <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
                    Detalle de flujos trasladados a t = {fmtNum(calculo.ff, 1)}
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
                          <td className="px-3 py-2 text-center">{fmtNum(d.periodo, 1)}</td>
                          <td className="px-3 py-2 font-sans text-[var(--ink-muted)]">
                            {d.operacion}{' '}
                            <span className="font-mono-num text-[10px] text-[var(--ink-faint)]">
                              ({d.exponente >= 0 ? '+' : ''}
                              {fmtNum(d.exponente, 1)})
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
