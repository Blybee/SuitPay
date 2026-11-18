import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'
import {
  OAuthError,
  OAuthErrorCode,
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
} from '@modelcontextprotocol/server'
import type { AuthInfo, OAuthTokenVerifier } from '@modelcontextprotocol/server'
import type { Hono } from 'hono'
import type { ResultadoDeFicha } from '../server/mcp/usuarios.ts'

export const ALCANCE_ESCRITURA = 'suitpay.escribir'

/** Supuesto: WorkOS pone el uid de Firebase en este claim, no en `sub`. */
export const CLAIM_UID_POR_OMISION = 'firebase_uid'

export interface ConfiguracionDeAcceso {
  readonly emisor: string
  readonly jwksUrl: URL
  readonly recurso: URL
  readonly claimUid: string
  readonly cargarUsuario: (uid: string) => Promise<ResultadoDeFicha>
}

export interface MetadatosDelRecurso {
  readonly resource: string
  readonly authorization_servers: readonly string[]
  readonly scopes_supported: readonly string[]
  readonly bearer_methods_supported: readonly ['header']
}

export function urlDeMetadatos(recurso: URL): string {
  return new URL('/.well-known/oauth-protected-resource', recurso).href
}

export function metadatosDelRecurso(
  acceso: ConfiguracionDeAcceso,
): MetadatosDelRecurso {
  return {
    resource: sinBarraFinal(acceso.recurso.href),
    authorization_servers: [acceso.emisor],
    scopes_supported: [ALCANCE_ESCRITURA],
    bearer_methods_supported: ['header'],
  }
}

export function configuracionDesdeEntorno(
  entorno: NodeJS.ProcessEnv,
  cargarUsuario: ConfiguracionDeAcceso['cargarUsuario'],
): ConfiguracionDeAcceso {
  return {
    emisor: textoExigido(entorno, 'MCP_JWT_ISSUER'),
    jwksUrl: urlExigida(textoExigido(entorno, 'MCP_JWKS_URL'), 'MCP_JWKS_URL'),
    recurso: urlExigida(
      textoExigido(entorno, 'MCP_RESOURCE_URL'),
      'MCP_RESOURCE_URL',
    ),
    claimUid: entorno['MCP_UID_CLAIM']?.trim() || CLAIM_UID_POR_OMISION,
    cargarUsuario,
  }
}

export interface AccesoPreparado {
  readonly autenticar: (request: Request) => Promise<AuthInfo | Response>
}

export function prepararAcceso(acceso: ConfiguracionDeAcceso): AccesoPreparado {
  const recurso = new URL(sinBarraFinal(acceso.recurso.href))
  const gate = requireBearerAuth({
    verifier: crearVerificador(acceso, recurso),
    expectedResource: recurso,
    resourceMetadataUrl: urlDeMetadatos(acceso.recurso),
  })

  return {
    async autenticar(request: Request): Promise<AuthInfo | Response> {
      const resultado = await gate(request)
      if (resultado instanceof Response) return resultado

      const uid = resultado.extra?.['uid']
      if (typeof uid !== 'string' || uid.trim() === '') {
        return Response.json({ error: 'acceso_denegado' }, { status: 403 })
      }

      const ficha = await acceso.cargarUsuario(uid)
      if (ficha.estado !== 'admitida') {
        return Response.json({ error: 'acceso_denegado' }, { status: 403 })
      }

      return resultado
    },
  }
}

export function publicarMetadatos(
  app: Hono,
  acceso: ConfiguracionDeAcceso,
): void {
  const metadatos = metadatosDelRecurso(acceso)
  app.get('/.well-known/oauth-protected-resource', (c) => c.json(metadatos))
  const rutaConRecurso = new URL(
    getOAuthProtectedResourceMetadataUrl(acceso.recurso),
  ).pathname
  if (rutaConRecurso !== '/.well-known/oauth-protected-resource') {
    app.get(rutaConRecurso, (c) => c.json(metadatos))
  }
}

function crearVerificador(
  acceso: ConfiguracionDeAcceso,
  recurso: URL,
): OAuthTokenVerifier {
  const llaves = createRemoteJWKSet(acceso.jwksUrl)
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      let payload: JWTPayload
      try {
        const verificado = await jwtVerify(token, llaves, {
          issuer: acceso.emisor,
          audience: recurso.href,
          algorithms: ['RS256'],
        })
        payload = verificado.payload
      } catch {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'Token inválido')
      }

      const uid = payload[acceso.claimUid]
      if (typeof uid !== 'string' || uid.trim() === '') {
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          'Token sin el uid de Firebase',
        )
      }

      if (typeof payload.exp !== 'number') {
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          'Token sin expiración',
        )
      }

      return {
        token,
        clientId: clientIdDe(payload),
        scopes: alcancesDe(payload),
        expiresAt: payload.exp,
        resource: recurso,
        extra: { uid },
      }
    },
  }
}

function alcancesDe(payload: JWTPayload): string[] {
  const lista = payload['scopes']
  if (Array.isArray(lista)) {
    return lista.filter((cada): cada is string => typeof cada === 'string')
  }
  if (typeof payload.scope === 'string') {
    return payload.scope.split(' ').filter((cada) => cada !== '')
  }
  return []
}

function clientIdDe(payload: JWTPayload): string {
  if (typeof payload['client_id'] === 'string' && payload['client_id'] !== '') {
    return payload['client_id']
  }
  if (typeof payload.azp === 'string' && payload.azp !== '') return payload.azp
  return 'mcp'
}

function sinBarraFinal(valor: string): string {
  return valor.length > 1 && valor.endsWith('/') ? valor.slice(0, -1) : valor
}

function textoExigido(entorno: NodeJS.ProcessEnv, nombre: string): string {
  const valor = entorno[nombre]?.trim()
  if (valor === undefined || valor === '') throw new Error(`Falta ${nombre}`)
  return valor
}

function urlExigida(valor: string, nombre: string): URL {
  try {
    return new URL(valor)
  } catch {
    throw new Error(`${nombre} no es una URL`)
  }
}
