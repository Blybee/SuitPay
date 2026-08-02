/**
 * Sondeo de facturación con PROVEEDOR_TOKEN (no TOKEN_2).
 * 1) Consulta un documento (serie/número).
 * 2) Emite uno nuevo con número alto único (crea doc real en demo).
 * 3) Contrasta con consultas RUC (mismo token).
 *
 * Uso: node scripts/sondeo-documento.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function cargarEnvLocal() {
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
}

cargarEnvLocal()

const base = (process.env.PROVEEDOR_URL_BASE ?? '').replace(/\/$/, '')
const token = process.env.PROVEEDOR_TOKEN
if (!base || !token) {
  console.error('Faltan PROVEEDOR_URL_BASE o PROVEEDOR_TOKEN')
  process.exit(1)
}

console.log(
  `Token: PROVEEDOR_TOKEN (len=${token.length}). TOKEN_2 ignorado a propósito.`,
)

async function post(ruta, cuerpo) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(30_000),
  })
  const texto = await respuesta.text()
  let json
  try {
    json = JSON.parse(texto)
  } catch {
    json = undefined
  }
  return { status: respuesta.status, json, texto: texto.slice(0, 500) }
}

const serie = process.env.SONDEO_SERIE ?? 'F001'
const numeroExistente = Number(process.env.SONDEO_CONSULTA_NUMERO ?? '900001')
const numeroNuevo = Number(
  process.env.SONDEO_EMITIR_NUMERO ?? `9${String(Date.now()).slice(-5)}`,
)

console.log(`\n## 1) Consultar documento ${serie}-${numeroExistente}`)
const consulta = await post('/api/v3/consulta', {
  serie,
  numero: String(numeroExistente),
})
console.log(`HTTP ${consulta.status}`)
console.log(
  `exito=${JSON.stringify(consulta.json?.exito)} number=${JSON.stringify(consulta.json?.data?.number ?? consulta.json?.data?.numero)}`,
)
console.log(
  `mensaje=${JSON.stringify(consulta.json?.errors?.[0]?.message ?? consulta.json?.message)}`,
)

console.log(`\n## 2) Emitir documento demo ${serie}-${numeroNuevo}`)
const emision = await post('/api/v3/documentos', {
  serie,
  numero: String(numeroNuevo),
  tipo_operacion: '1',
  cliente: {
    cliente_tipo_documento: '4',
    cliente_numero_documento: '20605577241',
    cliente_denominacion: 'SUITPAY SONDEO DOCUMENTO',
    cliente_direccion: 'Av. Prueba 1',
    cliente_email: '',
    cliente_telefono: '',
  },
  items: [
    {
      unidad: 'NIU',
      codigo: 'SONDEO',
      descripcion: 'Sondeo documento SuitPay (PROVEEDOR_TOKEN)',
      cantidad: 1,
      precio: 1,
      tipo_tax: '1',
      descuento: 0,
    },
  ],
  condicion_de_pago: [
    { tipo_de_condicion: '0', forma_de_pago: '0', monto: 0 },
  ],
  observaciones: 'Sondeo SuitPay — demo',
  formato_pdf: 'a4',
})
console.log(`HTTP ${emision.status}`)
console.log(
  `exito=${JSON.stringify(emision.json?.exito)} number=${JSON.stringify(emision.json?.data?.number ?? emision.json?.data?.numero)}`,
)
console.log(
  `mensaje=${JSON.stringify(emision.json?.errors?.[0]?.message ?? emision.json?.message)}`,
)
const numeroDevuelto =
  emision.json?.data?.number ?? emision.json?.data?.numero ?? ''
const okFacturacion =
  emision.status >= 200 &&
  emision.status < 300 &&
  emision.json?.exito !== false &&
  String(numeroDevuelto).length > 0
console.log(`facturacion_ok=${okFacturacion}`)

if (okFacturacion) {
  console.log(`\n## 2b) Reconsultar el emitido`)
  const otra = await post('/api/v3/consulta', {
    serie,
    numero: String(numeroNuevo),
  })
  console.log(`HTTP ${otra.status}`)
  console.log(
    `exito=${JSON.stringify(otra.json?.exito)} number=${JSON.stringify(otra.json?.data?.number ?? otra.json?.data?.numero)}`,
  )
}

console.log('\n## 3) Mismo token contra consultas RUC')
const rucResp = await fetch(
  'https://consultas.factpro.la/api/v1/ruc/20337564373',
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  },
)
const rucTexto = await rucResp.text()
let rucJson
try {
  rucJson = JSON.parse(rucTexto)
} catch {
  rucJson = undefined
}
console.log(`HTTP ${rucResp.status}`)
console.log(
  `detail/nombre=${JSON.stringify(rucJson?.detail ?? rucJson?.nombre)}`,
)
console.log(
  '\nConclusión: facturación y consultas son APIs distintas; un token puede emitir y aun así fallar en RUC.',
)
