import { createFileRoute, Link } from '@tanstack/react-router'
import { sileo } from 'sileo'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'

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
  const mostrar = usarNotificaciones((s) => s.mostrar)

  return (
    <div className="flex min-h-full flex-col px-6 py-8">
      <p className="max-w-3xl text-cuerpo text-desvaida">
        Administración del local: catálogo, series, umbral y usuarios.
      </p>
      <ul className="mt-8 flex flex-col gap-3">
        {ENLACES.map((enlace) => (
          <li key={enlace.to}>
            <Link
              to={enlace.to}
              className="block rounded-3xl border border-borde bg-papel p-6 shadow-sm transition hover:border-tinta"
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

      <section
        className="mt-10 max-w-3xl rounded-3xl border border-borde bg-papel p-5 shadow-sm"
        aria-label="Prueba de notificaciones"
      >
        <p className="font-mono text-etiqueta uppercase text-desvaida">
          Prueba de toasts
        </p>
        <p className="mt-1 text-cuerpo text-desvaida">
          Dispara cada tono de la isla flotante. Solo para validar diseño.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton
            variante="secundario"
            onClick={() =>
              mostrar({
                tono: 'exito',
                mensaje: 'La serie se guardó correctamente.',
              })
            }
          >
            Éxito
          </Boton>
          <Boton
            variante="peligro"
            onClick={() =>
              mostrar({
                tono: 'error',
                mensaje: 'No se pudo publicar el catálogo. Revisa el archivo.',
              })
            }
          >
            Error
          </Boton>
          <Boton
            variante="discreto"
            onClick={() =>
              mostrar({
                tono: 'info',
                mensaje:
                  'Pedido cargado desde B001-00000002. El comprobante original no se modifica.',
              })
            }
          >
            Info
          </Boton>
          <Boton
            variante="secundario"
            onClick={() =>
              mostrar({
                tono: 'exito',
                titulo: 'Catálogo publicado',
                mensaje: 'La versión 12 ya está disponible en los puestos.',
              })
            }
          >
            Con título
          </Boton>
          <Boton
            variante="discreto"
            onClick={() =>
              sileo.warning({
                title: 'Aviso',
                description: 'Toast warning de Sileo (sin tono SuitPay).',
              })
            }
          >
            Warning
          </Boton>
        </div>
      </section>
    </div>
  )
}
