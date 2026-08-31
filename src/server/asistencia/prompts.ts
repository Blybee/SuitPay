import { textoDeCandidatosParaPrompt } from './payload.ts'
import type { CandidatoDeAsistencia, TipoDeCaptura } from './tipos.ts'

/**
 * Prompts y schema JSON del modelo. Adaptados de la tienda virtual
 * (tmp/phase 8 y 9/dispatch-requests) al catálogo plano SuitPay (codigo +
 * descripcion + unidad, sin brand/variantId).
 */

export const SCHEMA_RESPUESTA_ASISTENCIA = {
  type: 'OBJECT',
  properties: {
    ilegible: { type: 'BOOLEAN' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          textoOriginal: { type: 'STRING' },
          codigo: { type: 'STRING' },
          cantidad: { type: 'NUMBER' },
          unidad: { type: 'STRING' },
          confidence: { type: 'STRING', enum: ['high', 'low'] },
          ilegible: { type: 'BOOLEAN' },
        },
        required: [
          'textoOriginal',
          'codigo',
          'cantidad',
          'unidad',
          'confidence',
        ],
      },
    },
  },
  required: ['ilegible', 'items'],
} as const

const REGLAS_BASE = `
Recibirás el catálogo compacto (o un lote) en JSON con campos:
  id (codigo), n (nombre), a (alias), e (etiquetas de intención: economico, liviano, …)
Debes usar SOLO esos productos. No inventes códigos.

Estructura típica del pedido hablado/escrito: [cantidad] [producto] [medida] [marca].
Ejemplos: "10 codo fg de media", "pegamento 1/16 pavco 5 unidades".

Reglas de extracción:
- Separa CADA producto pedido en un elemento de "items" (un audio puede traer muchos).
- "textoOriginal": lo oído/leído tal cual, antes de normalizar.
- "cantidad": solo numero + unidad de despacho (unidades, cajas, paquetes, rollos, docenas…).
  Por defecto 1. NO confundas medida con cantidad:
  en "sumidero de 2 pulgadas 100 unidades", cantidad=100; la medida va en el producto.
- Medidas en gasfitería (normalízalas dentro de textoOriginal si ayuda al match):
  media→1/2, tres cuartos→3/4, una→1, una y media→1 1/2, dos→2.
- "unidad": la de despacho si se dice; si no, la del candidato o "NIU".
- "codigo": codigo EXACTO del lote si hay UNA coincidencia clara; si no, "".
- "confidence": "high" solo con match claro a un codigo del lote; "low" si hay duda o varias opciones.
- Si hay ambigüedad, deja codigo vacío y confidence "low" (el vendedor elegirá).
- No inventes codigos fuera del lote.
- No incluyas razón social, RUC, DNI, dirección, teléfono, correo ni historial en ningún campo.
- Si el medio es ilegible por completo: ilegible=true e items=[].
- Si un renglón concreto no se puede leer (foto): ilegible=true en ese item, textoOriginal
  describiendo el problema, codigo ""; no lo omitas en silencio.
`.trim()

export function promptDeAsistencia(
  tipo: TipoDeCaptura,
  candidatos: readonly CandidatoDeAsistencia[],
  instrucciones: readonly string[] = [],
): string {
  const encabezado =
    tipo === 'audio'
      ? 'Escucha este audio de un pedido de mostrador (gasfitería/grifería) y devuelve SOLO JSON puro.'
      : 'Lee esta fotografía de una guía manual de pedido (manuscrita o impresa) y devuelve SOLO JSON puro. Primero extrae el texto de cada renglón en textoOriginal; después empareja contra el catálogo.'

  const bloqueNotas =
    instrucciones.length > 0
      ? `\nPreferencias de este pedido (sin identidad):\n${instrucciones.map((n) => `- ${n}`).join('\n')}\n`
      : ''

  return `${encabezado}

${REGLAS_BASE}
${bloqueNotas}
Catálogo compacto (${candidatos.length} productos, JSON):
${textoDeCandidatosParaPrompt(candidatos)}`
}
