import { describe, expect, it } from 'vitest'
import {
  aplicarDiffDeMemoria,
  diffsDesdePares,
} from '../../../src/domain/aprendizaje/memoria.ts'

describe('diffsDesdePares', () => {
  it('no duplica un alias ya presente', () => {
    const diffs = diffsDesdePares(
      [
        { textoOriginal: 'codo media', codigoAprobado: 'C1' },
        { textoOriginal: 'codo 1/2', codigoAprobado: 'C1' },
      ],
      { C1: { aliases: ['codo media'], etiquetas: [] } },
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0]?.agregados).toEqual(['codo 1/2'])
    expect(diffs[0]?.aliases).toEqual(['codo media', 'codo 1/2'])
  })

  it('omite el producto si toda la evidencia ya está', () => {
    const diffs = diffsDesdePares(
      [{ textoOriginal: 'codo media', codigoAprobado: 'C1' }],
      { C1: { aliases: ['Codo Media'], etiquetas: [] } },
    )
    expect(diffs).toEqual([])
  })
})

describe('aplicarDiffDeMemoria', () => {
  it('aplica listas canónicas y recortes', () => {
    const siguiente = aplicarDiffDeMemoria(
      { C1: { aliases: ['viejo'], etiquetas: ['liviano'] } },
      [
        {
          codigo: 'C1',
          aliases: ['codo media'],
          etiquetas: ['economico'],
          agregados: ['codo media'],
          quitados: ['viejo'],
        },
      ],
    )
    expect(siguiente.C1).toEqual({
      aliases: ['codo media'],
      etiquetas: ['economico'],
    })
  })
})
