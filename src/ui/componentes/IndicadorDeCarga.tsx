import { Loader2 } from 'lucide-react'

/**
 * Indicador de progreso indeterminado: texto + spinner, centrado.
 * Misma lectura que «Comprobando sesión…». Para lecturas a Firestore
 * (cotizaciones, comprobantes, sesión).
 */
export function IndicadorDeCarga({
  mensaje,
  className,
}: {
  readonly mensaje: string
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
        {mensaje}
        <Loader2
          className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      </p>
    </div>
  )
}
