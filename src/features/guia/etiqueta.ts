import { nombreDelComprobante } from '../emision/compartir.ts'

/**
 * Texto visible de la asociación guía ↔ boleta/factura (no el id opaco).
 */
export function etiquetaDeAsociacionGuia(
  tipo: 'boleta' | 'factura' | string,
  serie: string,
  numero: number | null,
): string {
  const corto = tipo === 'factura' ? 'Factura' : 'Boleta'
  return `Asociada a ${corto} ${nombreDelComprobante(serie, numero)}`
}
