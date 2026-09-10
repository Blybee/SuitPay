import { describe, expect, it } from 'vitest'
import { bytesDePdfInterno } from '../../../src/domain/documentos/pdf-interno.ts'
import { bytesDePdfDeNotaVenta } from '../../../src/domain/documentos/pdf-nota-venta.ts'

const fixture = {
  emitidoEn: new Date('2026-03-15T15:00:00-05:00'),
  numero: 10,
  cliente: 'Cliente Test',
  lineas: [
    {
      codigo: 'C001',
      descripcion: 'CODO FG 1/2',
      cantidad: 2,
      precio: 1230,
      importe: 2460,
    },
  ],
  total: 2460,
} as const

function textoDe(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

describe('PDF de nota de venta', () => {
  const texto = textoDe(bytesDePdfDeNotaVenta(fixture))

  it('es un PDF', () => {
    expect(texto.startsWith('%PDF')).toBe(true)
  })

  it('lleva el título de nota de venta y el correlativo', () => {
    expect(texto).toContain('NOTA DE VENTA')
    expect(texto).toContain('0000000010')
  })

  it('no imprime aclaraciones de valor tributario', () => {
    expect(texto).not.toContain('SIN VALOR TRIBUTARIO')
    expect(texto).not.toContain('sin valor tributario')
    expect(texto).not.toContain('documento interno')
  })

  it('incluye emisor, fecha, cliente, columnas y total', () => {
    expect(texto).toContain('Distribuidora Salomon Pacifico')
    expect(texto).toContain('20535643998')
    expect(texto).toContain('FECHA')
    expect(texto).toContain('CLIENTE')
    expect(texto).toContain('Cliente Test')
    expect(texto).toContain('CODIGO')
    expect(texto).toContain('DESCRIPCION')
    expect(texto).toContain('CANTIDAD')
    expect(texto).toContain('PRECIO')
    expect(texto).toContain('TOTAL')
    expect(texto).toContain('C001')
    expect(texto).toContain('CODO FG 1/2')
  })
})

describe('PDF de cotizacion', () => {
  const texto = textoDe(bytesDePdfInterno({ ...fixture, clase: 'cotizacion' }))

  it('usa el titulo de cotizacion y no el de nota', () => {
    expect(texto.startsWith('%PDF')).toBe(true)
    expect(texto).toContain('COTIZACION')
    expect(texto).not.toContain('NOTA DE VENTA')
    expect(texto).toContain('0000000010')
  })

  it('comparte emisor y columnas', () => {
    expect(texto).toContain('Distribuidora Salomon Pacifico')
    expect(texto).toContain('Jr. Lampa 1062')
    expect(texto).toContain('CODIGO')
    expect(texto).toContain('TOTAL')
  })
})

describe('PDF interno con muchas lineas', () => {
  it('parte a una segunda pagina', () => {
    const lineas = Array.from({ length: 80 }, (_, indice) => ({
      codigo: `P${String(indice + 1).padStart(3, '0')}`,
      descripcion: `Producto de prueba ${indice + 1}`,
      cantidad: 1,
      precio: 100,
      importe: 100,
    }))
    const texto = textoDe(
      bytesDePdfInterno({
        clase: 'cotizacion',
        emitidoEn: fixture.emitidoEn,
        numero: 1,
        cliente: 'Cliente Test',
        lineas,
        total: 8000,
      }),
    )
    expect(texto).toContain('/Count 2')
    expect(texto).toContain('P001')
    expect(texto).toContain('P080')
  })
})
