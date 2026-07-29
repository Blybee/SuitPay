import { describe, expect, it } from 'vitest'
import {
  calcularImporte,
  calcularTotal,
  centimosDesdeSoles,
  formatearImporte,
  lineaEsEmitible,
  lineasNoEmitibles,
  pedidoEsEmitible
  
} from '#/domain/totales/calculo.ts'
import type {LineaDePedido} from '#/domain/totales/calculo.ts';

function linea(parcial: Partial<LineaDePedido> = {}): LineaDePedido {
  return {
    codigo: 'CODO-FG-12',
    descripcion: 'Codo FG 1/2',
    unidad: 'UND',
    cantidad: 1,
    precio: 1230,
    ...parcial,
  }
}

describe('cálculo de importes', () => {
  it('multiplica cantidad por precio', () => {
    expect(calcularImporte(linea({ cantidad: 3, precio: 1230 }))).toBe(3690)
  })

  it('redondea al céntimo en la línea, no al final', () => {
    // 2,5 unidades a 3,33 son 8,325: se redondea a 8,33 en la línea. Si el
    // redondeo ocurriese solo en el total, un cliente que sume a mano las
    // líneas del comprobante obtendría otra cifra.
    expect(calcularImporte(linea({ cantidad: 2.5, precio: 333 }))).toBe(833)
  })

  it('suma catorce líneas sin acumular error de coma flotante', () => {
    const lineas = Array.from({ length: 14 }, () =>
      linea({ cantidad: 1, precio: 10 }),
    )
    expect(calcularTotal(lineas)).toBe(140)
  })

  it('el total es exactamente la suma de los importes mostrados', () => {
    const lineas = [
      linea({ cantidad: 2.5, precio: 333 }),
      linea({ cantidad: 1.5, precio: 777 }),
      linea({ cantidad: 0.333, precio: 999 }),
    ]
    const sumaDeImportes = lineas.reduce(
      (suma, cada) => suma + calcularImporte(cada),
      0,
    )
    expect(calcularTotal(lineas)).toBe(sumaDeImportes)
  })

  it('normaliza cantidades con cola decimal larga', () => {
    // 1/3 teclado como división da 0,3333333...; se recorta a tres decimales
    // para que no aparezca una cantidad con cola infinita en el comprobante.
    expect(calcularImporte(linea({ cantidad: 1 / 3, precio: 300 }))).toBe(100)
  })
})

describe('importe no positivo (FR-013)', () => {
  it('rechaza cantidad cero', () => {
    expect(lineaEsEmitible(linea({ cantidad: 0 }))).toBe(false)
  })

  it('rechaza cantidad negativa', () => {
    expect(lineaEsEmitible(linea({ cantidad: -2 }))).toBe(false)
  })

  it('rechaza precio cero, que es el accesorio regalado', () => {
    expect(lineaEsEmitible(linea({ precio: 0 }))).toBe(false)
  })

  it('rechaza una cantidad tan pequeña que su importe redondea a cero', () => {
    // 0,001 unidades a 1 céntimo redondea a 0. La línea parece válida mirando
    // sus campos y no lo es mirando su importe.
    expect(lineaEsEmitible(linea({ cantidad: 0.001, precio: 1 }))).toBe(false)
  })

  it('rechaza valores no finitos', () => {
    expect(lineaEsEmitible(linea({ cantidad: Number.NaN }))).toBe(false)
    expect(lineaEsEmitible(linea({ precio: Number.POSITIVE_INFINITY }))).toBe(
      false,
    )
  })

  it('acepta una línea normal', () => {
    expect(lineaEsEmitible(linea())).toBe(true)
  })

  it('señala cuáles son las líneas no emitibles', () => {
    const lineas = [linea(), linea({ cantidad: 0 }), linea({ precio: 0 })]
    expect(lineasNoEmitibles(lineas)).toHaveLength(2)
  })

  it('un pedido vacío no es emitible', () => {
    expect(pedidoEsEmitible([])).toBe(false)
  })

  it('un pedido con una sola línea mala no es emitible', () => {
    expect(pedidoEsEmitible([linea(), linea({ cantidad: 0 })])).toBe(false)
  })
})

describe('formato de importes', () => {
  it('muestra siempre dos decimales', () => {
    expect(formatearImporte(1200)).toBe('12.00')
    expect(formatearImporte(1230)).toBe('12.30')
    expect(formatearImporte(1203)).toBe('12.03')
  })

  it('separa los miles con coma y los decimales con punto, como en Perú', () => {
    expect(formatearImporte(123456789)).toBe('1,234,567.89')
  })

  it('convierte desde soles sin error de coma flotante', () => {
    expect(centimosDesdeSoles(12.3)).toBe(1230)
    expect(centimosDesdeSoles(0.1 + 0.2)).toBe(30)
  })
})
