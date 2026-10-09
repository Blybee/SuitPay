import { createFileRoute } from '@tanstack/react-router'
import {
  Brain,
  Hash,
  Package,
  SlidersHorizontal,
  Truck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { sileo } from 'sileo'
import { CabeceraAdmin } from '../../features/administracion/cabecera-admin.tsx'
import { usarNotificaciones } from '../../features/notificaciones/almacen.ts'
import { usarSesion } from '../../features/sesion/almacen.ts'
import { GuardaSesion } from '../../features/sesion/GuardaSesion.tsx'
import { Boton } from '../../ui/componentes/primitivas.tsx'
import { Tarjeta } from '../../ui/componentes/Tarjeta.tsx'

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

const ENLACES: readonly {
  to:
    | '/administracion/catalogo'
    | '/administracion/series'
    | '/administracion/usuarios'
    | '/administracion/parametros'
    | '/administracion/aprendizaje'
    | '/administracion/clientes-transporte'
  titulo: string
  descripcion: string
  icono: LucideIcon
  soloAdministrador?: boolean
}[] = [
  {
    to: '/administracion/catalogo',
    titulo: 'Catálogo',
    descripcion:
      'Lista, alta, importar y cantidades orientativas. No es el inventario de registro.',
    icono: Package,
  },
  {
    to: '/administracion/series',
    titulo: 'Series',
    descripcion: 'Establecimientos y series por vendedor.',
    icono: Hash,
  },
  {
    to: '/administracion/usuarios',
    titulo: 'Usuarios',
    descripcion: 'Alta, roles y activación.',
    icono: Users,
  },
  {
    to: '/administracion/parametros',
    titulo: 'Parámetros',
    descripcion: 'Umbral de identificación e impresión.',
    icono: SlidersHorizontal,
  },
  {
    to: '/administracion/aprendizaje',
    titulo: 'Aprendizaje',
    descripcion:
      'Entrena con pares de referencia y revisa alias, etiquetas y priores.',
    icono: Brain,
  },
  {
    to: '/administracion/clientes-transporte',
    titulo: 'Clientes y Empresas de Transporte',
    descripcion: 'Importa la lista de clientes y la de empresas de transporte.',
    icono: Truck,
    soloAdministrador: true,
  },
]

function InicioAdministracion() {
  const mostrar = usarNotificaciones((s) => s.mostrar)
  const rol = usarSesion((s) => s.rol)
  const enlaces =
    rol === 'administrador'
      ? ENLACES
      : ENLACES.filter((enlace) => enlace.soloAdministrador !== true)

  return (
    <div className="flex min-h-full flex-col px-6 py-8">
      <CabeceraAdmin titulo="Administración" />
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4">
        {enlaces.map((enlace) => (
          <li key={enlace.to}>
            <Tarjeta
              to={enlace.to}
              titulo={enlace.titulo}
              descripcion={enlace.descripcion}
              icono={enlace.icono}
            />
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
