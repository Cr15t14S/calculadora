import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  Eraser,
  FileSpreadsheet,
  Plus,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import {
  ErrorFinanciero,
  agruparMovimientos,
  exportarCSV,
  exportarExcel,
  fmtDinero,
  fmtDineroCorto,
  fmtNum,
  formatearEntradaEntero,
  formatearEntradaMonto,
  parsearEnteroPositivo,
  parsearNumero,
  parsearTasa,
  tablaCuenta,
  tablaPrestamo,
  type FilaCuenta,
  type FilaPrestamo,
  type ModoPrestamo,
  type MovimientoExtraItem,
} from '../../lib/finanzas';
import { ExpandButton, ExpandableModal } from '../ui/ExpandableModal';
import { FieldInput } from '../ui/FieldInput';
import { KpiTile } from '../ui/KpiTile';

interface Props {
  tasaTransferida?: { valorPct: string; token: number } | null;
}

function GraficaSaldoPrestamo({
  filas,
  filasBase,
  hayExtras,
  selectedPeriodo,
  onSelectPeriodo,
}: {
  filas: FilaPrestamo[];
  filasBase: FilaPrestamo[];
  hayExtras: boolean;
  selectedPeriodo: number | null;
  onSelectPeriodo: (periodo: number | null) => void;
}) {
  const [hoverPeriodo, setHoverPeriodo] = useState<number | null>(null);
  if (filas.length < 2) return null;

  const W = 680;
  const H = 268;
  const pad = { top: 28, right: 24, bottom: 34, left: 82 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxP = Math.max(filas[filas.length - 1].periodo, filasBase[filasBase.length - 1].periodo, 1);
  const maxY =
    Math.max(...filas.map((f) => f.saldoFinal), ...filasBase.map((f) => f.saldoFinal), 1) * 1.08;

  const xOf = (p: number) => pad.left + (p / maxP) * plotW;
  const yOf = (v: number) => pad.top + ((maxY - v) / maxY) * plotH;

  const ptsActual = filas.map((f) => `${xOf(f.periodo).toFixed(1)},${yOf(f.saldoFinal).toFixed(1)}`).join(' ');
  const ptsBase = filasBase.map((f) => `${xOf(f.periodo).toFixed(1)},${yOf(f.saldoFinal).toFixed(1)}`).join(' ');
  const areaActual = `M ${xOf(0).toFixed(1)},${yOf(0).toFixed(1)} ${filas
    .map((f) => `L ${xOf(f.periodo).toFixed(1)},${yOf(f.saldoFinal).toFixed(1)}`)
    .join(' ')} L ${xOf(filas[filas.length - 1].periodo).toFixed(1)},${yOf(0).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => maxY * r);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxP * r));

  const filaSeleccionada =
    selectedPeriodo !== null ? filas.find((f) => f.periodo === selectedPeriodo) ?? null : null;
  const filaHover =
    hoverPeriodo !== null ? filas.find((f) => f.periodo === hoverPeriodo) ?? null : null;
  const active = filaHover ?? filaSeleccionada;
  const filasConExtra = filas.filter((f) => f.extra !== null && Math.abs(f.extra) > 0.01);

  const resolverPeriodo = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const periodo = Math.max(0, Math.min(maxP, Math.round(((relX - pad.left) / plotW) * maxP)));
    return filas.some((f) => f.periodo === periodo) ? periodo : null;
  };

  return (
    <div className="chart-grid-bg p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full cursor-crosshair select-none"
        onMouseLeave={() => setHoverPeriodo(null)}
        onMouseMove={(e) => setHoverPeriodo(resolverPeriodo(e))}
        onClick={(e) => {
          const p = resolverPeriodo(e);
          if (p !== null) onSelectPeriodo(selectedPeriodo === p ? null : p);
        }}
      >
        {yTicks.map((val, idx) => (
          <g key={idx}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={yOf(val)}
              y2={yOf(val)}
              stroke="#d8d2c4"
              strokeDasharray={idx === 0 ? undefined : '2 3'}
            />
            <text
              x={pad.left - 8}
              y={yOf(val) + 4}
              textAnchor="end"
              className="fill-[#5c584f] font-mono-num text-[10px]"
            >
              {fmtDineroCorto(val)}
            </text>
          </g>
        ))}

        {xTicks.map((p, idx) => (
          <text
            key={idx}
            x={xOf(p)}
            y={H - 10}
            textAnchor="middle"
            className="fill-[#5c584f] font-mono-num text-[10px]"
          >
            Per. {p}
          </text>
        ))}

        {hayExtras && (
          <polyline
            fill="none"
            stroke="#8a8477"
            strokeWidth="1.75"
            strokeDasharray="5 4"
            points={ptsBase}
            className="svg-smooth"
          />
        )}

        <path d={areaActual} fill="#0d5c46" fillOpacity="0.12" className="svg-smooth" />

        <polyline
          key={`saldo-${filas.length}-${filas[0].saldoFinal}-${filasConExtra.length}`}
          fill="none"
          stroke="#0d5c46"
          strokeWidth="2.6"
          strokeLinejoin="round"
          points={ptsActual}
          className="svg-draw-line"
        />

        {filasConExtra.map((f) => {
          const esAbono = (f.extra ?? 0) > 0;
          const color = esAbono ? '#1d4ed8' : '#9f1239';
          const x = xOf(f.periodo);
          const y = yOf(f.saldoFinal);
          return (
            <g key={`ext-${f.periodo}`} className="svg-smooth">
              <line x1={x} x2={x} y1={pad.top} y2={yOf(0)} stroke={color} strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={x} cy={y} r="4.5" fill={color} stroke="#ffffff" strokeWidth="1.5" />
            </g>
          );
        })}

        {filaSeleccionada && (
          <g className="svg-smooth">
            <line
              x1={xOf(filaSeleccionada.periodo)}
              x2={xOf(filaSeleccionada.periodo)}
              y1={pad.top - 4}
              y2={yOf(0)}
              stroke="#1d4ed8"
              strokeWidth="2"
            />
            <line
              x1={pad.left}
              x2={xOf(filaSeleccionada.periodo)}
              y1={yOf(filaSeleccionada.saldoFinal)}
              y2={yOf(filaSeleccionada.saldoFinal)}
              stroke="#1d4ed8"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            <circle
              cx={xOf(filaSeleccionada.periodo)}
              cy={yOf(filaSeleccionada.saldoFinal)}
              r="9"
              fill="#1d4ed8"
              fillOpacity="0.18"
            />
            <circle
              cx={xOf(filaSeleccionada.periodo)}
              cy={yOf(filaSeleccionada.saldoFinal)}
              r="5.5"
              fill="#1d4ed8"
              stroke="#ffffff"
              strokeWidth="2"
            />
            {(() => {
              const cx = xOf(filaSeleccionada.periodo);
              const boxW = 92;
              const bx = Math.max(pad.left, Math.min(W - pad.right - boxW, cx - boxW / 2));
              return (
                <g>
                  <rect x={bx} y={4} width={boxW} height={18} fill="#1d4ed8" />
                  <text
                    x={bx + boxW / 2}
                    y={16}
                    textAnchor="middle"
                    className="fill-white font-mono-num text-[10px] font-semibold"
                  >
                    P{filaSeleccionada.periodo} · {fmtDineroCorto(filaSeleccionada.saldoFinal)}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {filaHover && filaHover.periodo !== selectedPeriodo && (
          <g>
            <line
              x1={xOf(filaHover.periodo)}
              x2={xOf(filaHover.periodo)}
              y1={pad.top}
              y2={yOf(0)}
              stroke="#171614"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={xOf(filaHover.periodo)}
              cy={yOf(filaHover.saldoFinal)}
              r="4.5"
              fill="#0d5c46"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {active && (
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-[var(--line)] bg-white px-3 py-2 text-xs sm:grid-cols-4">
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">
              Periodo {filaHover ? '(cursor)' : '(seleccionado)'}
            </span>
            <span className="font-mono-num font-semibold text-[var(--cobalt)]">
              Periodo {active.periodo}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Saldo final</span>
            <span className="font-mono-num font-semibold text-[var(--emerald)]">
              {fmtDinero(active.saldoFinal)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Interés</span>
            <span className="font-mono-num font-semibold text-[var(--ochre)]">
              {active.interes === null ? '—' : fmtDinero(active.interes)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Abono capital</span>
            <span className="font-mono-num font-semibold">
              {active.abono === null ? '—' : fmtDinero(active.abono)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function GraficaBarrasCuota({
  filas,
  selectedPeriodo,
  onSelectPeriodo,
  expandido = false,
}: {
  filas: FilaPrestamo[];
  selectedPeriodo: number | null;
  onSelectPeriodo: (periodo: number | null) => void;
  expandido?: boolean;
}) {
  const [hoverPeriodo, setHoverPeriodo] = useState<number | null>(null);
  const sinCero = filas.slice(1);
  if (sinCero.length === 0) return null;

  const paso = expandido ? 1 : sinCero.length > 48 ? Math.ceil(sinCero.length / 48) : 1;
  const visibles = sinCero.filter(
    (f, idx) => idx % paso === 0 || idx === sinCero.length - 1 || f.periodo === selectedPeriodo
  );

  const pad = { top: 28, right: 24, bottom: 34, left: 82 };
  const W = expandido ? Math.max(1080, pad.left + pad.right + visibles.length * 26) : 660;
  const H = expandido ? 360 : 268;
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxBar =
    Math.max(
      1,
      ...visibles.map((f) => (f.interes ?? 0) + Math.max(0, f.abono ?? 0) + Math.max(0, f.extra ?? 0))
    ) * 1.1;

  const yOf = (v: number) => pad.top + ((maxBar - v) / maxBar) * plotH;
  const baseY = yOf(0);
  const barSlot = plotW / visibles.length;
  const barW = Math.max(4, Math.min(28, barSlot * 0.72));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => maxBar * r);

  const filaHover = hoverPeriodo !== null ? visibles.find((f) => f.periodo === hoverPeriodo) ?? null : null;
  const filaSel = selectedPeriodo !== null ? filas.find((f) => f.periodo === selectedPeriodo) ?? null : null;
  const active = filaHover ?? (filaSel && filaSel.periodo > 0 ? filaSel : null);

  return (
    <div className="chart-grid-bg overflow-x-auto p-2 ledger-scroll">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={expandido ? { minWidth: `${W}px` } : undefined}
        className="h-auto w-full select-none"
        onMouseLeave={() => setHoverPeriodo(null)}
      >
        {yTicks.map((val, idx) => (
          <g key={idx}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={yOf(val)}
              y2={yOf(val)}
              stroke="#d8d2c4"
              strokeDasharray={idx === 0 ? undefined : '2 3'}
            />
            <text
              x={pad.left - 8}
              y={yOf(val) + 4}
              textAnchor="end"
              className="fill-[#5c584f] font-mono-num text-[10px]"
            >
              {fmtDineroCorto(val)}
            </text>
          </g>
        ))}

        {visibles.map((f, idx) => {
          const x = pad.left + idx * barSlot + (barSlot - barW) / 2;
          const hInt = ((f.interes ?? 0) / maxBar) * plotH;
          const hAbo = (Math.max(0, f.abono ?? 0) / maxBar) * plotH;
          const hExt = (Math.max(0, f.extra ?? 0) / maxBar) * plotH;

          const yAbo = baseY - hAbo;
          const yInt = yAbo - hInt;
          const yExt = yInt - hExt;
          const esSel = f.periodo === selectedPeriodo;
          const esHover = f.periodo === hoverPeriodo;
          const hayFoco = hoverPeriodo !== null || selectedPeriodo !== null;
          const op = !hayFoco || esSel || esHover ? 1 : 0.35;

          return (
            <g
              key={f.periodo}
              opacity={op}
              className="cursor-pointer"
              onMouseEnter={() => setHoverPeriodo(f.periodo)}
              onClick={() => onSelectPeriodo(esSel ? null : f.periodo)}
            >
              {esSel && (
                <g>
                  <rect
                    x={x - 3}
                    y={pad.top - 2}
                    width={barW + 6}
                    height={plotH + 4}
                    fill="#1d4ed8"
                    fillOpacity="0.1"
                    stroke="#1d4ed8"
                    strokeWidth="1.5"
                  />
                  <rect
                    x={Math.max(pad.left, Math.min(W - pad.right - 34, x + barW / 2 - 17))}
                    y={4}
                    width={34}
                    height={17}
                    fill="#1d4ed8"
                  />
                  <text
                    x={Math.max(pad.left + 17, Math.min(W - pad.right - 17, x + barW / 2))}
                    y={16}
                    textAnchor="middle"
                    className="fill-white font-mono-num text-[10px] font-semibold"
                  >
                    P{f.periodo}
                  </text>
                </g>
              )}
              <rect x={x} y={yAbo} width={barW} height={Math.max(0, hAbo)} fill="#0d5c46" className="svg-smooth" />
              <rect x={x} y={yInt} width={barW} height={Math.max(0, hInt)} fill="#b45309" className="svg-smooth" />
              {hExt > 0.5 && (
                <rect x={x} y={yExt} width={barW} height={hExt} fill="#1d4ed8" className="svg-smooth" />
              )}
              {(expandido ||
                esSel ||
                visibles.length <= 16 ||
                idx % Math.ceil(visibles.length / 10) === 0 ||
                idx === visibles.length - 1) && (
                <text
                  x={x + barW / 2}
                  y={H - 10}
                  textAnchor="middle"
                  className={`font-mono-num text-[9px] ${
                    esSel ? 'fill-[#1d4ed8] font-bold' : 'fill-[#5c584f]'
                  }`}
                >
                  {f.periodo}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {selectedPeriodo === 0 && !filaHover && (
        <div className="mt-1 border-t border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--ink-muted)]">
          El periodo 0 corresponde al desembolso inicial (sin cuota pagada). Cambie a «Curva de
          saldo» para ubicar el periodo 0.
        </div>
      )}

      {active && (
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-[var(--line)] bg-white px-3 py-2 text-xs sm:grid-cols-4">
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">
              Periodo {active.periodo} {filaHover ? '(cursor)' : '(seleccionado)'}
            </span>
            <span className="font-mono-num font-semibold">Cuota: {fmtDinero(active.cuota ?? 0)}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Interés</span>
            <span className="font-mono-num font-semibold text-[var(--ochre)]">
              {fmtDinero(active.interes ?? 0)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Abono capital</span>
            <span className="font-mono-num font-semibold text-[var(--emerald)]">
              {fmtDinero(active.abono ?? 0)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Extra / Desemb.</span>
            <span className="font-mono-num font-semibold text-[var(--cobalt)]">
              {fmtDinero(active.extra ?? 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function GraficaCuenta({
  filas,
  selectedPeriodo,
  onSelectPeriodo,
}: {
  filas: FilaCuenta[];
  selectedPeriodo: number | null;
  onSelectPeriodo: (periodo: number | null) => void;
}) {
  const [hoverPeriodo, setHoverPeriodo] = useState<number | null>(null);
  if (filas.length < 2) return null;

  const W = 680;
  const H = 260;
  const pad = { top: 28, right: 24, bottom: 34, left: 82 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxP = Math.max(filas[filas.length - 1].periodo, 1);
  const maxY = Math.max(...filas.map((f) => f.saldoFinal), 1) * 1.1;

  const xOf = (p: number) => pad.left + (p / maxP) * plotW;
  const yOf = (v: number) => pad.top + ((maxY - v) / maxY) * plotH;

  const pts = filas.map((f) => `${xOf(f.periodo).toFixed(1)},${yOf(f.saldoFinal).toFixed(1)}`).join(' ');
  const area = `M ${xOf(0).toFixed(1)},${yOf(0).toFixed(1)} ${filas
    .map((f) => `L ${xOf(f.periodo).toFixed(1)},${yOf(f.saldoFinal).toFixed(1)}`)
    .join(' ')} L ${xOf(maxP).toFixed(1)},${yOf(0).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => maxY * r);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxP * r));

  const filaSel = selectedPeriodo !== null ? filas.find((f) => f.periodo === selectedPeriodo) ?? null : null;
  const filaHover = hoverPeriodo !== null ? filas.find((f) => f.periodo === hoverPeriodo) ?? null : null;
  const active = filaHover ?? filaSel;

  const resolverPeriodo = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const p = Math.max(0, Math.min(maxP, Math.round(((relX - pad.left) / plotW) * maxP)));
    return filas.some((f) => f.periodo === p) ? p : null;
  };

  return (
    <div className="chart-grid-bg p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full cursor-crosshair select-none"
        onMouseLeave={() => setHoverPeriodo(null)}
        onMouseMove={(e) => setHoverPeriodo(resolverPeriodo(e))}
        onClick={(e) => {
          const p = resolverPeriodo(e);
          if (p !== null) onSelectPeriodo(selectedPeriodo === p ? null : p);
        }}
      >
        {yTicks.map((val, idx) => (
          <g key={idx}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={yOf(val)}
              y2={yOf(val)}
              stroke="#d8d2c4"
              strokeDasharray={idx === 0 ? undefined : '2 3'}
            />
            <text x={pad.left - 8} y={yOf(val) + 4} textAnchor="end" className="fill-[#5c584f] font-mono-num text-[10px]">
              {fmtDineroCorto(val)}
            </text>
          </g>
        ))}

        {xTicks.map((p, idx) => (
          <text key={idx} x={xOf(p)} y={H - 10} textAnchor="middle" className="fill-[#5c584f] font-mono-num text-[10px]">
            Per. {p}
          </text>
        ))}

        <path d={area} fill="#0d5c46" fillOpacity="0.14" className="svg-smooth" />
        <polyline
          key={`cta-${filas.length}-${filas[filas.length - 1].saldoFinal}`}
          fill="none"
          stroke="#0d5c46"
          strokeWidth="2.6"
          points={pts}
          className="svg-draw-line"
        />

        {filaSel && (
          <g className="svg-smooth">
            <line
              x1={xOf(filaSel.periodo)}
              x2={xOf(filaSel.periodo)}
              y1={pad.top - 4}
              y2={yOf(0)}
              stroke="#1d4ed8"
              strokeWidth="2"
            />
            <line
              x1={pad.left}
              x2={xOf(filaSel.periodo)}
              y1={yOf(filaSel.saldoFinal)}
              y2={yOf(filaSel.saldoFinal)}
              stroke="#1d4ed8"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            <circle cx={xOf(filaSel.periodo)} cy={yOf(filaSel.saldoFinal)} r="9" fill="#1d4ed8" fillOpacity="0.18" />
            <circle cx={xOf(filaSel.periodo)} cy={yOf(filaSel.saldoFinal)} r="5.5" fill="#1d4ed8" stroke="#fff" strokeWidth="2" />
            {(() => {
              const cx = xOf(filaSel.periodo);
              const boxW = 92;
              const bx = Math.max(pad.left, Math.min(W - pad.right - boxW, cx - boxW / 2));
              return (
                <g>
                  <rect x={bx} y={4} width={boxW} height={18} fill="#1d4ed8" />
                  <text x={bx + boxW / 2} y={16} textAnchor="middle" className="fill-white font-mono-num text-[10px] font-semibold">
                    P{filaSel.periodo} · {fmtDineroCorto(filaSel.saldoFinal)}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {filaHover && filaHover.periodo !== selectedPeriodo && (
          <g>
            <line x1={xOf(filaHover.periodo)} x2={xOf(filaHover.periodo)} y1={pad.top} y2={yOf(0)} stroke="#171614" strokeWidth="1" />
            <circle cx={xOf(filaHover.periodo)} cy={yOf(filaHover.saldoFinal)} r="4.5" fill="#0d5c46" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {active && (
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-[var(--line)] bg-white px-3 py-2 text-xs sm:grid-cols-4">
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">
              Periodo {filaHover ? '(cursor)' : '(seleccionado)'}
            </span>
            <span className="font-mono-num font-semibold text-[var(--cobalt)]">
              Periodo {active.periodo}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Interés ganado</span>
            <span className="font-mono-num font-semibold text-[var(--ochre)]">
              {active.interes === null ? '—' : fmtDinero(active.interes)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Movimiento</span>
            <span className="font-mono-num font-semibold">
              {active.movimiento === null ? '—' : fmtDinero(active.movimiento)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Saldo final</span>
            <span className="font-mono-num font-semibold text-[var(--emerald)]">
              {fmtDinero(active.saldoFinal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function AmortizacionTab({ tasaTransferida }: Props) {
  const [tipoTabla, setTipoTabla] = useState<'prestamo' | 'cuenta'>('prestamo');
  const [vpStr, setVpStr] = useState('');
  const [iStr, setIStr] = useState('');
  const [nStr, setNStr] = useState('');
  const [depStr, setDepStr] = useState('');
  const [modoPrestamo, setModoPrestamo] = useState<ModoPrestamo>('cuota');

  const [movItems, setMovItems] = useState<MovimientoExtraItem[]>([]);
  const [nuevoPer, setNuevoPer] = useState('');
  const [nuevoSigno, setNuevoSigno] = useState<1 | -1>(1);
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [errorMov, setErrorMov] = useState<string | null>(null);

  const [graficaVista, setGraficaVista] = useState<'saldo' | 'barras'>('saldo');
  const [selectedPeriodo, setSelectedPeriodo] = useState<number | null>(null);
  const [graficaAmpliada, setGraficaAmpliada] = useState(false);
  const [tablaAmpliada, setTablaAmpliada] = useState(false);
  const chartSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tasaTransferida) {
      setIStr(tasaTransferida.valorPct);
    }
  }, [tasaTransferida]);

  const agregarMovimiento = () => {
    try {
      const periodo = parsearEnteroPositivo(nuevoPer, 'Periodo');
      const montoAbs = parsearNumero(nuevoMonto, 'Monto del movimiento', { esMonto: true });
      if (montoAbs <= 0) throw new ErrorFinanciero('Ingrese un monto positivo.');
      const nActual = nStr.trim() ? Number(nStr) : null;
      if (
        nActual !== null &&
        Number.isInteger(nActual) &&
        nActual > 0 &&
        !(tipoTabla === 'prestamo' && modoPrestamo === 'plazo') &&
        periodo > nActual
      ) {
        throw new ErrorFinanciero(`El periodo (${periodo}) no puede superar el plazo n = ${nActual}.`);
      }

      setMovItems((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          periodo,
          monto: nuevoSigno * montoAbs,
        },
      ]);
      setNuevoPer('');
      setNuevoMonto('');
      setErrorMov(null);
    } catch (e) {
      setErrorMov(e instanceof ErrorFinanciero ? e.message : 'Dato inválido.');
    }
  };

  const calculo = useMemo(() => {
    if (!vpStr.trim() || !iStr.trim() || !nStr.trim()) {
      return { estado: 'vacio' as const };
    }

    try {
      const vp = parsearNumero(
        vpStr,
        tipoTabla === 'prestamo' ? 'Monto del préstamo VP' : 'Saldo inicial',
        { esMonto: true }
      );
      const i = parsearTasa(iStr, 'Tasa periódica i');
      const n = parsearEnteroPositivo(nStr, 'Número de periodos n');
      const movs = agruparMovimientos(movItems);

      if (tipoTabla === 'prestamo') {
        const res = tablaPrestamo(vp, i, n, movs, modoPrestamo);
        return {
          estado: 'ok' as const,
          tipo: 'prestamo' as const,
          data: res,
          hayExtras: Object.keys(movs).length > 0,
        };
      }

      const dep = depStr.trim() ? parsearNumero(depStr, 'Depósito fijo', { esMonto: true }) : 0;
      const res = tablaCuenta(vp, i, n, movs, dep);
      return {
        estado: 'ok' as const,
        tipo: 'cuenta' as const,
        data: res,
        hayExtras: Object.keys(movs).length > 0,
      };
    } catch (e) {
      return {
        estado: 'error' as const,
        error: e instanceof ErrorFinanciero ? e.message : 'Revise los datos ingresados.',
      };
    }
  }, [tipoTabla, vpStr, iStr, nStr, depStr, modoPrestamo, movItems]);

  useEffect(() => {
    if (selectedPeriodo === null || calculo.estado !== 'ok') return;
    const existe = calculo.data.filas.some((f) => f.periodo === selectedPeriodo);
    if (!existe) setSelectedPeriodo(null);
  }, [calculo, selectedPeriodo]);

  const exportar = (formato: 'csv' | 'xlsx') => {
    if (calculo.estado !== 'ok') return;
    if (calculo.tipo === 'prestamo') {
      const enc = [
        'Periodo',
        'Saldo inicial',
        'Cuota',
        'Interés',
        'Abono a capital',
        'Abono extra / Desembolso',
        'Saldo final',
      ];
      const filas = calculo.data.filas.map((f) => [
        f.periodo,
        f.saldoInicial,
        f.cuota,
        f.interes,
        f.abono,
        f.extra,
        f.saldoFinal,
      ]);
      if (formato === 'csv') exportarCSV(enc, filas, 'tabla_amortizacion.csv');
      else exportarExcel(enc, filas, 'tabla_amortizacion.xlsx', 'Amortización');
    } else {
      const enc = ['Periodo', 'Saldo inicial', 'Interés', 'Depósito (+) / Retiro (-)', 'Saldo final'];
      const filas = calculo.data.filas.map((f) => [
        f.periodo,
        f.saldoInicial,
        f.interes,
        f.movimiento,
        f.saldoFinal,
      ]);
      if (formato === 'csv') exportarCSV(enc, filas, 'tabla_cuenta.csv');
      else exportarExcel(enc, filas, 'tabla_cuenta.xlsx', 'Cuenta');
    }
  };

  const seleccionarFila = (periodo: number) => {
    setSelectedPeriodo((prev) => (prev === periodo ? null : periodo));
  };

  const renderTablaContenido = () => {
    if (calculo.estado !== 'ok') return null;

    if (calculo.tipo === 'prestamo') {
      return (
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--paper-alt)]">
            <tr className="border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              <th className="px-3 py-2.5 text-center">Per.</th>
              <th className="px-3 py-2.5 text-right">Saldo inicial</th>
              <th className="px-3 py-2.5 text-right">Cuota</th>
              <th className="px-3 py-2.5 text-right">Interés</th>
              <th className="px-3 py-2.5 text-right">Abono capital</th>
              <th className="px-3 py-2.5 text-right">Extra / Desemb.</th>
              <th className="px-3 py-2.5 text-right">Saldo final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)] font-mono-num">
            {calculo.data.filas.map((f) => {
              const tieneExtra = f.extra !== null && Math.abs(f.extra) > 0.01;
              const esSel = selectedPeriodo === f.periodo;
              return (
                <tr
                  key={f.periodo}
                  onClick={() => seleccionarFila(f.periodo)}
                  className={`cursor-pointer transition-colors ${
                    esSel
                      ? 'bg-[var(--cobalt-soft)] shadow-[inset_3px_0_0_0_var(--cobalt)]'
                      : tieneExtra
                        ? (f.extra ?? 0) > 0
                          ? 'bg-[var(--emerald-soft)]/50 hover:bg-[var(--cobalt-soft)]/40'
                          : 'bg-[var(--crimson-soft)]/50 hover:bg-[var(--cobalt-soft)]/40'
                        : 'hover:bg-[var(--paper)]'
                  }`}
                >
                  <td className="px-3 py-2 text-center font-semibold">
                    <span className={esSel ? 'font-bold text-[var(--cobalt)]' : ''}>{f.periodo}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--ink-muted)]">
                    {f.saldoInicial === null ? '—' : fmtDinero(f.saldoInicial)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {f.cuota === null ? '—' : fmtDinero(f.cuota)}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--ochre)]">
                    {f.interes === null ? '—' : fmtDinero(f.interes)}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--emerald)]">
                    {f.abono === null ? '—' : fmtDinero(f.abono)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      tieneExtra
                        ? (f.extra ?? 0) > 0
                          ? 'text-[var(--cobalt)]'
                          : 'text-[var(--crimson)]'
                        : 'text-[var(--ink-faint)]'
                    }`}
                  >
                    {f.extra === null ? '—' : fmtDinero(f.extra)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--ink)]">
                    {fmtDinero(f.saldoFinal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    return (
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-[var(--paper-alt)]">
          <tr className="border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            <th className="px-3 py-2.5 text-center">Per.</th>
            <th className="px-3 py-2.5 text-right">Saldo inicial</th>
            <th className="px-3 py-2.5 text-right">Interés</th>
            <th className="px-3 py-2.5 text-right">Depósito (+) / Retiro (-)</th>
            <th className="px-3 py-2.5 text-right">Saldo final</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)] font-mono-num">
          {calculo.data.filas.map((f) => {
            const mov = f.movimiento ?? 0;
            const esSel = selectedPeriodo === f.periodo;
            return (
              <tr
                key={f.periodo}
                onClick={() => seleccionarFila(f.periodo)}
                className={`cursor-pointer transition-colors ${
                  esSel
                    ? 'bg-[var(--cobalt-soft)] shadow-[inset_3px_0_0_0_var(--cobalt)]'
                    : 'hover:bg-[var(--paper)]'
                }`}
              >
                <td className="px-3 py-2 text-center font-semibold">
                  <span className={esSel ? 'font-bold text-[var(--cobalt)]' : ''}>{f.periodo}</span>
                </td>
                <td className="px-3 py-2 text-right text-[var(--ink-muted)]">
                  {f.saldoInicial === null ? '—' : fmtDinero(f.saldoInicial)}
                </td>
                <td className="px-3 py-2 text-right text-[var(--ochre)]">
                  {f.interes === null ? '—' : fmtDinero(f.interes)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    mov > 0
                      ? 'text-[var(--emerald)]'
                      : mov < 0
                        ? 'text-[var(--crimson)]'
                        : 'text-[var(--ink-faint)]'
                  }`}
                >
                  {f.movimiento === null ? '—' : fmtDinero(f.movimiento)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-[var(--ink)]">
                  {fmtDinero(f.saldoFinal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="animate-panel space-y-6">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="font-mono-num text-[11px] uppercase tracking-[0.12em] text-[var(--emerald)]">
          Módulo 04 · Sistema Francés y Control de Saldos
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Tabla de amortización y cuenta
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-4 border border-[var(--line)] bg-white p-4">
            <div className="grid grid-cols-2 border border-[var(--line-strong)]">
              <button
                type="button"
                onClick={() => {
                  setTipoTabla('prestamo');
                  setSelectedPeriodo(null);
                }}
                className={`cursor-pointer py-2 text-xs font-semibold transition-colors ${
                  tipoTabla === 'prestamo'
                    ? 'bg-[var(--ink)] text-white'
                    : 'bg-[var(--paper)] text-[var(--ink-muted)]'
                }`}
              >
                Préstamo
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoTabla('cuenta');
                  setSelectedPeriodo(null);
                }}
                className={`cursor-pointer py-2 text-xs font-semibold transition-colors ${
                  tipoTabla === 'cuenta'
                    ? 'bg-[var(--ink)] text-white'
                    : 'bg-[var(--paper)] text-[var(--ink-muted)]'
                }`}
              >
                Cuenta (Dep./Ret.)
              </button>
            </div>

            <FieldInput
              id="am-vp"
              label={tipoTabla === 'prestamo' ? 'Monto del préstamo (VP)' : 'Saldo inicial'}
              kind="monto"
              prefix="$"
              value={vpStr}
              onChange={setVpStr}
              placeholder="Ej. 1.000.000"
            />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput
                id="am-i"
                label="Tasa periódica i"
                kind="decimal"
                suffix="%"
                value={iStr}
                onChange={setIStr}
                placeholder="Ej. 2"
              />
              <FieldInput
                id="am-n"
                label="Periodos (n)"
                kind="entero"
                value={nStr}
                onChange={setNStr}
                placeholder="Ej. 12"
              />
            </div>

            {tipoTabla === 'prestamo' ? (
              <div className="space-y-2 border-t border-[var(--line)] pt-3">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                  Efecto tras un abono extraordinario
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModoPrestamo('cuota')}
                    className={`cursor-pointer border px-3 py-2 text-left text-xs transition-colors ${
                      modoPrestamo === 'cuota'
                        ? 'border-[var(--emerald)] bg-[var(--emerald-soft)] font-semibold text-[var(--emerald)]'
                        : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]'
                    }`}
                  >
                    Reducir la cuota <span className="font-normal">(mantiene el plazo n)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoPrestamo('plazo')}
                    className={`cursor-pointer border px-3 py-2 text-left text-xs transition-colors ${
                      modoPrestamo === 'plazo'
                        ? 'border-[var(--emerald)] bg-[var(--emerald-soft)] font-semibold text-[var(--emerald)]'
                        : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]'
                    }`}
                  >
                    Reducir el plazo <span className="font-normal">(mantiene la cuota R)</span>
                  </button>
                </div>
              </div>
            ) : (
              <FieldInput
                id="am-dep"
                label="Depósito fijo por periodo (opcional)"
                kind="monto"
                prefix="$"
                value={depStr}
                onChange={setDepStr}
                placeholder="0"
                helper="Se suma en cada periodo 1..n junto con los movimientos extra."
              />
            )}

            <div className="flex justify-end border-t border-[var(--line)] pt-2">
              <button
                type="button"
                onClick={() => {
                  setVpStr('');
                  setIStr('');
                  setNStr('');
                  setDepStr('');
                  setMovItems([]);
                  setSelectedPeriodo(null);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
              >
                <Eraser className="h-3.5 w-3.5" /> Limpiar todo
              </button>
            </div>
          </div>

          <div className="space-y-3 border border-[var(--line)] bg-white p-4">
            <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
              Movimientos extraordinarios
            </h3>

            <div className="grid grid-cols-12 gap-1.5">
              <div className="col-span-3">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-[var(--ink-faint)]">
                  Per.
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={nuevoPer}
                  onChange={(e) => setNuevoPer(formatearEntradaEntero(e.target.value, 4))}
                  placeholder="6"
                  className="w-full border border-[var(--line-strong)] px-2 py-1.5 font-mono-num text-xs outline-none focus:border-[var(--ink)]"
                />
              </div>
              <div className="col-span-4">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-[var(--ink-faint)]">
                  Tipo
                </label>
                <select
                  value={nuevoSigno}
                  onChange={(e) => setNuevoSigno(Number(e.target.value) as 1 | -1)}
                  className="w-full border border-[var(--line-strong)] bg-white px-1.5 py-1.5 text-xs outline-none focus:border-[var(--ink)]"
                >
                  <option value={1}>{tipoTabla === 'prestamo' ? 'Abono (+)' : 'Depósito (+)'}</option>
                  <option value={-1}>{tipoTabla === 'prestamo' ? 'Desemb. (-)' : 'Retiro (-)'}</option>
                </select>
              </div>
              <div className="col-span-5">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-[var(--ink-faint)]">
                  Monto ($)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={nuevoMonto}
                  onChange={(e) => setNuevoMonto(formatearEntradaMonto(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && agregarMovimiento()}
                  placeholder="500.000"
                  className="w-full border border-[var(--line-strong)] px-2 py-1.5 font-mono-num text-xs outline-none focus:border-[var(--ink)]"
                />
              </div>
            </div>
            {errorMov && <p className="text-xs text-[var(--crimson)]">{errorMov}</p>}
            <button
              type="button"
              onClick={agregarMovimiento}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 border border-[var(--ink)] bg-[var(--ink)] py-1.5 text-xs font-semibold text-white hover:border-[var(--emerald)] hover:bg-[var(--emerald)]"
            >
              <Plus className="h-3.5 w-3.5" /> Añadir movimiento
            </button>

            {movItems.length > 0 && (
              <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)] pt-2">
                {movItems.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-1.5 text-xs">
                    <div className="flex items-center gap-2 font-mono-num">
                      <span className="border border-[var(--line)] bg-[var(--paper)] px-1.5 py-0.5 text-[10px] font-semibold">
                        P{m.periodo}
                      </span>
                      <span
                        className={
                          m.monto >= 0
                            ? 'font-semibold text-[var(--emerald)]'
                            : 'font-semibold text-[var(--crimson)]'
                        }
                      >
                        {m.monto >= 0 ? '+' : ''}
                        {fmtDinero(m.monto)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMovItems((prev) => prev.filter((x) => x.id !== m.id))}
                      className="cursor-pointer p-1 text-[var(--ink-faint)] hover:text-[var(--crimson)]"
                      aria-label="Quitar movimiento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div ref={chartSectionRef} className="space-y-4 lg:col-span-8">
          {calculo.estado === 'vacio' ? (
            <div className="chart-grid-bg flex min-h-[380px] flex-col items-center justify-center border border-[var(--line)] p-8 text-center">
              <p className="font-editorial text-lg font-semibold text-[var(--ink)]">
                Ingrese los datos para generar la tabla y sus gráficas
              </p>
              <p className="mt-1.5 max-w-md text-xs text-[var(--ink-muted)]">
                Complete el {tipoTabla === 'prestamo' ? 'monto del préstamo' : 'saldo inicial'}, la
                tasa periódica i (%) y el número de periodos n. Después podrá hacer clic en
                cualquier fila de la tabla para ubicar ese periodo directamente en la gráfica o
                maximizarla.
              </p>
            </div>
          ) : calculo.estado === 'error' ? (
            <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] p-5 text-sm text-[var(--crimson)]">
              <strong className="block font-semibold">No se pudo generar la tabla</strong>
              <span className="mt-1 block">{calculo.error}</span>
            </div>
          ) : calculo.tipo === 'prestamo' ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiTile
                  label="Cuota fija inicial R"
                  value={calculo.data.cuotaInicial}
                  formatter={fmtDinero}
                  caption={
                    Math.abs(calculo.data.cuotaFinal - calculo.data.cuotaInicial) > 1
                      ? `Última: ${fmtDinero(calculo.data.cuotaFinal)}`
                      : 'Cuota constante'
                  }
                  tone="emerald"
                />
                <KpiTile
                  label="Total intereses"
                  value={calculo.data.totalIntereses}
                  formatter={fmtDinero}
                  caption={
                    calculo.hayExtras && Math.abs(calculo.data.ahorroIntereses) > 1
                      ? calculo.data.ahorroIntereses > 0
                        ? `Ahorro: ${fmtDinero(calculo.data.ahorroIntereses)}`
                        : `Costo extra: ${fmtDinero(-calculo.data.ahorroIntereses)}`
                      : undefined
                  }
                  tone="ochre"
                />
                <KpiTile
                  label="Periodos pagados"
                  value={calculo.data.periodosPagados}
                  formatter={(v) => fmtNum(v, 0)}
                  caption={
                    calculo.data.periodosAhorrados > 0
                      ? `${calculo.data.periodosAhorrados} periodo(s) menos`
                      : calculo.data.periodosAhorrados < 0
                        ? `${-calculo.data.periodosAhorrados} periodo(s) más`
                        : 'Plazo original'
                  }
                  tone="cobalt"
                />
                <KpiTile
                  label="Total desembolsado"
                  value={calculo.data.totalCuotas + calculo.data.totalExtra}
                  formatter={fmtDinero}
                  caption={`Neto extra: ${fmtDinero(calculo.data.totalExtra)}`}
                  tone="default"
                />
              </div>

              {calculo.data.advertencias.length > 0 && (
                <div className="space-y-1 border border-[var(--ochre)] bg-[var(--ochre-soft)] px-4 py-2.5 text-xs text-[var(--ochre)]">
                  {calculo.data.advertencias.map((adv, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{adv}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-[var(--line)] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGraficaVista('saldo')}
                      className={`inline-flex cursor-pointer items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        graficaVista === 'saldo'
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                          : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]'
                      }`}
                    >
                      <TrendingDown className="h-3.5 w-3.5" /> Curva de saldo
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraficaVista('barras')}
                      className={`inline-flex cursor-pointer items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        graficaVista === 'barras'
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                          : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]'
                      }`}
                    >
                      <BarChart3 className="h-3.5 w-3.5" /> Composición por cuota
                    </button>

                    {selectedPeriodo !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedPeriodo(null)}
                        className="inline-flex cursor-pointer items-center gap-1 border border-[var(--cobalt)] bg-[var(--cobalt-soft)] px-2 py-1 font-mono-num text-[11px] font-semibold text-[var(--cobalt)] hover:bg-[var(--cobalt)] hover:text-white"
                      >
                        Marcado: P{selectedPeriodo}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink-muted)]">
                    {graficaVista === 'saldo' ? (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2.5 w-2.5 bg-[var(--emerald)]" /> Saldo actual
                        </span>
                        {calculo.hayExtras && (
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#8a8477]" /> Sin extras
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2.5 w-2.5 bg-[var(--emerald)]" /> Abono capital
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2.5 w-2.5 bg-[var(--ochre)]" /> Interés
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2.5 w-2.5 bg-[var(--cobalt)]" /> Extra
                        </span>
                      </>
                    )}
                    <ExpandButton onClick={() => setGraficaAmpliada(true)} />
                  </div>
                </div>

                {graficaVista === 'saldo' ? (
                  <GraficaSaldoPrestamo
                    filas={calculo.data.filas}
                    filasBase={calculo.data.filasBase}
                    hayExtras={calculo.hayExtras}
                    selectedPeriodo={selectedPeriodo}
                    onSelectPeriodo={setSelectedPeriodo}
                  />
                ) : (
                  <GraficaBarrasCuota
                    filas={calculo.data.filas}
                    selectedPeriodo={selectedPeriodo}
                    onSelectPeriodo={setSelectedPeriodo}
                  />
                )}
              </div>

              <ExpandableModal
                open={graficaAmpliada}
                onClose={() => setGraficaAmpliada(false)}
                title={
                  graficaVista === 'saldo'
                    ? 'Curva de evolución del saldo'
                    : 'Composición de cada cuota (interés vs. capital)'
                }
                subtitle="Haga clic sobre cualquier punto o barra para fijar el periodo"
              >
                <div className="border border-[var(--line)] bg-white">
                  {graficaVista === 'saldo' ? (
                    <GraficaSaldoPrestamo
                      filas={calculo.data.filas}
                      filasBase={calculo.data.filasBase}
                      hayExtras={calculo.hayExtras}
                      selectedPeriodo={selectedPeriodo}
                      onSelectPeriodo={setSelectedPeriodo}
                    />
                  ) : (
                    <GraficaBarrasCuota
                      filas={calculo.data.filas}
                      selectedPeriodo={selectedPeriodo}
                      onSelectPeriodo={setSelectedPeriodo}
                      expandido
                    />
                  )}
                </div>
              </ExpandableModal>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile label="Saldo final" value={calculo.data.saldoFinal} formatter={fmtDinero} tone="emerald" large />
                <KpiTile label="Total intereses ganados" value={calculo.data.totalIntereses} formatter={fmtDinero} tone="ochre" />
                <KpiTile label="Neto depósitos / retiros" value={calculo.data.netoMovimientos} formatter={fmtDinero} tone="cobalt" />
              </div>

              <div className="border border-[var(--line)] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
                  <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
                    Evolución del saldo de la cuenta
                  </h3>
                  <div className="flex items-center gap-2">
                    {selectedPeriodo !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedPeriodo(null)}
                        className="inline-flex cursor-pointer items-center gap-1 border border-[var(--cobalt)] bg-[var(--cobalt-soft)] px-2 py-1 font-mono-num text-[11px] font-semibold text-[var(--cobalt)] hover:bg-[var(--cobalt)] hover:text-white"
                      >
                        Marcado: P{selectedPeriodo}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <ExpandButton onClick={() => setGraficaAmpliada(true)} />
                  </div>
                </div>
                <GraficaCuenta
                  filas={calculo.data.filas}
                  selectedPeriodo={selectedPeriodo}
                  onSelectPeriodo={setSelectedPeriodo}
                />
              </div>

              <ExpandableModal
                open={graficaAmpliada}
                onClose={() => setGraficaAmpliada(false)}
                title="Evolución del saldo de la cuenta"
                subtitle="Haga clic sobre cualquier periodo para fijar el marcador"
              >
                <div className="border border-[var(--line)] bg-white">
                  <GraficaCuenta
                    filas={calculo.data.filas}
                    selectedPeriodo={selectedPeriodo}
                    onSelectPeriodo={setSelectedPeriodo}
                  />
                </div>
              </ExpandableModal>
            </>
          )}
        </div>
      </div>

      {calculo.estado === 'ok' && (
        <>
          <div className="border border-[var(--line)] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <h3 className="font-editorial text-base font-semibold text-[var(--ink)]">
                  {calculo.tipo === 'prestamo'
                    ? `Tabla de amortización — ${calculo.data.periodosPagados} periodos`
                    : `Extracto de cuenta — ${calculo.data.filas.length - 1} periodos`}
                </h3>
                <p className="text-[11px] text-[var(--ink-faint)]">
                  Haga clic en cualquier fila para señalar ese periodo en la gráfica superior.
                  {selectedPeriodo !== null && (
                    <button
                      type="button"
                      onClick={() =>
                        chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                      className="ml-2 cursor-pointer font-semibold text-[var(--cobalt)] underline underline-offset-2"
                    >
                      Ver P{selectedPeriodo} en gráfica ↑
                    </button>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ExpandButton onClick={() => setTablaAmpliada(true)} label="Ampliar tabla" />
                <button
                  type="button"
                  onClick={() => exportar('csv')}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--line-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                >
                  <Download className="h-3.5 w-3.5" /> Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={() => exportar('xlsx')}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--emerald)] bg-[var(--emerald)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#094736]"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel (.xlsx)
                </button>
              </div>
            </div>

            <div className="max-h-[440px] overflow-auto ledger-scroll">
              {renderTablaContenido()}
            </div>
          </div>

          <ExpandableModal
            open={tablaAmpliada}
            onClose={() => setTablaAmpliada(false)}
            title={
              calculo.tipo === 'prestamo'
                ? `Tabla de amortización completa (${calculo.data.periodosPagados} periodos)`
                : `Extracto de cuenta completo (${calculo.data.filas.length - 1} periodos)`
            }
            subtitle="Haga clic en una fila para seleccionarla también en la gráfica"
            allowZoom={false}
          >
            <div className="border border-[var(--line)] bg-white">{renderTablaContenido()}</div>
          </ExpandableModal>
        </>
      )}
    </div>
  );
}
