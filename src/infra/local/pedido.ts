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
  readonly comprobanteOrigenEtiqueta?: string | null
  readonly modoCotizacion?: boolean
  readonly guardadoEn: number
}

export function leerPedido(): Promise<PedidoPersistido | undefined> {
  return leer<PedidoPersistido>('pedido', CLAVES.pedidoSlot1)
}

export function guardarPedido(
  pedido: Omit<PedidoPersistido, 'guardadoEn'>,
): Promise<void> {
  return guardarPedidoEnSlot(1, pedido)
}

export async function guardarPedidoEnSlot(
  slot: 1 | 2,
  pedido: Omit<PedidoPersistido, 'guardadoEn'>,
): Promise<void> {
  const clave = slot === 1 ? CLAVES.pedidoSlot1 : CLAVES.pedidoSlot2
  return guardar<PedidoPersistido>('pedido', clave, {
    ...pedido,
    guardadoEn: Date.now(),
  })
}

export function leerPedidoEnSlot(
  slot: 1 | 2,
): Promise<PedidoPersistido | undefined> {
  const clave = slot === 1 ? CLAVES.pedidoSlot1 : CLAVES.pedidoSlot2
  return leer<PedidoPersistido>('pedido', clave)
}

export function olvidarPedido(): Promise<void> {
  return olvidarPedidoEnSlot(1)
}

export function olvidarPedidoEnSlot(slot: 1 | 2): Promise<void> {
  const clave = slot === 1 ? CLAVES.pedidoSlot1 : CLAVES.pedidoSlot2
  return borrar('pedido', clave)
}

export interface MetaDeSlots {
  readonly slotActivo: 1 | 2
  readonly segundoAbierto: boolean
}

export function leerMetaDeSlots(): Promise<MetaDeSlots | undefined> {
  return leer<MetaDeSlots>('pedido', CLAVES.pedidoMeta)
}

export function guardarMetaDeSlots(meta: MetaDeSlots): Promise<void> {
  return guardar('pedido', CLAVES.pedidoMeta, meta)
}
