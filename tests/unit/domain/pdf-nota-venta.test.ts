import { describe, expect, it } from 'vitest'
import { bytesDePdfDeNotaVenta } from '../../../src/domain/documentos/pdf-nota-venta.ts'

describe('PDF de nota de venta', () => {
  const bytes = bytesDePdfDeNotaVenta({
    emitidoEn: new Date('2026-03-15T15:00:00-05:00'),
    cliente: 'Cliente Test',
    lineas: [
      { descripcion: 'CODO FG 1/2', cantidad: 2, importe: 2460 },
    ],
    total: 2460,
  })
  const texto = new TextDecoder().decode(bytes)

  it('es un PDF', () => {
    expect(texto.startsWith('%PDF')).toBe(true)
  })

  it('lleva el título grande y visible', () => {
    expect(texto).toContain('NOTA DE VENTA')
    expect(texto).toContain('/F1 24 Tf')
  })

  it('no imprime aclaraciones de valor tributario', () => {
    expect(texto).not.toContain('SIN VALOR TRIBUTARIO')
    expect(texto).not.toContain('sin valor tributario')
    expect(texto).not.toContain('documento interno')
  })

  it('incluye cliente, líneas y total', () => {
    expect(texto).toContain('Cliente Test')
    expect(texto).toContain('CODO FG 1/2')
    expect(texto).toContain('Total')
  })
})
