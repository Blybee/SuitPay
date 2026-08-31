import { describe, expect, it } from 'vitest'
import { calcularMotivoDeBloqueo } from '../../../src/features/emision/bloqueo.ts'

const base = {
  emitible: true,
  tipo: 'boleta' as const,
  cliente: { denominacion: 'Ana' },
  total: 1000,
  umbral: 70_000,
  motivoDeSesion: null,
}

describe('calcularMotivoDeBloqueo', () => {
  it('bloquea un pedido sin líneas', () => {
    expect(calcularMotivoDeBloqueo({ ...base, lineas: 0, emitible: false })).toBe(
      'Agrega al menos un producto para emitir.',
    )
  })

  it('deja emitir cuando hay líneas válidas', () => {
    expect(calcularMotivoDeBloqueo({ ...base, lineas: 1 })).toBeNull()
  })

  it('bloquea Bol+Guía sin serie T', () => {
    expect(
      calcularMotivoDeBloqueo({
        ...base,
        lineas: 1,
        encadenarGuia: true,
        serieGuia: null,
      }),
    ).toMatch(/serie de guía/)
  })
})
