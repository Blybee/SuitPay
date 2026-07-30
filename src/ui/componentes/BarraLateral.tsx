import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usarSesion } from '../../features/sesion/almacen.ts'
import type { Rol } from '../../features/sesion/almacen.ts'
import { MarcaSuitPay } from './MarcaSuitPay.tsx'
import { Boton } from './primitivas.tsx'

/**
 * Sidebar Soft-Pill colapsable: marca arriba, nav, perfil + logout al pie
 * (FR-005a). Reutilizable: el mostrador y la administración pasan sus ítems
 * (o se eligen según el rol).
 */

const CLAVE_COLAPSADA = 'suitpay.sidebar.colapsada'

export interface ItemDeBarraLateral {
  readonly to:
    | '/'
    | '/configuracion'
    | '/administracion'
    | '/administracion/catalogo'
    | '/administracion/series'
    | '/administracion/usuarios'
    | '/administracion/parametros'
    | '/acceso'
  readonly etiqueta: string
  readonly icono: LucideIcon
  readonly exacto?: boolean
}

const ITEMS_VENDEDOR: readonly ItemDeBarraLateral[] = [
  { to: '/', etiqueta: 'Inicio', icono: Store, exacto: true },
  {
    to: '/configuracion',
    etiqueta: 'Configuración',
    icono: Settings,
    exacto: false,
  },
]

const ITEMS_ADMIN: readonly ItemDeBarraLateral[] = [
  {
    to: '/administracion',
    etiqueta: 'Inicio',
    icono: LayoutDashboard,
    exacto: false,
  },
  { to: '/', etiqueta: 'Mostrador', icono: Store, exacto: true },
]

export function itemsParaRol(rol: Rol | null): readonly ItemDeBarraLateral[] {
  if (rol === 'administrador' || rol === 'jefe') return ITEMS_ADMIN
  return ITEMS_VENDEDOR
}

function unir(...clases: readonly (string | false | undefined)[]): string {
  return clases.filter((cada) => typeof cada === 'string').join(' ')
}

function leerColapsada(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CLAVE_COLAPSADA) === '1'
  } catch {
    return false
  }
}

