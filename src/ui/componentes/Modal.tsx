import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { CapaDeDialogo } from './capa-dialogo.ts'

/**
 * Modal Soft-Pill reutilizable sobre `<dialog>` nativo.
 *
 * `showModal()` atrapa el foco, Esc nativo y `::backdrop`. El nodo se publica
 * en `CapaDeDialogo` para que un listbox (Selector) se porte dentro de la
 * top layer y no quede detrás.
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
  /**
   * Light-dismiss: clic en el fondo. Por omisión sí. `false` deja Esc y el
   * botón de cerrar; el fondo no cierra (`closedby="closerequest"`).
   */
  readonly cerrarConFondo?: boolean
  readonly className?: string
  /** Acción en la esquina de la cabecera (p. ej. Ver todos). */
  readonly cabeceraExtra?: ReactNode
}

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

function closedbyDe(opciones: {
  readonly noSeCierraSola: boolean
  readonly cerrarConFondo: boolean
}): 'none' | 'any' | 'closerequest' {
  if (opciones.noSeCierraSola) return 'none'
  return opciones.cerrarConFondo ? 'any' : 'closerequest'
}

export function Modal({
  abierta,
  alCambiar,
  titulo,
  descripcion,
  children,
  pie,
  noSeCierraSola = false,
  cerrarConFondo = true,
  className,
  cabeceraExtra,
}: PropsDeModal) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [capa, setCapa] = useState<HTMLElement | null>(null)
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
      if (noSeCierraSola || !cerrarConFondo) return
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
  }, [alCambiar, noSeCierraSola, cerrarConFondo])

  const desbordaVisible = className?.includes('overflow-visible') === true

  return (
    <dialog
      ref={(nodo) => {
        dialogo.current = nodo
        setCapa((prev) => (prev === nodo ? prev : nodo))
      }}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion === undefined ? undefined : idDescripcion}
      // Atributo HTML nativo (Baseline Newly Available). React 19 lo reenvía.
      {...{ closedby: closedbyDe({ noSeCierraSola, cerrarConFondo }) }}
      className={unir(
        'modal-suitpay',
        'w-[min(34rem,calc(100vw-2rem))] max-h-[min(90vh,40rem)]',
        desbordaVisible ? 'overflow-visible' : 'overflow-y-auto',
        'rounded-3xl border border-borde bg-papel p-6 shadow-papeleta',
        'text-tinta focus-visible:outline-none focus-visible:border-tinta',
        className,
      )}
    >
      <CapaDeDialogo.Provider value={capa}>
        <div className="flex items-start justify-between gap-3">
          <h2 id={idTitulo} className="text-cabecera font-bold text-tinta">
            {titulo}
          </h2>
          {cabeceraExtra}
        </div>

        {descripcion !== undefined ? (
          <p id={idDescripcion} className="mt-1 text-cuerpo text-desvaida">
            {descripcion}
          </p>
        ) : null}

        <div className="mt-4">{children}</div>

        {pie !== undefined ? (
          <div className="mt-5 flex flex-wrap justify-end gap-3">{pie}</div>
        ) : null}
      </CapaDeDialogo.Provider>
    </dialog>
  )
}
