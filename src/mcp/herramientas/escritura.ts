import { requireScopes } from '@modelcontextprotocol/server'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { ALCANCE_ESCRITURA } from '../acceso.ts'
import {
  consultarEstadoSunat,
  crearCotizacion,
  registrarCliente,
} from '../../server/mcp/escritura.ts'

const alcance = requireScopes(ALCANCE_ESCRITURA)

const cliente = z
  .object({
    tipoDocumento: z.enum(['DNI', 'RUC', 'CE', 'PAS']).describe('Tipo de documento.'),
    numeroDocumento: z.string().trim().min(8).max(15).describe('RUC, DNI u otro documento.'),
    denominacion: z.string().trim().min(1).max(300).describe('Razón social o nombre.'),
  })
  .strict()

export const esquemaDeCrearCotizacion = z
  .object({
    clave: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{8,80}$/)
      .describe('Clave de idempotencia. La misma clave no crea otra cotización.'),
    lineas: z
      .array(
        z
          .object({
            codigo: z.string().trim().min(1).max(40).describe('Código del catálogo.'),
            cantidad: z.number().positive().max(1_000_000).describe('Cantidad.'),
            precio: z
              .number()
              .optional()
              .describe('Se ignora. El precio sale del catálogo, con IGV, en céntimos.'),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    cliente: cliente.nullable().describe('Cliente de la cotización, o null.'),
  })
  .strict()

export const esquemaDeRegistrarCliente = cliente

export const esquemaDeConsultarEstado = z
  .object({
    id: z.string().trim().min(1).max(120).describe('Id del comprobante a consultar.'),
  })
  .strict()

export function registrarEscritura(servidor: McpServer): void {
  servidor.registerTool(
    'crear_cotizacion',
    {
      title: 'Crear cotización',
      description:
        'Crea una cotización pendiente. Exige el alcance suitpay.escribir. Los precios salen del catálogo. La misma clave devuelve la cotización ya creada.',
      inputSchema: esquemaDeCrearCotizacion,
      outputSchema: z
        .object({
          id: z.string(),
          numero: z.number().int(),
          total: z.number().int().describe('Total con IGV, en céntimos, a precio de catálogo.'),
          yaExistia: z.boolean(),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false },
      scopeChallenge: alcance,
    },
    async ({ clave, lineas, cliente: comprador }, extra) => {
      const salida = await crearCotizacion({
        clave,
        lineas,
        cliente: comprador,
        uid: uidDe(extra.authInfo?.extra),
      })
      return json(salida)
    },
  )

  servidor.registerTool(
    'registrar_cliente',
    {
      title: 'Registrar cliente',
      description:
        'Da de alta un cliente. Exige suitpay.escribir. Si el documento ya existe, no lo pisa.',
      inputSchema: esquemaDeRegistrarCliente,
      outputSchema: z
        .object({
          numeroDocumento: z.string(),
          denominacion: z.string(),
          yaExistia: z.boolean(),
        })
        .strict(),
      annotations: { readOnlyHint: false },
      scopeChallenge: alcance,
    },
    async (datos, extra) => json(await registrarCliente(datos, uidDe(extra.authInfo?.extra))),
  )

  servidor.registerTool(
    'consultar_estado_sunat',
    {
      title: 'Consultar estado',
      description:
        'Consulta el estado de un comprobante ya registrado y lo actualiza. No emite, no anula y no toca un comprobante aceptado. Exige suitpay.escribir.',
      inputSchema: esquemaDeConsultarEstado,
      outputSchema: z
        .object({
          desenlace: z.string(),
          estado: z.string(),
        })
        .strict(),
      annotations: { readOnlyHint: false },
      scopeChallenge: alcance,
    },
    async ({ id }) => {
      const resultado = await consultarEstadoSunat({ id })
      return json({ desenlace: resultado.desenlace, estado: resultado.comprobante.estado })
    },
  )
}

function uidDe(extra: Record<string, unknown> | undefined): string {
  const uid = extra?.['uid']
  if (typeof uid !== 'string' || uid.trim() === '') {
    throw new Error('La llamada no trae uid')
  }
  return uid
}

function json(salida: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(salida) }],
    structuredContent: salida as Record<string, unknown>,
  }
}
