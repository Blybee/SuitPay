import { destinoDeRol } from '../sesion/destino.ts'
import type { Rol } from '../sesion/almacen.ts'

/** WorkOS manda un identificador opaco. No es HTML ni una lista de query. */
const ID_EXTERNO = /^[A-Za-z0-9_-]{8,200}$/

export type RutaDeRol = '/fichaje' | '/administracion' | '/'

export type MotivoDeConexion =
  | 'sesion'
  | 'sin-permiso'
  | 'sin-correo'
  | 'id-invalido'
  | 'sin-clave'
  | 'workos'
  | 'redirect'

export type ResultadoDeConexion =
  | { readonly ok: true; readonly redirectUri: string }
  | { readonly ok: false; readonly motivo: MotivoDeConexion }

export interface BusquedaDeAcceso {
  readonly externalAuthId: string | null
  readonly idInvalido: boolean
}

export type PasoDeAcceso =
  | { readonly tipo: 'destino'; readonly ruta: RutaDeRol }
  | { readonly tipo: 'completar' }
  | { readonly tipo: 'id-invalido' }

const MENSAJES: Record<MotivoDeConexion, string> = {
  sesion: 'La sesión no es válida. Vuelve a entrar.',
  'sin-permiso':
    'Esta conexión solo la completa un administrador o un jefe con la cuenta activa.',
  'sin-correo': 'Tu usuario no tiene correo y no se puede completar la conexión.',
  'id-invalido': 'El identificador de la conexión no es válido.',
  'sin-clave': 'La conexión externa no está configurada.',
  workos: 'No se pudo completar la conexión. Inténtalo de nuevo.',
  redirect: 'La respuesta de la conexión no trae una dirección segura.',
}

export function idExternoValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  return ID_EXTERNO.test(valor) ? valor : null
}

/**
 * Sin el parámetro, la pantalla es la de siempre. Un valor que no es un
 * string opaco se descarta: no se guarda para pintarlo.
 */
export function leerBusquedaDeAcceso(
  search: Record<string, unknown>,
): BusquedaDeAcceso {
  if (!Object.prototype.hasOwnProperty.call(search, 'external_auth_id')) {
    return { externalAuthId: null, idInvalido: false }
  }
  const id = idExternoValido(search['external_auth_id'])
  if (id === null) return { externalAuthId: null, idInvalido: true }
  return { externalAuthId: id, idInvalido: false }
}

export function decidirTrasEntrar(entrada: {
  readonly externalAuthId: string | null
  readonly idInvalido: boolean
  readonly rol: Rol | null
}): PasoDeAcceso {
  if (entrada.idInvalido) return { tipo: 'id-invalido' }
  if (entrada.externalAuthId === null) {
    return { tipo: 'destino', ruta: destinoDeRol(entrada.rol) }
  }
  return { tipo: 'completar' }
}

export function mensajeDeConexion(motivo: MotivoDeConexion): string {
  return MENSAJES[motivo]
}
