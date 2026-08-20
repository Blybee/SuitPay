/**
 * Filtros facetados sobre el espejo local del catálogo (FR-009d).
 *
 * Corren en memoria: cero lecturas extra. Un producto sin `categoriaId` no
 * entra al filtro de categoría (ni global ni cruzado con marca).
 */

export interface FacetasDeCatalogo {
  readonly marca?: string | null
  readonly categoriaId?: string | null
}

export interface ProductoConFacetas {
  readonly marca?: string
  readonly categoriaId?: string
}

export function filtrarPorFacetas<T extends ProductoConFacetas>(
  productos: readonly T[],
  facetas: FacetasDeCatalogo,
): readonly T[] {
  const marca = facetas.marca?.trim() ?? ''
  const categoriaId = facetas.categoriaId?.trim() ?? ''

  return productos.filter((producto) => {
    if (marca.length > 0 && (producto.marca ?? '') !== marca) return false
    if (categoriaId.length > 0) {
      const delProducto = producto.categoriaId?.trim() ?? ''
      if (delProducto.length === 0) return false
      if (delProducto !== categoriaId) return false
    }
    return true
  })
}

export function marcasDe(
  productos: readonly ProductoConFacetas[],
): readonly string[] {
  const unicas = new Set<string>()
  for (const producto of productos) {
    const marca = (producto.marca ?? '').trim()
    if (marca.length > 0) unicas.add(marca)
  }
  return [...unicas].sort((a, b) => a.localeCompare(b, 'es'))
}
