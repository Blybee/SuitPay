import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { usarSesion } from '../features/sesion/almacen.ts'

/**
 * Destino histórico del menú «Configuración» (T162).
 * Administradores van al Inicio de administración; el vendedor ve un acceso
 * acotado (sin importar catálogo).
 */

export const Route = createFileRoute('/configuracion')({
  component: Configuracion,
})

function Configuracion() {
  const rol = usarSesion((s) => s.rol)

  if (rol === 'administrador' || rol === 'jefe') {
    return <Navigate to="/administracion" />
  }

  return (
    <div className="flex min-h-full flex-col px-6 py-8">
      <h1 className="text-cabecera font-bold text-tinta">Configuración</h1>
      <p className="mt-2 max-w-xl text-cuerpo text-desvaida">
        La carga del catálogo, las series y los usuarios están en Administración.
        Si necesitas cambiar algo, habla con el administrador.
      </p>
      <p className="mt-8">
        <Link
          to="/"
          className="font-bold text-marca underline-offset-2 hover:underline"
        >
          Volver al mostrador
        </Link>
      </p>
    </div>
  )
}
