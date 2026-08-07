import { QueryClient } from '@tanstack/react-query'

/**
 * Configuración de las consultas remotas.
 *
 * ## Caché por sesión, no por minuto
 *
 * Los valores de aquí son deliberadamente largos, y la razón es económica y de
 * diseño a la vez: Firestore factura por documento leído. Los tres documentos del
 * arranque —catálogo, índice de clientes y parámetros— se leen **una vez por
 * sesión y dispositivo**, y volver a pedirlos porque han pasado cinco minutos
 * sería pagar por lo mismo varias veces al día sin ganar nada: el catálogo lo
 * publica el administrador y cambia cada varias semanas.
 *
 * De ahí que se desactive la revalidación al recuperar el foco de la ventana.
 * En un mostrador la ventana pierde y recupera el foco decenas de veces por hora,
 * y cada una habría sido una tanda de lecturas.
 *
 * Lo que sí se revalida son las listas de comprobantes y cotizaciones, que
 * declaran su propio tiempo de frescura al usarlas.
 */

export function crearClienteDeConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Una jornada de trabajo. Lo que se leyó al arrancar sirve todo el día.
        staleTime: 8 * 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Un reintento y para. En el mostrador, esperar tres rondas de reintento
        // delante del cliente es peor que decir "no hay red" y seguir.
        retry: 1,
        retryDelay: 800,
      },
      mutations: {
        // Las mutaciones NO se reintentan solas. Emitir es una mutación, y un
        // reintento automático de una emisión es exactamente lo que el principio
        // II prohíbe. Quien reintente tiene que hacerlo a la vista y con la
        // misma clave de idempotencia.
        retry: 0,
      },
    },
  })
}

/** Claves de consulta en un solo sitio, para que no se escriban a mano. */
export const CLAVES_DE_CONSULTA = {
  catalogo: ['catalogo'] as const,
  indiceDeClientes: ['indice-clientes'] as const,
  parametros: ['parametros'] as const,
  cliente: (numeroDocumento: string) => ['cliente', numeroDocumento] as const,
  comprobantesDelVendedor: (vendedorId: string) =>
    ['comprobantes', 'vendedor', vendedorId] as const,
  comprobantesDelCliente: (numeroDocumento: string) =>
    ['comprobantes', 'cliente', numeroDocumento] as const,
  cotizacionesPendientes: ['cotizaciones', 'pendientes', 'general'] as const,
  cotizacionesVecinos: ['cotizaciones', 'pendientes', 'vecino'] as const,
  series: (vendedorId: string) => ['series', vendedorId] as const,
} as const
