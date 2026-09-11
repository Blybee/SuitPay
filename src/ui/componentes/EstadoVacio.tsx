import type { ReactNode } from 'react'
import { IlustracionSinResultados } from './IlustracionSinResultados.tsx'

/**
 * Empty state de listas del mostrador: ilustración, título debajo y pista opcional.
 */

export function EstadoVacio({
  titulo,
  children,
}: {
  readonly titulo: string
  readonly children?: ReactNode
}) {
  return (
    <div
      className="estado-vacio mx-auto flex w-full max-w-md flex-col items-center px-4 py-8 text-center"
      role="status"
    >
      <IlustracionSinResultados className="h-auto w-[min(7.5rem,42vw)] text-tinta sm:w-[min(9rem,32vw)]" />
      <p className="mt-4 text-cabecera font-bold text-tinta">{titulo}</p>
      {children !== undefined && children !== null ? (
        <div className="mt-3 text-cuerpo text-desvaida">{children}</div>
      ) : null}
    </div>
  )
}
