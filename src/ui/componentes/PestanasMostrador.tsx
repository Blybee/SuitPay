/**
 * Tabs internos del mostrador: Pedido | Cotizaciones | Vecinos | Lista (FR-005b).
 * Lista es la lista de requerimiento (N° | Producto | Cantidad | Urgencia).
 */
import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

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
  slotPedido = 1,
  segundoAbierto = false,
  onSlotPedido,
}: {
  readonly activa: PestanaMostrador
  readonly onCambiar: (pestana: PestanaMostrador) => void
  readonly slotPedido?: 1 | 2
  readonly segundoAbierto?: boolean
  readonly onSlotPedido?: () => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Secciones del mostrador"
      className="flex flex-wrap items-center gap-1.5 bg-papel px-4 pt-0.5 pb-1.5"
    >
      {PESTANAS.map((cada) => {
        const seleccionada = cada.id === activa
        if (cada.id === 'pedido') {
          return (
            <div
              key={cada.id}
              className={unir(
                'flex h-9 items-center gap-1 rounded-full border pl-2 pr-0.5',
                'transition-colors duration-rapida ease-salida',
                seleccionada
                  ? 'border-tinta bg-tinta text-papel'
                  : 'border-borde bg-mesa text-desvaida',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={seleccionada}
                id={`tab-${cada.id}`}
                aria-controls={`panel-${cada.id}`}
                onClick={() => onCambiar(cada.id)}
                className={unir(
                  'h-full rounded-full px-3 text-cuerpo font-bold',
                  'transition-colors duration-rapida ease-salida',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta/10',
                  seleccionada ? 'text-papel' : 'text-desvaida hover:text-tinta',
                )}
              >
                {cada.etiqueta}
              </button>
              {onSlotPedido !== undefined ? (
                <button
                  type="button"
                  aria-label={
                    segundoAbierto
                      ? `Pedido ${slotPedido}, cambiar de workspace`
                      : 'Abrir segundo pedido'
                  }
                  onClick={onSlotPedido}
                  className={unir(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    'text-cuerpo font-bold transition-colors duration-rapida ease-salida',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta/10',
                    seleccionada
                      ? 'bg-papel text-tinta'
                      : 'bg-tinta text-papel',
                  )}
                >
                  {segundoAbierto ? slotPedido : <Plus className="size-3.5" aria-hidden />}
                </button>
              ) : null}
            </div>
          )
        }
        return (
          <button
            key={cada.id}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            id={`tab-${cada.id}`}
            aria-controls={`panel-${cada.id}`}
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

/**
 * Slot del tab en el shell `h-full overflow-hidden` del mostrador.
 * `pagina`: el panel entero es el scrollport (Cotizaciones + zona de carga).
 * `interno`: el slot recorta; el scroll vive en la lista/tabla del panel
 * (Pedido, Vecinos, Lista).
 */
export function CuerpoPestana({
  id,
  modo,
  children,
}: {
  readonly id: PestanaMostrador
  readonly modo: 'pagina' | 'interno'
  readonly children: ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      data-testid={`cuerpo-pestana-${id}`}
      className={
        modo === 'pagina'
          ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain'
          : 'flex min-h-0 flex-1 flex-col overflow-hidden'
      }
    >
      {children}
    </div>
  )
}
