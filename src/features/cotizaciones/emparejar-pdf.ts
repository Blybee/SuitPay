import { buscarProductos } from '../../domain/busqueda/productos.ts'
import type { IndiceDeProductos } from '../../domain/busqueda/productos.ts'
import type { CandidatoDeLinea, LineaDeCaptura } from '../captura/tipos.ts'

export interface ItemDeRequerimientoPdf {
  readonly textoOriginal: string
  readonly cantidad: number
  readonly unidad: string
}

/**
 * Empareja renglones del PDF contra el catálogo local (Fuse).
 * El servidor no envía el catálogo al modelo.
 */
export function emparejarItemsPdf(
  indice: IndiceDeProductos,
  items: readonly ItemDeRequerimientoPdf[],
): LineaDeCaptura[] {
  return items.map((item) => emparejarItem(indice, item))
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
