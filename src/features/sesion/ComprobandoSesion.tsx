import { Loader2 } from 'lucide-react'

/**
 * Indicador de progreso indeterminado mientras Firebase Auth resuelve la sesión.
 */

export function ComprobandoSesion({
  className,
}: {
  readonly className?: string
}) {
  return (
    <div
      className={['flex items-center justify-center p-8', className]
        .filter((cada) => cada !== undefined && cada !== '')
        .join(' ')}
      role="status"
      aria-busy="true"
    >
      <p className="flex items-center gap-3 text-cabecera font-bold text-tinta">
        Comprobando sesión…
        <Loader2
          className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      </p>
    </div>
  )
}
