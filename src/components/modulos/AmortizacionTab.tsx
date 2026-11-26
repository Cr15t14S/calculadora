import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileSpreadsheet,
  Plus,
  Sparkles,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import {
  ErrorFinanciero,
  agruparMovimientos,
  exportarCSV,
  exportarExcel,
  fmtDinero,
  fmtDineroCorto,
  fmtNum,
  parsearEnteroPositivo,
  parsearMovimientosTexto,
  parsearNumero,
  parsearTasa,
  tablaCuenta,
  tablaPrestamo,
  type FilaCuenta,
  type FilaPrestamo,
  type ModoPrestamo,
  type MovimientoExtraItem,
} from '../../lib/finanzas';
import { FieldInput } from '../ui/FieldInput';
import { KpiTile } from '../ui/KpiTile';

interface Props {
  tasaTransferida?: { valorPct: string; token: number } | null;
}

function GraficaSaldoPrestamo({
  filas,
  filasBase,
  hayExtras,
}: {
  filas: FilaPrestamo[];
  filasBase: FilaPrestamo[];
  hayExtras: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (filas.length < 2) return null;

  const W = 660;
  const H = 260;
  const pad = { top: 22, right: 24, bottom: 34, left: 66 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxP = Math.max(filas[filas.length - 1].periodo, filasBase[filasBase.length - 1].periodo, 1);
  const maxY =
    Math.max(...filas.map((f) => f.saldoFinal), ...filasBase.map((f) => f.saldoFinal), 1) * 1.06;

  const xOf = (p: number) => pad.left + (p / maxP) * plotW;
  const yOf = (v: number) => pad.top + ((maxY - v) / maxY) * plotH;

  const ptsActual = filas.map((f) => `${xOf(f.periodo).toFixed(1)},${yOf(f.saldoFinal).toFixed(1)}`).join(' ');
  const ptsBase = filasBase.map((f) => `${xOf(f.periodo).toFixed(1)},${yOf(f.saldoFinal).toFixed(1)}`).join(' ');
  const areaActual = `M ${xOf(0).toFixed(1)},${yOf(0).toFixed(1)} ${filas
    .map((f) => `L ${xOf(f.periodo).toFixed(1)},${yOf(f.saldoFinal).toFixed(1)}`)
    .join(' ')} L ${xOf(filas[filas.length - 1].periodo).toFixed(1)},${yOf(0).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => maxY * r);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxP * r));
  const active = hoverIdx !== null ? filas[hoverIdx] : null;
  const filasConExtra = filas.filter((f) => f.extra !== null && Math.abs(f.extra) > 0.01);

  return (
    <div className="chart-grid-bg p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          const periodoHover = Math.round(((relX - pad.left) / plotW) * maxP);
          const idx = filas.findIndex((f) => f.periodo === periodoHover);
          if (idx >= 0) setHoverIdx(idx);
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

        {/* Plan original fantasma si hay movimientos extra */}
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

        {/* Área saldo actual */}
        <path d={areaActual} fill="#0d5c46" fillOpacity="0.12" className="svg-smooth" />

        {/* Línea saldo actual */}
        <polyline
          key={`saldo-${filas.length}-${filas[0].saldoFinal}-${filasConExtra.length}`}
          fill="none"
          stroke="#0d5c46"
          strokeWidth="2.6"
          strokeLinejoin="round"
          points={ptsActual}
          className="svg-draw-line"
        />

        {/* Marcadores de abonos extra / desembolsos */}
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

        {/* Hover cursor */}
        {active && (
          <g>
            <line
              x1={xOf(active.periodo)}
              x2={xOf(active.periodo)}
              y1={pad.top}
              y2={yOf(0)}
              stroke="#171614"
              strokeWidth="1"
            />
            <circle
              cx={xOf(active.periodo)}
              cy={yOf(active.saldoFinal)}
              r="5"
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
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Periodo</span>
            <span className="font-mono-num font-semibold">{active.periodo}</span>
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

function GraficaBarrasCuota({ filas }: { filas: FilaPrestamo[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const sinCero = filas.slice(1);
  if (sinCero.length === 0) return null;

  // Si hay más de 48 periodos, muestreamos visualmente para mantener barras nítidas
  const paso = sinCero.length > 48 ? Math.ceil(sinCero.length / 48) : 1;
  const visibles = sinCero.filter((_, idx) => idx % paso === 0 || idx === sinCero.length - 1);

  const W = 660;
  const H = 260;
  const pad = { top: 22, right: 20, bottom: 34, left: 66 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxBar = Math.max(
    1,
    ...visibles.map((f) => (f.interes ?? 0) + Math.max(0, f.abono ?? 0) + Math.max(0, f.extra ?? 0))
  ) * 1.08;

  const yOf = (v: number) => pad.top + ((maxBar - v) / maxBar) * plotH;
  const baseY = yOf(0);
  const barSlot = plotW / visibles.length;
  const barW = Math.max(3, Math.min(28, barSlot * 0.72));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => maxBar * r);
  const active = hoverIdx !== null ? visibles[hoverIdx] : null;

  return (
    <div className="chart-grid-bg p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" onMouseLeave={() => setHoverIdx(null)}>
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
          const op = hoverIdx === null || hoverIdx === idx ? 1 : 0.45;

          return (
            <g
              key={f.periodo}
              opacity={op}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(idx)}
            >
              <rect x={x} y={yAbo} width={barW} height={Math.max(0, hAbo)} fill="#0d5c46" className="svg-smooth" />
              <rect x={x} y={yInt} width={barW} height={Math.max(0, hInt)} fill="#b45309" className="svg-smooth" />
              {hExt > 0.5 && (
                <rect x={x} y={yExt} width={barW} height={hExt} fill="#1d4ed8" className="svg-smooth" />
              )}
              {(visibles.length <= 16 || idx % Math.ceil(visibles.length / 10) === 0 || idx === visibles.length - 1) && (
                <text
                  x={x + barW / 2}
                  y={H - 10}
                  textAnchor="middle"
                  className="fill-[#5c584f] font-mono-num text-[9px]"
                >
                  {f.periodo}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {active && (
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-[var(--line)] bg-white px-3 py-2 text-xs sm:grid-cols-4">
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Periodo {active.periodo}</span>
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

function GraficaCuenta({ filas }: { filas: FilaCuenta[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (filas.length < 2) return null;

  const W = 660;
  const H = 250;
  const pad = { top: 22, right: 24, bottom: 34, left: 66 };
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
  const active = hoverIdx !== null ? filas[hoverIdx] : null;

  return (
    <div className="chart-grid-bg p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          const p = Math.round(((relX - pad.left) / plotW) * maxP);
          const idx = filas.findIndex((f) => f.periodo === p);
          if (idx >= 0) setHoverIdx(idx);
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

        {active && (
          <g>
            <line x1={xOf(active.periodo)} x2={xOf(active.periodo)} y1={pad.top} y2={yOf(0)} stroke="#171614" strokeWidth="1" />
            <circle cx={xOf(active.periodo)} cy={yOf(active.saldoFinal)} r="5" fill="#0d5c46" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {active && (
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-[var(--line)] bg-white px-3 py-2 text-xs sm:grid-cols-4">
          <div>
            <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Periodo</span>
            <span className="font-mono-num font-semibold">{active.periodo}</span>
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
  const [vpStr, setVpStr] = useState('1.000.000');
  const [iStr, setIStr] = useState('2');
  const [nStr, setNStr] = useState('12');
  const [depStr, setDepStr] = useState('0');
  const [modoPrestamo, setModoPrestamo] = useState<ModoPrestamo>('cuota');

  // Movimientos extraordinarios: modo lista visual o texto rápido
  const [modoMov, setModoMov] = useState<'lista' | 'texto'>('lista');
  const [movItems, setMovItems] = useState<MovimientoExtraItem[]>([]);
  const [movTexto, setMovTexto] = useState('');

  // Inputs para agregar movimiento estructurado
  const [nuevoPer, setNuevoPer] = useState('6');
  const [nuevoSigno, setNuevoSigno] = useState<1 | -1>(1);
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [errorMov, setErrorMov] = useState<string | null>(null);

  // Vista de gráfica en modo préstamo
  const [graficaVista, setGraficaVista] = useState<'saldo' | 'barras'>('saldo');

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
      setMovItems((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          periodo,
          monto: nuevoSigno * montoAbs,
        },
      ]);
      setNuevoMonto('');
      setErrorMov(null);
    } catch (e) {
      setErrorMov(e instanceof ErrorFinanciero ? e.message : 'Dato inválido.');
    }
  };

  const cambiarModoMov = (nuevo: 'lista' | 'texto') => {
    if (nuevo === modoMov) return;
    if (nuevo === 'texto') {
      const lineas = movItems.map((m) => `${m.periodo}: ${m.monto}`).join('\n');
      setMovTexto(lineas);
    } else {
      try {
        const mapa = parsearMovimientosTexto(movTexto);
        const items: MovimientoExtraItem[] = Object.entries(mapa)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([p, m], idx) => ({ id: `imp-${idx}-${p}`, periodo: Number(p), monto: m }));
        setMovItems(items);
      } catch {
        // Si el texto tiene un error, mantenemos los items anteriores
      }
    }
    setModoMov(nuevo);
  };

  const calculo = useMemo(() => {
    try {
      const vp = parsearNumero(vpStr, tipoTabla === 'prestamo' ? 'Monto del préstamo VP' : 'Saldo inicial', {
        esMonto: true,
      });
      const i = parsearTasa(iStr, 'Tasa periódica i');
      const n = parsearEnteroPositivo(nStr, 'Número de periodos n');
      const movs = modoMov === 'lista' ? agruparMovimientos(movItems) : parsearMovimientosTexto(movTexto);

      if (tipoTabla === 'prestamo') {
        const res = tablaPrestamo(vp, i, n, movs, modoPrestamo);
        return { ok: true as const, tipo: 'prestamo' as const, data: res, hayExtras: Object.keys(movs).length > 0 };
      }

      const dep = depStr.trim() ? parsearNumero(depStr, 'Depósito fijo', { esMonto: true }) : 0;
      const res = tablaCuenta(vp, i, n, movs, dep);
      return { ok: true as const, tipo: 'cuenta' as const, data: res, hayExtras: Object.keys(movs).length > 0 };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof ErrorFinanciero ? e.message : 'Revise los datos ingresados.',
      };
    }
  }, [tipoTabla, vpStr, iStr, nStr, depStr, modoPrestamo, modoMov, movItems, movTexto]);

  const exportar = (formato: 'csv' | 'xlsx') => {
    if (!calculo.ok) return;
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

  return (
    <div className="animate-panel space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-[0.12em] text-[var(--emerald)]">
            Módulo 04 · Sistema Francés y Control de Saldos
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
            Tabla de amortización y cuenta
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ink-faint)]">
            <Sparkles className="h-3.5 w-3.5" /> Casos rápidos:
          </span>
          <button
            type="button"
            onClick={() => {
              setTipoTabla('prestamo');
              setVpStr('1.000.000');
              setIStr('2');
              setNStr('12');
              setModoPrestamo('cuota');
              setModoMov('lista');
              setMovItems([]);
            }}
            className="cursor-pointer border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            $1M · 2 % · 12 m
          </button>
          <button
            type="button"
            onClick={() => {
              setTipoTabla('prestamo');
              setVpStr('134.000.000');
              setIStr('1,874209');
              setNStr('24');
              setModoPrestamo('plazo');
              setModoMov('lista');
              setMovItems([{ id: 'ex-h7', periodo: 8, monto: 15_000_000 }]);
            }}
            className="cursor-pointer border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            Excel Hoja7 ($134M + abono mes 8)
          </button>
          <button
            type="button"
            onClick={() => {
              setTipoTabla('cuenta');
              setVpStr('2.000.000');
              setIStr('1,2');
              setNStr('12');
              setDepStr('250.000');
              setModoMov('lista');
              setMovItems([
                { id: 'c1', periodo: 4, monto: 500_000 },
                { id: 'c2', periodo: 9, monto: -800_000 },
              ]);
            }}
            className="cursor-pointer border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            Cuenta ahorros + retiro
          </button>
        </div>
      </div>

      {/* Controles principales */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Columna de parámetros */}
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-4 border border-[var(--line)] bg-white p-4">
            <div className="grid grid-cols-2 border border-[var(--line-strong)]">
              <button
                type="button"
                onClick={() => setTipoTabla('prestamo')}
                className={`cursor-pointer py-2 text-xs font-semibold transition-colors ${
                  tipoTabla === 'prestamo' ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--ink-muted)]'
                }`}
              >
                Préstamo (Francés)
              </button>
              <button
                type="button"
                onClick={() => setTipoTabla('cuenta')}
                className={`cursor-pointer py-2 text-xs font-semibold transition-colors ${
                  tipoTabla === 'cuenta' ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--ink-muted)]'
                }`}
              >
                Cuenta (Dep./Ret.)
              </button>
            </div>

            <FieldInput
              id="am-vp"
              label={tipoTabla === 'prestamo' ? 'Monto del préstamo (VP)' : 'Saldo inicial'}
              prefix="$"
              value={vpStr}
              onChange={setVpStr}
            />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput id="am-i" label="Tasa periódica i" suffix="%" value={iStr} onChange={setIStr} />
              <FieldInput id="am-n" label="Periodos (n)" value={nStr} onChange={setNStr} />
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
                label="Depósito fijo por periodo"
                prefix="$"
                value={depStr}
                onChange={setDepStr}
                helper="Se suma en cada periodo 1..n junto con los movimientos extra."
              />
            )}
          </div>

          {/* Movimientos extraordinarios */}
          <div className="space-y-3 border border-[var(--line)] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
                Movimientos extraordinarios
              </h3>
              <div className="flex border border-[var(--line)] text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => cambiarModoMov('lista')}
                  className={`cursor-pointer px-2 py-1 ${
                    modoMov === 'lista' ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--ink-muted)]'
                  }`}
                >
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => cambiarModoMov('texto')}
                  className={`cursor-pointer px-2 py-1 ${
                    modoMov === 'texto' ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--ink-muted)]'
                  }`}
                >
                  Texto
                </button>
              </div>
            </div>

            {modoMov === 'lista' ? (
              <>
                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-3">
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-[var(--ink-faint)]">
                      Per.
                    </label>
                    <input
                      type="text"
                      value={nuevoPer}
                      onChange={(e) => setNuevoPer(e.target.value)}
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
                      value={nuevoMonto}
                      onChange={(e) => setNuevoMonto(e.target.value)}
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
                          <span className={m.monto >= 0 ? 'font-semibold text-[var(--emerald)]' : 'font-semibold text-[var(--crimson)]'}>
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
              </>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] text-[var(--ink-faint)]">
                  Una línea por movimiento: <code className="text-[var(--ink)]">6: 500000</code> (positivo ={' '}
                  {tipoTabla === 'prestamo' ? 'abono extra' : 'depósito'}, negativo ={' '}
                  {tipoTabla === 'prestamo' ? 'desembolso' : 'retiro'}).
                </p>
                <textarea
                  rows={5}
                  value={movTexto}
                  onChange={(e) => setMovTexto(e.target.value)}
                  placeholder={'6: 500000\n9: -200000'}
                  className="w-full border border-[var(--line-strong)] bg-[var(--paper)] p-2.5 font-mono-num text-xs outline-none focus:border-[var(--ink)]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: KPIs + Gráficas animadas */}
        <div className="space-y-4 lg:col-span-8">
          {!calculo.ok ? (
            <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] p-5 text-sm text-[var(--crimson)]">
              <strong className="block font-semibold">No se pudo generar la tabla</strong>
              <span className="mt-1 block">{calculo.error}</span>
            </div>
          ) : calculo.tipo === 'prestamo' ? (
            <>
              {/* KPIs de Préstamo */}
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

              {/* Selector de gráfica */}
              <div className="border border-[var(--line)] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>

                {graficaVista === 'saldo' ? (
                  <GraficaSaldoPrestamo
                    filas={calculo.data.filas}
                    filasBase={calculo.data.filasBase}
                    hayExtras={calculo.hayExtras}
                  />
                ) : (
                  <GraficaBarrasCuota filas={calculo.data.filas} />
                )}
              </div>
            </>
          ) : (
            <>
              {/* KPIs Cuenta */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile label="Saldo final" value={calculo.data.saldoFinal} formatter={fmtDinero} tone="emerald" large />
                <KpiTile label="Total intereses ganados" value={calculo.data.totalIntereses} formatter={fmtDinero} tone="ochre" />
                <KpiTile label="Neto depósitos / retiros" value={calculo.data.netoMovimientos} formatter={fmtDinero} tone="cobalt" />
              </div>

              <div className="border border-[var(--line)] bg-white">
                <div className="border-b border-[var(--line)] px-4 py-2.5">
                  <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
                    Evolución del saldo de la cuenta
                  </h3>
                </div>
                <GraficaCuenta filas={calculo.data.filas} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabla completa + Exportación */}
      {calculo.ok && (
        <div className="border border-[var(--line)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div>
              <h3 className="font-editorial text-base font-semibold text-[var(--ink)]">
                {calculo.tipo === 'prestamo'
                  ? `Tabla de amortización — ${calculo.data.periodosPagados} periodos`
                  : `Extracto de cuenta — ${calculo.data.filas.length - 1} periodos`}
              </h3>
              <p className="text-[11px] text-[var(--ink-faint)]">
                Las filas resaltadas indican movimientos extraordinarios aplicados en ese periodo.
              </p>
            </div>
            <div className="flex items-center gap-2">
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
            {calculo.tipo === 'prestamo' ? (
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
                    return (
                      <tr
                        key={f.periodo}
                        className={
                          tieneExtra
                            ? (f.extra ?? 0) > 0
                              ? 'bg-[var(--cobalt-soft)]/55'
                              : 'bg-[var(--crimson-soft)]/55'
                            : 'hover:bg-[var(--paper)]'
                        }
                      >
                        <td className="px-3 py-2 text-center font-semibold">{f.periodo}</td>
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
            ) : (
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
                    return (
                      <tr key={f.periodo} className="hover:bg-[var(--paper)]">
                        <td className="px-3 py-2 text-center font-semibold">{f.periodo}</td>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
