import { describe, expect, it } from 'vitest'
import { encolarPorClave } from '../../../src/features/vecinos/cola.ts'

describe('encolarPorClave', () => {
  it('ejecuta los trabajos de la misma clave en serie', async () => {
    const orden: number[] = []
    let liberarPrimera: (() => void) | undefined
    const primera = new Promise<void>((resolve) => {
      liberarPrimera = resolve
    })

    const t1 = encolarPorClave('v1', async () => {
      await primera
      orden.push(1)
    })
    const t2 = encolarPorClave('v1', async () => {
      orden.push(2)
    })

    expect(orden).toEqual([])
    liberarPrimera?.()
    await Promise.all([t1, t2])
    expect(orden).toEqual([1, 2])
  })

  it('no bloquea una clave distinta', async () => {
    const orden: string[] = []
    let liberar: (() => void) | undefined
    const espera = new Promise<void>((resolve) => {
      liberar = resolve
    })

    const t1 = encolarPorClave('a', async () => {
      await espera
      orden.push('a')
    })
    const t2 = encolarPorClave('b', async () => {
      orden.push('b')
    })

    await t2
    expect(orden).toEqual(['b'])
    liberar?.()
    await t1
    expect(orden).toEqual(['b', 'a'])
  })
})
