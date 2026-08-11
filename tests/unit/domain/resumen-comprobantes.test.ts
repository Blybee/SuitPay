import { describe, expect, it } from 'vitest'
import { totalDeVentasParaCierre } from '../../../src/domain/comprobantes/resumen.ts'

describe('totalDeVentasParaCierre', () => {
  it('suma emitidos y excluye anulados', () => {
    const total = totalDeVentasParaCierre([
      { estado: 'aceptado', total: 2700 },
      { estado: 'anulado', total: 1000 },
      { estado: 'enviado', total: 500 },
    ])
    expect(total).toBe(3200)
  })

  it('devuelve 0 si todos están anulados o la lista está vacía', () => {
    expect(totalDeVentasParaCierre([])).toBe(0)
    expect(
      totalDeVentasParaCierre([{ estado: 'anulado', total: 99 }]),
    ).toBe(0)
  })
})
