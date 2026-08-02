import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ProveedorFactpro } from '../../../src/server/proveedor/factpro/index.ts'
import type { ProveedorDeEmision } from '../../../src/server/proveedor/interfaz.ts'

/**
 * Credenciales y fábrica del proveedor **real** para pruebas de integración.
 * Usa `PROVEEDOR_TOKEN` + `PROVEEDOR_URL_BASE`. No imprime el token.
 */

export function cargarEnvLocal(): void {
  try {
    const texto = readFileSync(resolve('.env.local'), 'utf8')
    for (const linea of texto.split('\n')) {
      const limpia = linea.trim()
      if (limpia === '' || limpia.startsWith('#')) continue
      const igual = limpia.indexOf('=')
      if (igual <= 0) continue
      const clave = limpia.slice(0, igual).trim()
      const valor = limpia.slice(igual + 1).trim()
      if (process.env[clave] === undefined) {
        process.env[clave] = valor
      }
    }
  } catch {
    // Sin .env.local: las pruebas en vivo se saltan.
  }
}

cargarEnvLocal()

export function tokenDelProveedor(): string | undefined {
  const token = process.env['PROVEEDOR_TOKEN']
  return typeof token === 'string' && token.length > 0 ? token : undefined
}

export function hayCredencialesDelProveedor(): boolean {
  const url = process.env['PROVEEDOR_URL_BASE']
  const token = tokenDelProveedor()
  return (
    typeof url === 'string' &&
    url.length > 0 &&
    typeof token === 'string' &&
    token.length > 0
  )
}

export function proveedorReal(): ProveedorDeEmision {
  return new ProveedorFactpro()
}
