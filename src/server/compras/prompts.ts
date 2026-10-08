export const SCHEMA_PRECIOS_COMPRA = {
  type: 'OBJECT',
  properties: {
    moneda: { type: 'STRING' },
    fecha: { type: 'STRING' },
    coincidencias: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codigo: { type: 'STRING' },
          precioUnitario: { type: 'STRING' },
          moneda: { type: 'STRING' },
          precioCompraEn: { type: 'STRING' },
          etiquetaFactura: { type: 'STRING' },
        },
        required: ['codigo', 'precioUnitario', 'etiquetaFactura'],
      },
    },
    sinMatch: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          etiquetaFactura: { type: 'STRING' },
          precioUnitario: { type: 'STRING' },
          moneda: { type: 'STRING' },
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
  return `Lees órdenes de compra o facturas de COMPRA de un proveedor de ferretería/gasfitería en Perú (no son pedidos de cliente). Devuelve SOLO JSON.

Tarea: extrae cada línea de producto con su precio unitario impreso, la moneda del comprobante y la fecha. Empareja cada línea con un SKU del catálogo compacto.

Reglas:
- codigo: id exacto del compacto. Si no hay match claro, no lo inventes: ve a sinMatch.
- moneda: PEN si el comprobante dice SOLES. USD si dice DOLARES AMERICANOS, DOLARES o USD. Escríbela en la raíz y en cada línea.
- fecha: YYYY-MM-DD del campo FECHA del comprobante, no la hora de impresión. En la raíz y en precioCompraEn de cada línea.
- precioUnitario: el precio unitario tal como está impreso, con todos sus decimales, en texto ("1.0550" sigue "1.0550", "1.3200" sigue "1.3200"). Ese precio ya incluye IGV: no lo multipliques por 1.18, no lo conviertas a otra moneda y no lo pases a céntimos.
- etiquetaFactura: descripción tal cual en el comprobante, sin RUC ni razón social.
- Ignora membrete, RUC del comprador, DNI, teléfono, totales y datos de clientes. No los copies.
- No uses el precio de venta del catálogo: el compacto no lo trae.
- Varios archivos son comprobantes del mismo lote: junta las líneas. Si un SKU sale dos veces, quédate con la fecha más reciente.

Catálogo compacto (solo id, n nombre, m marca; SIN precio):
${entrada.catalogoJson}

Recibirás ${entrada.archivos} archivo${entrada.archivos === 1 ? '' : 's'} de factura.`
}
