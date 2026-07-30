import { describe, expect, it } from 'vitest'
import { esquemaDeParametros } from '../../../src/domain/esquemas/comunes.ts'

describe('esquemaDeParametros (T085)', () => {
  it('acepta el umbral en céntimos y formato a4', () => {
    const parseado = esquemaDeParametros.parse({
      umbralIdentificacionBoleta: 70_000,
      ventanaAnulacion: 'mismo_dia',
      formatoImpresionPorDefecto: 'a4',
    })
    expect(parseado.umbralIdentificacionBoleta).toBe(70_000)
  })

  it('rechaza umbral no positivo', () => {
    expect(() =>
      esquemaDeParametros.parse({
        umbralIdentificacionBoleta: 0,
        ventanaAnulacion: 'mismo_dia',
        formatoImpresionPorDefecto: 'a4',
      }),
    ).toThrow()
  })
})
