import { createFileRoute, Link } from '@tanstack/react-router'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'

/**
 * Inicio de administración: hub de funciones (catálogo, series, …).
 */

export const Route = createFileRoute('/administracion/')({
  component: () => (
    <GuardaSesion roles={['administrador', 'jefe']}>
      <InicioAdministracion />
    </GuardaSesion>
  ),
})

const ENLACES = [
  {
    to: '/administracion/catalogo' as const,
    etiqueta: 'Catálogo',
    detalle: 'Importar productos desde el JSON de la tienda',
  },
  {
    to: '/administracion/series' as const,
    etiqueta: 'Series',
    detalle: 'Establecimientos y series por vendedor',
  },
  {
    to: '/administracion/usuarios' as const,
    etiqueta: 'Usuarios',
    detalle: 'Alta, roles y activación',
  },
  {
    to: '/administracion/parametros' as const,
    etiqueta: 'Parámetros',
    detalle: 'Umbral de identificación e impresión',
  },
]

function InicioAdministracion() {
  return (
    <div className="flex min-h-full flex-col px-6 py-8">
      <h1 className="text-cabecera font-bold text-tinta">Inicio</h1>
      <p className="mt-2 max-w-xl text-cuerpo text-desvaida">
        Administración del local: catálogo, series, umbral y usuarios.
      </p>
      <ul className="mt-8 flex flex-col gap-3">
        {ENLACES.map((enlace) => (
          <li key={enlace.to}>
            <Link
              to={enlace.to}
              className="block rounded-3xl border border-borde bg-papel p-6 shadow-sm transition hover:border-marca"
            >
              <p className="font-mono text-etiqueta uppercase text-desvaida">
                {enlace.etiqueta}
              </p>
              <p className="mt-2 text-cuerpo font-bold text-tinta">
                {enlace.detalle}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
