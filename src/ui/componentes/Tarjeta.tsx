import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

/**
 * Card Soft-Pill: título, icono grande, descripción.
 * Con `to` es un enlace de navegación; sin `to` es solo superficie.
 * El grid padre define las columnas (`auto-fit` / `minmax`).
 */

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

const CLASES_TARJETA = unir(
  'flex h-full min-h-56 flex-col gap-5 rounded-3xl border border-borde bg-papel p-6 shadow-sm',
  'transition-[border-color,box-shadow] duration-200 ease-out',
  'hover:border-tinta hover:shadow-md',
  'focus-visible:border-tinta',
)

export function Tarjeta({
  titulo,
  descripcion,
  icono: Icono,
  to,
}: {
  readonly titulo: string
  readonly descripcion: string
  readonly icono: LucideIcon
  readonly to?: LinkProps['to']
}) {
  const cuerpo = (
    <>
      <h2 className="text-cabecera font-bold text-tinta">{titulo}</h2>
      <div className="flex flex-1 items-center justify-center" aria-hidden>
        <span className="flex size-20 items-center justify-center rounded-full bg-mesa text-tinta">
          <Icono className="size-10" strokeWidth={1.75} />
        </span>
      </div>
      <p className="text-cuerpo text-desvaida">{descripcion}</p>
    </>
  )

  if (to !== undefined) {
    return (
      <Link to={to} className={CLASES_TARJETA}>
        {cuerpo}
      </Link>
    )
  }

  return <div className={CLASES_TARJETA}>{cuerpo}</div>
}
