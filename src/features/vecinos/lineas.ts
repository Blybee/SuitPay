import type { ProductoBuscable } from '../../domain/busqueda/productos.ts'
import { mutarLineasDeVecino } from './persistir.ts'

/**
 * Agrega (o incrementa) un producto en la cotización viva del vecino.
 * El corte de día ocurre dentro de la transacción (FR-035g).
 */
export async function agregarProductoAVecino(datos: {
  readonly cotizacionId: string
  readonly producto: ProductoBuscable
  readonly cantidad?: number
}): Promise<{ ok: boolean; mensaje?: string }> {
  const incremento =
    datos.cantidad !== undefined && datos.cantidad > 0 ? datos.cantidad : 1
  return mutarLineasDeVecino({
    cotizacionId: datos.cotizacionId,
    mutar: (lineasActuales) => {
      const existentes = [...lineasActuales]
      const indice = existentes.findIndex(
        (linea) => linea.codigo === datos.producto.codigo,
      )
      if (indice >= 0) {
        const actual = existentes[indice]!
        existentes[indice] = {
          ...actual,
          cantidad: actual.cantidad + incremento,
        }
        return existentes
      }
      existentes.push({
        codigo: datos.producto.codigo,
        descripcion: datos.producto.descripcion,
        unidad: datos.producto.unidad,
        cantidad: incremento,
        precio: datos.producto.precio,
      })
      return existentes
    },
  })
}
