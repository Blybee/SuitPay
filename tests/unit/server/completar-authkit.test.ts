import { describe, expect, it } from 'vitest'
import {
  URL_DE_COMPLETION,
  completarConexion,
  pedirComplecionAWorkOS,
} from '../../../src/server/acceso/completar-authkit.ts'
import type {
  PedidoDeWorkOS,
  ReivindicacionDeConexion,
} from '../../../src/server/acceso/completar-authkit.ts'

const REDIRECT =
  'https://elegant-palm-42-staging.authkit.app/oauth2/callback?code=abc'

const ID_EXTERNO = '01EXTERNALAUTHID'
const UID = 'uid-firebase-77'

function admin(
  extra: Partial<ReivindicacionDeConexion> = {},
): ReivindicacionDeConexion {
  return {
    uid: UID,
    rol: 'administrador',
    activo: true,
    email: 'ada@suitpay.local',
    nombre: 'Ada Lovelace',
    ...extra,
  }
}

describe('completar la conexión de AuthKit', () => {
  it('manda el uid de Firebase como user.id y redirige a la uri devuelta', async () => {
    const pedidos: PedidoDeWorkOS[] = []
    const resultado = await completarConexion({
      token: 'token-de-firebase',
      externalAuthId: ID_EXTERNO,
      clave: 'clave-de-prueba',
      verificar: async (token) => {
        expect(token).toBe('token-de-firebase')
        return admin()
      },
      transportar: async (pedido) => {
        pedidos.push(pedido)
        return { redirect_uri: REDIRECT }
      },
    })

    expect(pedidos).toEqual([
      {
        external_auth_id: ID_EXTERNO,
        user: {
          id: UID,
          email: 'ada@suitpay.local',
          first_name: 'Ada Lovelace',
        },
      },
    ])
    expect(resultado).toEqual({ ok: true, redirectUri: REDIRECT })
  })

  it('un vendedor no dispara el POST', async () => {
    let llamadas = 0
    const resultado = await completarConexion({
      token: 'token-de-firebase',
      externalAuthId: ID_EXTERNO,
      clave: 'clave-de-prueba',
      verificar: async () => admin({ rol: 'vendedor' }),
      transportar: async () => {
        llamadas += 1
        return { redirect_uri: REDIRECT }
      },
    })

    expect(llamadas).toBe(0)
    expect(resultado).toEqual({ ok: false, motivo: 'sin-permiso' })
  })

  it('un jefe activo sí completa y una cuenta inactiva no', async () => {
    let llamadas = 0
    const jefe = await completarConexion({
      token: 'token-de-firebase',
      externalAuthId: ID_EXTERNO,
      clave: 'clave-de-prueba',
      verificar: async () => admin({ rol: 'jefe' }),
      transportar: async () => {
        llamadas += 1
        return { redirect_uri: REDIRECT }
      },
    })
    const inactivo = await completarConexion({
      token: 'token-de-firebase',
      externalAuthId: ID_EXTERNO,
      clave: 'clave-de-prueba',
      verificar: async () => admin({ activo: false }),
      transportar: async () => {
        llamadas += 1
        return { redirect_uri: REDIRECT }
      },
    })

    expect(jefe).toEqual({ ok: true, redirectUri: REDIRECT })
    expect(inactivo).toEqual({ ok: false, motivo: 'sin-permiso' })
    expect(llamadas).toBe(1)
  })

  it('sin clave y con un id que no es string no llama a WorkOS', async () => {
    let llamadas = 0
    const sinClave = await completarConexion({
      token: 'token-de-firebase',
      externalAuthId: ID_EXTERNO,
      clave: undefined,
      verificar: async () => admin(),
      transportar: async () => {
        llamadas += 1
        return { redirect_uri: REDIRECT }
      },
    })
    const idRaro = await completarConexion({
      token: 'token-de-firebase',
      externalAuthId: ['01AAAAAAA', '01BBBBBBB'],
      clave: 'clave-de-prueba',
      verificar: async () => admin(),
      transportar: async () => {
        llamadas += 1
        return { redirect_uri: REDIRECT }
      },
    })

    expect(sinClave).toEqual({ ok: false, motivo: 'sin-clave' })
    expect(idRaro).toEqual({ ok: false, motivo: 'id-invalido' })
    expect(llamadas).toBe(0)
  })

  it('no usa un redirect que no sea https', async () => {
    const resultado = await completarConexion({
      token: 'token-de-firebase',
      externalAuthId: ID_EXTERNO,
      clave: 'clave-de-prueba',
      verificar: async () => admin(),
      transportar: async () => ({ redirect_uri: 'javascript:alert(1)' }),
    })

    expect(resultado).toEqual({ ok: false, motivo: 'redirect' })
  })

  it('el POST va al endpoint de complete y un 500 no entrega la uri', async () => {
    const pedido: PedidoDeWorkOS = {
      external_auth_id: ID_EXTERNO,
      user: { id: UID, email: 'ada@suitpay.local', first_name: 'Ada Lovelace' },
    }
    let visto: { url: string; metodo: string; autorizacion: string; cuerpo: unknown } | null =
      null
    const ok = await pedirComplecionAWorkOS(pedido, 'clave-de-prueba', async (url, init) => {
      visto = {
        url: String(url),
        metodo: init?.method ?? '',
        autorizacion: new Headers(init?.headers).get('authorization') ?? '',
        cuerpo: JSON.parse(String(init?.body)),
      }
      return new Response(JSON.stringify({ redirect_uri: REDIRECT }), { status: 200 })
    })

    expect(visto).toEqual({
      url: URL_DE_COMPLETION,
      metodo: 'POST',
      autorizacion: 'Bearer clave-de-prueba',
      cuerpo: pedido,
    })
    expect(ok).toEqual({ redirect_uri: REDIRECT })

    await expect(
      pedirComplecionAWorkOS(pedido, 'clave-de-prueba', async () =>
        new Response(JSON.stringify({ redirect_uri: REDIRECT }), { status: 500 }),
      ),
    ).rejects.toThrow('WorkOS respondió 500')
  })
})
