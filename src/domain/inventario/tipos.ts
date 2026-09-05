/**
 * Contadores orientativos por SKU. No es inventario de registro.
 */

export interface Existencia {
  readonly codigo: string
  readonly cantidad: number
  readonly maximo: number
  readonly umbral?: number
  readonly alerta: boolean
  readonly actualizadoPor: string
  readonly actualizadoEn: Date
}

export interface LineaConCantidad {
  readonly codigo: string
  readonly cantidad: number
}
