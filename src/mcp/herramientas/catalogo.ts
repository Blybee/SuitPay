import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  buscarProductosPublicados,
  consultarExistencias,
} from '../../server/mcp/catalogo.ts'

const limite = z
  .number()
  .int()
  .min(1)
  .max(10)
  .describe('Cantidad máxima de resultados. Más de 10 se rechaza.')

export const esquemaDeBuscarProductos = z
  .object({
    termino: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe('Texto del producto, tolerante a erratas y al orden de las palabras.'),
    limite: limite.optional(),
  })
  .strict()

export const esquemaDeConsultarStock = z
  .object({
    codigos: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(40)
          .describe('Código de catálogo, tal como está publicado.'),
      )
      .min(1)
      .max(10)
      .describe('Hasta diez códigos. Una lista más larga se rechaza.'),
  })
  .strict()

const producto = z
  .object({
    codigo: z.string(),
    descripcion: z.string(),
    unidad: z.string(),
    precioCentimos: z
      .number()
      .int()
      .describe('Precio de venta con IGV, en céntimos.'),
    marca: z.string(),
    grado: z.enum(['exacta', 'fuerte', 'aproximada']),
  })
  .strict()

const existencia = z
  .object({
    codigo: z.string(),
    cantidad: z
      .number()
      .nullable()
      .describe('Unidades orientativas. Null si ese código no tiene existencia.'),
    precioCompraCentimos: z
      .number()
      .int()
      .nullable()
      .describe('Costo de compra en céntimos, con IGV. Null si no hay costo.'),
  })
  .strict()

export function registrarCatalogo(servidor: McpServer): void {
  servidor.registerTool(
    'buscar_productos',
    {
      title: 'Buscar productos',
      description:
        'Busca en el catálogo publicado. Tolera erratas y el orden de las palabras. No devuelve costo de compra ni stock.',
      inputSchema: esquemaDeBuscarProductos,
      outputSchema: z
        .object({
          productos: z.array(producto),
          lecturas: z
            .number()
            .int()
            .describe('Documentos de Firestore leídos para esta respuesta.'),
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ termino, limite: tope }) => {
      const salida = await buscarProductosPublicados({
        termino,
        limite: tope ?? 10,
      })
      return {
        content: [{ type: 'text', text: JSON.stringify(salida) }],
        structuredContent: salida,
      }
    },
  )

  servidor.registerTool(
    'consultar_stock',
    {
      title: 'Consultar stock',
      description:
        'Devuelve la cantidad orientativa y el costo de compra de hasta diez códigos. El costo solo llega a un administrador o jefe con cuenta activa.',
      inputSchema: esquemaDeConsultarStock,
      outputSchema: z
        .object({
          existencias: z.array(existencia),
          lecturas: z
            .number()
            .int()
            .describe('Documentos de inventario leídos, uno por código.'),
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ codigos }) => {
      const salida = await consultarExistencias({ codigos })
      return {
        content: [{ type: 'text', text: JSON.stringify(salida) }],
        structuredContent: salida,
      }
    },
  )
}
