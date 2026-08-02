import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * Modal Soft-Pill reutilizable sobre `<dialog>` nativo.
 *
 * ## Por qué `<dialog>` y no Radix
 *
 * La guía modern-web-guidance (html / light-dismiss / declarative-dialog) pide
 * `showModal()` para atrapar el foco, `Esc` nativo, `::backdrop` y, cuando
 * aplique, `closedby` para light-dismiss. Eso es la base; el diseño Soft-Pill
 * va encima.
 *
 * API controlada (`abierta` / `alCambiar`) para encajar con el estado React
 * del mostrador sin depender de Invoker Commands (Newly Available + polyfill).
 */

export interface PropsDeModal {
  readonly abierta: boolean
  readonly alCambiar: (abierta: boolean) => void
  readonly titulo: string
  readonly descripcion?: string
  readonly children: ReactNode
  readonly pie?: ReactNode
  /**
   * Impide cerrar con Esc o clic fuera. Para flujos que exigen una decisión
   * explícita (p. ej. emisión en verificación).
   */
  readonly noSeCierraSola?: boolean
  readonly className?: string
}

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

export function Modal({
  abierta,
  alCambiar,
  titulo,
  descripcion,
  children,
  pie,
  noSeCierraSola = false,
  className,
}: PropsDeModal) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idDescripcion = useId()
  /** Evita eco: close() programático no debe notificar al padre otra vez. */
  const cerrandoDesdeProps = useRef(false)

  useEffect(() => {
    const nodo = dialogo.current
    if (nodo === null) return

    if (abierta) {
      if (!nodo.open) {
        cerrandoDesdeProps.current = true
        nodo.showModal()
        cerrandoDesdeProps.current = false
      }
      return
    }

    if (nodo.open) {
      cerrandoDesdeProps.current = true
      nodo.close()
      cerrandoDesdeProps.current = false
    }
  }, [abierta])

  useEffect(() => {
    const nodo = dialogo.current
    if (nodo === null) return

    const alCerrar = () => {
      if (cerrandoDesdeProps.current) return
      alCambiar(false)
    }

    const alCancelar = (evento: Event) => {
      if (noSeCierraSola) evento.preventDefault()
    }

    /**
     * Light-dismiss de respaldo: clic en el propio `<dialog>` (área del
     * backdrop del elemento) cuando `closedby` aún no está disponible.
     * Con soporte nativo, `closedby="any"` cubre el mismo gesto.
     */
    const alClic = (evento: MouseEvent) => {
      if (noSeCierraSola) return
      if (evento.target === nodo) nodo.close()
    }

    nodo.addEventListener('close', alCerrar)
    nodo.addEventListener('cancel', alCancelar)
    nodo.addEventListener('click', alClic)
    return () => {
      nodo.removeEventListener('close', alCerrar)
      nodo.removeEventListener('cancel', alCancelar)
      nodo.removeEventListener('click', alClic)
    }
  }, [alCambiar, noSeCierraSola])

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion === undefined ? undefined : idDescripcion}
      // Atributo HTML nativo (Baseline Newly Available). React 19 lo reenvía.
      {...{ closedby: noSeCierraSola ? 'none' : 'any' }}
      className={unir(
        'modal-suitpay',
        'w-[min(34rem,calc(100vw-2rem))] max-h-[min(90vh,40rem)]',
        'overflow-y-auto rounded-3xl border border-borde bg-papel p-6 shadow-papeleta',
        'text-tinta focus-visible:outline-none focus-visible:border-tinta',
        className,
      )}
    >
      <h2 id={idTitulo} className="text-cabecera font-bold text-tinta">
        {titulo}
      </h2>

      {descripcion !== undefined ? (
        <p id={idDescripcion} className="mt-1 text-cuerpo text-desvaida">
          {descripcion}
        </p>
      ) : null}

      <div className="mt-4">{children}</div>

      {pie !== undefined ? (
        <div className="mt-5 flex flex-wrap justify-end gap-3">{pie}</div>
      ) : null}
    </dialog>
  )
}
