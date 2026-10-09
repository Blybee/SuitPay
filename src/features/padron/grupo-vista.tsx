import { Truck, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { VistaDePadron } from './borrador.ts'

const OPCIONES: readonly {
  id: VistaDePadron
  etiqueta: string
  icono: LucideIcon
}[] = [
  { id: 'clientes', etiqueta: 'Clientes', icono: Users },
  { id: 'transportistas', etiqueta: 'Empresas de transporte', icono: Truck },
]

/**
 * Grupo de radio nativo: siempre hay una vista activa.
 * Solo iconos; el nombre accesible va en el control.
 */
export function GrupoDeVista({
  vista,
  onCambiar,
  deshabilitado = false,
}: {
  readonly vista: VistaDePadron
  readonly onCambiar: (vista: VistaDePadron) => void
  readonly deshabilitado?: boolean
}) {
  return (
    <fieldset
      className="m-0 flex items-center gap-1 border-0 p-0"
      disabled={deshabilitado}
    >
      <legend className="sr-only">Qué lista ver</legend>
      {OPCIONES.map((opcion) => {
        const Icono = opcion.icono
        const activo = vista === opcion.id
        return (
          <label key={opcion.id} className="group cursor-pointer">
            <input
              type="radio"
              name="vista-padron"
              value={opcion.id}
              checked={activo}
              className="peer sr-only"
              onChange={() => onCambiar(opcion.id)}
            />
            <span
              className={[
                'flex size-11 items-center justify-center rounded-full border',
                'transition-[color,background-color,border-color,box-shadow] duration-rapida ease-salida',
                'peer-focus-visible:border-tinta peer-focus-visible:ring-2 peer-focus-visible:ring-tinta/10',
                'motion-reduce:transition-none',
                activo
                  ? 'border-tinta bg-tinta text-papel'
                  : 'border-borde bg-papel text-desvaida group-hover:border-tinta/40 group-hover:text-tinta',
              ].join(' ')}
            >
              <Icono className="size-4" aria-hidden />
              <span className="sr-only">{opcion.etiqueta}</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
