/// <reference types="vite/client" />
import {
  HeadContent,
  Navigate,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  degradacionPrincipal,
  usarDegradacion,
  vigilarConectividad,
} from '../features/degradacion/estado.ts'
import { usarPedido } from '../features/pedido/almacen.ts'
import { usarSesion } from '../features/sesion/almacen.ts'
import { Toaster } from 'sileo'
import { BandaDegradacion } from '../ui/componentes/BandaDegradacion.tsx'
import { BarraLateral } from '../ui/componentes/BarraLateral.tsx'
import { CapaDeToasts } from '../ui/componentes/CapaDeToasts.tsx'
import hojaDeEstilos from '../styles.css?url'

/**
 * Cáscara Soft-Pill: sidebar + área de trabajo a todo el ancho (FR-005a).
 *
 * La banda de degradación vive aquí porque afecta a todas las pantallas
 * (FR-051). El pedido a medias se restaura al montar, no al entrar en venta.
 */

export interface ContextoDeRuta {
  readonly clienteDeConsultas: QueryClient
}

export const Route = createRootRouteWithContext<ContextoDeRuta>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'SuitPay' },
      { name: 'color-scheme', content: 'light' },
      { name: 'theme-color', content: '#f9fafb' },
    ],
    links: [{ rel: 'stylesheet', href: hojaDeEstilos }],
  }),
  shellComponent: Cascara,
  component: Mostrador,
  errorComponent: SeRompioAlgo,
  notFoundComponent: NoExiste,
})

function Cascara({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="es-PE">
      <head>
        <HeadContent />
      </head>
      <body className="bg-mesa text-tinta">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function Mostrador() {
  const degradacion = usarDegradacion(degradacionPrincipal)
  const restaurarPedido = usarPedido((estado) => estado.restaurar)
  const clienteDeConsultas = Route.useRouteContext().clienteDeConsultas
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const enAcceso = pathname === '/acceso'
  const cargandoSesion = usarSesion((s) => s.cargando)
  const uid = usarSesion((s) => s.uid)
  const sinSesion = !cargandoSesion && uid === null

  useEffect(() => usarSesion.getState().vigilar(), [])
  useEffect(() => vigilarConectividad(), [])

  useEffect(() => {
    void restaurarPedido()
  }, [restaurarPedido])

  return (
    <QueryClientProvider client={clienteDeConsultas}>
      <div
        className={
          enAcceso || sinSesion || cargandoSesion
            ? 'flex min-h-svh flex-col bg-mesa'
            : 'flex h-svh flex-col overflow-hidden bg-mesa'
        }
      >
        <BandaDegradacion
          degradacion={degradacion}
          onReintentarAsistencia={
            degradacion?.causa === 'asistencia'
              ? () => usarDegradacion.getState().resolver('asistencia')
              : undefined
          }
        />
        <CapaDeToasts>
          <Toaster
            position="top-right"
            theme="dark"
            options={{
              fill: '#171717',
              styles: {
                title: 'text-white!',
                description: 'text-white/75!',
                badge: 'bg-white/10!',
                button: 'bg-white/10! hover:bg-white/15!',
              },
            }}
          />
        </CapaDeToasts>

        {enAcceso ? (
          <Outlet />
        ) : cargandoSesion ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8">
            <p className="text-cuerpo text-desvaida">Comprobando sesión…</p>
          </div>
        ) : sinSesion ? (
          <Navigate to="/acceso" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <BarraLateral />
            <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-mesa">
              <Outlet />
            </main>
          </div>
        )}
      </div>
    </QueryClientProvider>
  )
}

function SeRompioAlgo({ error }: { readonly error: Error }) {
  useEffect(() => {
    console.error('[SuitPay] fallo no controlado', error)
  }, [error])

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-cabecera font-bold text-aviso">
        El sistema se detuvo
      </h1>
      <p className="mt-2 text-cuerpo">
        Vuelve a cargar la página. El pedido que tenías a medias no se pierde.
      </p>
    </div>
  )
}

function NoExiste() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-cabecera font-bold">Esta pantalla no existe</h1>
      <p className="mt-2 text-cuerpo text-desvaida">
        Revisa la dirección o vuelve al mostrador.
      </p>
    </div>
  )
}
