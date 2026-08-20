import { describe, expect, it } from 'vitest'
import { debeMostrarToastRegenerar } from '../../../src/features/guia/recuperar.ts'

describe('US7 — toast Volver a Generar', () => {
  it('solo el rechazo definitivo ofrece regenerar', () => {
    expect(debeMostrarToastRegenerar('emision_rechazada')).toBe(true)
    expect(debeMostrarToastRegenerar('emision_indeterminada')).toBe(false)
    expect(debeMostrarToastRegenerar('proveedor_no_disponible')).toBe(false)
    expect(debeMostrarToastRegenerar('serie_no_configurada')).toBe(false)
  })
})
