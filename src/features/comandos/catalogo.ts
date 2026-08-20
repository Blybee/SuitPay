/**
 * Catálogo cerrado de operaciones de consulta (US9 / FR-047, FR-048).
 *
 * No hay interpretación libre. Cada comando de consulta vive aquí y también
 * en `CATALOGO_DE_COMANDOS` (`pistas.ts`). `/crear vecino` es de US8 y no
 * forma parte de este catálogo de solo-consulta.
 */

export type IdDeConsulta =
  | 'cliente'
  | 'cotizacion'
  | 'ayuda'
  | 'cotizaciones'
  | 'vecinos'
  | 'vecino'
  | 'usar-cotizacion'
  | 'limpiar-pedido'

export interface OperacionDeConsulta {
  readonly id: IdDeConsulta
  readonly prefijo: string
  readonly parametros: readonly string[]
  readonly soloLectura: boolean
}

export const OPERACIONES_DE_CONSULTA: readonly OperacionDeConsulta[] = [
  {
    id: 'usar-cotizacion',
    prefijo: '/usar cotizacion',
    parametros: ['{n}'],
    soloLectura: false,
  },
  {
    id: 'limpiar-pedido',
    prefijo: '/limpiar pedido',
    parametros: [],
    soloLectura: false,
  },
  {
    id: 'cotizacion',
    prefijo: '/cotizacion',
    parametros: ['{n}'],
    soloLectura: true,
  },
  {
    id: 'cotizaciones',
    prefijo: '/cotizaciones',
    parametros: [],
    soloLectura: true,
  },
  {
    id: 'vecino',
    prefijo: '/vecino',
    parametros: ['{alias}'],
    soloLectura: true,
  },
  {
    id: 'vecinos',
    prefijo: '/vecinos',
    parametros: [],
    soloLectura: true,
  },
  {
    id: 'cliente',
    prefijo: '/cliente',
    parametros: ['{DNI/RUC}'],
    soloLectura: true,
  },
  {
    id: 'ayuda',
    prefijo: '/ayuda',
    parametros: [],
    soloLectura: true,
  },
]
