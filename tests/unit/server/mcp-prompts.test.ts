import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import { describe, expect, it } from 'vitest'
import { crearApp } from '../../../src/mcp/app.ts'

describe('prompts MCP', () => {
  it('arma resumen-mes con el periodo y cotizar sin inventar el precio', async () => {
    const creado = crearApp({
      host: '127.0.0.1',
      hostsPermitidos: ['127.0.0.1'],
      origenesPermitidos: ['127.0.0.1'],
    })
    const cliente = new Client(
      { name: 'prueba-prompts', version: '0' },
      { versionNegotiation: { mode: 'auto' } },
    )
    await cliente.connect(
      new StreamableHTTPClientTransport(new URL('http://127.0.0.1/mcp'), {
        fetch: async (url, init) => {
          const encabezados = new Headers(init?.headers)
          if (!encabezados.has('host')) encabezados.set('host', new URL(url).host)
          return creado.app.fetch(new Request(url, { ...init, headers: encabezados }))
        },
      }),
    )
    try {
      const resumen = await cliente.getPrompt({
        name: 'resumen-mes',
        arguments: { periodo: '2020-11' },
      })
      const textoResumen = JSON.stringify(resumen)
      expect(textoResumen).toContain('2020-11')
      expect(textoResumen).toContain('resumen_ventas')

      const cotizar = await cliente.getPrompt({
        name: 'cotizar',
        arguments: { pedido: 'dos codos de media' },
      })
      const textoCotizar = JSON.stringify(cotizar)
      expect(textoCotizar).toContain('dos codos de media')
      expect(textoCotizar).toContain('catálogo')
      expect(textoCotizar).not.toContain('emite')

      const reglas = await cliente.getPrompt({ name: 'auditar-reglas' })
      expect(JSON.stringify(reglas)).toContain('indeterminado')
    } finally {
      await cliente.close()
      await creado.handler.close()
    }
  })
})
