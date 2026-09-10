import type { ReactNode } from 'react'
import { IlustracionSinResultados } from './IlustracionSinResultados.tsx'

/**
 * Empty state de listas del mostrador: título centrado y la ilustración debajo.
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
      <p className="text-cabecera font-bold text-tinta">{titulo}</p>
      <IlustracionSinResultados className="mt-6 h-auto w-[min(10rem,55vw)] text-tinta sm:w-[min(12.5rem,40vw)]" />
      {children !== undefined && children !== null ? (
        <div className="mt-4 text-cuerpo text-desvaida">{children}</div>
      ) : null}
    </div>
  )
}
