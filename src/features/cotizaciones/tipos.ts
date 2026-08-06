import type { Centimos, LineaDePedido } from '../../domain/totales/calculo.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'

export type EstadoDeCotizacion = 'pendiente' | 'convertida' | 'descartada'

export interface LineaDeCotizacion extends LineaDePedido {}

export interface Cotizacion {
  readonly id: string
  readonly numero: number
  readonly estado: EstadoDeCotizacion
  readonly cliente: ClienteDelPedido | null
  readonly lineas: readonly LineaDeCotizacion[]
  readonly total: Centimos
  readonly creadoPor: string
  readonly creadoEn: Date
  readonly comprobanteId: string | null
  readonly convertidaEn: Date | null
}
