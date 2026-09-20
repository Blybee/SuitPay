import {
  estaEnAlerta,
  maximoAlFijar,
} from './reglas.ts'
import type { Existencia } from './tipos.ts'

export interface ParcheDeInventario {
  readonly codigo: string
  readonly cantidad?: number
  readonly precioCompraCentimos?: number | null
  readonly precioCompraEn?: string | null
  readonly umbral?: number
  readonly autorId: string
  readonly momento: Date
}

/**
 * Une un parche con el documento previo. No inventa cantidad 0.
 * `precioCompraCentimos: null` borra costo y fecha.
 */
export function aplicarParcheDeInventario(
  previa: Existencia | null,
  parche: ParcheDeInventario,
): Existencia {
  const cantidad =
    parche.cantidad !== undefined ? parche.cantidad : previa?.cantidad
  const maximo =
    typeof cantidad === 'number'
      ? maximoAlFijar(cantidad, previa?.maximo)
      : (previa?.maximo ?? 0)
  const umbral = parche.umbral ?? previa?.umbral
  const alerta =
    typeof cantidad === 'number' ? estaEnAlerta(cantidad, maximo, umbral) : false

  let precioCompraCentimos = previa?.precioCompraCentimos
  let precioCompraEn = previa?.precioCompraEn
  if (parche.precioCompraCentimos === null) {
    precioCompraCentimos = undefined
    precioCompraEn = undefined
  } else if (typeof parche.precioCompraCentimos === 'number') {
    precioCompraCentimos = parche.precioCompraCentimos
    if (parche.precioCompraEn === null) {
      precioCompraEn = undefined
    } else if (parche.precioCompraEn !== undefined) {
      precioCompraEn = parche.precioCompraEn
    }
  } else if (parche.precioCompraEn === null) {
    precioCompraEn = undefined
  } else if (parche.precioCompraEn !== undefined) {
    precioCompraEn = parche.precioCompraEn
  }

  return {
    codigo: parche.codigo,
    ...(typeof cantidad === 'number' ? { cantidad } : {}),
    maximo,
    ...(umbral !== undefined ? { umbral } : {}),
    alerta,
    ...(precioCompraCentimos !== undefined ? { precioCompraCentimos } : {}),
    ...(precioCompraEn !== undefined && precioCompraEn !== ''
      ? { precioCompraEn }
      : {}),
    actualizadoPor: parche.autorId,
    actualizadoEn: parche.momento,
  }
}
