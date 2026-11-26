import { useEffect, useState, type ReactNode } from 'react';
import { Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

interface ExpandableButtonProps {
  onClick: () => void;
  label?: string;
}

export function ExpandButton({ onClick, label = 'Ampliar' }: ExpandableButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Abrir en vista maximizada para inspeccionar en detalle"
      className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--line-strong)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-white"
    >
      <Maximize2 className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

interface ExpandableModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  allowZoom?: boolean;
  children: ReactNode;
}

export function ExpandableModal({
  open,
  onClose,
  title,
  subtitle,
  allowZoom = true,
  children,
}: ExpandableModalProps) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!open) {
      setZoom(100);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#171614]/75 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="animate-panel flex max-h-[94vh] w-full max-w-[1440px] flex-col border border-[var(--line-strong)] bg-[var(--paper)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-5 py-3.5">
          <div>
            <h3 className="font-editorial text-lg font-semibold text-[var(--ink)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--ink-faint)]">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allowZoom && (
              <div className="flex items-center border border-[var(--line-strong)] bg-[var(--paper)]">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(75, z - 25))}
                  disabled={zoom <= 75}
                  title="Alejar"
                  className="cursor-pointer px-2 py-1.5 text-[var(--ink)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[50px] border-x border-[var(--line)] px-2 text-center font-mono-num text-xs font-semibold text-[var(--ink)]">
                  {zoom}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(200, z + 25))}
                  disabled={zoom >= 200}
                  title="Acercar"
                  className="cursor-pointer px-2 py-1.5 text-[var(--ink)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                {zoom !== 100 && (
                  <button
                    type="button"
                    onClick={() => setZoom(100)}
                    title="Restablecer zoom"
                    className="cursor-pointer border-l border-[var(--line)] px-2 py-1.5 text-[var(--ink-muted)] hover:bg-white hover:text-[var(--ink)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--ink)] bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--crimson)] hover:border-[var(--crimson)]"
            >
              <X className="h-3.5 w-3.5" /> Cerrar
            </button>
          </div>
        </div>

        {/* Contenido ampliable con scroll y zoom limpio */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 ledger-scroll">
          <div
            style={{
              width: allowZoom ? `${zoom}%` : '100%',
              minWidth: '100%',
              transition: 'width 200ms ease-out',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