function itemActivo(
  pathname: string,
  item: ItemDeBarraLateral,
): boolean {
  if (item.exacto) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export interface PropsDeBarraLateral {
  readonly items?: readonly ItemDeBarraLateral[]
  /** Subtítulo bajo la marca (p. ej. «Mostrador» / «Administración»). */
  readonly ambito?: string
}

export function BarraLateral({ items, ambito }: PropsDeBarraLateral) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const nombre = usarSesion((s) => s.nombre)
  const correo = usarSesion((s) => s.correo)
  const rol = usarSesion((s) => s.rol)
  const cargando = usarSesion((s) => s.cargando)
  const salir = usarSesion((s) => s.salir)
  const [colapsada, setColapsada] = useState(false)

  async function cerrarSesion(): Promise<void> {
    await salir()
    await navigate({ to: '/acceso' })
  }

  const enAdmin = pathname.startsWith('/administracion')
  const menu = items ?? (enAdmin ? ITEMS_ADMIN : itemsParaRol(rol))
  const etiquetaAmbito =
    ambito ?? (enAdmin || rol === 'administrador' || rol === 'jefe'
      ? 'Administración'
      : 'Mostrador')

  useEffect(() => {
    setColapsada(leerColapsada())
  }, [])

  function alternar(): void {
    setColapsada((actual) => {
      const siguiente = !actual
      try {
        window.localStorage.setItem(CLAVE_COLAPSADA, siguiente ? '1' : '0')
      } catch {
        /* sin persistencia si el almacenamiento está bloqueado */
      }
      return siguiente
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-borde bg-papel px-3 py-2 md:hidden">
        <p className="mr-1 shrink-0 text-cuerpo font-bold text-tinta">SuitPay</p>
        <nav className="flex min-w-0 flex-1 gap-1" aria-label="Menú">
          {menu.map((item) => {
            const activo = itemActivo(pathname, item)
            return (
              <Link
                key={`${item.to}-${item.etiqueta}`}
                to={item.to}
                className={unir(
                  'min-h-11 rounded-full px-3 text-etiqueta font-bold uppercase',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta',
                  activo ? 'bg-tinta text-papel' : 'bg-mesa text-desvaida',
                )}
                aria-current={activo ? 'page' : undefined}
              >
                {item.etiqueta}
              </Link>
            )
          })}
        </nav>
        <Boton
          variante="discreto"
          className="shrink-0 px-2"
          onClick={() => void cerrarSesion()}
          disabled={cargando || nombre === null}
          aria-label="Cerrar sesión"
        >
          <LogOut className="size-4" aria-hidden />
        </Boton>
      </div>

      <aside
        className={unir(
          'hidden shrink-0 flex-col border-r border-borde bg-papel transition-[width] duration-200 md:flex',
          colapsada
            ? 'w-[var(--ancho-sidebar-colapsada)]'
            : 'w-[var(--ancho-sidebar)]',
        )}
        aria-label="Navegación principal"
        data-colapsada={colapsada ? 'true' : 'false'}
      >
        <div
          className={unir(
            'flex pb-4 pt-5',
            colapsada ? 'justify-center px-2' : 'items-center gap-3 px-4',
          )}
        >
          {!colapsada && (
            <>
              <MarcaSuitPay className="size-9 shrink-0 text-tinta" />
              <div className="min-w-0 flex-1">
                <p className="text-cabecera font-bold tracking-tight text-tinta">
                  SuitPay
                </p>
                <p className="mt-0.5 text-etiqueta uppercase text-desvaida">
                  {etiquetaAmbito}
                </p>
              </div>
            </>
          )}
          <Boton
            variante="discreto"
            className="shrink-0 px-2"
            onClick={alternar}
            aria-label={colapsada ? 'Expandir menú' : 'Colapsar menú'}
            aria-expanded={!colapsada}
            title={colapsada ? 'Expandir' : 'Colapsar'}
          >
            {colapsada ? (
              <PanelLeftOpen className="size-5" aria-hidden />
            ) : (
              <PanelLeftClose className="size-5" aria-hidden />
            )}
          </Boton>
        </div>

        <nav
          className={unir(
            'flex flex-1 flex-col gap-1',
            colapsada ? 'items-center px-1' : 'px-3',
          )}
          aria-label="Menú"
        >
          {menu.map((item) => {
            const activo = itemActivo(pathname, item)
            const Icono = item.icono
            return (
              <Link
                key={`${item.to}-${item.etiqueta}`}
                to={item.to}
                title={item.etiqueta}
                className={unir(
                  'flex min-h-11 items-center rounded-full font-bold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta',
                  colapsada
                    ? 'w-11 justify-center px-0'
                    : 'gap-3 px-4 text-cuerpo',
                  activo
                    ? 'bg-tinta text-papel'
                    : 'text-desvaida hover:bg-mesa hover:text-tinta',
                )}
                aria-current={activo ? 'page' : undefined}
                aria-label={colapsada ? item.etiqueta : undefined}
              >
                <Icono className="size-5 shrink-0" aria-hidden />
                {!colapsada && item.etiqueta}
              </Link>
            )
          })}
        </nav>

        <div
          className={unir(
            'mt-auto border-t border-borde py-4',
            colapsada ? 'px-1' : 'px-4',
          )}
        >
          {!colapsada && (
            <div className="mb-3 min-w-0">
              <p className="truncate text-cuerpo font-bold text-tinta">
                {cargando ? '…' : (nombre ?? 'Sin sesión')}
              </p>
              {correo !== null && (
                <p className="truncate text-etiqueta text-desvaida">{correo}</p>
              )}
            </div>
          )}
          <Boton
            variante="discreto"
            className={unir(
              colapsada ? 'w-11 justify-center px-0' : 'w-full justify-start px-3',
            )}
            onClick={() => void cerrarSesion()}
            disabled={cargando || nombre === null}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" aria-hidden />
            {!colapsada && 'Cerrar sesión'}
          </Boton>
        </div>
      </aside>
    </>
  )
}
