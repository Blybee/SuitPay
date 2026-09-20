import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { EllipsisVertical } from 'lucide-react'
import { Boton } from '../../ui/componentes/primitivas.tsx'

/**
 * Overflow menu de la barra de Catálogo (móvil). Mismo patrón que el kebab
 * de captura: pointerdown fuera, Escape, motion con .menu-desborde.
 */

export function MenuAccionesCatalogo({
  children,
}: {
  readonly children: ReactNode
}) {
  const idMenu = useId()
  const [abierto, setAbierto] = useState(false)
  const cajaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function alPuntero(evento: PointerEvent): void {
      if (cajaRef.current?.contains(evento.target as Node)) return
      setAbierto(false)
    }
    function alTecla(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('pointerdown', alPuntero)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('pointerdown', alPuntero)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  return (
    <div ref={cajaRef} className="relative flex md:hidden">
      <Boton
        variante="secundario"
        tamano="icono"
        aria-label={abierto ? 'Cerrar más acciones' : 'Más acciones'}
        title="Más acciones"
        aria-expanded={abierto}
        aria-controls={idMenu}
        data-testid="menu-acciones-catalogo"
        onClick={() => setAbierto((actual) => !actual)}
      >
        <EllipsisVertical className="size-5" aria-hidden />
      </Boton>
      <div
        id={idMenu}
        role="menu"
        tabIndex={-1}
        data-testid="menu-acciones-catalogo-panel"
        data-open={abierto ? 'true' : undefined}
        className="menu-desborde absolute top-full right-0 z-40 mt-2 min-w-56 flex-col gap-1 rounded-2xl border border-borde bg-papel p-2 shadow-md"
        onClick={() => setAbierto(false)}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') setAbierto(false)
        }}
      >
        {children}
      </div>
    </div>
  )
}
