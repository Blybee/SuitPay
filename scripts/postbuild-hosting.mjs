/**
 * TanStack Start SPA deja el HTML en `_shell.html`. Hosting clásico espera
 * `index.html` para el rewrite `** → /index.html`.
 */
import { copyFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'

const shell = resolve('dist/client/_shell.html')
const index = resolve('dist/client/index.html')

try {
  await access(shell)
} catch {
  console.warn('[postbuild-hosting] no hay dist/client/_shell.html; se omite')
  process.exit(0)
}

await copyFile(shell, index)
console.log('[postbuild-hosting] index.html listo desde _shell.html')
