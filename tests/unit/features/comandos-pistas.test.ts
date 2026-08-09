import { describe, expect, it } from 'vitest'
import {
  CATALOGO_DE_COMANDOS,
  comandosCoincidentes,
  esModoComando,
  pistaDeComando,
  placeholderDelBuscador,
  textoAlElegirComando,
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

  it('tras / lista todo el catálogo seleccionable', () => {
    const lista = comandosCoincidentes('/')
    expect(lista.length).toBe(CATALOGO_DE_COMANDOS.length)
    expect(lista.some((c) => c.id === 'crear-vecino')).toBe(true)
    expect(lista.some((c) => c.id === 'ayuda')).toBe(true)
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

  it('elegir comando deja prefijo con espacio si faltan parámetros', () => {
    const crear = CATALOGO_DE_COMANDOS.find((c) => c.id === 'crear-vecino')
    expect(crear).toBeDefined()
    expect(textoAlElegirComando(crear!)).toBe('/crear vecino ')
  })

  it('filtra por prefijo parcial', () => {
    const lista = comandosCoincidentes('/cot')
    expect(lista.some((c) => c.id === 'cotizacion')).toBe(true)
    expect(lista.some((c) => c.id === 'cotizaciones')).toBe(true)
    expect(lista.some((c) => c.id === 'crear-vecino')).toBe(false)
  })
})
