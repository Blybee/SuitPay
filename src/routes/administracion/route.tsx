import { Outlet, createFileRoute } from '@tanstack/react-router'
import { EncabezadoMigasAdmin } from '../../features/administracion/encabezado-migas.tsx'

/**
 * Layout de administración: migas en encabezado propio (ancho del main),
 * contenido de cada página en su contenedor debajo.
 */

export const Route = createFileRoute('/administracion')({
  component: LayoutAdministracion,
})

function LayoutAdministracion() {
  return (
    <div className="flex min-h-full flex-col">
      <EncabezadoMigasAdmin />
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
