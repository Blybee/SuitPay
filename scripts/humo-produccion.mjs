import { spawn } from 'node:child_process'
import { access, readFile, readdir } from 'node:fs/promises'
import { connect } from 'node:net'
import { join } from 'node:path'
import { toJSONAsync } from 'seroval'

/**
 * Prueba de humo del servidor de producción (`.output/server`).
 *
 * ## Qué fallo detecta y por qué no lo detecta nada más
 *
 * Nitro 3 empaqueta `node_modules` en `.output/server/_libs`. Si ese empaquetado
 * rompe la carga de un módulo (interop CJS/ESM, un `import()` que no quedó en el
 * grafo, un nativo que no viaja), el error ocurre **al importar el módulo de la
 * función de servidor**, fuera del `try/catch` del handler. Nitro responde
 * entonces `500 {"status":500,"unhandled":true}` como JSON plano, y el cliente
 * de TanStack Start —que solo reconoce respuestas con `x-tss-serialized`—
 * devuelve `undefined` al llamador. En el mostrador eso se ve como
 * `Cannot read properties of undefined (reading 'ok')` y una banda de
 * «asistencia no disponible», aunque el fallo no tenga nada que ver con la IA.
 *
 * `vite dev` no empaqueta, así que en local todo funciona. Los tests unitarios
 * importan fuentes, no el bundle. Esta comprobación mira **el artefacto** que
 * se despliega, que es el único sitio donde el fallo existe.
 *
 * ## Qué hace
 *
 * Arranca `.output/server/index.mjs` en un puerto libre, sin credenciales ni
 * emuladores, y llama a una función de servidor **sin token**. La respuesta
 * correcta es la del propio handler: `{ ok: false, error: { codigo:
 * 'sesion_ausente' } }` serializada por TanStack (`x-tss-serialized: true`).
 * Cualquier otra cosa —en particular un 500 sin esa cabecera— significa que
 * el módulo no se pudo cargar en producción.
 *
 * Uso: `npm run build && node scripts/humo-produccion.mjs`
 */

const SALIDA = '.output/server'
const ENTRADA = join(SALIDA, 'index.mjs')
/**
 * Funciones POST con validador y `try/catch` propio: con datos válidos y sin
 * token responden `sesion_ausente` antes de tocar Firestore o Storage. Son las
 * que fallaban en el mostrador (foto, PDF de cotización, catálogo).
 */
const FUNCIONES = [
  {
    nombre: 'interpretarCapturaFn',
    data: { tipo: 'imagen', medioUrl: 'humo/no-existe.jpg' },
  },
  { nombre: 'extraerListaPdfFn', data: { medioUrl: 'humo/no-existe.pdf' } },
  { nombre: 'interpretarRequerimientoFn', data: { texto: 'humo' } },
  {
    nombre: 'importarCatalogoFn',
    data: { contenido: '[]', formato: 'json', modo: 'validar' },
  },
  {
    nombre: 'interpretarCatalogoDocumentoFn',
    data: { contenidoBase64: 'JVBERi0xLjQK' },
  },
]
const ESPERA_ARRANQUE_MS = 15_000

async function existe(ruta) {
  try {
    await access(ruta)
    return true
  } catch {
    return false
  }
}

async function archivosMjs(dir) {
  const salida = []
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name)
    if (entrada.isDirectory()) {
      if (entrada.name === 'node_modules') continue
      salida.push(...(await archivosMjs(ruta)))
    } else if (entrada.name.endsWith('.mjs')) {
      salida.push(ruta)
    }
  }
  return salida
}

/** Los ids son hashes estables; se leen del bundle para no acoplarlos aquí. */
async function idsDeFunciones() {
  const ids = new Map()
  const patron = /id:\s*"([a-f0-9]{64})",\s*name:\s*"([A-Za-z0-9_]+)"/g
  for (const archivo of await archivosMjs(SALIDA)) {
    const texto = await readFile(archivo, 'utf8')
    for (const coincidencia of texto.matchAll(patron)) {
      ids.set(coincidencia[2], coincidencia[1])
    }
  }
  return ids
}

