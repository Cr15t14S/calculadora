# Calculadora Financiera — Ingeniería Económica

Aplicación web construida con **Astro**, **React** y **Tailwind CSS** para el cálculo y simulación interactiva de operaciones de Ingeniería Económica.

## Módulos planificados

1. **Interés compuesto básico**: cálculo de `VF`, `VP`, tasa `i` y periodos `n`.
2. **Conversión de tasas**: nominal a periódica y EA, equivalencias entre tasas efectivas/periódicas, y anticipada ↔ vencida.
3. **Ecuaciones de valor y fecha focal**: balance de deudas y pagos en fecha focal, pago único faltante `X` y cuotas iguales `R`.
4. **Tabla de amortización**: sistema francés (cuota fija) con abonos extraordinarios/desembolsos (reducción de cuota o plazo) y modo cuenta con depósitos y retiros, con exportación a CSV y Excel (`.xlsx`).

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Referencias del curso

- `calculadora_financiera.py`: prototipo de escritorio en Python (Tkinter) con la lógica base.
- `anualidades UD 20263 303.xlsx`: libro de ejercicios y fórmulas de referencia.
