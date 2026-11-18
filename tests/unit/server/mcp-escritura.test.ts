import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import type { CryptoKey } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearApp } from '../../../src/mcp/app.ts'
import type { ConfiguracionDeAcceso } from '../../../src/mcp/acceso.ts'

describe('escritura MCP', () => {
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

  it('un vendedor y un token sin alcance reciben 403', async () => {
    const vendedor = await firmar(privada, emisor, recurso.href, {
      firebase_uid: 'vend-1',
      scope: 'suitpay.escribir',
    })
    const sinAlcance = await firmar(privada, emisor, recurso.href, {
      firebase_uid: 'admin-1',
    })
    const acceso: ConfiguracionDeAcceso = {
      emisor,
      jwksUrl,
      recurso,
      claimUid: 'firebase_uid',
      cargarUsuario: async (uid) =>
        uid === 'admin-1'
          ? { estado: 'admitida', ficha: { uid, rol: 'administrador' } }
          : { estado: 'rechazada' },
    }
    const creado = crearApp({
      host: '127.0.0.1',
      hostsPermitidos: ['127.0.0.1'],
      origenesPermitidos: ['127.0.0.1'],
      acceso,
    })
    const cuerpo = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'crear_cotizacion',
        arguments: {
          clave: 'cotizacion-1',
          lineas: [{ codigo: 'C1', cantidad: 1, precio: 1 }],
          cliente: null,
        },
      },
    }
    const delVendedor = await llamar(creado, vendedor, cuerpo)
    const delAdmin = await llamar(creado, sinAlcance, cuerpo)
    expect(delVendedor.status).toBe(403)
    expect(delAdmin.status).toBe(403)
    expect(await delAdmin.text()).not.toContain('"yaExistia"')
    await creado.handler.close()
  })
})

function firmar(
  privada: CryptoKey,
  emisor: string,
  audiencia: string,
  claims: Record<string, string>,
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'prueba' })
    .setIssuer(emisor)
    .setAudience(audiencia)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(privada)
}

function llamar(
  creado: ReturnType<typeof crearApp>,
  token: string,
  cuerpo: unknown,
) {
  return creado.app.fetch(
    new Request('http://127.0.0.1/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        host: '127.0.0.1',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cuerpo),
    }),
  )
}