function puertoAbierto(puerto) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port: puerto })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

/**
 * Solo comprueba que el puerto acepte conexiones. Una petición HTTP de sonda
 * pasaría por el mismo handler que se quiere diagnosticar y, si el bundle está
 * roto, ocultaría la causa detrás de un «no respondió a tiempo».
 */
async function esperarServidor(puerto, proceso) {
  const limite = Date.now() + ESPERA_ARRANQUE_MS
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) {
      throw new Error(
        `el servidor terminó al arrancar (código ${proceso.exitCode})`,
      )
    }
    if (await puertoAbierto(puerto)) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('el servidor no abrió el puerto en el tiempo de arranque')
}

async function llamar(base, id, data) {
  const respuesta = await fetch(`${base}/_serverFn/${id}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tsr-serverFn': 'true',
      accept:
        'application/x-tss-framed, application/x-ndjson, application/json',
    },
    // El mismo sobre seroval que manda el cliente de TanStack Start.
    body: JSON.stringify(await toJSONAsync({ data }, {})),
  })
  return {
    status: respuesta.status,
    serializada: respuesta.headers.get('x-tss-serialized') === 'true',
    cuerpo: await respuesta.text(),
  }
}

async function main() {
  if (!(await existe(ENTRADA))) {
    console.error(
      `[humo-produccion] no existe ${ENTRADA}; ejecuta \`npm run build\` antes`,
    )
    process.exit(2)
  }

  const ids = await idsDeFunciones()
  const faltantes = FUNCIONES.filter(({ nombre }) => !ids.has(nombre))
  if (faltantes.length > 0) {
    console.error(
      `[humo-produccion] no encuentro en el bundle: ${faltantes.map((f) => f.nombre).join(', ')}`,
    )
    process.exit(2)
  }

  const puerto = 3000 + Math.floor(Math.random() * 2000)
  const base = `http://127.0.0.1:${puerto}`
  const servidor = spawn(process.execPath, [ENTRADA], {
    env: {
      ...process.env,
      PORT: String(puerto),
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      // Sin proyecto real: el Admin SDK no debe llegar a hablar con nadie.
      GOOGLE_CLOUD_PROJECT:
        process.env.GOOGLE_CLOUD_PROJECT ?? 'humo-produccion',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let registro = ''
  servidor.stdout.on('data', (d) => {
    registro += d
  })
  servidor.stderr.on('data', (d) => {
    registro += d
  })

  let fallos = 0
  try {
    await esperarServidor(puerto, servidor)
    for (const { nombre, data } of FUNCIONES) {
      const r = await llamar(base, ids.get(nombre), data)
      const esperado =
        r.status === 200 && r.serializada && r.cuerpo.includes('sesion_ausente')
      if (esperado) {
        console.log(
          `[humo-produccion] OK   ${nombre}: sesion_ausente serializada`,
        )
      } else {
        fallos += 1
        console.error(
          `[humo-produccion] FALLO ${nombre}: HTTP ${r.status} x-tss-serialized=${r.serializada} cuerpo=${r.cuerpo.slice(0, 200)}`,
        )
      }
    }
  } catch (error) {
    fallos += 1
    console.error(
      `[humo-produccion] ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    servidor.kill('SIGTERM')
  }

  if (fallos > 0) {
    console.error(
      '\n[humo-produccion] salida del servidor:\n' + registro.slice(-4000),
    )
    console.error(
      '\n[humo-produccion] El bundle de producción no carga las funciones de servidor. ' +
        'Revisa `traceDeps` en vite.config.ts y el chunk que falla arriba.',
    )
    process.exit(1)
  }
  console.log(
    '[humo-produccion] el servidor de producción carga y responde las funciones',
  )
}

await main()
