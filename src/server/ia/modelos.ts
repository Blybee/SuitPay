import {
  MODELO_DE_RESPALDO_POR_DEFECTO,
  MODELO_POR_DEFECTO,
  modelosAIntentar,
} from '../asistencia/cliente-modelo.ts'

/**
 * Elegidos el 2026-10-20 entre los :free de openrouter.ai/api/v1/models.
 * Texto: el mayor con structured_outputs que devolvió JSON válido tres veces.
 * El 550B es más grande, pero una de tres respuestas no cumplió el schema.
 * Imagen: el de visión con structured_outputs que también lo devolvió.
 */
export const MODELO_OPENROUTER_TEXTO_POR_DEFECTO =
  'nvidia/nemotron-3-super-120b-a12b:free'
export const MODELO_OPENROUTER_IMAGEN_POR_DEFECTO =
  'nvidia/nemotron-3.5-super-vl:free'

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
