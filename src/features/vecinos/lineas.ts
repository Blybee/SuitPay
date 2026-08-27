import type { ProductoBuscable } from '../../domain/busqueda/productos.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import { persistirLineasDeVecino } from './persistir.ts'

/**
 * Agrega (o incrementa) un producto en la cotización viva del vecino.
 */
export async function agregarProductoAVecino(datos: {
  readonly cotizacionId: string
  readonly lineasActuales: readonly LineaDePedido[]
  readonly producto: ProductoBuscable
  readonly cantidad?: number
}): Promise<{ ok: boolean; mensaje?: string }> {
  const incremento = datos.cantidad !== undefined && datos.cantidad > 0
    ? datos.cantidad
    : 1
  const existentes = [...datos.lineasActuales]
  const indice = existentes.findIndex(
    (linea) => linea.codigo === datos.producto.codigo,
  )
  if (indice >= 0) {
    const actual = existentes[indice]!
    existentes[indice] = {
      ...actual,
      cantidad: actual.cantidad + incremento,
    }
  } else {
    existentes.push({
      codigo: datos.producto.codigo,
      descripcion: datos.producto.descripcion,
      unidad: datos.producto.unidad,
      cantidad: incremento,
      precio: datos.producto.precio,
    })
  }
  return persistirLineasDeVecino({
    cotizacionId: datos.cotizacionId,
    lineas: existentes,
  })
}
