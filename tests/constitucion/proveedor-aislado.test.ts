import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Principio III — el proveedor es sustituible.
 *
 * Criterio realista (ajustado en endurecimiento MVP): el nombre puede vivir en
 * `src/server/proveedor/**` (fábrica + adaptador) y en tooling de frontera
 * (ESLint, `scripts/verificar-frontera.mjs`, tests del adaptador). No en
 * `domain`, `features`, `ui`, `routes` ni `infra`.
 */

const RAIZ = join(import.meta.dirname, '../..')
const PROHIBIDO = /factpro/i

const DIRECTORIOS_VIGILADOS = [
  'src/domain',
  'src/features',
  'src/ui',
  'src/routes',
  'src/infra',
] as const

const EXTENSIONES = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

function listarArchivos(directorio: string): string[] {
  const absolutos: string[] = []
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada)
    const info = statSync(ruta)
    if (info.isDirectory()) {
      absolutos.push(...listarArchivos(ruta))
      continue
    }
    const punto = entrada.lastIndexOf('.')
    if (punto < 0) continue
    if (EXTENSIONES.has(entrada.slice(punto))) absolutos.push(ruta)
  }
  return absolutos
}

describe('principio III — proveedor aislado', () => {
  it('el nombre del proveedor no aparece fuera de la frontera y el tooling', () => {
    const fugas: string[] = []

    for (const relativo of DIRECTORIOS_VIGILADOS) {
      const base = join(RAIZ, relativo)
      for (const archivo of listarArchivos(base)) {
        const texto = readFileSync(archivo, 'utf8')
        if (!PROHIBIDO.test(texto)) continue
        fugas.push(relative(RAIZ, archivo).split(sep).join('/'))
      }
    }

    expect(fugas, `fugas: ${fugas.join(', ')}`).toEqual([])
  })
})
