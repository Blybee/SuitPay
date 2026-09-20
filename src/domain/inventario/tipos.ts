/**
 * Contadores orientativos por SKU. No es inventario de registro.
 * El costo de compra (spec 007) vive aquí, no en catalogo/actual.
 */

export interface Existencia {
  readonly codigo: string
  readonly cantidad?: number
  readonly maximo: number
  readonly umbral?: number
  readonly alerta: boolean
  readonly precioCompraCentimos?: number
  readonly precioCompraEn?: string
  readonly actualizadoPor: string
  readonly actualizadoEn: Date
}

export interface LineaConCantidad {
  readonly codigo: string
  readonly cantidad: number
}

export function tieneControlDeCantidad(
  existencia: Existencia | null,
): boolean {
  return existencia !== null && typeof existencia.cantidad === 'number'
}
