#!/usr/bin/env node
/**
 * Copia salidas de verificación a /opt/cursor/artifacts (sobreviven cleanup del repo).
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const destino = '/opt/cursor/artifacts/verify-suitpay'
mkdirSync(destino, { recursive: true })

const marca = new Date().toISOString().replace(/[:.]/g, '-')
const resumen = []

function copiarSiExiste(origen, nombreDestino) {
  if (!existsSync(origen)) return
  const dest = join(destino, nombreDestino)
  execFileSync('cp', ['-r', origen, dest], { stdio: 'pipe' })
  resumen.push(dest)
}

copiarSiExiste(join(raiz, 'test-results'), `test-results-${marca}`)
copiarSiExiste(join(raiz, 'playwright-report'), `playwright-report-${marca}`)

for (const log of ['verify-suitpay-doctor.log', 'verify-suitpay-drive-vecinos.log']) {
  const p = join('/opt/cursor/artifacts', log)
  if (existsSync(p)) {
    copyFileSync(p, join(destino, log))
    resumen.push(join(destino, log))
  }
}

writeFileSync(
  join(destino, 'manifest.txt'),
  resumen.length ? resumen.join('\n') : 'Sin artefactos copiados aún.',
)

console.log(`OK  Evidencia en ${destino}`)
console.log(resumen.join('\n') || '(vacío)')
