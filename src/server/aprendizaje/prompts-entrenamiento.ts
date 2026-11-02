/**
 * Prompt de alineación pedido vs cotización oro.
 * No reutiliza REGLAS_EMPAREJADO: aquí la cotización es el estándar oro.
 */

export const SCHEMA_ENTRENAMIENTO = {
  type: 'OBJECT',
  properties: {
    alineaciones: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          textoPedido: { type: 'STRING' },
          codigo: { type: 'STRING' },
          marca: { type: 'STRING' },
          estado: {
            type: 'STRING',
            enum: ['emparejado', 'omitido', 'no_en_catalogo'],
          },
          aliases: { type: 'ARRAY', items: { type: 'STRING' } },
          etiquetas: { type: 'ARRAY', items: { type: 'STRING' } },
          empaques: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                unidad: { type: 'STRING' },
                bultos: { type: 'NUMBER' },
                unidades: { type: 'NUMBER' },
              },
              required: ['unidad', 'bultos', 'unidades'],
            },
          },
        },
        required: [
          'textoPedido',
          'codigo',
          'estado',
          'aliases',
          'etiquetas',
          'empaques',
        ],
      },
    },
  },
  required: ['alineaciones'],
} as const

export function promptDeEntrenamiento(entrada: {
  readonly catalogoJson: string
  readonly memoriaJson: string
  readonly prioresJson: string
  readonly textoPedido?: string
  readonly textoOro?: string
  readonly archivosPedido?: number
  readonly archivosOro?: number
}): string {
  const bloquePedido =
    entrada.textoPedido !== undefined && entrada.textoPedido.trim() !== ''
      ? `\nTexto del pedido (además de los archivos, si hay):\n${entrada.textoPedido.trim()}\n`
      : ''
  const bloqueOro =
    entrada.textoOro !== undefined && entrada.textoOro.trim() !== ''
      ? `\nTexto de la cotización oro (además de los archivos, si hay):\n${entrada.textoOro.trim()}\n`
      : ''
  const nPedido = entrada.archivosPedido ?? 0
  const nOro = entrada.archivosOro ?? 0

  return `Alineas un PEDIDO de cliente (jerga, incompleto) con una COTIZACIÓN ORO (SKU + marca) de ferretería/gasfitería en Perú. Devuelve SOLO JSON.

La cotización es el estándar oro. El pedido trae coloquiales. No adivines productos que la cotización no cotizó.

Reglas:
- Extrae cada renglón de producto del PEDIDO. Cada uno es una alineación.
- estado "emparejado": hay un SKU del catálogo que aparece (o se identifica con claridad) en la cotización oro. codigo = id exacto del compacto. aliases = coloquiales del pedido (p. ej. "codo de media") más medidas normalizadas como alias (media→1/2), no como producto distinto.
- estado "omitido": el cliente lo pidió y la cotización NO lo cubre. codigo="". aliases=[]. NO inventes el SKU más parecido.
- estado "no_en_catalogo": se cotizó o se pidió algo que no está en el compacto. codigo="". aliases=[].
- Solo "emparejado" genera aliases. Prohibido alias hacia un SKU que no está en la cotización.
- Si el cliente no dijo marca y la cotización eligió una, rellena "marca" con esa. Eso alimenta el prior. Si el cliente nombró marca, respétala en "marca"; no la corrijas a la comercial.
- etiquetas: economico, liviano, etc. solo si el pedido lo sugiere.
- empaques: solo si el pedido nombra una unidad de empaque (bolsa, saco, caja, paquete, rollo, atado, fardo) y la cotización oro trae la cantidad en unidades de ESE MISMO renglón. unidad = esa palabra. bultos = cuántos empaques pidió (el 1 de "1 bolsa"). unidades = la cantidad del oro (25), no el precio. No incluyas docena, ciento ni millar. No uses medidas (1/2, 3/4) como bultos ni como unidades. Si no hay empaque, empaques=[].
- Ignora membrete, RUC, DNI, razón social, teléfono, precios y totales. No los copies a ningún campo.
- textoPedido: tal cual, sin PII.
- El pedido puede llegar en varias fotos. Son el MISMO requerimiento: junta todos los renglones de todas las imágenes. No trates cada foto como un pedido distinto.

Catálogo compacto (id, n, m, a, e):
${entrada.catalogoJson}

Memoria vigente (alias, etiquetas y factores de empaque por codigo):
${entrada.memoriaJson}

Priores de marca vigentes (familia → marca:peso):
${entrada.prioresJson}
${bloquePedido}${bloqueOro}
Recibirás primero los archivos del PEDIDO (${nPedido}) y después los de la COTIZACIÓN ORO (${nOro}), cada bloque etiquetado.`
}
