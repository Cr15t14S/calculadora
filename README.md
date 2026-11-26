# Calculadora Financiera — Ingeniería Económica

Aplicación web interactiva construida con **Astro**, **React** y **Tailwind CSS** para simular y visualizar cálculos de Ingeniería Económica en tiempo real.

## Arquitectura modular

Toda la matemática financiera está desacoplada de la interfaz en módulos TypeScript puros bajo `src/lib/finanzas/`:

- `src/lib/finanzas/formato.ts` — parseo flexible de números/tasas y formato moneda colombiana (`$ 1.234.567,89`).
- `src/lib/finanzas/interesCompuesto.ts` — cálculo de `VF`, `VP`, `i`, `n` y curva comparativa compuesta vs. simple.
- `src/lib/finanzas/tasas.ts` — nominal → periódica → EA, equivalencias y conversión anticipada ↔ vencida.
- `src/lib/finanzas/ecuacionesValor.ts` — traslado a fecha focal `FF`, balance de deudas/pagos, pago único `X` y cuotas iguales `R`.
- `src/lib/finanzas/amortizacion.ts` — sistema francés (cuota fija), abonos extra/desembolsos (reducción de cuota o plazo) y modo cuenta.
- `src/lib/finanzas/anualidades.ts` — anualidades ordinarias/vencidas, anticipadas, diferidas y generales.
- `src/lib/finanzas/exportar.ts` — exportación a CSV (Excel en español) y Excel (`.xlsx`).

## Módulos de la interfaz

1. **Interés compuesto**: despeje automático de `VF`, `VP`, `i` o `n` con curva animada compuesta vs. simple.
2. **Conversión de tasas**: cadena visual paso a paso, mapa comparativo de tasas equivalentes y envío directo de la tasa a otros módulos.
3. **Ecuaciones de valor y fecha focal**: diagrama interactivo de flujo de caja con deslizador de `FF` y resolución en vivo de `X` o cuotas `R`.
4. **Tabla de amortización y cuenta**: sistema francés + abonos extraordinarios/desembolsos, gráfica de evolución del saldo y composición por cuota, modo cuenta y exportación a CSV / `.xlsx`.
5. **Anualidades**: soporte para anualidad vencida, anticipada, diferida y general con esquema temporal.

## Comandos

```bash
npm install
npm run dev
npm run build
```
