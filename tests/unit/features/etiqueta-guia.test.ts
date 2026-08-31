import { describe, expect, it } from 'vitest'
import { etiquetaDeAsociacionGuia } from '../../../src/features/guia/etiqueta.ts'

describe('etiquetaDeAsociacionGuia', () => {
  it('muestra tipo y serie-número, no el id', () => {
    expect(etiquetaDeAsociacionGuia('boleta', 'B001', 42)).toBe(
      'Asociada a Boleta B001-00000042',
    )
    expect(etiquetaDeAsociacionGuia('factura', 'F001', 7)).toBe(
      'Asociada a Factura F001-00000007',
    )
  })
})
