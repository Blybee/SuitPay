import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

/**
 * La papeleta de contexto.
 *
 * Es la herramienta que resuelve los pasos intermedios: cuando el vendedor dictó
 * una razón social con varias coincidencias, cuando faltó un dato en un comando, o
 * cuando hay que confirmar algo antes de seguir. Aparece, se resuelve y se va.
 *
 * ## Tres decisiones que no se deben tocar
 *
 * **Es la única sombra del sistema.** Todo lo demás está impreso sobre el papel y
 * lo impreso no flota. Esto sí: es una hoja dejada encima. La sombra corta que
 * proyecta es el único `shadow-*` que existe en los tokens, precisamente para que
 * nadie pueda ponerle sombra a otra cosa.
 *
 * **Va ligeramente rotada.** Un par de grados, como una hoja dejada de cualquier
 * manera. Es el detalle que hace que se lea como algo puesto encima y no como
 * otra región de la interfaz.
 *
 * **Devuelve el foco al sitio exacto donde estaba el vendedor.** Radix lo hace
 * por omisión y por eso se usa Radix: resolver una ambigüedad y que el foco
 * aterrice al principio del formulario obligaría a recorrer el camino otra vez, y
 * esto se abre cien veces al día.
 */
export function PapeletaContexto({
  abierta,
  alCambiar,
  titulo,
  descripcion,
  children,
  pie,
  noSeCierraSola = false,
}: {
  readonly abierta: boolean
  readonly alCambiar: (abierta: boolean) => void
  readonly titulo: string
  readonly descripcion?: string
  readonly children: ReactNode
  readonly pie?: ReactNode
  /**
   * Impide cerrarla con Escape o pulsando fuera. Se usa en un solo sitio y por un
   * motivo concreto: cuando la emisión queda sin confirmar, un vendedor con prisa
   * pulsa Escape por reflejo y se perdería la única indicación de que **no debe
   * volver a emitir**. Para todo lo demás, cerrar por reflejo es lo deseable.
   */
  readonly noSeCierraSola?: boolean
}) {
  return (
    <Dialog.Root open={abierta} onOpenChange={alCambiar}>
      <Dialog.Portal>
        {/* La mesa se oscurece un poco para que la hoja de encima se lea como
            tal, sin llegar a tapar el pedido que hay debajo: el vendedor tiene
            que poder consultarlo mientras resuelve la papeleta. */}
        <Dialog.Overlay className="fixed inset-0 bg-tinta/25" />
        <Dialog.Content
          onEscapeKeyDown={(evento) => {
            if (noSeCierraSola) evento.preventDefault()
          }}
          onPointerDownOutside={(evento) => {
            if (noSeCierraSola) evento.preventDefault()
          }}
          className={[
            'fixed left-1/2 top-1/2 w-[min(34rem,calc(100vw-2rem))]',
            '-translate-x-1/2 -translate-y-1/2 rotate-[-1.2deg]',
            'border-2 border-tinta bg-papel p-5 shadow-papeleta',
            'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tinta',
          ].join(' ')}
        >
          <Dialog.Title className="text-cabecera font-bold text-tinta">
            {titulo}
          </Dialog.Title>

          {descripcion !== undefined ? (
            <Dialog.Description className="mt-1 text-cuerpo text-desvaida">
              {descripcion}
            </Dialog.Description>
          ) : null}

          <div className="mt-4">{children}</div>

          {pie !== undefined ? (
            <div className="mt-5 flex justify-end gap-3">{pie}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
