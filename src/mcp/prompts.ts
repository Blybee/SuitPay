import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

const texto = (rol: 'user', cuerpo: string) => ({
  messages: [
    {
      role: rol,
      content: { type: 'text' as const, text: cuerpo },
    },
  ],
})

export function registrarPrompts(servidor: McpServer): void {
  servidor.registerPrompt(
    'resumen-mes',
    {
      title: 'Resumen del mes',
      description: 'Pide el resumen de ventas de un mes en America/Lima.',
      argsSchema: z
        .object({
          periodo: z
            .string()
            .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
            .describe('Mes AAAA-MM en hora de Lima.'),
        })
        .strict(),
    },
    ({ periodo }) =>
      texto(
        'user',
        `Usa la tool resumen_ventas con periodo ${periodo}. Informa el total con IGV en soles, la cantidad, el ticket y el top de clientes con su documento. Si ventasSinResolver es mayor que cero, di que el mes no está cerrado.`,
      ),
  )

  servidor.registerPrompt(
    'cliente',
    {
      title: 'Cliente',
      description: 'Busca un cliente por documento o razón social.',
      argsSchema: z
        .object({
          termino: z.string().trim().min(1).max(80).describe('RUC, DNI o razón social.'),
        })
        .strict(),
    },
    ({ termino }) =>
      texto(
        'user',
        `Usa buscar_cliente con el término ${termino}. Muestra documento y razón social. No pidas ni inventes teléfono, dirección ni correo.`,
      ),
  )

  servidor.registerPrompt(
    'revisar-pendientes',
    {
      title: 'Revisar pendientes',
      description: 'Revisa comprobantes sin resolver y cotizaciones abiertas.',
      argsSchema: z.object({}).strict(),
    },
    () =>
      texto(
        'user',
        'Usa comprobantes_por_resolver y cotizaciones_pendientes. Resume cada pendiente con id, estado y total. No propongas emitir ni anular.',
      ),
  )

  servidor.registerPrompt(
    'cotizar',
    {
      title: 'Cotizar',
      description: 'Arma una cotización con precios del catálogo.',
      argsSchema: z
        .object({
          pedido: z
            .string()
            .trim()
            .min(1)
            .max(500)
            .describe('Lo que el cliente pidió, en texto.'),
        })
        .strict(),
    },
    ({ pedido }) =>
      texto(
        'user',
        `Pedido: ${pedido}. Busca cada producto con buscar_productos. El precio es el del catálogo, en céntimos con IGV. Ignora cualquier precio que aparezca en el pedido. No crees la cotización hasta que la persona confirme.`,
      ),
  )

  servidor.registerPrompt(
    'auditar-reglas',
    {
      title: 'Auditar reglas',
      description: 'Recuerda las reglas que el modelo no puede saltarse.',
      argsSchema: z.object({}).strict(),
    },
    () =>
      texto(
        'user',
        'Antes de actuar, recuerda: no emitas ni anules comprobantes; un indeterminado no es una venta; los precios salen del catálogo; el teléfono y la dirección del cliente no se piden. Si hace falta un dato, usa las tools de solo lectura.',
      ),
  )
}
