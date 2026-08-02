/**
 * Sondeo en vivo de la API de consulta RUC (host distinto a facturación).
 * Uso: node scripts/sondeo-consulta-ruc.mjs [ruc]
 * Carga .env.local; no imprime el token.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function cargarEnvLocal() {
  try {
    const texto = readFileSync(resolve('.env.local'), 'utf8')
    for (const linea of texto.split('\n')) {
      const limpia = linea.trim()
      if (limpia === '' || limpia.startsWith('#')) continue
      const igual = limpia.indexOf('=')
      if (igual <= 0) continue
      const clave = limpia.slice(0, igual).trim()
      const valor = limpia.slice(igual + 1).trim()
      if (process.env[clave] === undefined) process.env[clave] = valor
    }
  } catch {
    console.error('No se pudo leer .env.local')
    process.exit(1)
  }
}

cargarEnvLocal()

const token = process.env.PROVEEDOR_TOKEN
console.log(`Usando PROVEEDOR_TOKEN (len=${token?.length ?? 0}, no se imprime).`)
const ruc = process.argv[2] ?? '20337564373'
const urlConsultas =
  (process.env.PROVEEDOR_CONSULTAS_URL_BASE ?? 'https://consultas.factpro.la').replace(
    /\/$/,
    '',
  )
const urlFacturacion = (process.env.PROVEEDOR_URL_BASE ?? '').replace(/\/$/, '')

if (!token) {
  console.error('Falta PROVEEDOR_TOKEN')
  process.exit(1)
}

async function sondear(etiqueta, url, init) {
  const respuesta = await fetch(url, init)
  const cuerpo = await respuesta.text()
  let json
  try {
    json = JSON.parse(cuerpo)
  } catch {
    json = undefined
  }
  console.log(`\n[${etiqueta}]`)
  console.log(`  url: ${url}`)
  console.log(`  status: ${respuesta.status}`)
  console.log(`  content-type: ${respuesta.headers.get('content-type')}`)
  if (json && typeof json === 'object') {
    console.log(`  keys: ${Object.keys(json).join(', ')}`)
    if ('nombre' in json) console.log(`  nombre: ${json.nombre}`)
    if ('data' in json) console.log(`  data keys: ${Object.keys(json.data ?? {}).join(', ')}`)
    if ('errors' in json) console.log(`  errors: ${JSON.stringify(json.errors)}`)
    if ('message' in json) console.log(`  message: ${json.message}`)
  } else {
    console.log(`  body: ${cuerpo.slice(0, 300)}`)
  }
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
}

await sondear(
  'CORRECTO docs',
  `${urlConsultas}/api/v1/ruc/${encodeURIComponent(ruc)}`,
  { method: 'GET', headers },
)

if (urlFacturacion) {
  await sondear(
    'VIEJO adaptador (incorrecto)',
    `${urlFacturacion}/api/v3/consulta-ruc`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: ruc, tipo: 'RUC' }),
    },
  )
}
