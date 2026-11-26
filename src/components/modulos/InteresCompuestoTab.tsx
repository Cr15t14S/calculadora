import { useEffect, useMemo, useState } from 'react';
import { Eraser } from 'lucide-react';
import {
  ErrorFinanciero,
  fmtDinero,
  fmtDineroCorto,
  fmtNum,
  fmtPct,
  parsearNumero,
  parsearTasa,
  resolverInteresCompuesto,
  type IncognitaIC,
  type PuntoSerieIC,
} from '../../lib/finanzas';
import { ExpandButton, ExpandableModal } from '../ui/ExpandableModal';
import { FieldInput } from '../ui/FieldInput';
import { FormulaBar } from '../ui/FormulaBar';
import { KpiTile } from '../ui/KpiTile';

interface Props {
  tasaTransferida?: { valorPct: string; token: number } | null;
}

const OPCIONES: Array<{ id: IncognitaIC; titulo: string; simbolo: string }> = [
  { id: 'VF', titulo: 'Valor Futuro', simbolo: 'VF' },
  { id: 'VP', titulo: 'Valor Presente', simbolo: 'VP' },
  { id: 'i', titulo: 'Tasa periódica', simbolo: 'i' },
  { id: 'n', titulo: 'Periodos', simbolo: 'n' },
];

