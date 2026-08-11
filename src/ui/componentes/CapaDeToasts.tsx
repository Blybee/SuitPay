import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * Coloca el host de toasts en la **top layer** (Popover API) para que queden
 * por encima de un `<dialog showModal()>` y su backdrop.
 *
 * Un toast en el DOM normal queda detrás del modal: el diálogo modal vive en
 * top layer y ningún `z-index` lo supera. `popover="manual"` + `showPopover()`
 * mete este contenedor en esa misma capa.
 */
export function CapaDeToasts({ children }: { readonly children: ReactNode }) {
  const capa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const nodo = capa.current
    if (nodo === null) return
    if (typeof nodo.showPopover !== 'function') return
    try {
      if (!nodo.matches(':popover-open')) {
        nodo.showPopover()
      }
    } catch {
      // Ya abierta o entorno sin soporte completo: los toasts siguen en DOM.
    }
  }, [])

  return (
    <div
      ref={capa}
      id="suitpay-toasts"
      popover="manual"
      className="suitpay-toast-layer"
    >
      {children}
    </div>
  )
}
