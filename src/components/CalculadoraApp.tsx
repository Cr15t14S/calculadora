import { useState } from 'react';
import {
  ArrowLeftRight,
  CalendarRange,
  Check,
  Percent,
  Scale,
  Table2,
} from 'lucide-react';
import { AmortizacionTab } from './modulos/AmortizacionTab';
import { AnualidadesTab } from './modulos/AnualidadesTab';
import { ConversionTasasTab, type DestinoTasa } from './modulos/ConversionTasasTab';
import { EcuacionesValorTab } from './modulos/EcuacionesValorTab';
import { InteresCompuestoTab } from './modulos/InteresCompuestoTab';

type TabId = 'interes' | 'tasas' | 'ecuaciones' | 'amortizacion' | 'anualidades';

interface TransferenciaTasa {
  valorPct: string;
  token: number;
}

const PESTAÑAS: Array<{
  id: TabId;
  numero: string;
  titulo: string;
  corto: string;
  Icon: typeof Percent;
}> = [
  { id: 'interes', numero: '01', titulo: 'Interés compuesto', corto: 'Interés', Icon: Percent },
  { id: 'tasas', numero: '02', titulo: 'Conversión de tasas', corto: 'Tasas', Icon: ArrowLeftRight },
  { id: 'ecuaciones', numero: '03', titulo: 'Ecuaciones de valor', corto: 'Fecha focal', Icon: Scale },
  { id: 'amortizacion', numero: '04', titulo: 'Amortización y cuenta', corto: 'Amortización', Icon: Table2 },
  { id: 'anualidades', numero: '05', titulo: 'Anualidades', corto: 'Anualidades', Icon: CalendarRange },
];

export function CalculadoraApp() {
  const [activa, setActiva] = useState<TabId>('interes');
  const [tasaInteres, setTasaInteres] = useState<TransferenciaTasa | null>(null);
  const [tasaEcuaciones, setTasaEcuaciones] = useState<TransferenciaTasa | null>(null);
  const [tasaAmortizacion, setTasaAmortizacion] = useState<TransferenciaTasa | null>(null);
  const [tasaAnualidades, setTasaAnualidades] = useState<TransferenciaTasa | null>(null);
  const [avisoTasa, setAvisoTasa] = useState<string | null>(null);

  const handleEnviarTasa = (destino: DestinoTasa, tasaPorcentaje: string, etiqueta: string) => {
    const payload: TransferenciaTasa = { valorPct: tasaPorcentaje, token: Date.now() };
    if (destino === 'interes') setTasaInteres(payload);
    if (destino === 'ecuaciones') setTasaEcuaciones(payload);
    if (destino === 'amortizacion') setTasaAmortizacion(payload);
    if (destino === 'anualidades') setTasaAnualidades(payload);
    setActiva(destino);
    setAvisoTasa(`Tasa ${etiqueta} aplicada automáticamente.`);
    window.setTimeout(() => setAvisoTasa(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      {/* Cabecera editorial sobria */}
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4 py-5">
            <div>
              <div className="font-mono-num text-[11px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Ingeniería Económica · Instrumento de Simulación
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
                Calculadora Financiera
              </h1>
            </div>

            <div className="max-w-md text-xs leading-relaxed text-[var(--ink-muted)] sm:text-right">
              Las tasas se escriben en porcentaje (<span className="font-mono-num text-[var(--ink)]">2</span> = 2 %).
              Admite coma o punto decimal y miles (<span className="font-mono-num text-[var(--ink)]">1.500.000</span>).
            </div>
          </div>

          {/* Barra de pestañas arquitectónica */}
          <nav
            aria-label="Módulos financieros"
            className="-mb-px flex overflow-x-auto border-t border-[var(--line)]"
          >
            {PESTAÑAS.map(({ id, numero, titulo, corto, Icon }) => {
              const isActive = activa === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiva(id)}
                  className={`group relative flex shrink-0 cursor-pointer items-center gap-2.5 border-b-2 px-4 py-3.5 text-left text-xs font-semibold transition-colors sm:px-5 sm:text-sm ${
                    isActive
                      ? 'border-[var(--emerald)] bg-[var(--paper)]/70 text-[var(--ink)]'
                      : 'border-transparent text-[var(--ink-muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span
                    className={`font-mono-num text-[11px] ${
                      isActive ? 'font-bold text-[var(--emerald)]' : 'text-[var(--ink-faint)]'
                    }`}
                  >
                    {numero}
                  </span>
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-[var(--emerald)]' : 'text-[var(--ink-faint)] group-hover:text-[var(--ink-muted)]'
                    }`}
                  />
                  <span className="hidden sm:inline">{titulo}</span>
                  <span className="sm:hidden">{corto}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Banner de transferencia de tasa */}
      {avisoTasa && (
        <div className="border-b border-[var(--emerald)] bg-[var(--emerald-soft)]">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--emerald)] sm:px-6 lg:px-8">
            <Check className="h-4 w-4" />
            {avisoTasa}
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {activa === 'interes' && <InteresCompuestoTab tasaTransferida={tasaInteres} />}
        {activa === 'tasas' && <ConversionTasasTab onEnviarTasa={handleEnviarTasa} />}
        {activa === 'ecuaciones' && <EcuacionesValorTab tasaTransferida={tasaEcuaciones} />}
        {activa === 'amortizacion' && <AmortizacionTab tasaTransferida={tasaAmortizacion} />}
        {activa === 'anualidades' && <AnualidadesTab tasaTransferida={tasaAnualidades} />}
      </main>

      {/* Pie discreto */}
      <footer className="mt-10 border-t border-[var(--line)] bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] text-[var(--ink-faint)] sm:px-6 lg:px-8">
          <span>Calculadora Financiera · Ingeniería Económica</span>
          <span className="font-mono-num">
            Cálculos en doble precisión IEEE-754 · Exportación CSV (ES) y XLSX
          </span>
        </div>
      </footer>
    </div>
  );
}
