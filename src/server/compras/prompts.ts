export const SCHEMA_PRECIOS_COMPRA = {
  type: 'OBJECT',
  properties: {
    coincidencias: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codigo: { type: 'STRING' },
          precioCompraCentimos: { type: 'INTEGER' },
          precioCompraEn: { type: 'STRING' },
          etiquetaFactura: { type: 'STRING' },
        },
        required: ['codigo', 'precioCompraCentimos', 'etiquetaFactura'],
      },
    },
    sinMatch: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          etiquetaFactura: { type: 'STRING' },
          precioCompraCentimos: { type: 'INTEGER' },
          precioCompraEn: { type: 'STRING' },
        },
        required: ['etiquetaFactura'],
      },
    },
  },
  required: ['coincidencias', 'sinMatch'],
} as const

export function promptDePreciosCompra(entrada: {
  readonly catalogoJson: string
  readonly archivos: number
}): string {
  return `Lees facturas de COMPRA de un proveedor de ferretería/gasfitería en Perú (no son pedidos de cliente). Devuelve SOLO JSON.

Tarea: extrae cada línea de producto con su precio unitario y, si aparece, la fecha del comprobante. Empareja cada línea con un SKU del catálogo compacto.

Reglas:
- codigo: id exacto del compacto. Si no hay match claro, no lo inventes: ve a sinMatch.
- precioCompraCentimos: precio unitario CON IGV, en céntimos enteros (12.50 soles → 1250). No uses el precio de venta del catálogo: el compacto no lo trae.
- precioCompraEn: YYYY-MM-DD de la factura, si se lee. Vacío si no está.
- etiquetaFactura: descripción tal cual en la factura, sin RUC ni razón social.
- Ignora membrete, RUC del comprador, DNI, teléfono, totales y datos de clientes. No los copies.
- Varios archivos son facturas del mismo lote: junta las líneas. Si un SKU sale dos veces, quédate con la fecha más reciente.

Catálogo compacto (solo id, n nombre, m marca; SIN precio):
${entrada.catalogoJson}

Recibirás ${entrada.archivos} archivo${entrada.archivos === 1 ? '' : 's'} de factura.`
}
