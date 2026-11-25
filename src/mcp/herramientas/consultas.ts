import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  buscarClientes,
  comprobantesPorResolver,
  cotizacionesPendientes,
  listarComprobantes,
  obtenerComprobante,
} from '../../server/mcp/consultas.ts'

const identidad = z
  .object({
    numeroDocumento: z.string().describe('RUC o DNI.'),
    denominacion: z.string().describe('Razón social o nombre.'),
  })
  .strict()

const fila = z
  .object({
    id: z.string(),
    tipoDocumento: z.string(),
    estado: z.string(),
    total: z.number().int().describe('Total con IGV, en céntimos.'),
    emitidoEn: z.string().nullable(),
    cliente: identidad.nullable(),
  })
  .strict()

export const esquemaDeBuscarCliente = z
  .object({
    termino: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe('RUC, DNI o parte de la razón social.'),
    limite: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Máximo de clientes. Más de 10 se rechaza.'),
  })
  .strict()

export const esquemaDeObtenerComprobante = z
  .object({
    id: z.string().trim().min(1).max(120).describe('Id del comprobante.'),
  })
  .strict()

export const esquemaDeListarComprobantes = z
  .object({
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe('Id del último comprobante de la página anterior. Omitirlo empieza desde el más antiguo.'),
  })
  .strict()

const vacio = z.object({}).strict()

export function registrarConsultas(servidor: McpServer): void {
  servidor.registerTool(
    'buscar_cliente',
    {
      title: 'Buscar cliente',
      description:
        'Busca clientes por RUC, DNI o razón social. Devuelve solo documento y razón social.',
      inputSchema: esquemaDeBuscarCliente,
      outputSchema: z
        .object({
          clientes: z.array(identidad),
          lecturas: z.number().int(),
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ termino, limite }) => {
      const salida = await buscarClientes({ termino, limite: limite ?? 10 })
      return json(salida)
    },
  )

  servidor.registerTool(
    'obtener_comprobante',
    {
      title: 'Obtener comprobante',
      description:
        'Lee un comprobante por id. El cliente viaja solo con documento y razón social.',
      inputSchema: esquemaDeObtenerComprobante,
      outputSchema: z
        .object({
          comprobante: fila.nullable(),
          lecturas: z.number().int(),
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => json(await obtenerComprobante({ id })),
  )

  servidor.registerTool(
    'listar_comprobantes',
    {
      title: 'Listar comprobantes',
      description:
        'Lista comprobantes de a 20, del más antiguo al más nuevo. Pasa el cursor para la página siguiente.',
      inputSchema: esquemaDeListarComprobantes,
      outputSchema: z
        .object({
          filas: z.array(fila),
          siguiente: z
            .string()
            .nullable()
            .describe('Cursor de la página siguiente. Null si no hay más.'),
          lecturas: z.number().int(),
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ cursor }) => json(await listarComprobantes({ cursor })),
  )

  servidor.registerTool(
    'comprobantes_por_resolver',
    {
      title: 'Comprobantes por resolver',
      description:
        'Lista comprobantes en estado indeterminado o requiere_intervencion. No incluye aceptados ni pendientes.',
      inputSchema: vacio,
      outputSchema: z.object({ filas: z.array(fila), lecturas: z.number().int() }).strict(),
      annotations: { readOnlyHint: true },
    },
    async () => json(await comprobantesPorResolver({})),
  )

  servidor.registerTool(
    'cotizaciones_pendientes',
    {
      title: 'Cotizaciones pendientes',
      description:
        'Lista cotizaciones que siguen en estado pendiente. No incluye teléfono ni dirección.',
      inputSchema: vacio,
      outputSchema: z
        .object({
          cotizaciones: z.array(
            z
              .object({
                id: z.string(),
                numero: z.number().int(),
                total: z.number().int().describe('Total con IGV, en céntimos.'),
                cliente: identidad.nullable(),
              })
              .strict(),
          ),
          lecturas: z.number().int(),
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async () => json(await cotizacionesPendientes({})),
  )
}

function json(salida: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(salida) }],
    structuredContent: salida,
  }
}
