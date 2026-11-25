import { idExternoValido } from '../../features/acceso/conexion.ts'
import type { ResultadoDeConexion } from '../../features/acceso/conexion.ts'
import { auth } from '../firebase/admin.ts'

export const URL_DE_COMPLETION =
  'https://api.workos.com/authkit/oauth2/complete'

const ROLES_QUE_CONECTAN = new Set(['administrador', 'jefe'])

export interface ReivindicacionDeConexion {
  readonly uid: string
  readonly rol: string
  readonly activo: boolean
  readonly email: string | undefined
  readonly nombre: string | undefined
}

export interface PedidoDeWorkOS {
  readonly external_auth_id: string
  readonly user: {
    readonly id: string
    readonly email: string
    readonly first_name: string
  }
}

export async function verificarTokenDeConexion(
  token: string,
): Promise<ReivindicacionDeConexion> {
  const reivindicaciones = await auth().verifyIdToken(token, true)
  return {
    uid: reivindicaciones.uid,
    rol: typeof reivindicaciones.rol === 'string' ? reivindicaciones.rol : '',
    activo: reivindicaciones.activo === true,
    email:
      typeof reivindicaciones.email === 'string'
        ? reivindicaciones.email
        : undefined,
    nombre:
      typeof reivindicaciones.name === 'string'
        ? reivindicaciones.name
        : undefined,
  }
}

export async function completarConexion(entrada: {
  readonly token: string | undefined
  readonly externalAuthId: unknown
  readonly clave: string | undefined
  readonly verificar: (token: string) => Promise<ReivindicacionDeConexion>
  readonly transportar: (
    pedido: PedidoDeWorkOS,
    clave: string,
  ) => Promise<unknown>
}): Promise<ResultadoDeConexion> {
  const id = idExternoValido(entrada.externalAuthId)
  if (id === null) return { ok: false, motivo: 'id-invalido' }
  if (entrada.token === undefined || entrada.token.trim() === '') {
    return { ok: false, motivo: 'sesion' }
  }

  let reivindicacion: ReivindicacionDeConexion
  try {
    reivindicacion = await entrada.verificar(entrada.token)
  } catch {
    return { ok: false, motivo: 'sesion' }
  }

  if (
    reivindicacion.activo !== true ||
    !ROLES_QUE_CONECTAN.has(reivindicacion.rol)
  ) {
    return { ok: false, motivo: 'sin-permiso' }
  }
  if (reivindicacion.email === undefined || reivindicacion.email === '') {
    return { ok: false, motivo: 'sin-correo' }
  }

  const clave = entrada.clave?.trim()
  if (clave === undefined || clave === '') {
    return { ok: false, motivo: 'sin-clave' }
  }

  const pedido: PedidoDeWorkOS = {
    external_auth_id: id,
    user: {
      id: reivindicacion.uid,
      email: reivindicacion.email,
      first_name: nombreVisible(reivindicacion),
    },
  }

  let respuesta: unknown
  try {
    respuesta = await entrada.transportar(pedido, clave)
  } catch {
    return { ok: false, motivo: 'workos' }
  }

  const redirectUri = redirectHttps(respuesta)
  if (redirectUri === null) return { ok: false, motivo: 'redirect' }
  return { ok: true, redirectUri }
}

export async function pedirComplecionAWorkOS(
  pedido: PedidoDeWorkOS,
  clave: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const respuesta = await fetchImpl(URL_DE_COMPLETION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clave}`,
    },
    body: JSON.stringify(pedido),
  })
  if (!respuesta.ok) {
    throw new Error(`WorkOS respondió ${respuesta.status}`)
  }
  return respuesta.json() as Promise<unknown>
}

function nombreVisible(reivindicacion: ReivindicacionDeConexion): string {
  const nombre = reivindicacion.nombre?.trim()
  if (nombre !== undefined && nombre !== '') return nombre
  return reivindicacion.email ?? ''
}

function redirectHttps(respuesta: unknown): string | null {
  if (typeof respuesta !== 'object' || respuesta === null) return null
  const uri = (respuesta as { redirect_uri?: unknown }).redirect_uri
  if (typeof uri !== 'string') return null
  try {
    if (new URL(uri).protocol !== 'https:') return null
  } catch {
    return null
  }
  return uri
}
