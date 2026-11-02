import { describe, expect, it } from 'vitest'
import {
  INTERRUPTORES_POR_DEFECTO,
  modalidadEfectiva,
  proveedorDe,
} from '../../../src/domain/ia/proveedor.ts'

const AMBOS_ABIERTOS = { texto: 'openrouter', imagen: 'openrouter' } as const

describe('proveedorDe', () => {
  it('por defecto el texto va a OpenRouter y la imagen a Gemini', () => {
    expect(proveedorDe('texto', INTERRUPTORES_POR_DEFECTO)).toBe('openrouter')
    expect(proveedorDe('imagen', INTERRUPTORES_POR_DEFECTO)).toBe('gemini')
  })

  it('audio, PDF y compras quedan en Gemini aunque los dos interruptores apunten a OpenRouter', () => {
    expect(proveedorDe('audio', AMBOS_ABIERTOS)).toBe('gemini')
    expect(proveedorDe('pdf', AMBOS_ABIERTOS)).toBe('gemini')
    expect(proveedorDe('compras', AMBOS_ABIERTOS)).toBe('gemini')
  })

  it('respeta el interruptor cuando el administrador lo cambia', () => {
    const invertidos = { texto: 'gemini', imagen: 'openrouter' } as const
    expect(proveedorDe('texto', invertidos)).toBe('gemini')
    expect(proveedorDe('imagen', invertidos)).toBe('openrouter')
  })
})

describe('modalidadEfectiva', () => {
  it('una parte PDF o de audio no sigue el interruptor de texto', () => {
    expect(
      modalidadEfectiva('texto', [
        { inlineData: { mimeType: 'application/pdf' } },
      ]),
    ).toBe('pdf')
    expect(
      modalidadEfectiva('texto', [{ inlineData: { mimeType: 'audio/webm' } }]),
    ).toBe('audio')
  })

  it('compras sigue en compras aunque el medio sea una imagen', () => {
    expect(
      modalidadEfectiva('compras', [
        { inlineData: { mimeType: 'image/jpeg' } },
      ]),
    ).toBe('compras')
  })

  it('texto con una imagen sigue el interruptor de imagen', () => {
    expect(
      modalidadEfectiva('texto', [{ inlineData: { mimeType: 'image/png' } }]),
    ).toBe('imagen')
  })
})
