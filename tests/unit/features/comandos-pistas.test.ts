import { describe, expect, it } from 'vitest'
import {
  esModoComando,
  pistaDeComando,
  placeholderDelBuscador,
} from '../../../src/features/comandos/pistas.ts'

describe('pistas de comando en el buscador', () => {
  it('detecta modo comando', () => {
    expect(esModoComando('/crear')).toBe(true)
    expect(esModoComando('  /x')).toBe(true)
    expect(esModoComando('tubo')).toBe(false)
  })

  it('placeholder de producto fuera de comando', () => {
    expect(placeholderDelBuscador('')).toBe('Escribe un producto…')
  })

  it('tras / sugiere crear vecino con parámetros', () => {
    const pista = pistaDeComando('/')
    expect(pista.fantasma).toContain('crear vecino')
    expect(pista.fantasma).toContain('{alias}')
    expect(pista.fantasma).toContain('{DNI/RUC}')
  })

  it('tras /crear vecino pide alias y documento', () => {
    expect(pistaDeComando('/crear vecino').fantasma.trim()).toBe(
      '{alias} {DNI/RUC}',
    )
    expect(pistaDeComando('/crear vecino ').fantasma.trim()).toBe(
      '{alias} {DNI/RUC}',
    )
  })

  it('tras el alias pide solo el documento', () => {
    expect(pistaDeComando('/crear vecino wilmer').fantasma.trim()).toBe(
      '{DNI/RUC}',
    )
  })

  it('comando completo sin fantasma', () => {
    expect(
      pistaDeComando('/crear vecino wilmer 12345678901').fantasma,
    ).toBe('')
  })
})
