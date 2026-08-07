import type { Centimos, LineaDePedido } from '../../domain/totales/calculo.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'

/** Solo `pendiente` mientras el documento existe (FR-019). */
export type EstadoDeCotizacion = 'pendiente'

export type CanalDeCotizacion = 'general' | 'vecino'

export interface LineaDeCotizacion extends LineaDePedido {}

export interface Cotizacion {
  readonly id: string
  readonly numero: number
  readonly estado: EstadoDeCotizacion
  readonly canal: CanalDeCotizacion
  /** Obligatorio si `canal === 'vecino'`; etiqueta del tab interno. */
  readonly aliasVecino: string | null
  readonly cliente: ClienteDelPedido | null
  readonly lineas: readonly LineaDeCotizacion[]
  readonly total: Centimos
  readonly creadoPor: string
  readonly creadoEn: Date
  readonly actualizadoEn: Date | null
}
