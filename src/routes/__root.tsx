/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { QueryClientProvider  } from '@tanstack/react-query'
import type {QueryClient} from '@tanstack/react-query';
import { useEffect  } from 'react'
import type {ReactNode} from 'react';
import {
  degradacionPrincipal,
  usarDegradacion,
  vigilarConectividad,
} from '../features/degradacion/estado.ts'
import { usarPedido } from '../features/pedido/almacen.ts'
import { BandaDegradacion } from '../ui/componentes/BandaDegradacion.tsx'
import hojaDeEstilos from '../styles.css?url'

/**
 * La disposición raíz: la mesa de trabajo.
 *
 * ## Por qué la banda va aquí y no en cada pantalla
 *
 * El estado degradado no pertenece a ninguna pantalla en particular: afecta a lo
 * que el vendedor puede hacer en todas. Ponerla en la raíz garantiza que no se
 * puede navegar a un sitio donde el aviso no esté, que es exactamente el fallo
 * que FR-051 quiere evitar.
 *
 * ## La disposición es una sola columna, y es deliberado
 *
 * Sin barra lateral, sin paneles, sin pestañas. La hoja de trabajo ocupa el
 * ancho porque es lo único que importa mientras hay un cliente delante. Lo demás
 * —comprobantes del día, cotizaciones, administración— son destinos a los que se
 * va, no cosas que compitan por la atención en el borde de la pantalla.
 *
 * Esto es también lo que hace que la versión de teléfono no sea una adaptación:
 * una sola columna ya es la disposición de un teléfono.
 */

export interface ContextoDeRuta {
  readonly clienteDeConsultas: QueryClient
}

export const Route = createRootRouteWithContext<ContextoDeRuta>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      // Sin `maximum-scale`: limitar el zoom impide ampliar el texto a quien lo
      // necesita, y aquí se leen importes y números de comprobante.
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'SuitPay' },
      { name: 'color-scheme', content: 'light' },
      { name: 'theme-color', content: '#FDFCF8' },
    ],
    links: [{ rel: 'stylesheet', href: hojaDeEstilos }],
  }),
  shellComponent: Cascara,
  component: Mostrador,
  errorComponent: SeRompioAlgo,
  notFoundComponent: NoExiste,
})

/**
 * La cáscara es lo único que se renderiza en el servidor. En modo SPA se
 * prerrenderiza una vez en la compilación y se sirve estática, así que no puede
 * depender de nada del usuario: cuando existe, todavía no hay sesión.
 */
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

  useEffect(() => vigilarConectividad(), [])

  // El pedido a medias se recupera al montar, no al entrar en la pantalla de
  // venta: si el vendedor recarga estando en otra pantalla, el pedido tiene que
  // seguir ahí cuando vuelva.
  useEffect(() => {
    void restaurarPedido()
  }, [restaurarPedido])

  return (
    <QueryClientProvider client={clienteDeConsultas}>
      <div className="flex min-h-svh flex-col bg-mesa">
        <BandaDegradacion degradacion={degradacion} />

        {/* La hoja: papel sobre la mesa, con ancho máximo para que una línea de
            descripción no llegue a ser ilegible en un monitor grande. */}
        <main className="mx-auto w-full max-w-5xl flex-1 border-x-2 border-desvaida bg-papel">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  )
}

/**
 * El error de última instancia. Dice qué hacer, no qué falló: el vendedor no
 * puede accionar un rastro de pila, y el detalle técnico va a la consola.
 */
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
