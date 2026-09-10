import { bytesDePdfInterno } from './pdf-interno.ts'
import type { DatosDePdfInterno, LineaDePdfInterno } from './pdf-interno.ts'

export type LineaDePdfNotaVenta = LineaDePdfInterno
export type DatosDePdfNotaVenta = Omit<DatosDePdfInterno, 'clase'>

/**
 * PDF A4 de nota de venta. Misma plantilla que la cotización.
 */
export function bytesDePdfDeNotaVenta(
  datos: DatosDePdfNotaVenta,
): Uint8Array {
  return bytesDePdfInterno({ ...datos, clase: 'nota_venta' })
}
