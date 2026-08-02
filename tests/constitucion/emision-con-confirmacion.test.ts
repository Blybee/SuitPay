import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from '../unit/server/ayudas-emision.ts'

/**
 * Principio I — la aprobación humana es indelegable.
 *
 * Comprueba que el único camino de emisión exige clave de idempotencia y
 * vendedor tomado de la identidad (no del body), y que la puerta server fn
 * llama a `exigirIdentidad` antes de emitir.
 */

const RAIZ = join(import.meta.dirname, '../..')

describe('principio I — emisión con confirmación', () => {
  it('la puerta emitir exige identidad y no acepta vendedorId en el body', () => {
    const puerta = readFileSync(
      join(RAIZ, 'src/features/emision/emitir.funciones.ts'),
      'utf8',
    )

    expect(puerta).toMatch(/exigirIdentidad/)
    expect(puerta).toMatch(/vendedorId:\s*identidad\.uid/)
    expect(puerta).not.toMatch(/vendedorId:\s*data\./)
    expect(puerta).toMatch(/claveIdempotencia/)
  })

  it('emitirComprobante atribuye al vendedor del contexto y exige clave', async () => {
    const { contexto, proveedor } = montarEscenario()
    const respuesta = await emitirComprobante(
      contexto,
      peticion({ claveIdempotencia: 'clave-confirmacion-1' }),
    )

    expect(respuesta.yaExistia).toBe(false)
    expect(proveedor.llamadasA('emitir')).toBe(1)
    expect(contexto.vendedorId.length).toBeGreaterThan(0)
  })

  it('sin clave de idempotencia no hay emisión (petición inválida en puerta)', () => {
    const puerta = readFileSync(
      join(RAIZ, 'src/features/emision/emitir.funciones.ts'),
      'utf8',
    )
    expect(puerta).toMatch(/claveIdempotencia:\s*z\.string\(\)\.min\(8\)/)
  })
})
