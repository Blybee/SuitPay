import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import type { CryptoKey } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COLECCIONES } from '../../src/server/firebase/admin.ts'
import type { Firestore } from 'firebase-admin/firestore'

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }

async function emuladorEscuchando(): Promise<boolean> {
  try {
    await fetch(`http://${EMULADOR.host}:${EMULADOR.puerto}/`)
    return true
  } catch {
    return false
  }
}

const hayEmulador = await emuladorEscuchando()

if (!hayEmulador) {
  console.warn(
    '\n  AVISO: mcp-acceso NO se verificó contra Firestore (sin emulador).\n',
  )
}

const describeConEmulador = describe.skipIf(!hayEmulador)

describeConEmulador('roles del MCP contra Firestore', () => {
  let base: Firestore
  let privada: CryptoKey
  let emisor: string
  let recurso: URL
  let cerrarJwks: () => Promise<void>
  let app: { fetch: (request: Request) => Promise<Response> | Response }
  let appCache: { fetch: (request: Request) => Promise<Response> | Response }
  let reloj = 0

  const adminUid = 'mcp-acceso-admin'
  const jefeUid = 'mcp-acceso-jefe'
  const vendedorUid = 'mcp-acceso-vendedor'
  const inactivoUid = 'mcp-acceso-inactivo'
  const cacheUid = 'mcp-acceso-cache'

  beforeAll(async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] =
      `${EMULADOR.host}:${EMULADOR.puerto}`
    process.env['GOOGLE_CLOUD_PROJECT'] = 'demo-suitpay'

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
    emisor = `http://127.0.0.1:${puerto}`
    recurso = new URL(`${emisor}/mcp`)
    cerrarJwks = () =>
      new Promise((resolve, reject) => {
        servidor.close((error) => (error ? reject(error) : resolve()))
      })

    const { bd } = await import('../../src/server/firebase/admin.ts')
    const { crearApp } = await import('../../src/mcp/app.ts')
    const { crearCargadorDeUsuarios } =
      await import('../../src/server/mcp/usuarios.ts')
    base = bd()

    const accesoBase = {
      emisor,
      jwksUrl: new URL(`${emisor}/jwks`),
      recurso,
      claimUid: 'firebase_uid',
    }
    const hosts = {
      host: '127.0.0.1',
      hostsPermitidos: ['127.0.0.1', 'localhost'],
      origenesPermitidos: ['127.0.0.1', 'localhost'],
    }
    app = crearApp({
      ...hosts,
      acceso: {
        ...accesoBase,
        cargarUsuario: crearCargadorDeUsuarios({ cacheMs: 60_000, base }),
      },
    }).app
    appCache = crearApp({
      ...hosts,
      acceso: {
        ...accesoBase,
        cargarUsuario: crearCargadorDeUsuarios({
          cacheMs: 60_000,
          base,
          ahora: () => reloj,
        }),
      },
    }).app

    await escribirUsuario(adminUid, 'administrador', true)
    await escribirUsuario(jefeUid, 'jefe', true)
    await escribirUsuario(vendedorUid, 'vendedor', true)
    await escribirUsuario(inactivoUid, 'administrador', false)
    await escribirUsuario(cacheUid, 'administrador', true)
  })

  afterAll(async () => {
    if (!hayEmulador) return
    await Promise.all(
      [adminUid, jefeUid, vendedorUid, inactivoUid, cacheUid].map((uid) =>
        base.collection(COLECCIONES.usuarios).doc(uid).delete(),
      ),
    )
    await cerrarJwks()
  })

  async function escribirUsuario(
    uid: string,
    rol: string,
    activo: boolean,
  ): Promise<void> {
    await base.collection(COLECCIONES.usuarios).doc(uid).set({
      nombre: uid,
      rol,
      activo,
    })
  }

  async function firmar(uid: string): Promise<string> {
    return new SignJWT({ firebase_uid: uid })
      .setProtectedHeader({ alg: 'RS256', kid: 'prueba' })
      .setIssuer(emisor)
      .setAudience(recurso.href)
      .setIssuedAt()
      .setExpirationTime('2m')
      .sign(privada)
  }

  async function post(destino: typeof app, uid: string): Promise<Response> {
    return destino.fetch(
      new Request(recurso, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          host: '127.0.0.1',
          authorization: `Bearer ${await firmar(uid)}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    )
  }

  it('deja pasar a administrador y a jefe', async () => {
    const admin = await post(app, adminUid)
    const jefe = await post(app, jefeUid)
    expect(admin.status).toBe(200)
    expect(await admin.text()).toContain('"name":"ping"')
    expect(jefe.status).toBe(200)
  })

  it('rechaza vendedor, inactivo y uid ausente con 403', async () => {
    const vendedor = await post(app, vendedorUid)
    const inactivo = await post(app, inactivoUid)
    const ausente = await post(app, 'mcp-acceso-nadie')
    for (const respuesta of [vendedor, inactivo, ausente]) {
      expect(respuesta.status).toBe(403)
      expect(await respuesta.json()).toEqual({ error: 'acceso_denegado' })
    }
  })

  it('mantiene la ficha admitida durante 60 s y la suelta al vencer', async () => {
    reloj = 1_000_000
    const primera = await post(appCache, cacheUid)
    expect(primera.status).toBe(200)

    await escribirUsuario(cacheUid, 'vendedor', true)
    reloj += 1_000
    const dentro = await post(appCache, cacheUid)
    expect(dentro.status).toBe(200)

    reloj += 60_000
    const despues = await post(appCache, cacheUid)
    expect(despues.status).toBe(403)
  })
})
