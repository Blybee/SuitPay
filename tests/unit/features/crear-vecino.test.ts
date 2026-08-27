import { describe, expect, it } from 'vitest'
import {
  esComandoCrearVecino,
  reconocerCrearVecino,
} from '../../../src/features/comandos/crear-vecino.ts'

describe('reconocerCrearVecino', () => {
  it('parsea alias y RUC', () => {
    expect(reconocerCrearVecino('/crear vecino wilmer 12345678901')).toEqual({
      alias: 'wilmer',
      numeroDocumento: '12345678901',
      tipoDocumento: 'RUC',
    })
  })

  it('parsea DNI', () => {
    expect(reconocerCrearVecino('/crear vecino ana 12345678')).toEqual({
      alias: 'ana',
      numeroDocumento: '12345678',
      tipoDocumento: 'DNI',
    })
  })

  it('parsea el teléfono opcional', () => {
    expect(
      reconocerCrearVecino('/crear vecino wilmer 12345678901 987654321'),
    ).toEqual({
      alias: 'wilmer',
      numeroDocumento: '12345678901',
      tipoDocumento: 'RUC',
      telefono: '987654321',
    })
    expect(
      reconocerCrearVecino('/crear vecino ana 12345678 51987654321'),
    ).toEqual({
      alias: 'ana',
      numeroDocumento: '12345678',
      tipoDocumento: 'DNI',
      telefono: '51987654321',
    })
  })

  it('rechaza un teléfono que no es celular peruano', () => {
    expect(
      reconocerCrearVecino('/crear vecino ana 12345678 123'),
    ).toBeNull()
  })

  it('no escribe sin confirmación: solo propone o null', () => {
    expect(reconocerCrearVecino('/crear vecino')).toBeNull()
    expect(reconocerCrearVecino('crear vecino wilmer 12345678')).toBeNull()
    expect(esComandoCrearVecino('/crear vecino x')).toBe(true)
    expect(esComandoCrearVecino('tubo pvc')).toBe(false)
  })
})
