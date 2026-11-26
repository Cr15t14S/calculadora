#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
 CALCULADORA FINANCIERA - Ingeniería Económica
==============================================================================
 Módulos:
   1. Interés compuesto básico (VF, VP, i, n)
   2. Conversión de tasas (nominal -> periódica -> EA, equivalencias,
      anticipada <-> vencida)
   3. Ecuaciones de valor y fecha focal (deudas, pagos, pago único faltante
      o cuotas iguales R)
   4. Tabla de amortización - sistema francés (cuota fija), con abonos
      extraordinarios / desembolsos, y modo "cuenta" con depósitos y retiros.

 Requisitos: Python 3.8+ (Tkinter viene incluido en el instalador de Windows).
 Opcional:   openpyxl  (solo para exportar a .xlsx; CSV funciona siempre).

 Convenciones de entrada:
   * Las tasas se escriben en PORCENTAJE: 2 significa 2 %.
   * Se acepta coma o punto decimal: 2,5  ó  2.5
   * En montos se aceptan separadores de miles: 1.500.000  ó  1,500,000,50
==============================================================================
"""

import csv
import math
import re
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

EPS = 1e-7  # tolerancia para considerar un saldo como cero


# ============================================================================
#  UTILIDADES: lectura de números y formato de salida
# ============================================================================
class ErrorEntrada(ValueError):
    """Error de validación con un mensaje claro para el usuario."""


def leer_numero(texto, nombre, es_monto=False):
    """Convierte el texto de un campo en float, aceptando coma o punto decimal.

    es_monto=True: un único separador seguido de exactamente 3 dígitos se
    interpreta como separador de miles (p. ej. '150.000' -> 150000).
    """
    s = (texto or "").strip().replace("$", "").replace("%", "").replace(" ", "")
    if not s:
        raise ErrorEntrada(f"El campo «{nombre}» está vacío.")

    if "," in s and "." in s:
        # El último separador que aparezca es el decimal.
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s or "." in s:
        sep = "," if "," in s else "."
        if s.count(sep) > 1:                       # 1.000.000 -> miles
            s = s.replace(sep, "")
        elif es_monto and re.fullmatch(r"-?\d{1,3}[.,]\d{3}", s):
            s = s.replace(sep, "")                 # 150.000 -> 150000
        else:
            s = s.replace(",", ".")                # 2,5 -> 2.5

    try:
        valor = float(s)
    except ValueError:
        raise ErrorEntrada(f"El campo «{nombre}» no es un número válido: «{texto}».")
    if not math.isfinite(valor):
        raise ErrorEntrada(f"El campo «{nombre}» debe ser un número finito.")
    return valor


def leer_tasa(texto, nombre):
    """Lee una tasa escrita en porcentaje y la devuelve en decimal (2 -> 0.02)."""
    return leer_numero(texto, nombre) / 100.0


def leer_entero_positivo(texto, nombre):
    v = leer_numero(texto, nombre)
    if v <= 0 or abs(v - round(v)) > 1e-9:
        raise ErrorEntrada(f"«{nombre}» debe ser un número entero mayor que cero.")
    return int(round(v))


def _formato_co(x, dec):
    """1234567.891 -> '1.234.567,89' (formato colombiano)."""
    s = f"{x:,.{dec}f}"
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def fmt_dinero(x):
    return "$ " + _formato_co(x, 2)


def fmt_pct(x, dec=4):
    """x en decimal -> porcentaje con 'dec' decimales."""
    return _formato_co(x * 100, dec) + " %"


def fmt_num(x, dec=4):
    return _formato_co(x, dec)


def num_csv(x, dec=2):
    """Número para CSV en Excel en español: sin miles y con coma decimal."""
    return "" if x is None else f"{x:.{dec}f}".replace(".", ",")


# ============================================================================
#  MÓDULO 1: INTERÉS COMPUESTO
# ============================================================================
def _validar_tasa(i):
    if i <= -1:
        raise ErrorEntrada("La tasa debe ser mayor que -100 %.")


def calc_vf(vp, i, n):
    """VF = VP * (1 + i)^n"""
    _validar_tasa(i)
    return vp * (1 + i) ** n


def calc_vp(vf, i, n):
    """VP = VF / (1 + i)^n"""
    _validar_tasa(i)
    return vf / (1 + i) ** n


def calc_tasa(vp, vf, n):
    """i = (VF / VP)^(1/n) - 1"""
    if vp <= 0 or vf <= 0:
        raise ErrorEntrada("VP y VF deben ser mayores que cero para calcular la tasa.")
    if n <= 0:
        raise ErrorEntrada("n debe ser mayor que cero.")
    return (vf / vp) ** (1 / n) - 1


def calc_n(vp, vf, i):
    """n = ln(VF / VP) / ln(1 + i)"""
    if vp <= 0 or vf <= 0:
        raise ErrorEntrada("VP y VF deben ser mayores que cero para calcular n.")
    _validar_tasa(i)
    if i == 0:
        raise ErrorEntrada("Con tasa 0 % no se puede calcular n (ln(1) = 0).")
    return math.log(vf / vp) / math.log(1 + i)


# ============================================================================
#  MÓDULO 2: CONVERSIÓN DE TASAS
# ============================================================================
def nominal_a_periodica(j, m, anticipada=False):
    """Nominal anual j capitalizable m veces al año.

    Devuelve (tasa periódica de la nominal, periódica vencida, EA).
    Si la nominal es anticipada: ia = j/m, iv = ia/(1-ia).
    """
    if m <= 0:
        raise ErrorEntrada("m (capitalizaciones por año) debe ser mayor que cero.")
    ip = j / m
    if anticipada:
        iv = anticipada_a_vencida(ip)
    else:
        _validar_tasa(ip)
        iv = ip
    ea = (1 + iv) ** m - 1
    return ip, iv, ea


def tasa_equivalente(i_conocida, n_conocida, n_buscada):
    """i_buscada = (1 + i_conocida)^(n_conocida / n_buscada) - 1

    n = número de periodos que caben en el año (12 mensual, 4 trimestral,
    2 semestral, 1 anual, 360 diaria...).
    """
    if n_conocida <= 0 or n_buscada <= 0:
        raise ErrorEntrada("Los periodos por año deben ser mayores que cero.")
    _validar_tasa(i_conocida)
    return (1 + i_conocida) ** (n_conocida / n_buscada) - 1


def anticipada_a_vencida(ia):
    """iv = ia / (1 - ia)"""
    if ia >= 1:
        raise ErrorEntrada("La tasa anticipada debe ser menor que 100 % (1 - ia ≠ 0).")
    return ia / (1 - ia)


def vencida_a_anticipada(iv):
    """ia = iv / (1 + iv)"""
    _validar_tasa(iv)
    return iv / (1 + iv)


# ============================================================================
#  MÓDULO 3: ECUACIONES DE VALOR Y FECHA FOCAL
# ============================================================================
def mover_a_ff(monto, periodo, i, ff):
    """Lleva un flujo a la fecha focal: monto * (1+i)^(FF - periodo).

    Exponente > 0 -> capitaliza (flujo antes de la FF)
    Exponente < 0 -> descuenta  (flujo después de la FF)
    """
    _validar_tasa(i)
    factor = (1 + i) ** (ff - periodo)
    if periodo < ff:
        operacion = "Capitaliza"
    elif periodo > ff:
        operacion = "Descuenta"
    else:
        operacion = "En la FF"
    return monto * factor, factor, operacion


def balance_ff(flujos, i, ff):
    """flujos: lista de (tipo, monto, periodo), tipo = 'Deuda' o 'Pago'.

    Devuelve (detalle, total_deudas_FF, total_pagos_FF, diferencia)
    diferencia = deudas - pagos (lo que aún falta pagar, valorado en la FF).
    """
    detalle, deudas, pagos = [], 0.0, 0.0
    for tipo, monto, periodo in flujos:
        valor, factor, op = mover_a_ff(monto, periodo, i, ff)
        detalle.append((tipo, monto, periodo, op, factor, valor))
        if tipo == "Deuda":
            deudas += valor
        else:
            pagos += valor
    return detalle, deudas, pagos, deudas - pagos


def pago_unico_faltante(diferencia, i, ff, k):
    """X tal que X * (1+i)^(FF-k) = diferencia."""
    _validar_tasa(i)
    return diferencia / (1 + i) ** (ff - k)


def cuotas_iguales(diferencia, i, ff, periodos):
    """R tal que R * Σ (1+i)^(FF-k) = diferencia. Devuelve (R, Σ factores)."""
    if not periodos:
        raise ErrorEntrada("Indique al menos un periodo para las cuotas R.")
    _validar_tasa(i)
    suma = sum((1 + i) ** (ff - k) for k in periodos)
    return diferencia / suma, suma


def leer_periodos(texto):
    """'1-12' -> 1..12 ; '3,6,9' ; '3;6;9' ; '1-6, 9, 12' (combinable)."""
    texto = (texto or "").strip()
    if not texto:
        raise ErrorEntrada("Escriba los periodos de las cuotas (ej.: 1-12  ó  3;6;9).")
    periodos = []
    for parte in re.split(r"[;,\s]+", texto):
        if not parte:
            continue
        rango = re.fullmatch(r"(\d+)\s*-\s*(\d+)", parte)
        if rango:
            a, b = int(rango.group(1)), int(rango.group(2))
            if a > b:
                raise ErrorEntrada(f"Rango inválido «{parte}»: el inicio es mayor que el final.")
            periodos.extend(range(a, b + 1))
        else:
            periodos.append(leer_numero(parte, "Periodos de las cuotas"))
    return periodos


# ============================================================================
#  MÓDULO 4: AMORTIZACIÓN (SISTEMA FRANCÉS) Y CUENTA CON MOVIMIENTOS
# ============================================================================
def cuota_fija(vp, i, n):
    """R = VP * [ i / (1 - (1+i)^(-n)) ]   (si i = 0, R = VP / n)"""
    if n <= 0:
        raise ErrorEntrada("n debe ser mayor que cero.")
    if i == 0:
        return vp / n
    _validar_tasa(i)
    return vp * (i / (1 - (1 + i) ** (-n)))


def leer_movimientos(texto):
    """Lee líneas 'periodo: monto' y devuelve {periodo: monto acumulado}.

    Separadores válidos entre periodo y monto: ':'  '='  o  ';'
    """
    movs = {}
    for num_linea, linea in enumerate((texto or "").splitlines(), start=1):
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        m = re.fullmatch(r"(\d+)\s*[:=;]\s*(.+)", linea)
        if not m:
            raise ErrorEntrada(
                f"Línea {num_linea} de movimientos inválida: «{linea}».\n"
                "Use el formato  periodo: monto   (ej.  6: 500000  ó  8: -200000)")
        k = int(m.group(1))
        if k < 1:
            raise ErrorEntrada(f"Línea {num_linea}: el periodo debe ser 1 o mayor.")
        movs[k] = movs.get(k, 0.0) + leer_numero(m.group(2), f"monto línea {num_linea}", es_monto=True)
    return movs


def tabla_prestamo(vp, i, n, movimientos=None, modo="cuota"):
    """Tabla de amortización sistema francés.

    movimientos: {periodo: monto}. Positivo = abono extraordinario a capital
                 (se aplica después de la cuota). Negativo = desembolso o
                 retiro adicional que aumenta el saldo.
    modo: 'cuota' -> tras un movimiento se recalcula la cuota manteniendo n.
          'plazo' -> se mantiene la cuota y cambia el número de periodos.
    Devuelve (filas, cuota_inicial). Cada fila es un dict.
    """
    if vp <= 0:
        raise ErrorEntrada("El monto del préstamo debe ser mayor que cero.")
    if i < 0:
        raise ErrorEntrada("La tasa del préstamo no puede ser negativa.")
    movimientos = movimientos or {}

    R = cuota_fija(vp, i, n)
    cuota_inicial = R
    filas = [dict(periodo=0, saldo_inicial=None, cuota=None, interes=None,
                  abono=None, extra=None, saldo_final=vp)]
    saldo, k = vp, 0
    limite = n if modo == "cuota" else n * 10 + 1200  # protección anti-bucle

    while saldo > EPS and k < limite:
        k += 1
        interes = saldo * i
        if modo == "plazo" and R <= interes + EPS:
            raise ErrorEntrada(
                f"En el periodo {k} la cuota ({fmt_dinero(R)}) no cubre los intereses "
                f"({fmt_dinero(interes)}); el crédito nunca se pagaría. "
                "Use la opción «Reducir cuota / recalcular».")
        # En modo 'cuota', el último periodo liquida exactamente el saldo.
        cuota = saldo + interes if (modo == "cuota" and k == n) else min(R, saldo + interes)
        abono = cuota - interes
        saldo_tras_cuota = saldo - abono

        extra = movimientos.get(k, 0.0)
        if extra > saldo_tras_cuota:          # el abono extra no puede superar la deuda
            extra = saldo_tras_cuota
        saldo_final = saldo_tras_cuota - extra
        if abs(saldo_final) < EPS:
            saldo_final = 0.0

        filas.append(dict(periodo=k, saldo_inicial=saldo, cuota=cuota, interes=interes,
                          abono=abono, extra=extra, saldo_final=saldo_final))
        saldo = saldo_final

        # Recalcular cuota si hubo movimiento y se eligió mantener el plazo.
        if modo == "cuota" and abs(extra) > EPS and k < n and saldo > EPS:
            R = cuota_fija(saldo, i, n - k)

    if modo == "plazo" and saldo > EPS:
        raise ErrorEntrada("El préstamo no se termina de pagar en un número razonable de periodos.")
    return filas, cuota_inicial


def tabla_cuenta(saldo0, i, n, movimientos=None, deposito_fijo=0.0):
    """Cuenta de ahorro / saldo con depósitos y retiros periodo a periodo.

    Saldo final = Saldo inicial + Interés (Saldo inicial * i) + depósito fijo
                  + movimiento del periodo (positivo = depósito, negativo = retiro)
    """
    if saldo0 < 0:
        raise ErrorEntrada("El saldo inicial no puede ser negativo.")
    _validar_tasa(i)
    movimientos = movimientos or {}
    filas = [dict(periodo=0, saldo_inicial=None, interes=None, movimiento=None,
                  saldo_final=saldo0)]
    saldo = saldo0
    for k in range(1, n + 1):
        interes = saldo * i
        mov = deposito_fijo + movimientos.get(k, 0.0)
        saldo_final = saldo + interes + mov
        if saldo_final < -EPS:
            raise ErrorEntrada(f"El retiro del periodo {k} supera el saldo disponible "
                               f"({fmt_dinero(saldo + interes)}).")
        saldo_final = max(saldo_final, 0.0)
        filas.append(dict(periodo=k, saldo_inicial=saldo, interes=interes,
                          movimiento=mov, saldo_final=saldo_final))
        saldo = saldo_final
    return filas


# ============================================================================
#  INTERFAZ GRÁFICA (Tkinter)
# ============================================================================
ERRORES_CALCULO = (ErrorEntrada, OverflowError, ZeroDivisionError, ValueError)


class CalculadoraFinanciera(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Calculadora Financiera - Ingeniería Económica")
        self.geometry("1080x720")
        self.minsize(900, 600)
        estilo = ttk.Style(self)
        if "clam" in estilo.theme_names():
            estilo.theme_use("clam")
        estilo.configure("Titulo.TLabel", font=("Segoe UI", 11, "bold"))
        estilo.configure("Accion.TButton", font=("Segoe UI", 10, "bold"))

        cuaderno = ttk.Notebook(self)
        cuaderno.pack(fill="both", expand=True, padx=8, pady=8)
        for titulo, constructor in [
            ("1. Interés compuesto", self._tab_interes),
            ("2. Conversión de tasas", self._tab_tasas),
            ("3. Ecuaciones de valor", self._tab_ecuaciones),
            ("4. Amortización", self._tab_amortizacion),
        ]:
            marco = ttk.Frame(cuaderno, padding=10)
            cuaderno.add(marco, text=titulo)
            constructor(marco)

    # ---------------------------------------------------------- utilidades GUI
    @staticmethod
    def _campo(padre, etiqueta, fila, col=0, ancho=18, valor=""):
        ttk.Label(padre, text=etiqueta).grid(row=fila, column=col, sticky="w", padx=4, pady=3)
        entrada = ttk.Entry(padre, width=ancho)
        entrada.grid(row=fila, column=col + 1, sticky="w", padx=4, pady=3)
        if valor:
            entrada.insert(0, valor)
        return entrada

    @staticmethod
    def _caja_resultado(padre, alto=12):
        marco = ttk.Frame(padre)
        texto = tk.Text(marco, height=alto, wrap="none", font="TkFixedFont",
                        background="#fbfbf8", relief="solid", borderwidth=1)
        barra = ttk.Scrollbar(marco, orient="vertical", command=texto.yview)
        texto.configure(yscrollcommand=barra.set, state="disabled")
        texto.pack(side="left", fill="both", expand=True)
        barra.pack(side="right", fill="y")
        return marco, texto

    @staticmethod
    def _mostrar(caja, contenido):
        caja.configure(state="normal")
        caja.delete("1.0", "end")
        caja.insert("1.0", contenido)
        caja.configure(state="disabled")

    @staticmethod
    def _error(e):
        if isinstance(e, OverflowError):
            msg = "El resultado es demasiado grande. Revise la tasa y el número de periodos."
        elif isinstance(e, ZeroDivisionError):
            msg = "Se produjo una división por cero. Revise los datos ingresados."
        else:
            msg = str(e)
        messagebox.showerror("Dato inválido", msg)

    # ===================================================== PESTAÑA 1: INTERÉS
    def _tab_interes(self, f):
        ttk.Label(f, text="Interés compuesto:  VF = VP·(1+i)^n", style="Titulo.TLabel").grid(
            row=0, column=0, columnspan=4, sticky="w", pady=(0, 8))

        self.ic_incognita = tk.StringVar(value="VF")
        marco_radio = ttk.LabelFrame(f, text="¿Qué desea calcular?", padding=6)
        marco_radio.grid(row=1, column=0, columnspan=4, sticky="w")
        for txt, val in [("Valor Futuro (VF)", "VF"), ("Valor Presente (VP)", "VP"),
                         ("Tasa periódica (i)", "i"), ("Número de periodos (n)", "n")]:
            ttk.Radiobutton(marco_radio, text=txt, value=val, variable=self.ic_incognita,
                            command=self._ic_actualizar).pack(side="left", padx=6)

        datos = ttk.Frame(f)
        datos.grid(row=2, column=0, columnspan=4, sticky="w", pady=8)
        self.ic_vp = self._campo(datos, "Valor Presente VP ($):", 0)
        self.ic_vf = self._campo(datos, "Valor Futuro VF ($):", 1)
        self.ic_i = self._campo(datos, "Tasa periódica i (%):", 2)
        self.ic_n = self._campo(datos, "Número de periodos n:", 3)

        ttk.Button(f, text="Calcular", style="Accion.TButton", command=self._ic_calcular).grid(
            row=3, column=0, sticky="w", pady=4)
        ttk.Button(f, text="Limpiar", command=lambda: [e.delete(0, "end") for e in
                   (self.ic_vp, self.ic_vf, self.ic_i, self.ic_n)]).grid(row=3, column=1, sticky="w")

        marco, self.ic_res = self._caja_resultado(f, alto=10)
        marco.grid(row=4, column=0, columnspan=4, sticky="nsew", pady=8)
        f.rowconfigure(4, weight=1)
        f.columnconfigure(3, weight=1)
        self._ic_actualizar()

    def _ic_actualizar(self):
        """Deshabilita el campo de la incógnita."""
        mapa = {"VP": self.ic_vp, "VF": self.ic_vf, "i": self.ic_i, "n": self.ic_n}
        for clave, entrada in mapa.items():
            if clave == self.ic_incognita.get():
                entrada.delete(0, "end")
                entrada.configure(state="disabled")
            else:
                entrada.configure(state="normal")

    def _ic_calcular(self):
        inc = self.ic_incognita.get()
        try:
            if inc == "VF":
                vp = leer_numero(self.ic_vp.get(), "VP", es_monto=True)
                i = leer_tasa(self.ic_i.get(), "i")
                n = leer_numero(self.ic_n.get(), "n")
                r = calc_vf(vp, i, n)
                txt = (f"VF = VP · (1 + i)^n\n"
                       f"VF = {fmt_dinero(vp)} · (1 + {fmt_num(i, 6)})^{fmt_num(n, 2)}\n"
                       f"Factor (1+i)^n = {fmt_num((1 + i) ** n, 6)}\n\n"
                       f"VALOR FUTURO = {fmt_dinero(r)}\n"
                       f"Intereses ganados = {fmt_dinero(r - vp)}")
            elif inc == "VP":
                vf = leer_numero(self.ic_vf.get(), "VF", es_monto=True)
                i = leer_tasa(self.ic_i.get(), "i")
                n = leer_numero(self.ic_n.get(), "n")
                r = calc_vp(vf, i, n)
                txt = (f"VP = VF / (1 + i)^n\n"
                       f"VP = {fmt_dinero(vf)} / (1 + {fmt_num(i, 6)})^{fmt_num(n, 2)}\n"
                       f"Factor (1+i)^-n = {fmt_num((1 + i) ** -n, 6)}\n\n"
                       f"VALOR PRESENTE = {fmt_dinero(r)}\n"
                       f"Descuento (intereses) = {fmt_dinero(vf - r)}")
            elif inc == "i":
                vp = leer_numero(self.ic_vp.get(), "VP", es_monto=True)
                vf = leer_numero(self.ic_vf.get(), "VF", es_monto=True)
                n = leer_numero(self.ic_n.get(), "n")
                r = calc_tasa(vp, vf, n)
                txt = (f"i = (VF / VP)^(1/n) - 1\n"
                       f"i = ({fmt_dinero(vf)} / {fmt_dinero(vp)})^(1/{fmt_num(n, 2)}) - 1\n\n"
                       f"TASA PERIÓDICA i = {fmt_pct(r)}   ({fmt_num(r, 6)} en decimal)")
            else:
                vp = leer_numero(self.ic_vp.get(), "VP", es_monto=True)
                vf = leer_numero(self.ic_vf.get(), "VF", es_monto=True)
                i = leer_tasa(self.ic_i.get(), "i")
                r = calc_n(vp, vf, i)
                txt = (f"n = ln(VF / VP) / ln(1 + i)\n"
                       f"n = ln({fmt_num(vf / vp, 6)}) / ln({fmt_num(1 + i, 6)})\n\n"
                       f"NÚMERO DE PERIODOS n = {fmt_num(r, 4)}\n"
                       f"(Entero superior: {math.ceil(r - 1e-9)} periodos)")
            self._mostrar(self.ic_res, txt)
        except ERRORES_CALCULO as e:
            self._error(e)

    # ====================================================== PESTAÑA 2: TASAS
    def _tab_tasas(self, f):
        f.columnconfigure(0, weight=1)

        # --- a) Nominal -> periódica -> EA
        a = ttk.LabelFrame(f, text="a) Nominal anual (j) → tasa periódica (i = j/m) → Efectiva Anual",
                           padding=8)
        a.grid(row=0, column=0, sticky="ew", pady=4)
        self.tn_j = self._campo(a, "Tasa nominal anual j (%):", 0)
        self.tn_m = self._campo(a, "Capitalizaciones por año m:", 1, valor="12")
        ttk.Label(a, text="(12 mensual, 4 trimestral, 2 semestral, 6 bimestral, 360 diaria)",
                  foreground="#666").grid(row=1, column=2, sticky="w")
        self.tn_ant = tk.BooleanVar(value=False)
        ttk.Checkbutton(a, text="La nominal es ANTICIPADA (ej. 24 % NMA / NTA)",
                        variable=self.tn_ant).grid(row=2, column=0, columnspan=3, sticky="w")
        ttk.Button(a, text="Convertir", style="Accion.TButton",
                   command=self._tasa_nominal).grid(row=3, column=0, sticky="w", pady=4)

        # --- b) Equivalencia
        b = ttk.LabelFrame(f, text="b) Equivalencia entre tasas efectivas / periódicas", padding=8)
        b.grid(row=1, column=0, sticky="ew", pady=4)
        self.te_i = self._campo(b, "Tasa conocida (%):", 0)
        self.te_nc = self._campo(b, "Periodos/año de la conocida:", 1, valor="12")
        self.te_nb = self._campo(b, "Periodos/año de la buscada:", 2, valor="1")
        ttk.Label(b, text="i_buscada = (1 + i_conocida)^(n_conocida / n_buscada) - 1",
                  foreground="#666").grid(row=0, column=2, sticky="w", padx=10)
        ttk.Label(b, text="Ej.: mensual→EA: 12 y 1 · EA→mensual: 1 y 12 · trimestral→mensual: 4 y 12",
                  foreground="#666").grid(row=1, column=2, sticky="w", padx=10)
        ttk.Button(b, text="Calcular equivalente", style="Accion.TButton",
                   command=self._tasa_equivalente).grid(row=3, column=0, sticky="w", pady=4)

        # --- c) Anticipada <-> vencida
        c = ttk.LabelFrame(f, text="c) Tasa anticipada ↔ vencida (del mismo periodo)", padding=8)
        c.grid(row=2, column=0, sticky="ew", pady=4)
        self.tav_tasa = self._campo(c, "Tasa periódica (%):", 0)
        self.tav_dir = tk.StringVar(value="a2v")
        ttk.Radiobutton(c, text="Anticipada → Vencida   iv = ia / (1 - ia)", value="a2v",
                        variable=self.tav_dir).grid(row=1, column=0, columnspan=3, sticky="w")
        ttk.Radiobutton(c, text="Vencida → Anticipada   ia = iv / (1 + iv)", value="v2a",
                        variable=self.tav_dir).grid(row=2, column=0, columnspan=3, sticky="w")
        ttk.Button(c, text="Convertir", style="Accion.TButton",
                   command=self._tasa_ant_venc).grid(row=3, column=0, sticky="w", pady=4)

        marco, self.t_res = self._caja_resultado(f, alto=8)
        marco.grid(row=3, column=0, sticky="nsew", pady=6)
        f.rowconfigure(3, weight=1)

    def _tasa_nominal(self):
        try:
            j = leer_tasa(self.tn_j.get(), "j")
            m = leer_numero(self.tn_m.get(), "m")
            ant = self.tn_ant.get()
            ip, iv, ea = nominal_a_periodica(j, m, ant)
            txt = (f"Nominal j = {fmt_pct(j)} {'anticipada' if ant else 'vencida'}, "
                   f"m = {fmt_num(m, 0)}\n\n"
                   f"Tasa periódica {'anticipada ia' if ant else 'i'} = j / m = {fmt_pct(ip)}\n")
            if ant:
                txt += f"Tasa periódica vencida iv = ia / (1 - ia) = {fmt_pct(iv)}\n"
            txt += (f"Efectiva anual EA = (1 + iv)^m - 1 = {fmt_pct(ea)}\n"
                    f"Nominal vencida equivalente = iv · m = {fmt_pct(iv * m)}")
            self._mostrar(self.t_res, txt)
        except ERRORES_CALCULO as e:
            self._error(e)

    def _tasa_equivalente(self):
        try:
            i = leer_tasa(self.te_i.get(), "Tasa conocida")
            nc = leer_numero(self.te_nc.get(), "Periodos/año conocida")
            nb = leer_numero(self.te_nb.get(), "Periodos/año buscada")
            r = tasa_equivalente(i, nc, nb)
            ea = tasa_equivalente(i, nc, 1)
            txt = (f"i_buscada = (1 + {fmt_num(i, 6)})^({fmt_num(nc, 2)} / {fmt_num(nb, 2)}) - 1\n\n"
                   f"TASA EQUIVALENTE = {fmt_pct(r)} por periodo  ({fmt_num(r, 6)})\n"
                   f"Nominal equivalente (i · {fmt_num(nb, 0)}) = {fmt_pct(r * nb)}\n"
                   f"Efectiva anual de referencia = {fmt_pct(ea)}")
            self._mostrar(self.t_res, txt)
        except ERRORES_CALCULO as e:
            self._error(e)

    def _tasa_ant_venc(self):
        try:
            t = leer_tasa(self.tav_tasa.get(), "Tasa periódica")
            if self.tav_dir.get() == "a2v":
                r = anticipada_a_vencida(t)
                txt = (f"iv = ia / (1 - ia) = {fmt_num(t, 6)} / (1 - {fmt_num(t, 6)})\n\n"
                       f"TASA VENCIDA = {fmt_pct(r)}")
            else:
                r = vencida_a_anticipada(t)
                txt = (f"ia = iv / (1 + iv) = {fmt_num(t, 6)} / (1 + {fmt_num(t, 6)})\n\n"
                       f"TASA ANTICIPADA = {fmt_pct(r)}")
            self._mostrar(self.t_res, txt)
        except ERRORES_CALCULO as e:
            self._error(e)

    # ============================================ PESTAÑA 3: ECUACIONES DE VALOR
    def _tab_ecuaciones(self, f):
        f.columnconfigure(1, weight=1)
        f.rowconfigure(1, weight=1)

        # --- Ingreso de flujos
        ing = ttk.LabelFrame(f, text="Agregar deuda o pago", padding=8)
        ing.grid(row=0, column=0, sticky="nw")
        ttk.Label(ing, text="Tipo:").grid(row=0, column=0, sticky="w", padx=4, pady=3)
        self.ev_tipo = ttk.Combobox(ing, values=["Deuda", "Pago"], state="readonly", width=16)
        self.ev_tipo.current(0)
        self.ev_tipo.grid(row=0, column=1, sticky="w", padx=4)
        self.ev_monto = self._campo(ing, "Monto ($):", 1)
        self.ev_periodo = self._campo(ing, "Periodo:", 2)
        botones = ttk.Frame(ing)
        botones.grid(row=3, column=0, columnspan=2, sticky="w", pady=4)
        ttk.Button(botones, text="Agregar", command=self._ev_agregar).pack(side="left", padx=2)
        ttk.Button(botones, text="Eliminar seleccionado", command=self._ev_eliminar).pack(side="left", padx=2)
        ttk.Button(botones, text="Limpiar todo", command=self._ev_limpiar).pack(side="left", padx=2)
        self.ev_periodo.bind("<Return>", lambda _e: self._ev_agregar())

        # --- Parámetros
        par = ttk.LabelFrame(f, text="Parámetros", padding=8)
        par.grid(row=0, column=1, sticky="nw", padx=10)
        self.ev_i = self._campo(par, "Tasa periódica i (%):", 0)
        self.ev_ff = self._campo(par, "Fecha focal FF (periodo):", 1)
        ttk.Button(par, text="Calcular balance en la FF", style="Accion.TButton",
                   command=self._ev_balance).grid(row=2, column=0, columnspan=2, sticky="w", pady=4)

        # --- Resolver faltante
        res = ttk.LabelFrame(par, text="Resolver lo que falta por pagar", padding=6)
        res.grid(row=3, column=0, columnspan=2, sticky="ew", pady=4)
        self.ev_modo = tk.StringVar(value="unico")
        ttk.Radiobutton(res, text="Pago único X en el periodo:", value="unico",
                        variable=self.ev_modo).grid(row=0, column=0, sticky="w")
        self.ev_k = ttk.Entry(res, width=12)
        self.ev_k.grid(row=0, column=1, sticky="w", padx=4)
        ttk.Radiobutton(res, text="Cuotas iguales R en los periodos:", value="cuotas",
                        variable=self.ev_modo).grid(row=1, column=0, sticky="w")
        self.ev_periodos = ttk.Entry(res, width=18)
        self.ev_periodos.grid(row=1, column=1, sticky="w", padx=4)
        ttk.Label(res, text="ej.: 1-12   ó   3;6;9   ó   2-4;8", foreground="#666").grid(
            row=2, column=1, sticky="w")
        ttk.Button(res, text="Resolver", style="Accion.TButton", command=self._ev_resolver).grid(
            row=3, column=0, sticky="w", pady=4)

        # --- Lista de flujos
        cols = ("tipo", "monto", "periodo")
        self.ev_tabla = ttk.Treeview(f, columns=cols, show="headings", height=8)
        for c, t, w in zip(cols, ("Tipo", "Monto", "Periodo"), (90, 150, 80)):
            self.ev_tabla.heading(c, text=t)
            self.ev_tabla.column(c, width=w, anchor="e" if c != "tipo" else "w")
        self.ev_tabla.grid(row=1, column=0, sticky="nsew", pady=8)
        self.ev_flujos = {}  # id de la fila -> (tipo, monto, periodo)

        marco, self.ev_res = self._caja_resultado(f, alto=14)
        marco.grid(row=1, column=1, sticky="nsew", padx=10, pady=8)

    def _ev_agregar(self):
        try:
            tipo = self.ev_tipo.get()
            monto = leer_numero(self.ev_monto.get(), "Monto", es_monto=True)
            periodo = leer_numero(self.ev_periodo.get(), "Periodo")
            if monto <= 0:
                raise ErrorEntrada("El monto debe ser mayor que cero.")
            fila = self.ev_tabla.insert("", "end", values=(tipo, fmt_dinero(monto), fmt_num(periodo, 2)))
            self.ev_flujos[fila] = (tipo, monto, periodo)
            self.ev_monto.delete(0, "end")
            self.ev_periodo.delete(0, "end")
            self.ev_monto.focus_set()
        except ERRORES_CALCULO as e:
            self._error(e)

    def _ev_eliminar(self):
        for fila in self.ev_tabla.selection():
            self.ev_tabla.delete(fila)
            self.ev_flujos.pop(fila, None)

    def _ev_limpiar(self):
        for fila in self.ev_tabla.get_children():
            self.ev_tabla.delete(fila)
        self.ev_flujos.clear()
        self._mostrar(self.ev_res, "")

    def _ev_calculo_base(self):
        """Valida y calcula el balance; devuelve (i, ff, detalle, deudas, pagos, dif)."""
        if not self.ev_flujos:
            raise ErrorEntrada("Agregue al menos una deuda o un pago.")
        i = leer_tasa(self.ev_i.get(), "Tasa periódica i")
        ff = leer_numero(self.ev_ff.get(), "Fecha focal")
        flujos = [self.ev_flujos[f] for f in self.ev_tabla.get_children()]
        return (i, ff) + balance_ff(flujos, i, ff)

    def _ev_texto_balance(self, i, ff, detalle, deudas, pagos, dif):
        lin = [f"Tasa i = {fmt_pct(i)}    Fecha focal = periodo {fmt_num(ff, 2)}",
               "Flujo movido a la FF:  Valor · (1+i)^(FF - periodo)", "",
               f"{'Tipo':<6} {'Monto':>18} {'Per.':>6} {'Operación':<11} {'Factor':>10} {'Valor en FF':>18}",
               "-" * 74]
        for tipo, monto, per, op, factor, valor in detalle:
            lin.append(f"{tipo:<6} {fmt_dinero(monto):>18} {fmt_num(per, 2):>6} {op:<11} "
                       f"{fmt_num(factor, 6):>10} {fmt_dinero(valor):>18}")
        lin += ["-" * 74,
                f"Σ Deudas en la FF : {fmt_dinero(deudas):>20}",
                f"Σ Pagos  en la FF : {fmt_dinero(pagos):>20}",
                f"Diferencia (Deudas - Pagos): {fmt_dinero(dif)}"]
        if abs(dif) < 0.005:
            lin.append("→ La ecuación de valor está BALANCEADA.")
        elif dif > 0:
            lin.append("→ Falta por pagar ese valor (expresado en la FF).")
        else:
            lin.append("→ Los pagos superan a las deudas (saldo a favor en la FF).")
        return "\n".join(lin)

    def _ev_balance(self):
        try:
            self._mostrar(self.ev_res, self._ev_texto_balance(*self._ev_calculo_base()))
        except ERRORES_CALCULO as e:
            self._error(e)

    def _ev_resolver(self):
        try:
            i, ff, detalle, deudas, pagos, dif = self._ev_calculo_base()
            txt = self._ev_texto_balance(i, ff, detalle, deudas, pagos, dif) + "\n\n"
            if abs(dif) < 0.005:
                txt += "No hay nada pendiente por resolver."
            elif self.ev_modo.get() == "unico":
                k = leer_numero(self.ev_k.get(), "Periodo del pago único")
                x = pago_unico_faltante(dif, i, ff, k)
                txt += (f"PAGO ÚNICO en el periodo {fmt_num(k, 2)}:\n"
                        f"X · (1+i)^(FF-k) = Diferencia\n"
                        f"X = {fmt_dinero(dif)} / (1 + {fmt_num(i, 6)})^({fmt_num(ff - k, 2)})\n\n"
                        f"X = {fmt_dinero(x)}")
            else:
                periodos = leer_periodos(self.ev_periodos.get())
                r, suma = cuotas_iguales(dif, i, ff, periodos)
                lista = ", ".join(fmt_num(p, 0) if p == int(p) else fmt_num(p, 2) for p in periodos)
                txt += (f"CUOTAS IGUALES R en los periodos: {lista}\n"
                        f"R · Σ (1+i)^(FF-k) = Diferencia\n"
                        f"Σ factores = {fmt_num(suma, 6)}\n\n"
                        f"R = {fmt_dinero(dif)} / {fmt_num(suma, 6)} = {fmt_dinero(r)}")
            self._mostrar(self.ev_res, txt)
        except ERRORES_CALCULO as e:
            self._error(e)

    # ================================================ PESTAÑA 4: AMORTIZACIÓN
    def _tab_amortizacion(self, f):
        f.columnconfigure(2, weight=1)
        f.rowconfigure(1, weight=1)

        izq = ttk.Frame(f)
        izq.grid(row=0, column=0, sticky="nw")
        self.am_tipo = tk.StringVar(value="prestamo")
        tipo = ttk.LabelFrame(izq, text="Tipo de tabla", padding=6)
        tipo.grid(row=0, column=0, columnspan=2, sticky="ew")
        ttk.Radiobutton(tipo, text="Préstamo – sistema francés (cuota fija)", value="prestamo",
                        variable=self.am_tipo, command=self._am_actualizar).pack(anchor="w")
        ttk.Radiobutton(tipo, text="Cuenta con depósitos y retiros", value="cuenta",
                        variable=self.am_tipo, command=self._am_actualizar).pack(anchor="w")

        datos = ttk.Frame(izq)
        datos.grid(row=1, column=0, sticky="w", pady=6)
        self.am_lbl_vp = ttk.Label(datos, text="Monto del préstamo VP ($):")
        self.am_lbl_vp.grid(row=0, column=0, sticky="w", padx=4, pady=3)
        self.am_vp = ttk.Entry(datos, width=18)
        self.am_vp.grid(row=0, column=1, sticky="w", padx=4)
        self.am_i = self._campo(datos, "Tasa periódica i (%):", 1)
        self.am_n = self._campo(datos, "Número de periodos n:", 2)
        self.am_dep = self._campo(datos, "Depósito fijo por periodo ($):", 3, valor="0")

        self.am_modo = tk.StringVar(value="cuota")
        self.am_marco_modo = ttk.LabelFrame(izq, text="Tras un abono extraordinario…", padding=6)
        self.am_marco_modo.grid(row=2, column=0, sticky="ew")
        ttk.Radiobutton(self.am_marco_modo, text="Reducir la cuota (mantener n)", value="cuota",
                        variable=self.am_modo).pack(anchor="w")
        ttk.Radiobutton(self.am_marco_modo, text="Reducir el plazo (mantener la cuota)", value="plazo",
                        variable=self.am_modo).pack(anchor="w")

        # Movimientos extraordinarios
        mov = ttk.LabelFrame(f, text="Movimientos extraordinarios (opcional)", padding=6)
        mov.grid(row=0, column=1, sticky="nw", padx=10)
        self.am_ayuda = ttk.Label(mov, foreground="#555", justify="left")
        self.am_ayuda.pack(anchor="w")
        self.am_movs = tk.Text(mov, width=30, height=9, font="TkFixedFont")
        self.am_movs.pack(fill="both", expand=True, pady=4)

        acciones = ttk.Frame(f)
        acciones.grid(row=0, column=2, sticky="nw")
        ttk.Button(acciones, text="Generar tabla", style="Accion.TButton",
                   command=self._am_generar).pack(fill="x", pady=2)
        ttk.Button(acciones, text="Exportar a CSV", command=self._am_exportar_csv).pack(fill="x", pady=2)
        ttk.Button(acciones, text="Exportar a Excel (.xlsx)",
                   command=self._am_exportar_excel).pack(fill="x", pady=2)
        self.am_resumen = ttk.Label(acciones, justify="left", font=("Segoe UI", 10))
        self.am_resumen.pack(anchor="w", pady=8)

        # Tabla
        marco = ttk.Frame(f)
        marco.grid(row=1, column=0, columnspan=3, sticky="nsew", pady=8)
        self.am_tabla = ttk.Treeview(marco, show="headings")
        sy = ttk.Scrollbar(marco, orient="vertical", command=self.am_tabla.yview)
        sx = ttk.Scrollbar(marco, orient="horizontal", command=self.am_tabla.xview)
        self.am_tabla.configure(yscrollcommand=sy.set, xscrollcommand=sx.set)
        self.am_tabla.grid(row=0, column=0, sticky="nsew")
        sy.grid(row=0, column=1, sticky="ns")
        sx.grid(row=1, column=0, sticky="ew")
        marco.rowconfigure(0, weight=1)
        marco.columnconfigure(0, weight=1)

        self.am_datos_export = None  # (encabezados, filas numéricas)
        self._am_actualizar()

    def _am_actualizar(self):
        prestamo = self.am_tipo.get() == "prestamo"
        self.am_lbl_vp.configure(text="Monto del préstamo VP ($):" if prestamo else "Saldo inicial ($):")
        self.am_dep.configure(state="disabled" if prestamo else "normal")
        for w in self.am_marco_modo.winfo_children():
            w.configure(state="normal" if prestamo else "disabled")
        if prestamo:
            ayuda = ("Una línea por movimiento:  periodo: monto\n"
                     "  6: 500000    → abono extra a capital\n"
                     "  9: -200000   → desembolso adicional\n"
                     "(se aplican después de la cuota)")
        else:
            ayuda = ("Una línea por movimiento:  periodo: monto\n"
                     "  3: 200000    → depósito\n"
                     "  7: -150000   → retiro\n"
                     "(se suman al depósito fijo)")
        self.am_ayuda.configure(text=ayuda)

    def _am_configurar_columnas(self, encabezados):
        self.am_tabla.delete(*self.am_tabla.get_children())
        ids = [f"c{k}" for k in range(len(encabezados))]
        self.am_tabla.configure(columns=ids)
        for cid, titulo in zip(ids, encabezados):
            self.am_tabla.heading(cid, text=titulo)
            self.am_tabla.column(cid, width=70 if titulo == "Periodo" else 150,
                                 anchor="center" if titulo == "Periodo" else "e", stretch=True)

    def _am_generar(self):
        try:
            prestamo = self.am_tipo.get() == "prestamo"
            vp = leer_numero(self.am_vp.get(), "Monto / Saldo inicial", es_monto=True)
            i = leer_tasa(self.am_i.get(), "Tasa periódica i")
            n = leer_entero_positivo(self.am_n.get(), "Número de periodos n")
            movs = leer_movimientos(self.am_movs.get("1.0", "end"))
            # En "reducir plazo" el crédito puede extenderse más allá de n; en los demás casos no.
            fuera = [] if (prestamo and self.am_modo.get() == "plazo") else sorted(k for k in movs if k > n)
            if fuera:
                raise ErrorEntrada(f"Hay movimientos en periodos mayores que n = {n}: {fuera}")

            def m(x):
                return "" if x is None else fmt_dinero(x)

            if prestamo:
                filas, R = tabla_prestamo(vp, i, n, movs, self.am_modo.get())
                enc = ["Periodo", "Saldo inicial", "Cuota", "Interés", "Abono a capital",
                       "Abono extra / Desembolso", "Saldo final"]
                claves = ["periodo", "saldo_inicial", "cuota", "interes", "abono", "extra", "saldo_final"]
                self._am_configurar_columnas(enc)
                for fi in filas:
                    self.am_tabla.insert("", "end", values=[fi["periodo"]] + [m(fi[c]) for c in claves[1:]])
                tot_int = sum(fi["interes"] for fi in filas[1:])
                tot_cuotas = sum(fi["cuota"] for fi in filas[1:])
                tot_extra = sum(fi["extra"] for fi in filas[1:])
                self.am_resumen.configure(text=(
                    f"Cuota fija inicial R: {fmt_dinero(R)}\n"
                    f"Periodos pagados: {len(filas) - 1}\n"
                    f"Total intereses: {fmt_dinero(tot_int)}\n"
                    f"Total cuotas: {fmt_dinero(tot_cuotas)}\n"
                    f"Neto abonos extra: {fmt_dinero(tot_extra)}"))
            else:
                dep = leer_numero(self.am_dep.get() or "0", "Depósito fijo", es_monto=True)
                filas = tabla_cuenta(vp, i, n, movs, dep)
                enc = ["Periodo", "Saldo inicial", "Interés", "Depósito (+) / Retiro (-)", "Saldo final"]
                claves = ["periodo", "saldo_inicial", "interes", "movimiento", "saldo_final"]
                self._am_configurar_columnas(enc)
                for fi in filas:
                    self.am_tabla.insert("", "end", values=[fi["periodo"]] + [m(fi[c]) for c in claves[1:]])
                tot_int = sum(fi["interes"] for fi in filas[1:])
                tot_mov = sum(fi["movimiento"] for fi in filas[1:])
                self.am_resumen.configure(text=(
                    f"Saldo final: {fmt_dinero(filas[-1]['saldo_final'])}\n"
                    f"Total intereses: {fmt_dinero(tot_int)}\n"
                    f"Neto depósitos/retiros: {fmt_dinero(tot_mov)}"))

            self.am_datos_export = (enc, [[fi[c] for c in claves] for fi in filas])
        except ERRORES_CALCULO as e:
            self._error(e)

    def _am_exportar_csv(self):
        if not self.am_datos_export:
            messagebox.showinfo("Exportar", "Primero genere la tabla.")
            return
        ruta = filedialog.asksaveasfilename(defaultextension=".csv", initialfile="tabla_amortizacion.csv",
                                            filetypes=[("CSV (Excel)", "*.csv")])
        if not ruta:
            return
        enc, filas = self.am_datos_export
        try:
            # ';' y coma decimal: así lo abre bien Excel configurado en español.
            with open(ruta, "w", newline="", encoding="utf-8-sig") as fh:
                w = csv.writer(fh, delimiter=";")
                w.writerow(enc)
                for fila in filas:
                    w.writerow([fila[0]] + [num_csv(x) for x in fila[1:]])
            messagebox.showinfo("Exportar", f"Tabla guardada en:\n{ruta}")
        except OSError as e:
            messagebox.showerror("Exportar", f"No se pudo guardar el archivo:\n{e}")

    def _am_exportar_excel(self):
        if not self.am_datos_export:
            messagebox.showinfo("Exportar", "Primero genere la tabla.")
            return
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment
        except ImportError:
            messagebox.showwarning("Exportar a Excel",
                                   "Falta la librería openpyxl.\nInstálela con:  pip install openpyxl\n\n"
                                   "Mientras tanto puede usar «Exportar a CSV», que Excel abre sin problema.")
            return
        ruta = filedialog.asksaveasfilename(defaultextension=".xlsx", initialfile="tabla_amortizacion.xlsx",
                                            filetypes=[("Libro de Excel", "*.xlsx")])
        if not ruta:
            return
        enc, filas = self.am_datos_export
        try:
            wb = Workbook()
            ws = wb.active
            ws.title = "Tabla"
            ws.append(enc)
            for celda in ws[1]:
                celda.font = Font(bold=True, color="FFFFFF")
                celda.fill = PatternFill("solid", fgColor="1F4E78")
                celda.alignment = Alignment(horizontal="center", wrap_text=True)
            for fila in filas:
                ws.append([fila[0]] + [None if x is None else round(x, 2) for x in fila[1:]])
            for col in ws.iter_cols(min_col=2, min_row=2):
                for celda in col:
                    celda.number_format = '"$" #,##0.00'
            for k in range(1, len(enc) + 1):
                ws.column_dimensions[ws.cell(1, k).column_letter].width = 10 if k == 1 else 22
            ws.freeze_panes = "A2"
            wb.save(ruta)
            messagebox.showinfo("Exportar", f"Tabla guardada en:\n{ruta}")
        except OSError as e:
            messagebox.showerror("Exportar", f"No se pudo guardar el archivo:\n{e}")


# ============================================================================
#  PUNTO DE ENTRADA
# ============================================================================
if __name__ == "__main__":
    app = CalculadoraFinanciera()
    app.mainloop()
