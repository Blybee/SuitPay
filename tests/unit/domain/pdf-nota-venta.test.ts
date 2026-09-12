import { describe, expect, it } from 'vitest'
import {
  bytesDePdfInterno,
  LAYOUT_COLUMNAS_PDF_INTERNO,
} from '../../../src/domain/documentos/pdf-interno.ts'
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

  it('usa Helvetica-Bold en titulo, razon social y encabezados', () => {
    expect(texto).toContain('/Helvetica-Bold')
    expect(texto).toContain('/F2')
  })

  it('encierras encabezados y TOTAL en celdas con borde', () => {
    expect(texto).toContain(' re\n')
    expect(texto).toContain('0.898 0.906 0.922 RG')
  })

  it('declara WinAnsi para el signo de numero', () => {
    expect(texto).toContain('/WinAnsiEncoding')
    expect(texto).toContain('\\260')
  })

  it('compacta PRECIO y TOTAL y cede el espacio a DESCRIPCIÓN', () => {
    expect(LAYOUT_COLUMNAS_PDF_INTERNO).toEqual({
      codigo: 68,
      descripcion: 266,
      cantidad: 65,
      precio: 58,
      total: 58,
      margenDerecho: 555,
    })
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

  it('pinta zebra en la segunda fila de productos', () => {
    const texto = textoDe(
      bytesDePdfInterno({
        clase: 'cotizacion',
        emitidoEn: fixture.emitidoEn,
        numero: 1,
        cliente: 'Cliente Test',
        lineas: [
          fixture.lineas[0]!,
          {
            codigo: 'C002',
            descripcion: 'TEE FG 1/2',
            cantidad: 1,
            precio: 800,
            importe: 800,
          },
        ],
        total: 3260,
      }),
    )
    expect(texto).toContain('0.976 0.980 0.984 rg')
    expect(texto).toContain('C002')
  })

  it('la franja de zebra cubre todos los renglones de una fila larga', () => {
    const descripcionLarga =
      'CODO DE FIERRO GALVANIZADO DE MEDIA PULGADA CON ROSCA INTERNA Y REFUERZO PARA ALTA PRESION EN REDES DE AGUA POTABLE'
    const texto = textoDe(
      bytesDePdfInterno({
        clase: 'nota_venta',
        emitidoEn: fixture.emitidoEn,
        numero: 1,
        cliente: 'Cliente Test',
        lineas: [
          fixture.lineas[0]!,
          {
            codigo: 'C002',
            descripcion: descripcionLarga,
            cantidad: 1,
            precio: 800,
            importe: 800,
          },
        ],
        total: 3260,
      }),
    )
    const franja = texto.match(
      /0\.976 0\.980 0\.984 rg\n[\d.]+ [\d.]+ 515\.00 ([\d.]+) re/,
    )
    expect(franja).not.toBeNull()
    expect(Number(franja?.[1])).toBeGreaterThan(20)
  })
})
