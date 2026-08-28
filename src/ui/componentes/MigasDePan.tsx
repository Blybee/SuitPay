import { Link, useRouter } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Migas de pan reutilizables.
 * Si una capa tiene `hermanas`, se renderiza un select para saltar entre ellas.
 * Debe vivir en el encabezado del layout admin (no dentro de max-w del contenido).
 * Ver docs/UI-COMPONENTES.md.
 */

export interface HermanaDeMiga {
  readonly etiqueta: string
  readonly to: string
}

export interface ItemDeMiga {
  readonly etiqueta: string
  /** Si falta, es el tramo actual (texto, no enlace). */
  readonly to?: string
  /** Otras páginas del mismo nivel (select con chevron). */
  readonly hermanas?: readonly HermanaDeMiga[]
}

export function MigasDePan({
  items,
  className,
}: {
  readonly items: readonly ItemDeMiga[]
  readonly className?: string
}) {
  const router = useRouter()

  return (
    <nav
      aria-label="Migas de pan"
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-cuerpo">
        {items.map((item, indice) => {
          const esUltima = indice === items.length - 1
          const tieneHermanas =
            item.hermanas !== undefined && item.hermanas.length > 1

          return (
            <li
              key={`${item.etiqueta}-${indice}`}
              className="flex items-center gap-1.5"
            >
              {indice > 0 ? (
                <span className="text-desvaida" aria-hidden>
                  /
                </span>
              ) : null}

              {tieneHermanas ? (
                <span className="relative inline-flex w-fit max-w-full items-center">
                  <label className="sr-only" htmlFor={`miga-select-${indice}`}>
                    Cambiar sección: {item.etiqueta}
                  </label>
                  <select
                    id={`miga-select-${indice}`}
                    value={item.to ?? item.hermanas![0]!.to}
                    onChange={(evento) => {
                      const destino = evento.target.value
                      void router.navigate({ to: destino })
                    }}
                    className={[
                      'field-sizing-content w-auto max-w-full cursor-pointer appearance-none',
                      'border-0 bg-transparent p-0 pr-5 font-bold text-tinta',
                      'focus-visible:outline-none focus-visible:underline',
                    ].join(' ')}
                    aria-current={esUltima ? 'page' : undefined}
                  >
                    {item.hermanas!.map((hermana) => (
                      <option key={hermana.to} value={hermana.to}>
                        {hermana.etiqueta}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 text-desvaida"
                    aria-hidden
                  />
                </span>
              ) : item.to !== undefined && !esUltima ? (
                <Link
                  to={item.to}
                  className="font-bold text-desvaida hover:text-tinta focus-visible:outline-none focus-visible:underline"
                >
                  {item.etiqueta}
                </Link>
              ) : (
                <SpanActual esUltima={esUltima}>{item.etiqueta}</SpanActual>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function SpanActual({
  children,
  esUltima,
}: {
  readonly children: ReactNode
  readonly esUltima: boolean
}) {
  return (
    <span
      className={
        esUltima ? 'font-bold text-tinta' : 'font-bold text-desvaida'
      }
      aria-current={esUltima ? 'page' : undefined}
    >
      {children}
    </span>
  )
}
