export interface CoincidenciaDeCompra {
  readonly codigo: string
  readonly precioCompraCentimos: number
  readonly precioCompraEn?: string
  readonly etiquetaFactura: string
}

export interface LineaSinMatchDeCompra {
  readonly etiquetaFactura: string
  readonly precioCompraCentimos?: number
  readonly precioCompraEn?: string
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
