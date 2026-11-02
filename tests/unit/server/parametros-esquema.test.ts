import { describe, expect, it } from 'vitest'
import { esquemaDeParametros } from '../../../src/domain/esquemas/comunes.ts'
import { completarParametros } from '../../../src/server/parametros/gestionar.ts'

describe('esquemaDeParametros (T085)', () => {
  it('acepta el umbral en céntimos y formato a4', () => {
    const parseado = esquemaDeParametros.parse({
      umbralIdentificacionBoleta: 70_000,
      ventanaAnulacion: 'mismo_dia',
      formatoImpresionPorDefecto: 'a4',
    })
    expect(parseado.umbralIdentificacionBoleta).toBe(70_000)
    expect(parseado.iaTexto).toBe('openrouter')
    expect(parseado.iaImagen).toBe('gemini')
  })

  it('un documento viejo sin interruptores deja el texto en OpenRouter y la imagen en Gemini', () => {
    const leido = completarParametros({
      umbralIdentificacionBoleta: 70_000,
      ventanaAnulacion: 'mismo_dia',
      formatoImpresionPorDefecto: 'a4',
    })
    expect(leido.iaTexto).toBe('openrouter')
    expect(leido.iaImagen).toBe('gemini')
  })

  it('respeta un texto ya guardado en Gemini', () => {
    const leido = completarParametros({
      umbralIdentificacionBoleta: 70_000,
      ventanaAnulacion: 'mismo_dia',
      formatoImpresionPorDefecto: 'a4',
      iaTexto: 'gemini',
      iaImagen: 'openrouter',
    })
    expect(leido.iaTexto).toBe('gemini')
    expect(leido.iaImagen).toBe('openrouter')
  })

  it('rechaza un proveedor que no está en el interruptor', () => {
    const resultado = esquemaDeParametros.safeParse({
      umbralIdentificacionBoleta: 70_000,
      ventanaAnulacion: 'mismo_dia',
      formatoImpresionPorDefecto: 'a4',
      iaTexto: 'local',
    })
    expect(resultado.success).toBe(false)
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
