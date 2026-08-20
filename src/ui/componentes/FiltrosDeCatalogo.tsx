import type { CategoriaEnCatalogo } from '../../infra/local/catalogo.ts'
import type { FacetasDeCatalogo } from '../../domain/catalogo/filtros.ts'
import { Etiqueta } from './primitivas.tsx'

/**
 * Filtros facetados sobre el espejo local (FR-009d). Native <select>:
 * Baseline, teclado y lector de pantalla sin librería extra.
 */

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

const CLASE_SELECT = unir(
  'min-h-11 min-w-40 rounded-full border border-borde bg-papel px-4 text-cuerpo text-tinta',
  'focus-visible:outline-none focus-visible:border-tinta',
)

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
        <label className="flex min-w-40 flex-col gap-1">
          <Etiqueta htmlFor="filtro-marca">Marca</Etiqueta>
          <select
            id="filtro-marca"
            className={CLASE_SELECT}
            value={facetas.marca ?? ''}
            onChange={(evento) => {
              const valor = evento.target.value
              onCambiar({
                ...facetas,
                marca: valor.length > 0 ? valor : null,
              })
            }}
          >
            <option value="">Todas</option>
            {marcas.map((marca) => (
              <option key={marca} value={marca}>
                {marca}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {categorias.length > 0 ? (
        <label className="flex min-w-40 flex-col gap-1">
          <Etiqueta htmlFor="filtro-categoria">Categoría</Etiqueta>
          <select
            id="filtro-categoria"
            className={CLASE_SELECT}
            value={facetas.categoriaId ?? ''}
            onChange={(evento) => {
              const valor = evento.target.value
              onCambiar({
                ...facetas,
                categoriaId: valor.length > 0 ? valor : null,
              })
            }}
          >
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
