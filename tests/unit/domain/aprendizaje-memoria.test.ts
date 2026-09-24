import { describe, expect, it } from 'vitest'
import {
  aplicarDiffDeMemoria,
  aplicarPropuestaDeRevision,
  diffsDesdeAlineaciones,
  diffsDesdePares,
  medirMemoria,
  memoriaParaPrompt,
  paginarMemoria,
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

describe('diffsDesdeAlineaciones', () => {
  it('no crea alias para omitido ni no_en_catalogo', () => {
    const diffs = diffsDesdeAlineaciones(
      [
        {
          textoPedido: 'codo de media',
          codigo: 'C1',
          marca: 'Pavco',
          estado: 'emparejado',
          aliases: ['codo media'],
          etiquetas: [],
        },
        {
          textoPedido: 'llave que no tenemos',
          codigo: '',
          marca: '',
          estado: 'omitido',
          aliases: ['no debe entrar'],
          etiquetas: [],
        },
        {
          textoPedido: 'cosa rara',
          codigo: 'X9',
          marca: '',
          estado: 'no_en_catalogo',
          aliases: ['tampoco'],
          etiquetas: [],
        },
      ],
      {},
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0]?.codigo).toBe('C1')
    expect(diffs[0]?.aliases).toEqual(
      expect.arrayContaining(['codo de media', 'codo media']),
    )
  })
})

describe('presupuesto y paginación de memoria', () => {
  it('no recorta un mapa bajo el margen al armar el prompt', () => {
    const mapa = {
      C1: { aliases: ['codo media', 'codo de 1/2'], etiquetas: ['liviano'] },
    }
    expect(memoriaParaPrompt(mapa)).toBe(mapa)
    expect(medirMemoria(mapa).superaPresupuesto).toBe(false)
  })

  it('denegar deja el mapa igual y autorizar quita solo la repetición', () => {
    const mapa = {
      C1: { aliases: ['codo media', 'Codo Media', 'codo 1/2'], etiquetas: [] },
    }
    const cambios = [
      {
        codigo: 'C1',
        aliases: ['codo media', 'codo 1/2', 'inventado'],
        etiquetas: [],
        quitados: ['Codo Media'],
        motivo: 'Repetido.',
      },
    ]
    expect(aplicarPropuestaDeRevision(mapa, cambios, false)).toBe(mapa)
    expect(aplicarPropuestaDeRevision(mapa, cambios, true).C1).toEqual({
      aliases: ['codo media', 'codo 1/2'],
      etiquetas: [],
    })
  })

  it('el cursor de la segunda página es el código del ítem 10', () => {
    const mapa: Record<string, { aliases: string[]; etiquetas: string[] }> = {}
    for (let i = 1; i <= 11; i += 1) {
      mapa[`P${String(i).padStart(2, '0')}`] = { aliases: ['a'], etiquetas: [] }
    }
    const primera = paginarMemoria(mapa)
    expect(primera.cursorSiguiente).toBe('P10')
    expect(primera.hayMas).toBe(true)
    const segunda = paginarMemoria(mapa, { cursor: primera.cursorSiguiente! })
    expect(segunda.entradas.map(([codigo]) => codigo)).toEqual(['P11'])
  })

  it('una lista de 10 no tiene página siguiente', () => {
    const mapa: Record<string, { aliases: string[]; etiquetas: string[] }> = {}
    for (let i = 1; i <= 10; i += 1) {
      mapa[`P${String(i).padStart(2, '0')}`] = { aliases: ['a'], etiquetas: [] }
    }
    const pagina = paginarMemoria(mapa)
    expect(pagina.entradas).toHaveLength(10)
    expect(pagina.hayMas).toBe(false)
    expect(pagina.cursorSiguiente).toBeNull()
  })
})
