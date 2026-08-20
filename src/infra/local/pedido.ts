import { CLAVES, borrar, guardar, leer } from './almacenes.ts'

/**
 * El pedido en curso, persistido.
 *
 * Existe por FR-015 y por un escenario concreto del local: se va la luz, cae el
 * router, el vendedor pasa al wifi del teléfono de la empresa y el pedido que
 * llevaba a medias tiene que seguir ahí. Un pedido de catorce líneas rearmado
 * desde cero con el cliente delante es la clase de fricción que hizo que este
 * proyecto exista.
 */

export interface PedidoPersistido {
  readonly lineas: readonly {
    readonly codigo: string
    readonly descripcion: string
    readonly unidad: string
    readonly cantidad: number
    readonly precio: number
  }[]
  readonly cliente: {
    readonly tipoDocumento: string
    readonly numeroDocumento: string
    readonly denominacion: string
    readonly direccion?: string
  } | null
  readonly tipoDocumento: string
  readonly cotizacionId: string | null
  readonly capturaId: string | null
  /**
   * La clave de idempotencia se genera al **confirmar**, no al empezar, y se
   * persiste desde ese momento. Así un reintento tras recargar la página
   * reutiliza la misma clave en lugar de generar otra, que es lo que convertiría
   * el reintento en un segundo comprobante.
   */
  readonly claveIdempotencia: string | null
  readonly comprobanteOrigenId?: string | null
  readonly guardadoEn: number
}

export function leerPedido(): Promise<PedidoPersistido | undefined> {
  return leer<PedidoPersistido>('pedido', CLAVES.pedidoEnCurso)
}

export function guardarPedido(
  pedido: Omit<PedidoPersistido, 'guardadoEn'>,
): Promise<void> {
  return guardar<PedidoPersistido>('pedido', CLAVES.pedidoEnCurso, {
    ...pedido,
    guardadoEn: Date.now(),
  })
}

export function olvidarPedido(): Promise<void> {
  return borrar('pedido', CLAVES.pedidoEnCurso)
}
