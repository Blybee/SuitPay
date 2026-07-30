import { Navigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { usarSesion } from './almacen.ts'
import type { Rol } from './almacen.ts'

/**
 * Redirige a `/acceso` si no hay sesión, o a Inicio si el rol no basta.
 */

export function GuardaSesion({
  children,
  roles,
}: {
  readonly children: ReactNode
  readonly roles?: readonly Rol[]
}) {
  const cargando = usarSesion((s) => s.cargando)
  const uid = usarSesion((s) => s.uid)
  const rol = usarSesion((s) => s.rol)
  const activo = usarSesion((s) => s.activo)

  if (cargando) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-cuerpo text-desvaida">Comprobando sesión…</p>
      </div>
    )
  }

  if (uid === null) {
    return <Navigate to="/acceso" />
  }

  if (!activo || rol === null) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="text-cabecera font-bold text-aviso">
          Usuario sin permiso
        </h1>
        <p className="mt-2 text-cuerpo text-desvaida">
          Tu cuenta existe pero no tiene rol activo. El administrador debe
          asignártelo antes de usar SuitPay.
        </p>
      </div>
    )
  }

  if (roles !== undefined && !roles.includes(rol)) {
    return <Navigate to="/" />
  }

  return children
}
