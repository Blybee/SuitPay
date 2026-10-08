export interface CoincidenciaDeCompra {
  readonly codigo: string
  /** Costo en soles. En USD se llena al conocer el tipo de cambio. */
  readonly precioCompraCentimos?: number
  readonly precioCompraEn?: string
  readonly etiquetaFactura: string
  readonly moneda?: 'PEN' | 'USD'
  /** Precio unitario impreso, con su escala (`1.0550`). Solo USD. */
  readonly precioOriginal?: string
  readonly tipoCambio?: number
  /** Fecha de la orden con la que se pidió el tipo de cambio venta. */
  readonly tipoCambioEn?: string
  /** Índice del archivo subido. Solo arma la cabecera; no se persiste. */
  readonly grupo?: number
}

export interface LineaSinMatchDeCompra {
  readonly etiquetaFactura: string
  readonly precioCompraCentimos?: number
  readonly precioCompraEn?: string
  readonly moneda?: 'PEN' | 'USD'
  readonly precioOriginal?: string
  /** Índice del archivo subido. Solo arma la cabecera. */
  readonly grupo?: number
}

export interface BocetoDeCompras {
  readonly coincidencias: readonly CoincidenciaDeCompra[]
  readonly sinMatch: readonly LineaSinMatchDeCompra[]
  readonly modelo: string
}

/** Techo por archivo que viaja al modelo (no se persiste). */
export const TECHO_MEDIO_COMPRAS_BYTES = 8 * 1024 * 1024

/** Suma de todos los archivos de una carga. */
export const TECHO_MEDIOS_COMPRAS_BYTES = 24 * 1024 * 1024

export const MAX_MEDIOS_COMPRAS = 8
