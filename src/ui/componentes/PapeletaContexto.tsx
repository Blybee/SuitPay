import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

/**
 * Panel de contexto Soft-Pill: superficie blanca, radios amplios, sombra suave.
 * Devuelve el foco al sitio exacto (Radix).
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
  readonly noSeCierraSola?: boolean
}) {
  return (
    <Dialog.Root open={abierta} onOpenChange={alCambiar}>
      <Dialog.Portal>
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
            '-translate-x-1/2 -translate-y-1/2',
            'rounded-3xl border border-borde bg-papel p-6 shadow-papeleta',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta',
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
