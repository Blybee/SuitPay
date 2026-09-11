import { describe, expect, it } from 'vitest'
import {
  aplicarDeltasDeMarca,
  deltasDeMarcaDesdeCodigos,
  FAMILIA_GLOBAL,
  familiaDeProducto,
  pesoLaplace,
  textoDePrioresParaPrompt,
} from '../../../src/domain/aprendizaje/priores.ts'

describe('familiaDeProducto', () => {
  it('usa la categoría si existe', () => {
    expect(
      familiaDeProducto({
        descripcion: 'CODO FG 1/2 PAVCO',
        categoriaNombre: 'Tubería PVC',
      }),
    ).toBe('tubería pvc')
  })

  it('cae al token de la descripción', () => {
    expect(
      familiaDeProducto({ descripcion: 'Codo FG de media' }),
    ).toBe('codo')
  })

  it('cae a _global si no hay pista', () => {
    expect(familiaDeProducto({ descripcion: 'XYZ-99' })).toBe(FAMILIA_GLOBAL)
  })
})

describe('priores de marca', () => {
  it('Laplace: peso = n + 1', () => {
    expect(pesoLaplace(0)).toBe(1)
    expect(pesoLaplace(4)).toBe(5)
  })

  it('acumula n y deriva peso', () => {
    const siguiente = aplicarDeltasDeMarca(
      {},
      [
        { familia: 'codo', marca: 'Pavco', delta: 2 },
        { familia: 'codo', marca: 'Pavco', delta: 1 },
      ],
    )
    expect(siguiente.codo?.Pavco).toEqual({ n: 3, peso: 4 })
  })

  it('agrupa deltas por codigo aprobado', () => {
    const deltas = deltasDeMarcaDesdeCodigos(['C1', 'C1', 'T1'], {
      C1: { marca: 'Pavco', familia: 'codo' },
      T1: { marca: 'Nicoll', familia: 'tee' },
    })
    expect(deltas).toEqual(
      expect.arrayContaining([
        { familia: 'codo', marca: 'Pavco', delta: 2 },
        { familia: 'tee', marca: 'Nicoll', delta: 1 },
      ]),
    )
  })

  it('el JSON de prompt no lleva identidad', () => {
    const json = textoDePrioresParaPrompt({
      codo: { Pavco: { n: 4, peso: 5 } },
    })
    expect(json).toBe('{"codo":{"Pavco":5}}')
    expect(json).not.toMatch(/ruc|dni|cliente/i)
  })
})
