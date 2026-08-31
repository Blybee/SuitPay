import { buscarProductos } from '../../domain/busqueda/productos.ts'
import type { IndiceDeProductos } from '../../domain/busqueda/productos.ts'
import type { CandidatoDeLinea, LineaDeCaptura } from '../captura/tipos.ts'

export interface ItemDeRequerimientoPdf {
  readonly textoOriginal: string
  readonly cantidad: number
  readonly unidad: string
  readonly codigo?: string | null
  readonly confidence?: 'high' | 'low'
}

/**
 * Prefiere el código del modelo; Fuse solo si no hay código.
 */
export function emparejarItemsPdf(
  indice: IndiceDeProductos,
  items: readonly ItemDeRequerimientoPdf[],
  productoPorCodigo?: (codigo: string) =>
    | { codigo: string; descripcion: string; unidad: string }
    | undefined,
): LineaDeCaptura[] {
  return items.map((item) => {
    const codigo = item.codigo?.trim() ?? ''
    if (codigo !== '') {
      const producto = productoPorCodigo?.(codigo)
      if (producto !== undefined) {
        const resuelta = item.confidence === 'high'
        return {
          textoOriginal: item.textoOriginal,
          candidatos: [
            {
              codigo: producto.codigo,
              descripcion: producto.descripcion,
              unidad: producto.unidad,
              cantidad: item.cantidad,
              grado: resuelta ? 'exacta' : 'aproximada',
            },
          ],
          seleccion: resuelta ? producto.codigo : null,
          estadoLinea: resuelta ? 'resuelta' : 'ambigua',
          cantidad: item.cantidad,
        }
      }
      return {
        textoOriginal: item.textoOriginal,
        candidatos: [],
        seleccion: null,
        estadoLinea: 'pendiente',
        cantidad: item.cantidad,
      }
    }
    return emparejarItem(indice, item)
  })
}

function emparejarItem(
  indice: IndiceDeProductos,
  item: ItemDeRequerimientoPdf,
): LineaDeCaptura {
  const resultado = buscarProductos(indice, item.textoOriginal, 4)
  const candidatos: CandidatoDeLinea[] = resultado.coincidencias.map((c) => ({
    codigo: c.elemento.codigo,
    descripcion: c.elemento.descripcion,
    unidad: c.elemento.unidad,
    cantidad: item.cantidad,
    grado: c.grado,
  }))

  if (candidatos.length === 0) {
    return {
      textoOriginal: item.textoOriginal,
      candidatos: [],
      seleccion: null,
      estadoLinea: 'pendiente',
      cantidad: item.cantidad,
    }
  }

  const primero = candidatos[0]!
  if (
    candidatos.length === 1 &&
    (primero.grado === 'exacta' || primero.grado === 'fuerte')
  ) {
    return {
      textoOriginal: item.textoOriginal,
      candidatos,
      seleccion: primero.codigo,
      estadoLinea: 'resuelta',
      cantidad: item.cantidad,
    }
  }

  return {
    textoOriginal: item.textoOriginal,
    candidatos,
    seleccion: null,
    estadoLinea: 'ambigua',
    cantidad: item.cantidad,
  }
}
