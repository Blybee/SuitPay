import { describe, expect, it } from 'vitest'
import {
  extraerMencionDeCliente,
  resolverClienteLocal,
} from '../../../src/features/captura/cliente.ts'

describe('resolución de cliente fuera del modelo (T126)', () => {
  it('extrae mención de cliente del texto original', () => {
    expect(
      extraerMencionDeCliente(['codo fg para Ferretería Sol']),
    ).toBe('Ferretería Sol')
  })

  it('resuelve contra el índice local', () => {
    const indice = [
      { numeroDocumento: '20111111111', denominacion: 'Ferretería Sol SAC' },
      { numeroDocumento: '12345678', denominacion: 'Juan Pérez' },
    ]
    const hallado = resolverClienteLocal('ferretería sol', indice)
    expect(hallado?.numeroDocumento).toBe('20111111111')
  })

  it('no inventa coincidencia ambigua', () => {
    const indice = [
      { numeroDocumento: '1', denominacion: 'Ferretería Norte' },
      { numeroDocumento: '2', denominacion: 'Ferretería Sur' },
    ]
    expect(resolverClienteLocal('ferretería', indice)).toBeNull()
  })
})
