/**
 * T027 — sondeo del entorno de demostración del proveedor.
 *
 * Lee PROVEEDOR_URL_BASE y PROVEEDOR_TOKEN de .env.local.
 * No imprime el token. Escribe un resumen en stdout para pegar en research.md.
 *
 * Uso: node --env-file=.env.local scripts/t027-sondeo-proveedor.mjs
 */

const base = process.env.PROVEEDOR_URL_BASE
const token = process.env.PROVEEDOR_TOKEN

if (!base || !token) {
  console.error('Faltan PROVEEDOR_URL_BASE o PROVEEDOR_TOKEN en el entorno.')
  process.exit(1)
}

async function post(ruta, cuerpo) {
  const inicio = Date.now()
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
    json = null
  }
  return {
    ms: Date.now() - inicio,
    estadoHttp: respuesta.status,
    ok: respuesta.ok,
    json,
    texto: texto.slice(0, 800),
  }
}

function resumen(etiqueta, r) {
  const keys =
    r.json && typeof r.json === 'object' ? Object.keys(r.json).join(', ') : '(no json)'
  const exito = r.json?.exito ?? r.json?.success
  const code = r.json?.response?.code ?? r.json?.codigo ?? r.json?.code
  const msg =
    r.json?.response?.description ??
    r.json?.mensaje ??
    r.json?.message ??
    r.json?.error
  const number = r.json?.data?.number ?? r.json?.data?.numero
  console.log(`\n## ${etiqueta}`)
  console.log(`HTTP ${r.estadoHttp} (${r.ms} ms) keys=[${keys}]`)
  console.log(`exito/success=${JSON.stringify(exito)} code=${JSON.stringify(code)}`)
  console.log(`mensaje=${JSON.stringify(msg)}`)
  if (number !== undefined) console.log(`number=${JSON.stringify(number)}`)
  console.log(`cuerpo (recorte): ${r.texto}`)
}

const seriePrueba = process.env.T027_SERIE ?? 'F001'
const numeroAlto = Number(process.env.T027_NUMERO ?? '900001')

console.log('T027 sondeo — base configurada, token presente (no se imprime).')
console.log(`Serie de prueba: ${seriePrueba}, numero explícito candidato: ${numeroAlto}`)

// (b) Forma de error: consulta de un documento que casi seguro no existe.
const consultaAusente = await post('/api/v3/consulta', {
  serie: seriePrueba,
  numero: String(numeroAlto),
})
resumen('Consulta documento inexistente (forma de error)', consultaAusente)

// (a) Emisión con número explícito — solo si T027_EMITIR=1 (crea documento real en demo).
if (process.env.T027_EMITIR === '1') {
  const cuerpoEmision = {
    serie: seriePrueba,
    numero: String(numeroAlto),
    tipo_operacion: '1',
    cliente: {
      cliente_tipo_documento: '4',
      cliente_numero_documento: '20605577241',
      cliente_denominacion: 'SUITPAY SONDEO T027',
      cliente_direccion: 'Av. Prueba 1',
      cliente_email: '',
      cliente_telefono: '',
    },
    items: [
      {
        unidad: 'NIU',
        codigo: 'T027',
        descripcion: 'Sondeo numero explicito SuitPay',
        cantidad: 1,
        precio: 1,
        tipo_tax: '1',
        descuento: 0,
      },
    ],
    condicion_de_pago: [
      { tipo_de_condicion: '0', forma_de_pago: '0', monto: 0 },
    ],
    observaciones: 'T027 SuitPay — borrar/anular en demo si hace falta',
    formato_pdf: 'a4',
  }

  const emision = await post('/api/v3/documentos', cuerpoEmision)
  resumen('Emisión con número explícito', emision)

  const numeroDevuelto =
    emision.json?.data?.number ?? emision.json?.data?.numero ?? ''
  const respetado =
    typeof numeroDevuelto === 'string' &&
    (numeroDevuelto.endsWith(`-${numeroAlto}`) ||
      numeroDevuelto === String(numeroAlto) ||
      numeroDevuelto.endsWith(`-${numeroAlto}`))

  console.log(`\n¿Parece respetar el número? ${respetado ? 'SÍ' : 'REVISAR'} (devuelto=${numeroDevuelto})`)

  // Reintento del mismo número: forma ante "ya usado".
  const duplicado = await post('/api/v3/documentos', cuerpoEmision)
  resumen('Reemisión mismo número (ya usado)', duplicado)
} else {
  console.log(
    '\n(Emisión omitida. Exporta T027_EMITIR=1 para probar número explícito y duplicado.)',
  )
}
