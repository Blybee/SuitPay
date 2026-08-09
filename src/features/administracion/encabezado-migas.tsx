import { useRouterState } from '@tanstack/react-router'
import { MigasDePan } from '../../ui/componentes/MigasDePan.tsx'
import { HERMANAS_ADMIN } from './migas.ts'
import type { RutaAdminHermana } from './migas.ts'

/**
 * Barra de migas del layout de administración (fuera del contenedor de contenido).
 */
export function EncabezadoMigasAdmin() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const enHub =
    pathname === '/administracion' || pathname === '/administracion/'

  if (enHub) {
    return (
      <header className="sticky top-0 z-10 shrink-0 border-b border-borde bg-mesa px-6 py-3">
        <MigasDePan items={[{ etiqueta: 'Inicio' }]} />
        <h1 className="sr-only">Inicio</h1>
      </header>
    )
  }

  const seccion = HERMANAS_ADMIN.find((cada) => cada.to === pathname)
  const actual: { etiqueta: string; to: RutaAdminHermana } = seccion ?? {
    etiqueta: 'Administración',
    to: '/administracion/catalogo',
  }

  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-borde bg-mesa px-6 py-3">
      <MigasDePan
        items={[
          { etiqueta: 'Inicio', to: '/administracion' },
          {
            etiqueta: actual.etiqueta,
            to: actual.to,
            hermanas: HERMANAS_ADMIN,
          },
        ]}
      />
    </header>
  )
}
