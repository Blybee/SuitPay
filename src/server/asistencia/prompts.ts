/**
 * Prompts y schema JSON del modelo de asistencia.
 * Compacto { id, n, m, a, e } — constitución IV v1.3.0.
 */

import { textoDeCandidatosParaPrompt } from './payload.ts'
import type { CandidatoDeAsistencia, TipoDeCaptura } from './tipos.ts'

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

export type TipoDePromptAsistencia = TipoDeCaptura | 'texto'

/**
 * Reglas compartidas de emparejado (foto, dictado, Cotizar PDF/texto).
 * El prompt de entrenamiento no las reutiliza.
 */
export const REGLAS_EMPAREJADO = `
Recibirás el catálogo compacto en JSON con campos:
  id (codigo), n (nombre), m (marca del SKU), a (alias coloquiales aprendidos),
  e (etiquetas de intención: economico, liviano, …)
Debes usar SOLO esos productos. No inventes códigos.
Empareja primero por a[], después por n. No exijas el nombre técnico.

Estructura típica del pedido hablado/escrito: [cantidad] [producto] [medida] [marca].
Ejemplos: "10 codo fg de media", "pegamento 1/16 pavco 5 unidades".

Reglas de extracción:
- Separa CADA producto pedido en un elemento de "items". Extrae TODOS los renglones;
  si no hay match, deja codigo="" y confidence="low". No borres la línea en silencio.
- "textoOriginal": lo oído/leído TAL CUAL, antes de normalizar. No reescribas medidas ahí.
- "cantidad": solo numero + unidad de despacho (unidades, cajas, paquetes, rollos, docenas…).
  Por defecto 1. NO confundas medida con cantidad:
  en "sumidero de 2 pulgadas 100 unidades", cantidad=100; la medida va en el producto.
- Medidas en gasfitería (úsalas solo para el match interno, no las copies a textoOriginal):
  media→1/2, tres cuartos→3/4, una→1, una y media→1 1/2, dos→2.
- "unidad": la de despacho si se dice; si no, la del candidato o "NIU".
- "codigo": codigo EXACTO del lote si hay UNA coincidencia clara; si no, "".
- "confidence": "high" solo con match claro a un codigo del lote; "low" si hay duda o varias opciones.
- Si el cliente NOMBRA marca, restringe a SKUs cuya m (o n/a) coincida. No "corrijas" a la comercial.
- Si el cliente NO nombra marca: entre coincidencias de producto+medida, prefiere la marca con mayor
  peso en prioresDeMarca de esa familia. Si el prior está vacío o hay empate, codigo="" y confidence="low".
- "e[]" solo si el cliente o las notas piden esa intención.
- Si hay ambigüedad, deja codigo vacío y confidence "low" (el vendedor elegirá).
- No inventes codigos fuera del lote.
- No incluyas razón social, RUC, DNI, dirección, teléfono, correo ni historial en ningún campo.
- Si el medio es ilegible por completo: ilegible=true e items=[].
- Si un renglón concreto no se puede leer (foto): ilegible=true en ese item, textoOriginal
  describiendo el problema, codigo ""; no lo omitas en silencio.
`.trim()

export function bloqueDePriores(prioresJson?: string): string {
  const crudo = prioresJson?.trim() ?? ''
  if (crudo === '' || crudo === '{}') return ''
  return `
Priores de marca (familia → marca:peso). Úsalos solo si el cliente no nombra marca.
${crudo}
`
}

export function promptDeAsistencia(
  tipo: TipoDePromptAsistencia,
  candidatos: readonly CandidatoDeAsistencia[],
  instrucciones: readonly string[] = [],
  prioresJson?: string,
): string {
  const encabezado =
    tipo === 'audio'
      ? 'Escucha este audio de un pedido de mostrador (gasfitería/grifería) y devuelve SOLO JSON puro.'
      : tipo === 'texto'
        ? 'Lee este texto de requerimiento de un cliente (gasfitería/grifería) y devuelve SOLO JSON puro. Extrae cada renglón en textoOriginal; después empareja contra el catálogo.'
        : 'Lee esta fotografía de una guía manual de pedido (manuscrita o impresa) y devuelve SOLO JSON puro. Primero extrae el texto de cada renglón en textoOriginal; después empareja contra el catálogo.'

  const bloqueNotas =
    instrucciones.length > 0
      ? `\nPreferencias de este pedido (sin identidad):\n${instrucciones.map((n) => `- ${n}`).join('\n')}\n`
      : ''

  return `${encabezado}

${REGLAS_EMPAREJADO}
${bloqueDePriores(prioresJson)}
${bloqueNotas}
Catálogo compacto (${candidatos.length} productos, JSON):
${textoDeCandidatosParaPrompt(candidatos)}`
}
