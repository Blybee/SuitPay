#!/usr/bin/env node
/**
 * Comprueba que el entorno puede verificar SuitPay (emuladores + Playwright).
 * Sale 0 si listo; 1 con mensajes accionables si no.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function ok(mensaje) {
  console.log(`OK  ${mensaje}`)
}

function aviso(mensaje) {
  console.log(`AVISO  ${mensaje}`)
}

function fallo(mensaje) {
  console.error(`FALLO  ${mensaje}`)
}

const errores = []

function versionNode() {
  const v = process.version.match(/^v(\d+)/)
  return v ? Number(v[1]) : 0
}

if (versionNode() < 22) {
  errores.push(`Node ${process.version}; se requiere >=22 (engines en package.json).`)
} else {
  ok(`Node ${process.version}`)
}

if (!existsSync(join(raiz, 'node_modules'))) {
  errores.push('Sin node_modules. Ejecuta: npm install')
} else {
  ok('node_modules presente')
}

try {
  execSync('java -version', { stdio: 'pipe' })
  ok('Java disponible (Emulator Suite)')
} catch {
  errores.push(
    'Java no encontrado. Firebase emulators:exec lo necesita (npm run prueba:e2e:completa).',
  )
}

const pwChromium = join(
  process.env.HOME ?? '',
  '.cache/ms-playwright/chromium_headless_shell-1234',
)
if (!existsSync(pwChromium)) {
  aviso(
    'Chromium de Playwright no instalado. Ejecuta: npx playwright install chromium',
  )
} else {
  ok('Playwright Chromium instalado')
}

function puertoLibre(puerto) {
  return new Promise((resolve) => {
    const servidor = createConnection({ port: puerto, host: '127.0.0.1' })
    servidor.on('connect', () => {
      servidor.destroy()
      resolve(false)
    })
    servidor.on('error', () => resolve(true))
  })
}

const puerto3000Ocupado = !(await puertoLibre(3000))
if (puerto3000Ocupado) {
  aviso(
    'Puerto 3000 en uso (p. ej. `.cursor/environment.json` start). ' +
      'Playwright usa PUERTO_PRUEBAS=3001 vía scripts/drive-feature.sh.',
  )
} else {
  ok('Puerto 3000 libre para webServer de Playwright')
}

const envLocal = join(raiz, '.env.local')
if (existsSync(envLocal)) {
  const texto = readFileSync(envLocal, 'utf8')
  const proyectoVite = texto.match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m)?.[1]?.trim()
  const usarEmu = texto.match(/^VITE_USAR_EMULADORES=(.+)$/m)?.[1]?.trim()
  const gcp = texto.match(/^GOOGLE_CLOUD_PROJECT=(.+)$/m)?.[1]?.trim()

  if (usarEmu === 'false' || usarEmu === undefined) {
    aviso(
      '.env.local sin VITE_USAR_EMULADORES=true. e2e fuerza emuladores en playwright.config.ts ' +
        'pero un `npm run dev` manual en 3000 puede apuntar a nube.',
    )
  }

  if (
    gcp &&
    proyectoVite &&
    gcp !== proyectoVite &&
    gcp !== 'demo-suitpay' &&
    proyectoVite !== 'demo-suitpay'
  ) {
    errores.push(
      `GOOGLE_CLOUD_PROJECT (${gcp}) ≠ VITE_FIREBASE_PROJECT_ID (${proyectoVite}). ` +
        'verifyIdToken fallará en server functions.',
    )
  }

  if (proyectoVite && proyectoVite !== 'demo-suitpay' && usarEmu === 'true') {
    aviso(
      'Proyecto Firebase real en .env.local con emuladores: Playwright e2e usa demo-suitpay; ' +
        'no mezcles un dev server en 3000 con tokens demo.',
    )
  }
} else {
  aviso(
    'Sin .env.local. Playwright e2e inyecta VITE_* demo en webServer; ' +
      'para dev manual copia .env.example → .env.local (ver AGENTS.md).',
  )
}

for (const [puerto, nombre] of [
  [8080, 'Firestore'],
  [9099, 'Auth'],
  [9199, 'Storage'],
]) {
  const libre = await puertoLibre(puerto)
  if (libre) {
    aviso(
      `${nombre} (${puerto}) libre. drive-feature.sh arranca emuladores con emulators:exec.`,
    )
  } else {
    ok(`${nombre} emulator ya escuchando en ${puerto}`)
  }
}

if (errores.length > 0) {
  console.error('\n--- Doctor: no listo ---')
  for (const e of errores) fallo(e)
  process.exit(1)
}

console.log('\n--- Doctor: listo para verificación con emuladores (npm run prueba:e2e:completa o drive-feature.sh) ---')
process.exit(0)
