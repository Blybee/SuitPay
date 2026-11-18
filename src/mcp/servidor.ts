import { serve } from '@hono/node-server'
import { configuracionDesdeEntorno } from './acceso.ts'
import { crearApp } from './app.ts'
import {
  listaDeEntorno,
  milisegundosDeCache,
  puertoDeEntorno,
} from './entorno.ts'
import { crearCargadorDeUsuarios } from '../server/mcp/usuarios.ts'

const HOSTS_LOCALES = ['localhost', '127.0.0.1', '[::1]'] as const

const hostDeEscucha = process.env['MCP_HOST']?.trim() || '127.0.0.1'
const enTodasLasInterfaces =
  hostDeEscucha === '0.0.0.0' || hostDeEscucha === '::'

const hostsPermitidos = listaDeEntorno(
  process.env['MCP_ALLOWED_HOSTS'],
  enTodasLasInterfaces ? [] : HOSTS_LOCALES,
)

if (enTodasLasInterfaces && hostsPermitidos.length === 0) {
  console.error(
    'MCP_ALLOWED_HOSTS es obligatorio cuando MCP_HOST es 0.0.0.0 o ::. ' +
      'Pon el hostname público del servicio, separado por comas si hay más de uno.',
  )
  process.exit(1)
}

let acceso
try {
  const cacheMs = milisegundosDeCache(process.env['MCP_USUARIO_CACHE_MS'])
  acceso = configuracionDesdeEntorno(
    process.env,
    crearCargadorDeUsuarios({ cacheMs }),
  )
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Configuración MCP inválida',
  )
  process.exit(1)
}

const { app } = crearApp({
  host: hostDeEscucha,
  hostsPermitidos,
  origenesPermitidos: listaDeEntorno(
    process.env['MCP_ALLOWED_ORIGINS'],
    HOSTS_LOCALES,
  ),
  acceso,
})

const puerto = puertoDeEntorno(process.env['PORT'])

serve(
  {
    fetch: app.fetch,
    port: puerto,
    hostname: hostDeEscucha,
  },
  (info) => {
    console.log(
      `suitpay-mcp escuchando en http://${info.address}:${info.port}/mcp`,
    )
  },
)
