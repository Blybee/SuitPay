import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import type { CryptoKey } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearApp } from '../../../src/mcp/app.ts'
import { configuracionDesdeEntorno } from '../../../src/mcp/acceso.ts'
import type { ConfiguracionDeAcceso } from '../../../src/mcp/acceso.ts'
import type { ResultadoDeFicha } from '../../../src/server/mcp/usuarios.ts'

const ENCABEZADOS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  host: '127.0.0.1',
}

let cerrarJwks: () => Promise<void>
let jwksUrl: URL
let emisor: string
let recurso: URL
let privada: CryptoKey

async function firmar(opciones: {
  readonly uid?: string
  readonly emisor?: string
  readonly audiencia?: string
  readonly expiraEn?: number | string
  readonly claim?: string
}): Promise<string> {
  const claim = opciones.claim ?? 'firebase_uid'
  const cuerpo: Record<string, string> = {}
  if (opciones.uid !== undefined) cuerpo[claim] = opciones.uid
  const jwt = new SignJWT(cuerpo)
    .setProtectedHeader({ alg: 'RS256', kid: 'prueba' })
    .setIssuer(opciones.emisor ?? emisor)
    .setAudience(opciones.audiencia ?? recurso.href)
    .setIssuedAt()
  if (typeof opciones.expiraEn === 'number')
    jwt.setExpirationTime(opciones.expiraEn)
  else jwt.setExpirationTime(opciones.expiraEn ?? '2m')
  return jwt.sign(privada)
}

function appCon(
  cargarUsuario: ConfiguracionDeAcceso['cargarUsuario'],
  claimUid = 'firebase_uid',
) {
  return crearApp({
    host: '127.0.0.1',
    hostsPermitidos: ['127.0.0.1', 'localhost'],
    origenesPermitidos: ['127.0.0.1', 'localhost'],
    acceso: {
      emisor,
      jwksUrl,
      recurso,
      claimUid,
      cargarUsuario,
    },
  })
}

async function postMcp(
  app: ReturnType<typeof crearApp>['app'],
  token?: string,
): Promise<Response> {
  return app.fetch(
    new Request(recurso, {
      method: 'POST',
      headers: {
        ...ENCABEZADOS,
        ...(token !== undefined ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }),
  )
}

const cargarNadie: ConfiguracionDeAcceso['cargarUsuario'] = async () => {
  throw new Error('un token inválido no debe leer Firestore')
}

describe('acceso MCP', () => {
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
    cerrarJwks = () =>
      new Promise((resolve, reject) => {
        servidor.close((error) => (error ? reject(error) : resolve()))
      })
  })

  afterAll(async () => {
    await cerrarJwks()
  })

  it('no anuncia scopes que AuthKit rechazaría en el documento de recurso', async () => {
    const aceptadosPorAuthKit = new Set([
      'openid',
      'email',
      'profile',
      'offline_access',
    ])
    const { app } = appCon(cargarNadie)
    const respuesta = await app.fetch(
      new Request(new URL('/.well-known/oauth-protected-resource', recurso), {
        headers: { host: '127.0.0.1' },
      }),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = (await respuesta.json()) as {
      resource: string
      authorization_servers: string[]
      scopes_supported?: string[]
      bearer_methods_supported: string[]
    }
    const anunciados = cuerpo.scopes_supported ?? []
    expect(cuerpo.resource).toBe(recurso.href)
    expect(cuerpo.authorization_servers).toEqual([emisor])
    expect(cuerpo.bearer_methods_supported).toEqual(['header'])
    expect(anunciados.filter((scope) => !aceptadosPorAuthKit.has(scope))).toEqual([])
    expect(anunciados).not.toContain('suitpay.escribir')
    expect(JSON.stringify(cuerpo)).not.toContain('suitpay.escribir')
  })

  it('responde 401 con WWW-Authenticate si no hay token', async () => {
    const { app } = appCon(cargarNadie)
    const respuesta = await postMcp(app)
    expect(respuesta.status).toBe(401)
    const desafio = respuesta.headers.get('www-authenticate') ?? ''
    expect(desafio.startsWith('Bearer ')).toBe(true)
    expect(desafio).toContain(
      `resource_metadata="${new URL('/.well-known/oauth-protected-resource', recurso).href}"`,
    )
    expect(desafio).not.toContain('suitpay.escribir')
    expect(desafio).not.toContain('scope=')
  })

  it('rechaza audiencia, emisor o expiración incorrectos con 401', async () => {
    const { app } = appCon(cargarNadie)
    const audienciaMala = await firmar({
      uid: 'uid-admin',
      audiencia: 'http://otro.example/mcp',
    })
    const emisorMalo = await firmar({
      uid: 'uid-admin',
      emisor: 'http://emisor-malo.example',
    })
    const vencido = await firmar({
      uid: 'uid-admin',
      expiraEn: Math.floor(Date.now() / 1000) - 60,
    })

    for (const token of [audienciaMala, emisorMalo, vencido]) {
      const respuesta = await postMcp(app, token)
      expect(respuesta.status).toBe(401)
    }
  })

  it('acepta un admin del cargador y tools/list incluye ping', async () => {
    const cargarUsuario = async (uid: string): Promise<ResultadoDeFicha> => {
      if (uid !== 'uid-admin') return { estado: 'rechazada' }
      return {
        estado: 'admitida',
        ficha: { uid, rol: 'administrador' },
      }
    }
    const { app } = appCon(cargarUsuario)
    const token = await firmar({ uid: 'uid-admin' })
    const respuesta = await postMcp(app, token)
    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toContain('"name":"ping"')
  })

  it('exige el nombre de las variables y no arranca sin ellas', () => {
    expect(() =>
      configuracionDesdeEntorno({}, async () => ({ estado: 'rechazada' })),
    ).toThrow(/Falta MCP_JWT_ISSUER/)
  })
})
