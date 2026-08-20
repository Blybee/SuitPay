import { formatearImporte } from '../../domain/totales/calculo.ts'
import type { ProductoBuscable } from '../../domain/busqueda/productos.ts'

/**
 * Tab Lista: catálogo espejado (FR-009d). Los filtros viven junto a los tabs
 * para aplicar también a la búsqueda.
 */

export function PanelDeListaCatalogo({
  productos,
  onElegir,
}: {
  readonly productos: readonly ProductoBuscable[]
  readonly onElegir: (producto: ProductoBuscable) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {productos.length === 0 ? (
        <p className="px-4 py-8 text-cuerpo text-desvaida" role="status">
          No hay productos con esos filtros.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto pb-4">
          {productos.map((producto) => (
            <li key={producto.codigo}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-4 border-b border-borde px-4 py-3 text-left hover:bg-mesa"
                onClick={() => onElegir(producto)}
              >
                <span>
                  <span className="block font-bold uppercase text-tinta">
                    {producto.descripcion}
                  </span>
                  <span className="font-mono text-etiqueta text-desvaida">
                    {producto.codigo}
                    {producto.marca ? ` · ${producto.marca}` : ''}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-tinta">
                  {formatearImporte(producto.precio)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
