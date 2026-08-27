/**
 * Tabs internos del mostrador: Pedido | Cotizaciones | Vecinos | Lista (FR-005b).
 * Lista es la lista de requerimiento (N° | Producto | Cantidad | Urgencia).
 */

export type PestanaMostrador = 'pedido' | 'cotizaciones' | 'vecinos' | 'lista'

const PESTANAS: readonly { id: PestanaMostrador; etiqueta: string }[] = [
  { id: 'pedido', etiqueta: 'Pedido' },
  { id: 'cotizaciones', etiqueta: 'Cotizaciones' },
  { id: 'vecinos', etiqueta: 'Vecinos' },
  { id: 'lista', etiqueta: 'Lista' },
]

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

export function PestanasMostrador({
  activa,
  onCambiar,
}: {
  readonly activa: PestanaMostrador
  readonly onCambiar: (pestana: PestanaMostrador) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Secciones del mostrador"
      className="flex flex-wrap gap-1.5 bg-papel px-4 pt-0.5 pb-1.5"
    >
      {PESTANAS.map((cada) => {
        const seleccionada = cada.id === activa
        return (
          <button
            key={cada.id}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            id={`tab-${cada.id}`}
            onClick={() => onCambiar(cada.id)}
            className={unir(
              'min-h-9 rounded-full px-4 text-cuerpo font-bold transition-colors',
              'focus-visible:outline-none focus-visible:border-tinta',
              seleccionada
                ? 'bg-tinta text-papel'
                : 'bg-mesa text-desvaida hover:text-tinta',
            )}
          >
            {cada.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
