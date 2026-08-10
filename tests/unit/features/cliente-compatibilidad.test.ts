import { describe, expect, it } from 'vitest'
import {
  clienteCompatibleConModo,
  mensajeIncompatibilidadCliente,
  tiposDocumentoClientePermitidos,
} from '../../../src/features/clientes/compatibilidad-documento.ts'

describe('compatibilidad cliente ↔ tipo de documento', () => {
  it('factura solo admite RUC', () => {
    expect(tiposDocumentoClientePermitidos('factura')).toEqual(['RUC'])
    expect(clienteCompatibleConModo('20123456789', 'factura')).toBe(true)
    expect(clienteCompatibleConModo('12345678', 'factura')).toBe(false)
  })

  it('boleta solo admite DNI', () => {
    expect(tiposDocumentoClientePermitidos('boleta')).toEqual(['DNI'])
    expect(clienteCompatibleConModo('12345678', 'boleta')).toBe(true)
    expect(clienteCompatibleConModo('20123456789', 'boleta')).toBe(false)
  })

  it('cotización y nota de venta admiten ambos', () => {
    expect(tiposDocumentoClientePermitidos('cotizacion')).toEqual(['DNI', 'RUC'])
    expect(tiposDocumentoClientePermitidos('nota_venta')).toEqual(['DNI', 'RUC'])
    expect(clienteCompatibleConModo('12345678', 'cotizacion')).toBe(true)
    expect(clienteCompatibleConModo('20123456789', 'nota_venta')).toBe(true)
  })

  it('explica la incompatibilidad', () => {
    expect(mensajeIncompatibilidadCliente('20123456789', 'boleta')).toMatch(
      /boleta/i,
    )
    expect(mensajeIncompatibilidadCliente('12345678', 'factura')).toMatch(
      /factura/i,
    )
  })
})
