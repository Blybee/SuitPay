import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { crearClienteDeConsultas } from './infra/consultas/cliente.ts'

/**
 * El enrutador.
 *
 * ## El cliente de consultas viaja en el contexto
 *
 * Va en el contexto del enrutador y no en un proveedor de React porque así los
 * cargadores de ruta pueden usarlo antes de que se monte ningún componente. Es lo
 * que permite que una ruta declare lo que necesita y lo tenga listo al pintarse.
 *
 * ## El componente de espera es la cáscara de la aplicación
 *
 * En modo SPA, la compilación **prerrenderiza la ruta raíz con este mismo
 * componente de espera** y guarda el resultado como cáscara estática. O sea que
 * `defaultPendingComponent` no es solo lo que se ve entre navegaciones: es
 * literalmente lo primero que ve el vendedor al abrir el sistema por la mañana.
 * De ahí que sea papel con una nota sobria y no un girador genérico.
 */

export function getRouter() {
  const clienteDeConsultas = crearClienteDeConsultas()

  const router = createRouter({
    routeTree,
    context: { clienteDeConsultas },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPendingComponent: CargandoElMostrador,
  })

  return router
}

function CargandoElMostrador() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-papel">
      <p className="font-mono text-etiqueta uppercase text-desvaida">
        Abriendo el mostrador…
      </p>
    </div>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
