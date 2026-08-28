/**
 * Prompt y schema de extraerListaPdf (FR-061).
 * Distinto de dictado/foto: no hay lote de catálogo.
 */

export const SCHEMA_RESPUESTA_PDF = {
  type: 'OBJECT',
  properties: {
    ilegible: { type: 'BOOLEAN' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          textoOriginal: { type: 'STRING' },
          cantidad: { type: 'NUMBER' },
          unidad: { type: 'STRING' },
        },
        required: ['textoOriginal', 'cantidad'],
      },
    },
    cliente: {
      type: 'OBJECT',
      properties: {
        tipoDocumento: { type: 'STRING', enum: ['DNI', 'RUC'] },
        numeroDocumento: { type: 'STRING' },
        denominacion: { type: 'STRING' },
      },
      required: ['tipoDocumento', 'numeroDocumento', 'denominacion'],
      nullable: true,
    },
  },
  required: ['ilegible', 'items'],
} as const

export function promptDeListaPdf(): string {
  return `
Lee este PDF de requerimiento o pedido de un cliente (ferretería / gasfitería) y devuelve SOLO JSON puro.

Reglas de mercadería:
- Extrae SOLO renglones de producto (cantidad + descripción). Un renglón = un elemento de "items".
- Ignora precios, descuentos, condiciones de pago, totales, membrete operativo, fechas de entrega e instrucciones logísticas.
- "textoOriginal": el texto del renglón tal cual aparece, antes de normalizar.
- "cantidad": unidades pedidas. Por defecto 1. NO confundas medida (1/2", 3/4) con cantidad.
- "unidad": la de despacho si se indica; si no, "NIU".
- No inventes productos que no estén en el documento. No rellenes códigos de catálogo.

Identidad del cliente (si está presente en membrete, pie o cabecera):
- Si hay RUC (11 dígitos) o DNI (8 dígitos) y un nombre o razón social, rellena "cliente".
- "tipoDocumento": "RUC" o "DNI". "numeroDocumento": solo dígitos. "denominacion": tal como aparece.
- Si no hay identidad clara: cliente = null. No inventes un cliente.

Si el documento es ilegible por completo (escaneo en negro, páginas vacías): ilegible=true e items=[].
`.trim()
}
