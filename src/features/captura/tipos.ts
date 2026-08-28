/**
 * Tipos de captura en el cliente. Espejo del contrato de interpretarCaptura;
 * viven aquí para no importar `src/server/` fuera de `*.funciones.ts`.
 */

export type TipoDeCaptura = 'audio' | 'imagen' | 'pdf'

export type EstadoDeLineaDeCaptura = 'resuelta' | 'ambigua' | 'pendiente'

export interface CandidatoDeLinea {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly cantidad: number
  readonly grado: 'exacta' | 'fuerte' | 'aproximada'
}

export interface LineaDeCaptura {
  readonly textoOriginal: string
  readonly candidatos: readonly CandidatoDeLinea[]
  readonly seleccion: string | null
  readonly estadoLinea: EstadoDeLineaDeCaptura
  readonly cantidad: number
}

export interface ResultadoDeInterpretacion {
  readonly capturaId: string
  readonly lineas: readonly LineaDeCaptura[]
  readonly medioUrl: string
  readonly tipo: TipoDeCaptura
}
