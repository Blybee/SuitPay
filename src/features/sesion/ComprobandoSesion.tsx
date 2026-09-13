import { IndicadorDeCarga } from '../../ui/componentes/IndicadorDeCarga.tsx'

/**
 * Mientras Firebase Auth resuelve la sesión.
 */
export function ComprobandoSesion({
  className,
}: {
  readonly className?: string
}) {
  return (
    <IndicadorDeCarga mensaje="Comprobando sesión…" className={className} />
  )
}
