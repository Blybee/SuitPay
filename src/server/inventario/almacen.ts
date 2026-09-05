import type { Existencia } from '../../domain/inventario/tipos.ts'
import type { Comprobante } from '../emision/almacen.ts'

export interface FijarExistencia {
  readonly codigo: string
  readonly cantidad: number
  readonly umbral?: number
  readonly autorId: string
  readonly momento: Date
}

export interface AlmacenDeInventario {
  leer: (codigo: string) => Promise<Existencia | null>
  fijar: (entrada: FijarExistencia) => Promise<Existencia>
  listarAlertas: () => Promise<readonly Existencia[]>
  /**
   * Aplica deltas (solo SKUs que ya tienen documento) y marca flags del
   * comprobante en la misma transacción lógica.
   */
  aplicarVenta: (comprobante: Comprobante) => Promise<void>
  reintegrar: (comprobante: Comprobante) => Promise<void>
  heredarTitularidad: (
    origen: Comprobante,
    guia: Comprobante,
  ) => Promise<void>
}