function GraficaCrecimientoSVG({
  serie,
  vp,
  vf,
  n,
}: {
  serie: PuntoSerieIC[];
  vp: number;
  vf: number;
  n: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (serie.length < 2) {
    return (
      <div className="chart-grid-bg flex h-72 items-center justify-center border border-[var(--line)] text-xs text-[var(--ink-faint)]">
        Ingrese valores positivos de n para visualizar la curva de crecimiento.
      </div>
    );
  }

  const W = 640;
  const H = 290;
  const pad = { top: 24, right: 24, bottom: 38, left: 88 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const vals = serie.flatMap((p) => [p.compuesto, p.simple, p.capital, 0]);
  const maxY = Math.max(...vals) * 1.08 || 1;
  const minY = Math.min(0, ...vals);
  const spanY = maxY - minY || 1;
  const maxT = serie[serie.length - 1].t || 1;

  const xOf = (t: number) => pad.left + (t / maxT) * plotW;
  const yOf = (v: number) => pad.top + ((maxY - v) / spanY) * plotH;

  const compPoints = serie.map((p) => `${xOf(p.t).toFixed(1)},${yOf(p.compuesto).toFixed(1)}`).join(' ');
  const simplePoints = serie.map((p) => `${xOf(p.t).toFixed(1)},${yOf(p.simple).toFixed(1)}`).join(' ');

  const baseY = yOf(Math.max(0, minY));
  const capY = yOf(vp);

  const areaComp = `M ${xOf(serie[0].t).toFixed(1)},${capY.toFixed(1)} ${serie
    .map((p) => `L ${xOf(p.t).toFixed(1)},${yOf(p.compuesto).toFixed(1)}`)
    .join(' ')} L ${xOf(maxT).toFixed(1)},${capY.toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => minY + spanY * r);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => maxT * r);

  const active = hoverIdx !== null ? serie[hoverIdx] : serie[serie.length - 1];
  const totalGanado = vf - vp;

  return (
    <div className="chart-grid-bg relative p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          const frac = Math.max(0, Math.min(1, (relX - pad.left) / plotW));
          const idx = Math.round(frac * (serie.length - 1));
          setHoverIdx(idx);
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

        {xTicks.map((t, idx) => (
          <text
            key={idx}
            x={xOf(t)}
            y={H - 12}
            textAnchor="middle"
            className="fill-[#5c584f] font-mono-num text-[10px]"
          >
            t = {fmtNum(t, t % 1 === 0 ? 0 : 1)}
          </text>
        ))}

        {vp > 0 && (
          <rect
            x={pad.left}
            y={capY}
            width={plotW}
            height={Math.max(0, baseY - capY)}
            fill="#171614"
            fillOpacity="0.06"
            className="svg-smooth"
          />
        )}

        <path
          d={areaComp}
          fill={totalGanado >= 0 ? '#0d5c46' : '#9f1239'}
          fillOpacity="0.16"
          className="svg-smooth"
        />

        <polyline
          fill="none"
          stroke="#b45309"
          strokeWidth="1.75"
          strokeDasharray="5 4"
          points={simplePoints}
          className="svg-smooth"
        />

        <polyline
          key={`${vp}-${vf}-${n}`}
          fill="none"
          stroke={totalGanado >= 0 ? '#0d5c46' : '#9f1239'}
          strokeWidth="2.75"
          strokeLinejoin="round"
          points={compPoints}
          className="svg-draw-line"
        />

        {active && (
          <g>
            <line
              x1={xOf(active.t)}
              x2={xOf(active.t)}
              y1={pad.top}
              y2={baseY}
              stroke="#171614"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={xOf(active.t)}
              cy={yOf(active.simple)}
              r="3.5"
              fill="#ffffff"
              stroke="#b45309"
              strokeWidth="2"
            />
            <circle
              cx={xOf(active.t)}
              cy={yOf(active.compuesto)}
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
            <span className="block text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
              Periodo inspeccionado
            </span>
            <span className="font-mono-num font-semibold">t = {fmtNum(active.t, 2)}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
              Saldo compuesto
            </span>
            <span className="font-mono-num font-semibold text-[var(--emerald)]">
              {fmtDinero(active.compuesto)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
              Referencia simple
            </span>
            <span className="font-mono-num font-semibold text-[var(--ochre)]">
              {fmtDinero(active.simple)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
              Efecto compuesto
            </span>
            <span className="font-mono-num font-semibold text-[var(--ink)]">
              {fmtDinero(active.compuesto - active.simple)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function GraficaCrecimiento({
  serie,
  vp,
  vf,
  n,
}: {
  serie: PuntoSerieIC[];
  vp: number;
  vf: number;
  n: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const pctCap = vf > 0 ? Math.max(0, Math.min(100, (vp / vf) * 100)) : 50;
  const pctInt = 100 - pctCap;

  return (
    <div className="space-y-3">
      <div className="border border-[var(--line)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <div>
            <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
              Curva de capitalización compuesta vs. interés simple
            </h3>
            <p className="text-[11px] text-[var(--ink-faint)]">
              Deslice el cursor sobre la gráfica para inspeccionar cada periodo
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 bg-[var(--emerald)]" /> Compuesto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[var(--ochre)]" /> Simple
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 bg-[#d8d2c4]" /> Capital base
            </span>
            <ExpandButton onClick={() => setAbierto(true)} />
          </div>
        </div>

        <div
          className="cursor-zoom-in"
          title="Haga clic para ampliar la gráfica"
          onClick={() => setAbierto(true)}
        >
          <GraficaCrecimientoSVG serie={serie} vp={vp} vf={vf} n={n} />
        </div>
      </div>

      {vf > 0 && vp > 0 && vf >= vp && (
        <div className="border border-[var(--line)] bg-white px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Composición del Valor Futuro
            </span>
            <span className="font-mono-num text-[var(--ink-muted)]">
              Capital {fmtNum(pctCap, 1)} % · Intereses {fmtNum(pctInt, 1)} %
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden border border-[var(--line)] bg-[var(--paper-alt)]">
            <div
              className="h-full bg-[#2c2a26] transition-all duration-500 ease-out"
              style={{ width: `${pctCap}%` }}
            />
            <div
              className="h-full bg-[var(--emerald)] transition-all duration-500 ease-out"
              style={{ width: `${pctInt}%` }}
            />
          </div>
        </div>
      )}

      <ExpandableModal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Curva de capitalización compuesta vs. interés simple"
        subtitle="Vista ampliada · Use los controles de zoom o pase el cursor para inspeccionar"
      >
        <div className="border border-[var(--line)] bg-white">
          <GraficaCrecimientoSVG serie={serie} vp={vp} vf={vf} n={n} />
        </div>
      </ExpandableModal>
    </div>
  );
}

export function InteresCompuestoTab({ tasaTransferida }: Props) {
  const [incognita, setIncognita] = useState<IncognitaIC>('VF');
  const [vpStr, setVpStr] = useState('');
  const [vfStr, setVfStr] = useState('');
  const [iStr, setIStr] = useState('');
  const [nStr, setNStr] = useState('');

  useEffect(() => {
    if (tasaTransferida) {
      if (incognita === 'i') setIncognita('VF');
      setIStr(tasaTransferida.valorPct);
    }
  }, [tasaTransferida]);

  const calculo = useMemo(() => {
    const faltan =
      (incognita !== 'VP' && !vpStr.trim()) ||
      (incognita !== 'VF' && !vfStr.trim()) ||
      (incognita !== 'i' && !iStr.trim()) ||
      (incognita !== 'n' && !nStr.trim());

    if (faltan) {
      return { estado: 'vacio' as const };
    }

    try {
      const vp = incognita !== 'VP' ? parsearNumero(vpStr, 'Valor Presente VP', { esMonto: true }) : undefined;
      const vf = incognita !== 'VF' ? parsearNumero(vfStr, 'Valor Futuro VF', { esMonto: true }) : undefined;
      const i = incognita !== 'i' ? parsearTasa(iStr, 'Tasa periódica i') : undefined;
      const n = incognita !== 'n' ? parsearNumero(nStr, 'Número de periodos n') : undefined;
      return {
        estado: 'ok' as const,
        data: resolverInteresCompuesto({ incognita, vp, vf, i, n }),
      };
    } catch (err) {
      const msg = err instanceof ErrorFinanciero ? err.message : 'Revise los datos ingresados.';
      return { estado: 'error' as const, error: msg };
    }
  }, [incognita, vpStr, vfStr, iStr, nStr]);

  const valorMostrado = (campo: IncognitaIC, textoActual: string) => {
    if (incognita !== campo) return textoActual;
    if (calculo.estado !== 'ok') return '';
    if (campo === 'VF' || campo === 'VP') return fmtDinero(calculo.data.valor);
    if (campo === 'i') return fmtPct(calculo.data.valor, 4);
    return fmtNum(calculo.data.valor, 4);
  };

  return (
    <div className="animate-panel space-y-6">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="font-mono-num text-[11px] uppercase tracking-[0.12em] text-[var(--emerald)]">
          Módulo 01 · Capitalización y Descuento
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Interés compuesto básico
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 border border-[var(--line)] bg-white p-5 lg:col-span-5">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              ¿Qué variable desea despejar?
            </span>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
              {OPCIONES.map((op) => {
                const activo = incognita === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setIncognita(op.id)}
                    className={`cursor-pointer border px-3 py-2 text-left transition-colors ${
                      activo
                        ? 'border-[var(--emerald)] bg-[var(--emerald)] text-white'
                        : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--ink)]'
                    }`}
                  >
                    <span className="block font-mono-num text-sm font-semibold">{op.simbolo}</span>
                    <span
                      className={`block text-[11px] ${
                        activo ? 'text-white/80' : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      {op.titulo}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3.5 border-t border-[var(--line)] pt-4">
            <FieldInput
              id="ic-vp"
              label="Valor Presente (VP)"
              kind="monto"
              prefix="$"
              value={valorMostrado('VP', vpStr)}
              onChange={setVpStr}
              disabled={incognita === 'VP'}
              highlightTarget={incognita === 'VP'}
              placeholder="Ej. 1.000.000"
            />
            <FieldInput
              id="ic-vf"
              label="Valor Futuro (VF)"
              kind="monto"
              prefix="$"
              value={valorMostrado('VF', vfStr)}
              onChange={setVfStr}
              disabled={incognita === 'VF'}
              highlightTarget={incognita === 'VF'}
              placeholder="Ej. 1.268.241,79"
            />
            <FieldInput
              id="ic-i"
              label="Tasa periódica (i)"
              kind="decimal"
              suffix="%"
              value={valorMostrado('i', iStr)}
              onChange={setIStr}
              disabled={incognita === 'i'}
              highlightTarget={incognita === 'i'}
              placeholder="Ej. 2"
              helper={incognita !== 'i' ? 'Escriba en porcentaje (2 equivale a 2 %).' : undefined}
            />
            <FieldInput
              id="ic-n"
              label="Número de periodos (n)"
              kind="decimal"
              suffix="per."
              value={valorMostrado('n', nStr)}
              onChange={setNStr}
              disabled={incognita === 'n'}
              highlightTarget={incognita === 'n'}
              placeholder="Ej. 12"
            />
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
            <span className="text-[11px] text-[var(--ink-faint)]">
              Recálculo automático en tiempo real
            </span>
            <button
              type="button"
              onClick={() => {
                setVpStr('');
                setVfStr('');
                setIStr('');
                setNStr('');
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              <Eraser className="h-3.5 w-3.5" /> Limpiar
            </button>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-7">
          {calculo.estado === 'vacio' ? (
            <div className="chart-grid-bg flex min-h-[340px] flex-col items-center justify-center border border-[var(--line)] p-8 text-center">
              <p className="font-editorial text-lg font-semibold text-[var(--ink)]">
                Ingrese los datos para calcular {incognita}
              </p>
              <p className="mt-1.5 max-w-sm text-xs text-[var(--ink-muted)]">
                Complete los tres campos conocidos en el panel izquierdo para ver el resultado, la
                fórmula desarrollada y la curva de capitalización en tiempo real.
              </p>
            </div>
          ) : calculo.estado === 'error' ? (
            <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] p-5 text-sm text-[var(--crimson)]">
              <strong className="block font-semibold">Dato inválido</strong>
              <span className="mt-1 block">{calculo.error}</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile
                  label={
                    incognita === 'VF'
                      ? 'Valor Futuro (VF)'
                      : incognita === 'VP'
                        ? 'Valor Presente (VP)'
                        : incognita === 'i'
                          ? 'Tasa periódica (i)'
                          : 'Periodos (n)'
                  }
                  value={calculo.data.valor}
                  formatter={(v) =>
                    incognita === 'i'
                      ? fmtPct(v, 4)
                      : incognita === 'n'
                        ? fmtNum(v, 4)
                        : fmtDinero(v)
                  }
                  caption={
                    incognita === 'i'
                      ? `Decimal: ${fmtNum(calculo.data.valor, 6)}`
                      : incognita === 'n' && calculo.data.enteroSuperiorN !== undefined
                        ? `Entero superior: ${calculo.data.enteroSuperiorN} periodos`
                        : `Factor: ${fmtNum(calculo.data.factor, 6)}`
                  }
                  tone="emerald"
                  large
                />
                <KpiTile
                  label={incognita === 'VP' ? 'Descuento (Intereses)' : 'Intereses generados'}
                  value={calculo.data.intereses}
                  formatter={fmtDinero}
                  caption={
                    calculo.data.vp > 0
                      ? `${fmtNum((calculo.data.intereses / calculo.data.vp) * 100, 2)} % sobre capital`
                      : undefined
                  }
                  tone="ochre"
                />
                <KpiTile
                  label="Factor acumulado"
                  value={calculo.data.factor}
                  formatter={(v) => fmtNum(v, 6)}
                  caption={incognita === 'VP' ? '(1 + i)^(-n)' : '(1 + i)^n'}
                  tone="default"
                />
              </div>

              {calculo.data.advertencia && (
                <div className="border border-[var(--ochre)] bg-[var(--ochre-soft)] px-4 py-2.5 text-xs text-[var(--ochre)]">
                  {calculo.data.advertencia}
                </div>
              )}

              <FormulaBar
                simbolica={calculo.data.formulaSimbolica}
                sustituida={calculo.data.formulaSustituida}
              />

              <GraficaCrecimiento
                serie={calculo.data.serie}
                vp={calculo.data.vp}
                vf={calculo.data.vf}
                n={Math.abs(calculo.data.n)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
