import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import { afterEach, describe, expect, it } from 'vitest'
import { crearApp } from '../../../src/mcp/app.ts'
import type { AppMcp } from '../../../src/mcp/app.ts'

const PETICION_MCP = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
} as const

const ENCABEZADOS_MCP = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  host: '127.0.0.1:8787',
}

function appDePrueba(): AppMcp {
  return crearApp({
    host: '127.0.0.1',
    hostsPermitidos: ['localhost', '127.0.0.1', '[::1]'],
    origenesPermitidos: ['localhost', '127.0.0.1', '[::1]'],
  })
}

describe('servidor MCP', () => {
  const abiertos: AppMcp[] = []

  afterEach(async () => {
    await Promise.all(abiertos.splice(0).map((cada) => cada.handler.close()))
  })

  it('responde 403 cuando Origin no está permitido', async () => {
    const creado = appDePrueba()
    abiertos.push(creado)

    const rechazada = await creado.app.fetch(
      new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers: {
          ...ENCABEZADOS_MCP,
          origin: 'https://evil.example',
        },
        body: JSON.stringify(PETICION_MCP),
      }),
    )

    expect(rechazada.status).toBe(403)

    const admitida = await creado.app.fetch(
      new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers: {
          ...ENCABEZADOS_MCP,
          origin: 'http://127.0.0.1:6274',
        },
        body: JSON.stringify(PETICION_MCP),
      }),
    )

    expect(admitida.status).not.toBe(403)
  })

  it('lista ping y lo llama sin enviar mcp-session-id', async () => {
    const creado = appDePrueba()
    abiertos.push(creado)
    const sesionesVistas: string[] = []

    const transporte = new StreamableHTTPClientTransport(
      new URL('http://127.0.0.1/mcp'),
      {
        fetch: async (url, init) => {
          const encabezados = new Headers(init?.headers)
          const sesion = encabezados.get('mcp-session-id')
          if (sesion !== null && sesion !== '') sesionesVistas.push(sesion)
          // Un fetch en proceso no añade Host. El servidor HTTP sí lo hace.
          if (!encabezados.has('host')) {
            encabezados.set('host', new URL(url).host)
          }
          return creado.app.fetch(
            new Request(url, { ...init, headers: encabezados }),
          )
        },
      },
    )

    const cliente = new Client(
      { name: 'prueba-suitpay', version: '0.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    )

    await cliente.connect(transporte)
    try {
      const lista = await cliente.listTools()
      expect(lista.tools.map((herramienta) => herramienta.name)).toContain(
        'ping',
      )

      const primera = await cliente.callTool({ name: 'ping', arguments: {} })
      const segunda = await cliente.callTool({ name: 'ping', arguments: {} })

      expect(primera.structuredContent).toEqual({ pong: true })
      expect(primera.isError).not.toBe(true)
      expect(segunda.structuredContent).toEqual({ pong: true })
      expect(sesionesVistas).toEqual([])
    } finally {
      await cliente.close()
    }
  })
})
