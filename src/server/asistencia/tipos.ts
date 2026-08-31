/**
 * Tipos de la frontera de asistencia (interpretarCaptura).
 * Alineados con data-model.md y contracts/functions.md.
 */

export type TipoDeCaptura = 'audio' | 'imagen'

export type EstadoDeLineaDeCaptura = 'resuelta' | 'ambigua' | 'pendiente'

export interface CandidatoDeAsistencia {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly aliases?: readonly string[]
  readonly etiquetas?: readonly string[]
}

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

/** Respuesta cruda del modelo tras normalizar (sin datos de cliente). */
export interface ItemDelModelo {
  readonly textoOriginal: string
  readonly codigo: string | null
  readonly cantidad: number
  readonly unidad: string
  readonly confidence: 'high' | 'low'
  /** Solo imagen: el renglón no se pudo leer. */
  readonly ilegible?: boolean
}

export interface RespuestaDelModelo {
  readonly ilegible: boolean
  readonly items: readonly ItemDelModelo[]
}
