import type { CategoriaEnCatalogo } from '../../infra/local/catalogo.ts'
import type { FacetasDeCatalogo } from '../../domain/catalogo/filtros.ts'
import { Selector } from './Selector.tsx'

/**
 * Filtros facetados sobre el espejo local (FR-009d).
 */

export function FiltrosDeCatalogo({
  marcas,
  categorias,
  facetas,
  onCambiar,
}: {
  readonly marcas: readonly string[]
  readonly categorias: readonly CategoriaEnCatalogo[]
  readonly facetas: FacetasDeCatalogo
  readonly onCambiar: (facetas: FacetasDeCatalogo) => void
}) {
  if (marcas.length === 0 && categorias.length === 0) return null

  return (
    <div className="flex flex-wrap items-end gap-3 px-4 pb-2">
      {marcas.length > 0 ? (
        <Selector
          id="filtro-marca"
          etiqueta="Marca"
          disposicion="columna"
          contenedorClassName="min-w-40"
          valor={facetas.marca ?? ''}
          onCambiar={(valor) =>
            onCambiar({
              ...facetas,
              marca: valor.length > 0 ? valor : null,
            })
          }
          opciones={[
            { valor: '', etiqueta: 'Todas' },
            ...marcas.map((marca) => ({ valor: marca, etiqueta: marca })),
          ]}
        />
      ) : null}

      {categorias.length > 0 ? (
        <Selector
          id="filtro-categoria"
          etiqueta="Categoría"
          disposicion="columna"
          contenedorClassName="min-w-40"
          valor={facetas.categoriaId ?? ''}
          onCambiar={(valor) =>
            onCambiar({
              ...facetas,
              categoriaId: valor.length > 0 ? valor : null,
            })
          }
          opciones={[
            { valor: '', etiqueta: 'Todas' },
            ...categorias.map((categoria) => ({
              valor: categoria.id,
              etiqueta: categoria.nombre,
            })),
          ]}
        />
      ) : null}
    </div>
  )
}
