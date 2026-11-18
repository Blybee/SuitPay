import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import type { CryptoKey } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearApp } from '../../../src/mcp/app.ts'
import type { ConfiguracionDeAcceso } from '../../../src/mcp/acceso.ts'
import {
  esquemaDeBuscarProductos,
  esquemaDeConsultarStock,
} from '../../../src/mcp/herramientas/catalogo.ts'

describe('límites del catálogo', () => {
  it('rechaza un límite mayor que diez y una lista de stock de once códigos', () => {
    expect(esquemaDeBuscarProductos.safeParse({ termino: 'codo', limite: 10 }).success).toBe(
      true,
    )
    expect(esquemaDeBuscarProductos.safeParse({ termino: 'codo', limite: 11 }).success).toBe(
      false,
    )
    expect(
      esquemaDeConsultarStock.safeParse({
        codigos: Array.from({ length: 11 }, (_, indice) => `C${indice}`),
      }).success,
    ).toBe(false)
  })

  it('la tool no ejecuta una búsqueda con límite 11', async () => {
    const creado = crearApp({
      host: '127.0.0.1',
      hostsPermitidos: ['127.0.0.1'],
      origenesPermitidos: ['127.0.0.1'],
    })
    const cliente = new Client(
      { name: 'prueba-catalogo', version: '0' },
      { versionNegotiation: { mode: 'auto' } },
    )
    await cliente.connect(transporte(creado))
    try {
      const resultado = await cliente.callTool({
        name: 'buscar_productos',
        arguments: { termino: 'codo', limite: 11 },
      })
      expect(resultado.isError).toBe(true)
    } finally {
      await cliente.close()
      await creado.handler.close()
    }
  })
})

describe('consultar_stock queda detrás del rol', () => {
  let cerrar: () => Promise<void>
  let jwksUrl: URL
  let emisor: string
  let recurso: URL
  let privada: CryptoKey

  beforeAll(async () => {
    const par = await generateKeyPair('RS256', { extractable: true })
    privada = par.privateKey
    const jwk = await exportJWK(par.publicKey)
    jwk.kid = 'prueba'
    jwk.alg = 'RS256'
    jwk.use = 'sig'
    const servidor = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ keys: [jwk] }))
    })
    await new Promise<void>((resolve) => {
      servidor.listen(0, '127.0.0.1', () => resolve())
    })
    const puerto = (servidor.address() as AddressInfo).port
    jwksUrl = new URL(`http://127.0.0.1:${puerto}/jwks`)
    emisor = `http://127.0.0.1:${puerto}`
    recurso = new URL(`http://127.0.0.1:${puerto}/mcp`)
    cerrar = () =>
      new Promise((resolve, reject) => {
        servidor.close((error) => (error ? reject(error) : resolve()))
      })
  })

  afterAll(async () => {
    await cerrar()
  })

  it('un vendedor no llega a leer el costo', async () => {
    const token = await new SignJWT({ firebase_uid: 'vend-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'prueba' })
      .setIssuer(emisor)
      .setAudience(recurso.href)
      .setIssuedAt()
      .setExpirationTime('2m')
      .sign(privada)
    const acceso: ConfiguracionDeAcceso = {
      emisor,
      jwksUrl,
      recurso,
      claimUid: 'firebase_uid',
      cargarUsuario: async () => ({ estado: 'rechazada' }),
    }
    const creado = crearApp({
      host: '127.0.0.1',
      hostsPermitidos: ['127.0.0.1'],
      origenesPermitidos: ['127.0.0.1'],
      acceso,
    })
    const respuesta = await creado.app.fetch(
      new Request(recurso, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          host: '127.0.0.1',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'consultar_stock', arguments: { codigos: ['C1'] } },
        }),
      }),
    )
    expect(respuesta.status).toBe(403)
    expect(await respuesta.text()).not.toContain('precioCompraCentimos')
    await creado.handler.close()
  })
})

function transporte(creado: ReturnType<typeof crearApp>) {
  return new StreamableHTTPClientTransport(new URL('http://127.0.0.1/mcp'), {
    fetch: async (url, init) => {
      const encabezados = new Headers(init?.headers)
      if (!encabezados.has('host')) encabezados.set('host', new URL(url).host)
      return creado.app.fetch(new Request(url, { ...init, headers: encabezados }))
    },
  })
}
