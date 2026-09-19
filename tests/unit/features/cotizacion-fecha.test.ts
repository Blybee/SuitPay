import { describe, expect, it } from 'vitest'
import { formatearFechaCortaCotizacion } from '../../../src/features/cotizaciones/fecha.ts'
import { etiquetaDeClaseMedio } from '../../../src/features/cotizaciones/propuestas.ts'

describe('formatearFechaCortaCotizacion', () => {
  it('usa iniciales de mes y día civil en Lima', () => {
    // 15 mar 2026 12:00 UTC-5 = 15 mar 17:00 UTC
    expect(
      formatearFechaCortaCotizacion(new Date('2026-03-15T17:00:00.000Z')),
    ).toBe('Mar 15')
  })

  it('no cruza de día por UTC a última hora de Lima', () => {
    // 15 mar 2026 23:30 Lima = 16 mar 04:30 UTC
    expect(
      formatearFechaCortaCotizacion(new Date('2026-03-16T04:30:00.000Z')),
    ).toBe('Mar 15')
  })
})

describe('etiquetaDeClaseMedio', () => {
  it('distingue PDF, imagen y texto', () => {
    expect(etiquetaDeClaseMedio('pdf')).toBe('PDF')
    expect(etiquetaDeClaseMedio('imagen')).toBe('IMG')
    expect(etiquetaDeClaseMedio('texto')).toBe('TXT')
    expect(etiquetaDeClaseMedio(undefined)).toBe('PDF')
  })
})
