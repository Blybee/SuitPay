import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import type { Comprobante } from '../emision/emitir.funciones.ts'
import type { ClienteDelPedido } from './almacen.ts'

/**
 * Mapea un comprobante persistido al pedido del mostrador (FR-056).
 * No toca el documento origen; quien llama debe reclamar nueva idempotencia.
 */
export function pedidoDesdeComprobante(comprobante: Comprobante): {
  readonly lineas: readonly LineaDePedido[]
  readonly cliente: ClienteDelPedido | null
} {
  const lineas: LineaDePedido[] = comprobante.lineas.map((linea) => ({
    codigo: linea.codigo,
    descripcion: linea.descripcion,
    unidad: linea.unidad,
    cantidad: linea.cantidad,
    precio: linea.precio,
  }))

  const origen = comprobante.cliente
  const cliente: ClienteDelPedido | null =
    origen === null
      ? null
      : {
          tipoDocumento: origen.tipoDocumento,
          numeroDocumento: origen.numeroDocumento,
          denominacion: origen.denominacion,
          ...(origen.direccion !== null && origen.direccion !== ''
            ? { direccion: origen.direccion }
            : {}),
        }

  return { lineas, cliente }
}

export function etiquetaDeComprobante(comprobante: Comprobante): string {
  if (comprobante.numero === null) {
    return comprobante.serie || comprobante.id.slice(0, 8)
  }
  return `${comprobante.serie}-${String(comprobante.numero).padStart(8, '0')}`
}

/**
 * Confirma si hace falta, carga el pedido y devuelve la etiqueta usada en el
 * aviso. `null` = el vendedor canceló el reemplazo.
 */
export function confirmarYPrepararReutilizacion(
  comprobante: Comprobante,
  lineasEnCurso: number,
): { readonly lineas: readonly LineaDePedido[]; readonly cliente: ClienteDelPedido | null; readonly etiqueta: string } | null {
  if (comprobante.lineas.length === 0) return null

  if (
    lineasEnCurso > 0 &&
    !window.confirm(
      'Ya hay un pedido en el mostrador. ¿Reemplazarlo con las líneas de este comprobante?',
    )
  ) {
    return null
  }

  const pedido = pedidoDesdeComprobante(comprobante)
  return {
    ...pedido,
    etiqueta: etiquetaDeComprobante(comprobante),
  }
}
