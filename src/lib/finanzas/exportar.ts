import * as XLSX from 'xlsx';
import { numCsv } from './formato';

/**
 * Descarga un archivo CSV con separador ';' y coma decimal,
 * listo para abrir directamente en Excel en español.
 */
export function exportarCSV(
  encabezados: string[],
  filas: Array<Array<number | null>>,
  nombreArchivo = 'tabla_amortizacion.csv'
): void {
  const lineas: string[] = [encabezados.join(';')];
  for (const fila of filas) {
    const periodo = fila[0] === null ? '' : String(fila[0]);
    const valores = fila.slice(1).map((v) => numCsv(v, 2));
    lineas.push([periodo, ...valores].join(';'));
  }

  // BOM UTF-8 para que Excel muestre tildes y símbolos correctamente
  const contenido = '\uFEFF' + lineas.join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera y descarga un libro Excel (.xlsx) con formato de moneda.
 */
export function exportarExcel(
  encabezados: string[],
  filas: Array<Array<number | null>>,
  nombreArchivo = 'tabla_amortizacion.xlsx',
  nombreHoja = 'Tabla'
): void {
  const datos = [
    encabezados,
    ...filas.map((fila) => [
      fila[0],
      ...fila.slice(1).map((v) => (v === null ? null : Math.round(v * 100) / 100)),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(datos);

  // Ancho de columnas legible
  ws['!cols'] = encabezados.map((_, idx) => ({ wch: idx === 0 ? 10 : 22 }));

  // Formato moneda para columnas numéricas (B en adelante, desde fila 2)
  const rango = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = 1; r <= rango.e.r; r++) {
    for (let c = 1; c <= rango.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const celda = ws[ref];
      if (celda && typeof celda.v === 'number') {
        celda.z = '"$" #,##0.00';
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, nombreArchivo);
}
