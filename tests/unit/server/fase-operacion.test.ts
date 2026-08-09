import { afterEach, describe, expect, it } from 'vitest'
import {
  esFaseDemo,
  faseOperacion,
} from '../../../src/server/fase-operacion.ts'

describe('fase de operación', () => {
  const original = process.env['SUITPAY_FASE']

  afterEach(() => {
    if (original === undefined) {
      delete process.env['SUITPAY_FASE']
    } else {
      process.env['SUITPAY_FASE'] = original
    }
  })

  it('por omisión es DEMO', () => {
    delete process.env['SUITPAY_FASE']
    expect(faseOperacion()).toBe('DEMO')
    expect(esFaseDemo()).toBe(true)
  })

  it('acepta PRODUCCION', () => {
    process.env['SUITPAY_FASE'] = 'PRODUCCION'
    expect(faseOperacion()).toBe('PRODUCCION')
    expect(esFaseDemo()).toBe(false)
  })

  it('acepta PRODUCTION como alias', () => {
    process.env['SUITPAY_FASE'] = 'production'
    expect(faseOperacion()).toBe('PRODUCCION')
  })
})
