import { describe, expect, it } from 'vitest'
import { envolverTextoPorAncho } from '../../../src/domain/captura/envolver-texto.ts'

function medirPorCaracter(texto: string): number {
  return texto.length * 10
}

describe('envolverTextoPorAncho', () => {
  it('deja en un renglón lo que cabe', () => {
    expect(envolverTextoPorAncho('VALVULA MINI', 200, medirPorCaracter)).toEqual([
      'VALVULA MINI',
    ])
  })

  it('parte por palabras sin truncar', () => {
    expect(
      envolverTextoPorAncho(
        'ERA- VALVULA ESFERICA DOBLE UNION 3/4 C/R',
        250,
        medirPorCaracter,
      ),
    ).toEqual(['ERA- VALVULA ESFERICA', 'DOBLE UNION 3/4 C/R'])
  })

  it('corta por caracteres una palabra más ancha que la columna', () => {
    expect(
      envolverTextoPorAncho('SUPERCALIFRAGILISTICO', 50, medirPorCaracter),
    ).toEqual(['SUPER', 'CALIF', 'RAGIL', 'ISTIC', 'O'])
  })

  it('un texto vacío da un renglón vacío', () => {
    expect(envolverTextoPorAncho('   ', 100, medirPorCaracter)).toEqual([''])
  })
})
