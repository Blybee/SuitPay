/**
 * Tras Nitro, los estáticos viven en `.output/public`. Si solo hay
 * `_shell.html`, se copia a `index.html` para el rewrite de Hosting clásico.
 */
import { copyFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'

const publicDir = resolve('.output/public')
const shell = resolve(publicDir, '_shell.html')
const index = resolve(publicDir, 'index.html')

try {
  await access(publicDir)
} catch {
  console.warn('[postbuild-hosting] no hay .output/public; se omite')
  process.exit(0)
}

try {
  await access(index)
  console.log('[postbuild-hosting] index.html ya existe')
  process.exit(0)
} catch {
  /* crear desde _shell si hace falta */
}

try {
  await access(shell)
  await copyFile(shell, index)
  console.log('[postbuild-hosting] index.html desde _shell.html')
} catch {
  console.warn('[postbuild-hosting] ni index.html ni _shell.html')
}
