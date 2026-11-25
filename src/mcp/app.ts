import { createMcpHonoApp } from '@modelcontextprotocol/hono'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import { prepararAcceso, publicarMetadatos } from './acceso.ts'
import type { ConfiguracionDeAcceso } from './acceso.ts'
import { registrarCatalogo } from './herramientas/catalogo.ts'
import { registrarEscritura } from './herramientas/escritura.ts'
import { registrarConsultas } from './herramientas/consultas.ts'
import { registrarPrompts } from './prompts.ts'
import { registrarRecursos } from './recursos.ts'

export const NOMBRE_DEL_SERVIDOR = 'suitpay-mcp'
export const VERSION_DEL_SERVIDOR = '0.1.0'

const esquemaDePing = z.object({}).strict()
const esquemaDeRespuestaDePing = z
  .object({
    pong: z.literal(true),
  })
  .strict()

export function crearServidorMcp(): McpServer {
  const servidor = new McpServer({
    name: NOMBRE_DEL_SERVIDOR,
    version: VERSION_DEL_SERVIDOR,
  })

  registrarCatalogo(servidor)
  registrarConsultas(servidor)
  registrarRecursos(servidor)
  registrarPrompts(servidor)
  registrarEscritura(servidor)

  servidor.registerTool(
    'ping',
    {
      title: 'Ping',
      description:
        'Comprueba que el servidor MCP de SuitPay responde. No lee ni escribe datos del negocio.',
      inputSchema: esquemaDePing,
      outputSchema: esquemaDeRespuestaDePing,
      annotations: { readOnlyHint: true },
    },
    async () => ({
      content: [{ type: 'text', text: 'pong' }],
      structuredContent: { pong: true },
    }),
  )

  return servidor
}

export interface OpcionesDeLaApp {
  /** Hostname de escucha que `createMcpHonoApp` usa para elegir la protección por defecto. */
  readonly host?: string
  /** Hostnames admitidos en el encabezado Host. Sin puerto. */
  readonly hostsPermitidos?: readonly string[]
  /** Hostnames admitidos en Origin. Sin puerto. Un Origin ausente pasa. */
  readonly origenesPermitidos?: readonly string[]
  /** Ausente: /mcp no exige token. Lo usa el esqueleto y sus pruebas. */
  readonly acceso?: ConfiguracionDeAcceso
}

export interface AppMcp {
  readonly app: Hono
  readonly handler: ReturnType<typeof createMcpHandler>
}

export function crearApp(opciones: OpcionesDeLaApp = {}): AppMcp {
  const handler = createMcpHandler(crearServidorMcp)
  const app = createMcpHonoApp({
    host: opciones.host ?? '127.0.0.1',
    ...(opciones.hostsPermitidos !== undefined
      ? { allowedHosts: [...opciones.hostsPermitidos] }
      : {}),
    ...(opciones.origenesPermitidos !== undefined
      ? { allowedOrigins: [...opciones.origenesPermitidos] }
      : {}),
  })

  const acceso =
    opciones.acceso !== undefined ? prepararAcceso(opciones.acceso) : undefined
  if (opciones.acceso !== undefined) publicarMetadatos(app, opciones.acceso)

  app.all('/mcp', async (c: Context) => {
    const authInfo = acceso ? await acceso.autenticar(c.req.raw) : undefined
    if (authInfo instanceof Response) return authInfo
    return handler.fetch(c.req.raw, {
      parsedBody: c.get('parsedBody'),
      ...(authInfo !== undefined ? { authInfo } : {}),
    })
  })

  return { app, handler }
}
