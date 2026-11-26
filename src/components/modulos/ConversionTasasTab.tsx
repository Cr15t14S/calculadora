import { useMemo, useState } from 'react';
import { ArrowRight, Eraser, Send } from 'lucide-react';
import {
  ErrorFinanciero,
  FRECUENCIAS_TASA,
  anticipadaAVencida,
  fmtNum,
  fmtPct,
  nominalAPeriodica,
  parsearNumero,
  parsearTasa,
  tablaEquivalenciasDesdeEA,
  tasaEquivalente,
  vencidaAAnticipada,
} from '../../lib/finanzas';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { ExpandButton, ExpandableModal } from '../ui/ExpandableModal';
import { FieldInput } from '../ui/FieldInput';
import { FormulaBar } from '../ui/FormulaBar';
import { KpiTile } from '../ui/KpiTile';

export type DestinoTasa = 'interes' | 'ecuaciones' | 'amortizacion' | 'anualidades';

interface Props {
  onEnviarTasa: (destino: DestinoTasa, tasaPorcentaje: string, etiqueta: string) => void;
}

type SubModo = 'nominal' | 'equivalencia' | 'ant_venc';

export function ConversionTasasTab({ onEnviarTasa }: Props) {
  const [modo, setModo] = useState<SubModo>('nominal');
  const [mapaAmpliado, setMapaAmpliado] = useState(false);

  const [nomJ, setNomJ] = useState('');
  const [nomM, setNomM] = useState('');
  const [nomAnt, setNomAnt] = useState(false);

  const [eqI, setEqI] = useState('');
  const [eqNc, setEqNc] = useState('');
  const [eqNb, setEqNb] = useState('');

  const [avTasa, setAvTasa] = useState('');
  const [avDir, setAvDir] = useState<'a2v' | 'v2a'>('a2v');
  const [avM, setAvM] = useState('');

  const resNominal = useMemo(() => {
    if (!nomJ.trim() || !nomM.trim()) return { estado: 'vacio' as const };
    try {
      const j = parsearTasa(nomJ, 'Tasa nominal j');
      const m = parsearNumero(nomM, 'Capitalizaciones m');
      return { estado: 'ok' as const, data: nominalAPeriodica(j, m, nomAnt) };
    } catch (e) {
      return {
        estado: 'error' as const,
        error: e instanceof ErrorFinanciero ? e.message : 'Dato inválido.',
      };
    }
  }, [nomJ, nomM, nomAnt]);

  const resEquiv = useMemo(() => {
    if (!eqI.trim() || !eqNc.trim() || !eqNb.trim()) return { estado: 'vacio' as const };
    try {
      const i = parsearTasa(eqI, 'Tasa conocida');
      const nc = parsearNumero(eqNc, 'Periodos/año conocida');
      const nb = parsearNumero(eqNb, 'Periodos/año buscada');
      const buscada = tasaEquivalente(i, nc, nb);
      const ea = tasaEquivalente(i, nc, 1);
      return {
        estado: 'ok' as const,
        data: { i, nc, nb, buscada, nominalEquiv: buscada * nb, ea },
      };
    } catch (e) {
      return {
        estado: 'error' as const,
        error: e instanceof ErrorFinanciero ? e.message : 'Dato inválido.',
      };
    }
  }, [eqI, eqNc, eqNb]);

  const resAV = useMemo(() => {
    if (!avTasa.trim()) return { estado: 'vacio' as const };
    try {
      const t = parsearTasa(avTasa, 'Tasa periódica');
      const resultado = avDir === 'a2v' ? anticipadaAVencida(t) : vencidaAAnticipada(t);
      const iv = avDir === 'a2v' ? resultado : t;
      let m: number | null = null;
      let ea: number | null = null;
      if (avM.trim()) {
        m = parsearNumero(avM, 'Periodos/año');
        ea = tasaEquivalente(iv, m, 1);
      }
      return { estado: 'ok' as const, data: { t, m, resultado, iv, ea } };
    } catch (e) {
      return {
        estado: 'error' as const,
        error: e instanceof ErrorFinanciero ? e.message : 'Dato inválido.',
      };
    }
  }, [avTasa, avDir, avM]);

  const eaActiva =
    modo === 'nominal' && resNominal.estado === 'ok'
      ? resNominal.data.ea
      : modo === 'equivalencia' && resEquiv.estado === 'ok'
        ? resEquiv.data.ea
        : modo === 'ant_venc' && resAV.estado === 'ok'
          ? resAV.data.ea
          : null;

  const tasaParaEnviar = useMemo(() => {
    if (modo === 'nominal' && resNominal.estado === 'ok') {
      return {
        pct: (resNominal.data.iv * 100).toFixed(6).replace('.', ','),
        etiqueta: `${fmtPct(resNominal.data.iv, 4)} vencida`,
      };
    }
    if (modo === 'equivalencia' && resEquiv.estado === 'ok') {
      return {
        pct: (resEquiv.data.buscada * 100).toFixed(6).replace('.', ','),
        etiqueta: `${fmtPct(resEquiv.data.buscada, 4)} equivalente`,
      };
    }
    if (modo === 'ant_venc' && resAV.estado === 'ok') {
      return {
        pct: (resAV.data.iv * 100).toFixed(6).replace('.', ','),
        etiqueta: `${fmtPct(resAV.data.iv, 4)} vencida`,
      };
    }
    return null;
  }, [modo, resNominal, resEquiv, resAV]);

  const escalera = useMemo(() => {
    if (eaActiva === null) return [];
    try {
      return tablaEquivalenciasDesdeEA(eaActiva);
    } catch {
      return [];
    }
  }, [eaActiva]);

  const maxNominalBar = useMemo(() => {
    if (escalera.length === 0) return 0.3;
    return Math.max(
      ...escalera.map((f) => Math.max(f.nominalVencida, f.periodicaVencida)),
      eaActiva ?? 0,
      0.01
    );
  }, [escalera, eaActiva]);

  const limpiarModo = () => {
    if (modo === 'nominal') {
      setNomJ('');
      setNomM('');
      setNomAnt(false);
    } else if (modo === 'equivalencia') {
      setEqI('');
      setEqNc('');
      setEqNb('');
    } else {
      setAvTasa('');
      setAvM('');
    }
  };

  const renderMapaBarras = () => (
    <div className="space-y-3">
      {escalera.map((fila) => {
        const pctNom = Math.max(0, Math.min(100, (fila.nominalVencida / maxNominalBar) * 100));
        const pctPer = Math.max(0, Math.min(100, (fila.periodicaVencida / maxNominalBar) * 100));
        return (
          <div key={fila.m} className="grid grid-cols-12 items-center gap-2 text-xs">
            <div className="col-span-3 sm:col-span-2">
              <span className="font-semibold text-[var(--ink)]">{fila.label}</span>
              <span className="ml-1 font-mono-num text-[10px] text-[var(--ink-faint)]">
                ({fila.sigla})
              </span>
            </div>
            <div className="col-span-5 space-y-1 sm:col-span-6">
              <div className="h-2.5 w-full bg-[var(--paper-alt)]">
                <div
                  className="h-full bg-[var(--emerald)] transition-all duration-500 ease-out"
                  style={{ width: `${pctNom}%` }}
                />
              </div>
              <div className="h-2 w-full bg-[var(--paper-alt)]">
                <div
                  className="h-full bg-[var(--ochre)] transition-all duration-500 ease-out"
                  style={{ width: `${pctPer}%` }}
                />
              </div>
            </div>
            <div className="col-span-4 text-right font-mono-num text-[11px] leading-tight">
              <div className="font-semibold text-[var(--emerald)]">
                {fmtPct(fila.nominalVencida, 3)}{' '}
                <span className="text-[10px] font-normal text-[var(--ink-faint)]">nom</span>
              </div>
              <div className="text-[var(--ochre)]">
                {fmtPct(fila.periodicaVencida, 4)}{' '}
                <span className="text-[10px] text-[var(--ink-faint)]">per</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="animate-panel space-y-6">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="font-mono-num text-[11px] uppercase tracking-[0.12em] text-[var(--emerald)]">
          Módulo 02 · Equivalencias Financieras
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Conversión de tasas de interés
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          {
            id: 'nominal' as SubModo,
            num: 'A',
            titulo: 'Nominal → Periódica → EA',
            desc: 'j / m y capitalización anual (vencida o anticipada)',
          },
          {
            id: 'equivalencia' as SubModo,
            num: 'B',
            titulo: 'Equivalencia entre tasas',
            desc: 'De una periodicidad efectiva a otra (ej. EA → EM)',
          },
          {
            id: 'ant_venc' as SubModo,
            num: 'C',
            titulo: 'Anticipada ↔ Vencida',
            desc: 'Conversión directa para el mismo periodo',
          },
        ].map((item) => {
          const active = modo === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setModo(item.id)}
              className={`cursor-pointer border p-3.5 text-left transition-colors ${
                active
                  ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                  : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--ink)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center font-mono-num text-xs font-semibold ${
                    active ? 'bg-[var(--emerald)] text-white' : 'bg-[var(--paper-alt)] text-[var(--ink)]'
                  }`}
                >
                  {item.num}
                </span>
                <span className="text-sm font-semibold">{item.titulo}</span>
              </div>
              <p className={`mt-1 text-xs ${active ? 'text-white/75' : 'text-[var(--ink-faint)]'}`}>
                {item.desc}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          {modo === 'nominal' && (
            <div className="space-y-4 border border-[var(--line)] bg-white p-5">
              <FieldInput
                id="tn-j"
                label="Tasa nominal anual (j)"
                kind="decimal"
                suffix="%"
                value={nomJ}
                onChange={setNomJ}
                placeholder="Ej. 24"
              />
              <FieldInput
                id="tn-m"
                label="Capitalizaciones por año (m)"
                kind="entero"
                suffix="/año"
                value={nomM}
                onChange={setNomM}
                placeholder="Ej. 12"
              />
              <div className="flex flex-wrap gap-1.5">
                {FRECUENCIAS_TASA.filter((f) => [12, 4, 2, 6, 360].includes(f.m)).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setNomM(String(f.m))}
                    className={`cursor-pointer border px-2 py-1 font-mono-num text-[11px] transition-colors ${
                      nomM === String(f.m)
                        ? 'border-[var(--emerald)] bg-[var(--emerald-soft)] font-semibold text-[var(--emerald)]'
                        : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)] hover:border-[var(--ink)]'
                    }`}
                  >
                    {f.corto} ({f.m})
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-xs font-medium text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={nomAnt}
                  onChange={(e) => setNomAnt(e.target.checked)}
                  className="h-4 w-4 accent-[var(--emerald)]"
                />
                La tasa nominal es ANTICIPADA (ej. NMA / NTA)
              </label>
              <div className="flex justify-end border-t border-[var(--line)] pt-2">
                <button
                  type="button"
                  onClick={limpiarModo}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                >
                  <Eraser className="h-3.5 w-3.5" /> Limpiar
                </button>
              </div>
            </div>
          )}

          {modo === 'equivalencia' && (
            <div className="space-y-4 border border-[var(--line)] bg-white p-5">
              <FieldInput
                id="te-i"
                label="Tasa efectiva / periódica conocida"
                kind="decimal"
                suffix="%"
                value={eqI}
                onChange={setEqI}
                placeholder="Ej. 24,96"
              />
              <div className="grid grid-cols-2 gap-3">
                <FieldInput
                  id="te-nc"
                  label="Periodos/año conocida"
                  kind="entero"
                  value={eqNc}
                  onChange={setEqNc}
                  placeholder="Ej. 1"
                />
                <FieldInput
                  id="te-nb"
                  label="Periodos/año buscada"
                  kind="entero"
                  value={eqNb}
                  onChange={setEqNb}
                  placeholder="Ej. 12"
                />
              </div>
              <div className="space-y-1.5 border-t border-[var(--line)] pt-3">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  Frecuencias comunes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { l: 'EA → EM', c: '1', b: '12' },
                    { l: 'EM → EA', c: '12', b: '1' },
                    { l: 'EM → ET', c: '12', b: '4' },
                    { l: 'ET → EM', c: '4', b: '12' },
                    { l: 'EA → ET', c: '1', b: '4' },
                    { l: 'EA → ED (360)', c: '1', b: '360' },
                  ].map((at) => (
                    <button
                      key={at.l}
                      type="button"
                      onClick={() => {
                        setEqNc(at.c);
                        setEqNb(at.b);
                      }}
                      className="cursor-pointer border border-[var(--line)] bg-[var(--paper)] px-2 py-1 font-mono-num text-[11px] text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                    >
                      {at.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end border-t border-[var(--line)] pt-2">
                <button
                  type="button"
                  onClick={limpiarModo}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                >
                  <Eraser className="h-3.5 w-3.5" /> Limpiar
                </button>
              </div>
            </div>
          )}

          {modo === 'ant_venc' && (
            <div className="space-y-4 border border-[var(--line)] bg-white p-5">
              <FieldInput
                id="tav-t"
                label="Tasa periódica"
                kind="decimal"
                suffix="%"
                value={avTasa}
                onChange={setAvTasa}
                placeholder="Ej. 2"
              />
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setAvDir('a2v')}
                  className={`cursor-pointer border px-3 py-2.5 text-left text-xs transition-colors ${
                    avDir === 'a2v'
                      ? 'border-[var(--emerald)] bg-[var(--emerald-soft)] font-semibold text-[var(--emerald)]'
                      : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]'
                  }`}
                >
                  Anticipada → Vencida <span className="ml-2 font-mono-num">iv = ia / (1 - ia)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAvDir('v2a')}
                  className={`cursor-pointer border px-3 py-2.5 text-left text-xs transition-colors ${
                    avDir === 'v2a'
                      ? 'border-[var(--emerald)] bg-[var(--emerald-soft)] font-semibold text-[var(--emerald)]'
                      : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]'
                  }`}
                >
                  Vencida → Anticipada <span className="ml-2 font-mono-num">ia = iv / (1 + iv)</span>
                </button>
              </div>
              <FieldInput
                id="tav-m"
                label="Periodos por año (opcional, para ver EA)"
                kind="entero"
                value={avM}
                onChange={setAvM}
                placeholder="Ej. 12"
                helper="Si lo llena, proyecta la Efectiva Anual y el mapa comparativo."
              />
              <div className="flex justify-end border-t border-[var(--line)] pt-2">
                <button
                  type="button"
                  onClick={limpiarModo}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                >
                  <Eraser className="h-3.5 w-3.5" /> Limpiar
                </button>
              </div>
            </div>
          )}

          {tasaParaEnviar && (
            <div className="border border-[var(--line)] bg-[var(--paper-alt)] p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                <Send className="h-3.5 w-3.5 text-[var(--emerald)]" />
                Usar {tasaParaEnviar.etiqueta} en otro módulo
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                {[
                  { id: 'amortizacion' as DestinoTasa, label: 'Amortización' },
                  { id: 'ecuaciones' as DestinoTasa, label: 'Ecuaciones de valor' },
                  { id: 'interes' as DestinoTasa, label: 'Interés compuesto' },
                  { id: 'anualidades' as DestinoTasa, label: 'Anualidades' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onEnviarTasa(d.id, tasaParaEnviar.pct, tasaParaEnviar.etiqueta)}
                    className="cursor-pointer border border-[var(--line-strong)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--emerald)] hover:bg-[var(--emerald)] hover:text-white"
                  >
                    → {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-7">
          {modo === 'nominal' &&
            (resNominal.estado === 'vacio' ? (
              <div className="chart-grid-bg flex min-h-[300px] flex-col items-center justify-center border border-[var(--line)] p-8 text-center">
                <p className="font-editorial text-lg font-semibold text-[var(--ink)]">
                  Ingrese la tasa nominal y su frecuencia
                </p>
                <p className="mt-1.5 max-w-sm text-xs text-[var(--ink-muted)]">
                  Escriba j (%) y el número de capitalizaciones m por año para ver la ruta paso a
                  paso y el mapa comparativo de tasas equivalentes.
                </p>
              </div>
            ) : resNominal.estado === 'error' ? (
              <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] p-4 text-sm text-[var(--crimson)]">
                {resNominal.error}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <KpiTile
                    label={resNominal.data.anticipada ? 'Periódica anticipada (ia)' : 'Tasa periódica (i)'}
                    value={resNominal.data.ip}
                    formatter={(v) => fmtPct(v, 4)}
                    caption={`j / ${fmtNum(resNominal.data.m, 0)}`}
                    tone="default"
                  />
                  <KpiTile
                    label="Periódica vencida (iv)"
                    value={resNominal.data.iv}
                    formatter={(v) => fmtPct(v, 4)}
                    caption={resNominal.data.anticipada ? 'ia / (1 - ia)' : 'Igual a i periódica'}
                    tone="cobalt"
                  />
                  <KpiTile
                    label="Efectiva Anual (EA)"
                    value={resNominal.data.ea}
                    formatter={(v) => fmtPct(v, 4)}
                    caption={`Nominal vencida: ${fmtPct(resNominal.data.nominalVencida, 4)}`}
                    tone="emerald"
                    large
                  />
                </div>

                <div className="border border-[var(--line)] bg-white p-4">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Ruta de conversión paso a paso
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[115px] flex-1 border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                      <span className="block text-[10px] uppercase text-[var(--ink-faint)]">Nominal j</span>
                      <AnimatedNumber
                        value={resNominal.data.j}
                        formatter={(v) => fmtPct(v, 2)}
                        className="text-sm font-semibold"
                      />
                    </div>
                    <div className="flex flex-col items-center font-mono-num text-[10px] text-[var(--ink-faint)]">
                      <span>÷ {fmtNum(resNominal.data.m, 0)}</span>
                      <ArrowRight className="h-4 w-4 text-[var(--ink-muted)]" />
                    </div>
                    <div className="min-w-[115px] flex-1 border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                      <span className="block text-[10px] uppercase text-[var(--ink-faint)]">
                        {resNominal.data.anticipada ? 'Anticipada ia' : 'Periódica i'}
                      </span>
                      <AnimatedNumber
                        value={resNominal.data.ip}
                        formatter={(v) => fmtPct(v, 4)}
                        className="text-sm font-semibold"
                      />
                    </div>
                    {resNominal.data.anticipada && (
                      <>
                        <div className="flex flex-col items-center font-mono-num text-[10px] text-[var(--ochre)]">
                          <span>÷(1-ia)</span>
                          <ArrowRight className="h-4 w-4 text-[var(--ochre)]" />
                        </div>
                        <div className="min-w-[115px] flex-1 border border-[var(--cobalt)] bg-[var(--cobalt-soft)] px-3 py-2">
                          <span className="block text-[10px] uppercase text-[var(--cobalt)]">Vencida iv</span>
                          <AnimatedNumber
                            value={resNominal.data.iv}
                            formatter={(v) => fmtPct(v, 4)}
                            className="text-sm font-semibold text-[var(--cobalt)]"
                          />
                        </div>
                      </>
                    )}
                    <div className="flex flex-col items-center font-mono-num text-[10px] text-[var(--emerald)]">
                      <span>(1+iv)^{fmtNum(resNominal.data.m, 0)}-1</span>
                      <ArrowRight className="h-4 w-4 text-[var(--emerald)]" />
                    </div>
                    <div className="min-w-[125px] flex-1 border border-[var(--emerald)] bg-[var(--emerald-soft)] px-3 py-2">
                      <span className="block text-[10px] uppercase text-[var(--emerald)]">Efectiva EA</span>
                      <AnimatedNumber
                        value={resNominal.data.ea}
                        formatter={(v) => fmtPct(v, 4)}
                        className="text-sm font-semibold text-[var(--emerald)]"
                      />
                    </div>
                  </div>
                </div>
              </>
            ))}

          {modo === 'equivalencia' &&
            (resEquiv.estado === 'vacio' ? (
              <div className="chart-grid-bg flex min-h-[300px] flex-col items-center justify-center border border-[var(--line)] p-8 text-center">
                <p className="font-editorial text-lg font-semibold text-[var(--ink)]">
                  Ingrese la tasa conocida y las dos periodicidades
                </p>
                <p className="mt-1.5 max-w-sm text-xs text-[var(--ink-muted)]">
                  Indique la tasa efectiva (%) y cuántos periodos por año corresponden a la tasa
                  conocida y a la buscada.
                </p>
              </div>
            ) : resEquiv.estado === 'error' ? (
              <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] p-4 text-sm text-[var(--crimson)]">
                {resEquiv.error}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <KpiTile
                    label="Tasa equivalente buscada"
                    value={resEquiv.data.buscada}
                    formatter={(v) => fmtPct(v, 4)}
                    caption={`Decimal: ${fmtNum(resEquiv.data.buscada, 6)}`}
                    tone="emerald"
                    large
                  />
                  <KpiTile
                    label={`Nominal equivalente (×${fmtNum(resEquiv.data.nb, 0)})`}
                    value={resEquiv.data.nominalEquiv}
                    formatter={(v) => fmtPct(v, 4)}
                    tone="cobalt"
                  />
                  <KpiTile
                    label="Efectiva Anual (EA)"
                    value={resEquiv.data.ea}
                    formatter={(v) => fmtPct(v, 4)}
                    tone="default"
                  />
                </div>
                <FormulaBar
                  simbolica="i_buscada = (1 + i_conocida)^(n_conocida / n_buscada) - 1"
                  sustituida={`i = (1 + ${fmtNum(resEquiv.data.i, 6)})^(${fmtNum(resEquiv.data.nc, 2)} / ${fmtNum(resEquiv.data.nb, 2)}) - 1 = ${fmtPct(resEquiv.data.buscada, 4)}`}
                />
              </>
            ))}

          {modo === 'ant_venc' &&
            (resAV.estado === 'vacio' ? (
              <div className="chart-grid-bg flex min-h-[300px] flex-col items-center justify-center border border-[var(--line)] p-8 text-center">
                <p className="font-editorial text-lg font-semibold text-[var(--ink)]">
                  Ingrese la tasa periódica a convertir
                </p>
                <p className="mt-1.5 max-w-sm text-xs text-[var(--ink-muted)]">
                  Seleccione el sentido de conversión (anticipada ↔ vencida) y escriba el porcentaje.
                </p>
              </div>
            ) : resAV.estado === 'error' ? (
              <div className="border border-[var(--crimson)] bg-[var(--crimson-soft)] p-4 text-sm text-[var(--crimson)]">
                {resAV.error}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <KpiTile
                    label={avDir === 'a2v' ? 'Tasa periódica VENCIDA (iv)' : 'Tasa periódica ANTICIPADA (ia)'}
                    value={resAV.data.resultado}
                    formatter={(v) => fmtPct(v, 4)}
                    caption={`Decimal: ${fmtNum(resAV.data.resultado, 6)}`}
                    tone="emerald"
                    large
                  />
                  {resAV.data.ea !== null && resAV.data.m !== null ? (
                    <KpiTile
                      label="Efectiva Anual de referencia"
                      value={resAV.data.ea}
                      formatter={(v) => fmtPct(v, 4)}
                      caption={`Con m = ${fmtNum(resAV.data.m, 0)} periodos/año`}
                      tone="ochre"
                    />
                  ) : (
                    <div className="flex items-center border border-dashed border-[var(--line-strong)] bg-[var(--paper)] px-4 py-3 text-xs text-[var(--ink-faint)]">
                      Opcional: ingrese «Periodos por año» para proyectar la Efectiva Anual.
                    </div>
                  )}
                </div>
                <FormulaBar
                  simbolica={avDir === 'a2v' ? 'iv = ia / (1 - ia)' : 'ia = iv / (1 + iv)'}
                  sustituida={
                    avDir === 'a2v'
                      ? `iv = ${fmtNum(resAV.data.t, 6)} / (1 - ${fmtNum(resAV.data.t, 6)}) = ${fmtPct(resAV.data.resultado, 4)}`
                      : `ia = ${fmtNum(resAV.data.t, 6)} / (1 + ${fmtNum(resAV.data.t, 6)}) = ${fmtPct(resAV.data.resultado, 4)}`
                  }
                />
              </>
            ))}

          {escalera.length > 0 && eaActiva !== null && (
            <>
              <div className="border border-[var(--line)] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                  <div>
                    <h3 className="font-editorial text-sm font-semibold text-[var(--ink)]">
                      Mapa comparativo de tasas equivalentes (misma EA)
                    </h3>
                    <p className="text-[11px] text-[var(--ink-faint)]">
                      Todas estas tasas producen exactamente {fmtPct(eaActiva, 4)} Efectiva Anual
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink-muted)]">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 bg-[var(--emerald)]" /> Nominal anualizada
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 bg-[var(--ochre)]" /> Periódica vencida
                    </span>
                    <ExpandButton onClick={() => setMapaAmpliado(true)} />
                  </div>
                </div>
                {renderMapaBarras()}
              </div>

              <ExpandableModal
                open={mapaAmpliado}
                onClose={() => setMapaAmpliado(false)}
                title="Mapa comparativo de tasas equivalentes"
                subtitle={`Todas las frecuencias equivalentes a ${fmtPct(eaActiva, 4)} Efectiva Anual`}
                allowZoom={false}
              >
                <div className="border border-[var(--line)] bg-white p-6">{renderMapaBarras()}</div>
              </ExpandableModal>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
