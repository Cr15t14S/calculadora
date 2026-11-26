import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  formatter: (v: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Interpola suavemente un número desde su valor anterior al nuevo usando
 * requestAnimationFrame (curva ease-out cúbica) para evidenciar cada recálculo.
 */
export function AnimatedNumber({
  value,
  formatter,
  duration = 380,
  className = '',
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState<number>(value);
  const prevRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    const startVal = Number.isFinite(prevRef.current) ? prevRef.current : value;
    const endVal = value;

    if (!Number.isFinite(endVal) || Math.abs(endVal - startVal) < 1e-12) {
      setDisplay(endVal);
      prevRef.current = endVal;
      return;
    }

    setFlashKey((k) => k + 1);
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplay(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = endVal;
        setDisplay(endVal);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      prevRef.current = endVal;
    };
  }, [value, duration]);

  return (
    <span
      key={flashKey}
      className={`font-mono-num inline-block rounded-[2px] px-0.5 animate-recalc ${className}`}
    >
      {formatter(display)}
    </span>
  );
}
