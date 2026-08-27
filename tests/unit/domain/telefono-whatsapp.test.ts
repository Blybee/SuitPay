import { describe, expect, it } from 'vitest'
import {
  enlaceChatWhatsApp,
  normalizarTelefonoPeru,
  telefonoEsValido,
} from '../../../src/domain/vecinos/telefono.ts'

describe('teléfono de vecino para WhatsApp', () => {
  it('normaliza 9 dígitos peruanos a 51…', () => {
    expect(normalizarTelefonoPeru('987654321')).toBe('51987654321')
    expect(normalizarTelefonoPeru('+51 987 654 321')).toBe('51987654321')
    expect(normalizarTelefonoPeru('51987654321')).toBe('51987654321')
  })

  it('rechaza números que no son celular peruano', () => {
    expect(telefonoEsValido('123')).toBe(false)
    expect(telefonoEsValido('012345678')).toBe(false)
    expect(telefonoEsValido('')).toBe(false)
  })

  it('arma el enlace click-to-chat sin adjunto', () => {
    expect(enlaceChatWhatsApp('987654321')).toBe('https://wa.me/51987654321')
  })
})
