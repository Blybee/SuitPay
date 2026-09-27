import { describe, expect, it } from 'vitest'
import { motivoDeRucParaFactura } from '#/domain/documentos/ruc-de-factura.ts'
import { TIPOS_DE_DOCUMENTO } from '#/domain/documentos/tipos.ts'
import type { TipoDeDocumento } from '#/domain/documentos/tipos.ts'

const MENSAJE = 'La factura requiere un cliente con RUC'

const RUC_10 = '10123456789'
const RUC_20 = '20123456789'
const DNI = '12345678'

function cliente(numeroDocumento: string) {
  return { numeroDocumento }
}

describe('motivoDeRucParaFactura', () => {
  it.each(TIPOS_DE_DOCUMENTO)(
    '%s con RUC prefijo 10 se puede documentar',
    (tipo) => {
      expect(
        motivoDeRucParaFactura({ tipo, cliente: cliente(RUC_10) }),
      ).toBeNull()
    },
  )

  it.each(TIPOS_DE_DOCUMENTO)(
    '%s con RUC prefijo 20 se puede documentar',
    (tipo) => {
      expect(
        motivoDeRucParaFactura({ tipo, cliente: cliente(RUC_20) }),
      ).toBeNull()
    },
  )

  it.each(TIPOS_DE_DOCUMENTO.filter((tipo) => tipo !== 'factura'))(
    '%s con DNI no exige RUC',
    (tipo: TipoDeDocumento) => {
      expect(motivoDeRucParaFactura({ tipo, cliente: cliente(DNI) })).toBeNull()
    },
  )

  it.each(TIPOS_DE_DOCUMENTO.filter((tipo) => tipo !== 'factura'))(
    '%s sin cliente no exige RUC',
    (tipo: TipoDeDocumento) => {
      expect(motivoDeRucParaFactura({ tipo, cliente: null })).toBeNull()
    },
  )

  it('factura con DNI se bloquea', () => {
    expect(
      motivoDeRucParaFactura({ tipo: 'factura', cliente: cliente(DNI) }),
    ).toBe(MENSAJE)
  })

  it('factura con RUC de prefijo distinto de 10 o 20 se bloquea', () => {
    expect(
      motivoDeRucParaFactura({
        tipo: 'factura',
        cliente: cliente('15123456789'),
      }),
    ).toBe(MENSAJE)
  })

  it('factura con RUC de longitud distinta de 11 se bloquea', () => {
    expect(
      motivoDeRucParaFactura({
        tipo: 'factura',
        cliente: cliente('2012345678'),
      }),
    ).toBe(MENSAJE)
  })

  it('factura sin cliente se bloquea', () => {
    expect(motivoDeRucParaFactura({ tipo: 'factura', cliente: null })).toBe(
      MENSAJE,
    )
  })

  it('factura con documento vacío se bloquea', () => {
    expect(
      motivoDeRucParaFactura({ tipo: 'factura', cliente: cliente('') }),
    ).toBe(MENSAJE)
  })

  it('factura con cliente solo por nombre se bloquea', () => {
    expect(
      motivoDeRucParaFactura({
        tipo: 'factura',
        cliente: cliente('00000000'),
      }),
    ).toBe(MENSAJE)
  })
})
