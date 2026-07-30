import { describe, expect, it } from 'vitest'
import { serieEsValida } from '../../../src/domain/documentos/tipos.ts'
import { idDeSerie } from '../../../src/server/emision/almacen.ts'

/**
 * Reglas que T083 debe respetar al alta (decisión 12 / FR-031).
 */

describe('alta de serie (reglas)', () => {
  it('el id es vendedor__tipo', () => {
    expect(idDeSerie('uid-abc', 'boleta')).toBe('uid-abc__boleta')
    expect(idDeSerie('uid-abc', 'factura')).toBe('uid-abc__factura')
  })

  it('boleta exige prefijo B y factura F', () => {
    expect(serieEsValida('boleta', 'B001')).toBe(true)
    expect(serieEsValida('boleta', 'F001')).toBe(false)
    expect(serieEsValida('factura', 'F001')).toBe(true)
    expect(serieEsValida('factura', 'B001')).toBe(false)
  })

  it('nota de venta solo admite serie vacía (sin proveedor)', () => {
    expect(serieEsValida('nota_venta', '')).toBe(true)
    expect(serieEsValida('nota_venta', 'N001')).toBe(false)
  })
})
