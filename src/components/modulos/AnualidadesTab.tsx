import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  ErrorFinanciero,
  FRECUENCIAS_TASA,
  fmtDinero,
  fmtDineroCorto,
  fmtPct,
  parsearEnteroPositivo,
  parsearNumero,
  parsearTasa,
  resolverAnualidad,
  type ObjetivoAnualidad,
  type ResultadoAnualidad,
  type TipoAnualidad,
} from '../../lib/finanzas';
import { FieldInput } from '../ui/FieldInput';
import { FormulaBar } from '../ui/FormulaBar';
import { KpiTile } from '../ui/KpiTile';

interface Props {
  tasaTransferida?: { valorPct: string; token: number } | null;
}

function DiagramaAnualidad({ res }: { res: ResultadoAnualidad }) {
  const W = 640;
  const H = 200;
  const padX = 44;
  const axisY = 122;

  const periodos = res.periodosPago;
  const maxP = Math.max(res.gracia + res.n, ...periodos, 1);
  const xOf = (p: number) => padX + (p / maxP) * (W - padX * 2);

  // Si hay muchos pagos, mostramos una muestra visual con puntos suspensivos en el centro
  const mostrarTodos = periodos.length <= 16;
  const mostrados = mostrarTodos
    ? periodos
    : [...periodos.slice(0, 6), ...periodos.slice(-5)];

  return (
    <div className="border border-[var(--line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <div>
          <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
            Esquema temporal de la anualidad ({res.n} pagos)
          </h3>
          <p className="text-[11px] text-[var(--ink-faint)]">
            {res.tipo === 'anticipada'
              ? 'Pagos al inicio de cada periodo (t = 0 hasta n - 1)'
              : res.tipo === 'diferida'
                ? `${res.gracia} periodos de gracia · primer pago en t = ${res.gracia + 1}`
                : 'Pagos al final de cada periodo (t = 1 hasta n)'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--ink-muted)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 bg-[var(--emerald)]" /> Cuotas R
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 bg-[var(--cobalt)]" /> VP / VF
          </span>
        </div>
      </div>

      <div className="chart-grid-bg overflow-x-auto p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto min-w-[500px] w-full select-none">
          {/* Zona sombreada de gracia si es diferida */}
          {res.tipo === 'diferida' && res.gracia > 0 && (
            <g>
              <rect
                x={xOf(0)}
                y={30}
                width={xOf(res.gracia) - xOf(0)}
                height={axisY - 30}
                fill="#b45309"
                fillOpacity="0.12"
                className="svg-smooth"
              />
              <text
                x={(xOf(0) + xOf(res.gracia)) / 2}
                y={46}
                textAnchor="middle"
                className="fill-[#b45309] font-mono-num text-[10px] font-semibold"
              >
                Gracia ({res.gracia})
              </text>
            </g>
          )}

          {/* Eje temporal */}
          <line x1={padX - 10} x2={W - padX + 10} y1={axisY} y2={axisY} stroke="#171614" strokeWidth="2" />

          {/* Flecha de VP en t=0 */}
          <g className="svg-smooth">
            <line x1={xOf(0)} x2={xOf(0)} y1={axisY} y2={axisY - 66} stroke="#1d4ed8" strokeWidth="2.8" />
            <polygon points={`${xOf(0)},${axisY - 73} ${xOf(0) - 5},${axisY - 64} ${xOf(0) + 5},${axisY - 64}`} fill="#1d4ed8" />
            <text x={xOf(0)} y={axisY - 78} textAnchor="middle" className="fill-[#1d4ed8] font-mono-num text-[10px] font-bold">
              VP {fmtDineroCorto(res.vp)}
            </text>
          </g>

          {/* Flecha de VF en t=maxP */}
          <g className="svg-smooth">
            <line x1={xOf(maxP)} x2={xOf(maxP)} y1={axisY} y2={axisY - 66} stroke="#b45309" strokeWidth="2.4" strokeDasharray="4 2" />
            <polygon points={`${xOf(maxP)},${axisY - 73} ${xOf(maxP) - 5},${axisY - 64} ${xOf(maxP) + 5},${axisY - 64}`} fill="#b45309" />
            <text x={xOf(maxP)} y={axisY - 78} textAnchor="middle" className="fill-[#b45309] font-mono-num text-[10px] font-bold">
              VF {fmtDineroCorto(res.vf)}
            </text>
          </g>

          {/* Flechas de pagos R hacia abajo */}
          {mostrados.map((p, idx) => {
            const x = xOf(p);
            return (
              <g key={`${p}-${idx}`} className="svg-smooth">
                <line x1={x} x2={x} y1={axisY} y2={axisY + 42} stroke="#0d5c46" strokeWidth="2.2" />
                <polygon points={`${x},${axisY + 48} ${x - 4},${axisY + 40} ${x + 4},${axisY + 40}`} fill="#0d5c46" />
                <text x={x} y={axisY + 61} textAnchor="middle" className="fill-[#5c584f] font-mono-num text-[9px]">
                  {p}
                </text>
              </g>
            );
          })}

          {!mostrarTodos && (
            <text
              x={W / 2}
              y={axisY + 26}
              textAnchor="middle"
              className="fill-[#0d5c46] font-mono-num text-sm font-bold"
            >
              ··· ({res.n} pagos de {fmtDineroCorto(res.r)}) ···
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

export function AnualidadesTab({ tasaTransferida }: Props) {
  const [tipo, setTipo] = useState<TipoAnualidad>('vencida');
  const [objetivo, setObjetivo] = useState<ObjetivoAnualidad>('R_desde_VP');
  const [montoStr, setMontoStr] = useState('1.000.000');
  const [iStr, setIStr] = useState('10');
  const [nStr, setNStr] = useState('4');
  const [graciaStr, setGraciaStr] = useState('3');
  const [mTasa, setMTasa] = useState('12');
  const [mPago, setMPago] = useState('4');
  const [genAnt, setGenAnt] = useState(false);

  useEffect(() => {
    if (tasaTransferida) {
      setIStr(tasaTransferida.valorPct);
    }
  }, [tasaTransferida]);

  const calculo = useMemo(() => {
    try {
      const monto = parsearNumero(montoStr, 'Monto', { esMonto: true });
      const i = parsearTasa(iStr, 'Tasa periódica i');
      const n = parsearEnteroPositivo(nStr, 'Número de pagos n');
      const gracia = tipo === 'diferida' ? Math.max(0, Math.round(parsearNumero(graciaStr, 'Periodos de gracia'))) : 0;
      const mt = tipo === 'general' ? parsearNumero(mTasa, 'Frecuencia tasa') : undefined;
      const mp = tipo === 'general' ? parsearNumero(mPago, 'Frecuencia pago') : undefined;

      const data = resolverAnualidad({
        tipo,
        objetivo,
        monto,
        i,
        n,
        gracia,
        mTasa: mt,
        mPago: mp,
        generalAnticipada: genAnt,
      });
      return { ok: true as const, data };
    } catch (e) {
      return { ok: false as const, error: e instanceof ErrorFinanciero ? e.message : 'Revise los datos ingresados.' };
    }
  }, [tipo, objetivo, montoStr, iStr, nStr, graciaStr, mTasa, mPago, genAnt]);

  const etiquetaMonto =
    objetivo === 'VP' || objetivo === 'VF'
      ? 'Valor de la cuota periódica (R)'
      : objetivo === 'R_desde_VP'
        ? 'Valor Presente (VP)'
        : 'Valor Futuro deseado (VF)';

  return (
    <div className="animate-panel space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-[0.12em] text-[var(--emerald)]">
            Módulo 05 · Series Uniformes (Apoyo del Curso)
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
            Anualidades: vencida, anticipada, diferida y general
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ink-faint)]">
            <Sparkles className="h-3.5 w-3.5" /> Casos Excel:
          </span>
          <button
            type="button"
            onClick={() => {
              setTipo('anticipada');
              setObjetivo('VF');
              setMontoStr('1.000.000');
              setIStr('2');
              setNStr('12');
            }}
            className="cursor-pointer border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            Anticipada (Hoja2)
          </button>
          <button
            type="button"
            onClick={() => {
              setTipo('diferida');
              setObjetivo('R_desde_VP');
              setMontoStr('8.000.000');
              setIStr('9');
              setNStr('20');
              setGraciaStr('3');
            }}
            className="cursor-pointer border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            Diferida (Hoja5)
          </button>
          <button
            type="button"
            onClick={() => {
              setTipo('general');
              setObjetivo('VF');
              setMontoStr('250.000');
              setIStr('2');
              setNStr('30');
              setMTasa('12');
              setMPago('4');
              setGenAnt(false);
            }}
            className="cursor-pointer border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            General (Hoja6)
          </button>
        </div>
      </div>

      {/* Selector de tipo de anualidad */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { id: 'vencida' as TipoAnualidad, titulo: 'Ordinaria / Vencida', desc: 'Pagos al final de cada periodo' },
          { id: 'anticipada' as TipoAnualidad, titulo: 'Anticipada', desc: 'Pagos al inicio (arriendos, seguros)' },
          { id: 'diferida' as TipoAnualidad, titulo: 'Diferida', desc: 'Con k periodos de gracia inicial' },
          { id: 'general' as TipoAnualidad, titulo: 'General', desc: 'Tasa y pagos con distinta frecuencia' },
        ].map((item) => {
          const active = tipo === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTipo(item.id)}
              className={`cursor-pointer border p-3 text-left transition-colors ${
                active
                  ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                  : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--ink)]'
              }`}
            >
              <span className="block text-sm font-semibold">{item.titulo}</span>
              <span className={`mt-0.5 block text-[11px] ${active ? 'text-white/75' : 'text-[var(--ink-faint)]'}`}>
                {item.desc}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Entradas */}
        <div className="space-y-4 border border-[var(--line)] bg-white p-5 lg:col-span-5">
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              ¿Qué desea hallar?
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'VP' as ObjetivoAnualidad, l: 'Valor Presente (VP)' },
                { id: 'VF' as ObjetivoAnualidad, l: 'Valor Futuro (VF)' },
                { id: 'R_desde_VP' as ObjetivoAnualidad, l: 'Cuota R (desde VP)' },
                { id: 'R_desde_VF' as ObjetivoAnualidad, l: 'Cuota R (desde VF)' },
              ].map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setObjetivo(op.id)}
                  className={`cursor-pointer border px-2.5 py-2 text-xs font-semibold transition-colors ${
                    objetivo === op.id
                      ? 'border-[var(--emerald)] bg-[var(--emerald)] text-white'
                      : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)] hover:border-[var(--ink)]'
                  }`}
                >
                  {op.l}
                </button>
              ))}
            </div>
          </div>

          <FieldInput id="an-monto" label={etiquetaMonto} prefix="$" value={montoStr} onChange={setMontoStr} />

          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              id="an-i"
              label={tipo === 'general' ? 'Tasa periódica dada' : 'Tasa periódica i'}
              suffix="%"
              value={iStr}
              onChange={setIStr}
            />
            <FieldInput id="an-n" label="Número de pagos (n)" value={nStr} onChange={setNStr} />
          </div>

          {tipo === 'diferida' && (
            <FieldInput
              id="an-gracia"
              label="Periodos de gracia (k)"
              suffix="per."
              value={graciaStr}
              onChange={setGraciaStr}
              helper="Ej.: si empieza a pagar en el periodo 4, hay k = 3 periodos de gracia."
            />
          )}

          {tipo === 'general' && (
            <div className="space-y-3 border-t border-[var(--line)] pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Frecuencia de la tasa
                  </label>
                  <select
                    value={mTasa}
                    onChange={(e) => setMTasa(e.target.value)}
                    className="w-full border border-[var(--line-strong)] bg-white px-2.5 py-2 text-xs outline-none focus:border-[var(--ink)]"
                  >
                    {FRECUENCIAS_TASA.map((f) => (
                      <option key={f.id} value={f.m}>
                        {f.label} ({f.m}/año)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Frecuencia de pagos
                  </label>
                  <select
                    value={mPago}
                    onChange={(e) => setMPago(e.target.value)}
                    className="w-full border border-[var(--line-strong)] bg-white px-2.5 py-2 text-xs outline-none focus:border-[var(--ink)]"
                  >
                    {FRECUENCIAS_TASA.map((f) => (
                      <option key={f.id} value={f.m}>
                        {f.label} ({f.m}/año)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--ink-muted)]">
                <input
                  type="checkbox"
                  checked={genAnt}
                  onChange={(e) => setGenAnt(e.target.checked)}
                  className="h-4 w-4 accent-[var(--emerald)]"
                />
                Los pagos de esta anualidad general son anticipados
              </label>
            </div>
          )}
        </div>

        {/* Resultados + Esquema temporal */}
        <div className="space-y-4 lg:col-span-7">
          {!calculo.ok ? (
            <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] p-5 text-sm text-[var(--crimson)]">
              {calculo.error}
            </div>
          ) : (
            <>
              {calculo.data.notaConversion && (
                <div className="border border-[var(--cobalt)] bg-[var(--cobalt-soft)] px-4 py-2.5 font-mono-num text-xs text-[var(--cobalt)]">
                  {calculo.data.notaConversion}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile
                  label={
                    objetivo === 'VP'
                      ? 'Valor Presente (VP)'
                      : objetivo === 'VF'
                        ? 'Valor Futuro (VF)'
                        : 'Cuota periódica (R)'
                  }
                  value={calculo.data.valor}
                  formatter={fmtDinero}
                  caption={`Tasa efectiva pago: ${fmtPct(calculo.data.iEfectivaPago, 4)}`}
                  tone="emerald"
                  large
                />
                <KpiTile
                  label="Suma nominal de pagos"
                  value={calculo.data.totalPagos}
                  formatter={fmtDinero}
                  caption={`${calculo.data.n} × ${fmtDinero(calculo.data.r)}`}
                  tone="default"
                />
                <KpiTile
                  label="Intereses implícitos"
                  value={calculo.data.interesesImplicito}
                  formatter={fmtDinero}
                  tone="ochre"
                />
              </div>

              <FormulaBar
                simbolica={calculo.data.formulaSimbolica}
                sustituida={calculo.data.formulaSustituida}
              />

              <DiagramaAnualidad res={calculo.data} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
