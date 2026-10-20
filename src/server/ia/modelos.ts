import {
  MODELO_DE_RESPALDO_POR_DEFECTO,
  MODELO_POR_DEFECTO,
  modelosAIntentar,
} from '../asistencia/cliente-modelo.ts'

/**
 * Verificado el 2026-10-20 en /api/v1/models y con
 * provider.data_collection=deny: :free, structured_outputs, texto e imagen.
 * Los extremos gratuitos de Nvidia responden 404 con esa política.
 */
export const MODELO_OPENROUTER_TEXTO_POR_DEFECTO =
  'dots-studio/dots-3-note-preview:free'
export const MODELO_OPENROUTER_IMAGEN_POR_DEFECTO =
  'dots-studio/dots-3-note-preview:free'

function saneada(valor: string | undefined): string | undefined {
  const limpio = valor?.trim()
  return limpio === undefined || limpio === '' ? undefined : limpio
}

export interface ModelosVisibles {
  readonly openrouterTexto: string
  readonly openrouterImagen: string
  readonly geminiPrincipal: string
  readonly geminiRespaldo: string
}

export function modelosVisibles(): ModelosVisibles {
  const gemini = modelosAIntentar({})
  return {
    openrouterTexto:
      saneada(process.env.OPENROUTER_MODELO_TEXTO) ??
      MODELO_OPENROUTER_TEXTO_POR_DEFECTO,
    openrouterImagen:
      saneada(process.env.OPENROUTER_MODELO_IMAGEN) ??
      MODELO_OPENROUTER_IMAGEN_POR_DEFECTO,
    geminiPrincipal: gemini[0] ?? MODELO_POR_DEFECTO,
    geminiRespaldo: gemini[1] ?? MODELO_DE_RESPALDO_POR_DEFECTO,
  }
}
