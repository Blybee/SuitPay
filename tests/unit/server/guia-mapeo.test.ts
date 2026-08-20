import { describe, expect, it } from 'vitest'
import {
  codigoModoTransporte,
  codigoMotivoTraslado,
} from '../../../src/server/proveedor/factpro/mapeo-guia.ts'

describe('mapeo de guía en el adaptador', () => {
  it('traduce modalidades SuitPay a códigos de modo/motivo', () => {
    expect(codigoModoTransporte('publico')).toBe('01')
    expect(codigoModoTransporte('privado')).toBe('02')
    expect(codigoMotivoTraslado('entre_almacenes')).toBe('04')
    expect(codigoMotivoTraslado('venta')).toBe('01')
  })
})
