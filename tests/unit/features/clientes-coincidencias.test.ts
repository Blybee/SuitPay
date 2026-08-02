import { describe, expect, it } from 'vitest'
import { buscarCoincidenciasDeCliente } from '../../../src/features/clientes/coincidencias.ts'

describe('buscarCoincidenciasDeCliente', () => {
  const indice = [
    { numeroDocumento: '20111111111', denominacion: 'FERRETERIA EL TORNILLO S.A.C.' },
    { numeroDocumento: '20222222222', denominacion: 'DISTRIBUIDORA TORNILLO NORTE' },
    { numeroDocumento: '12345678', denominacion: 'PEREZ LOPEZ, JUAN' },
  ]

  it('encuentra por términos parciales desordenados', () => {
    const hallados = buscarCoincidenciasDeCliente('tornillo ferreteria', indice)
    expect(hallados).toHaveLength(1)
    expect(hallados[0]?.numeroDocumento).toBe('20111111111')
  })

  it('no inventa coincidencias', () => {
    expect(buscarCoincidenciasDeCliente('xyz inexistente', indice)).toEqual([])
  })
})
