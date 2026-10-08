import { describe, expect, it } from 'vitest'
import { compactoParaCompras } from '../../../src/domain/compras/compacto.ts'
import { fusionarCoincidencias } from '../../../src/domain/compras/fusionar.ts'
import {
  crudoDesdeOrdenes,
  leerOrdenDeItems,
} from '../../../src/domain/compras/leer-orden.ts'
import {
  centimosDeDecimales,
  centimosDesdeTextoDecimal,
  normalizarMoneda,
} from '../../../src/domain/compras/moneda.ts'
import { parsearBocetoDeCompras } from '../../../src/domain/compras/parsear.ts'

describe('compactoParaCompras', () => {
  it('serializa id, nombre y marca sin precio', () => {
    const json = compactoParaCompras([
      { id: 'C1', n: 'CODO 1/2', m: 'Pavco', a: ['codo'], e: ['liviano'] },
    ])
    expect(json).toContain('"id":"C1"')
    expect(json).toContain('"n":"CODO 1/2"')
    expect(json).toContain('"m":"Pavco"')
    expect(json).not.toMatch(/precio/)
    expect(json).not.toContain('"a"')
  })
})

describe('fusionarCoincidencias', () => {
  it('el mismo SKU conserva la fecha más reciente', () => {
    const fusion = fusionarCoincidencias([
      {
        codigo: 'C1',
        precioCompraCentimos: 100,
        precioCompraEn: '2026-01-01',
        etiquetaFactura: 'vieja',
      },
      {
        codigo: 'C1',
        precioCompraCentimos: 200,
        precioCompraEn: '2026-03-15',
        etiquetaFactura: 'nueva',
      },
    ])
    expect(fusion).toHaveLength(1)
    expect(fusion[0]?.precioCompraCentimos).toBe(200)
    expect(fusion[0]?.etiquetaFactura).toBe('nueva')
  })
})

describe('parsearBocetoDeCompras', () => {
  it('un código fuera del catálogo va a sinMatch', () => {
    const boceto = parsearBocetoDeCompras(
      {
        coincidencias: [
          {
            codigo: 'NOPE',
            precioCompraCentimos: 100,
            etiquetaFactura: 'cosa',
          },
          {
            codigo: 'C1',
            precioCompraCentimos: 1250,
            etiquetaFactura: 'codo',
            precioCompraEn: '2026-03-15',
          },
        ],
        sinMatch: [],
      },
      new Set(['C1']),
      'simulado',
    )
    expect(boceto.coincidencias).toEqual([
      {
        codigo: 'C1',
        precioCompraCentimos: 1250,
        etiquetaFactura: 'codo',
        precioCompraEn: '2026-03-15',
      },
    ])
    expect(boceto.sinMatch[0]?.etiquetaFactura).toBe('cosa')
  })

  it('acepta soles si no vienen céntimos', () => {
    const boceto = parsearBocetoDeCompras(
      {
        coincidencias: [
          {
            codigo: 'C1',
            precioCompraSoles: 12.5,
            etiquetaFactura: 'codo',
          },
        ],
      },
      new Set(['C1']),
      'simulado',
    )
    expect(boceto.coincidencias[0]?.precioCompraCentimos).toBe(1250)
  })

  it('una orden en dólares conserva 1.0550 y no lo vuelve 106 céntimos', () => {
    const boceto = parsearBocetoDeCompras(
      {
        moneda: 'DOLARES AMERICANOS',
        fecha: '2026-09-30',
        coincidencias: [
          {
            codigo: 'JL-9000',
            precioUnitario: '1.3200',
            etiquetaFactura: 'CODO',
          },
          {
            codigo: 'JL-27000',
            precioUnitario: '1.0550',
            etiquetaFactura: 'UNION',
          },
        ],
      },
      new Set(['JL-9000', 'JL-27000']),
      'orden-pdf',
    )
    expect(boceto.coincidencias).toEqual([
      {
        codigo: 'JL-9000',
        etiquetaFactura: 'CODO',
        moneda: 'USD',
        precioOriginal: '1.3200',
        precioCompraEn: '2026-09-30',
      },
      {
        codigo: 'JL-27000',
        etiquetaFactura: 'UNION',
        moneda: 'USD',
        precioOriginal: '1.0550',
        precioCompraEn: '2026-09-30',
      },
    ])
    expect(boceto.coincidencias[0]?.precioCompraCentimos).toBeUndefined()
  })

  it('en soles redondea el precio impreso al céntimo', () => {
    const boceto = parsearBocetoDeCompras(
      {
        moneda: 'SOLES',
        coincidencias: [
          {
            codigo: 'C1',
            precioUnitario: '12.50',
            etiquetaFactura: 'codo',
          },
        ],
      },
      new Set(['C1']),
      'orden-pdf',
    )
    expect(boceto.coincidencias[0]?.moneda).toBeUndefined()
    expect(boceto.coincidencias[0]?.precioCompraCentimos).toBe(1250)
  })
})

describe('moneda de compra', () => {
  it('reconoce soles y dólares americanos', () => {
    expect(normalizarMoneda('DOLARES AMERICANOS')).toBe('USD')
    expect(normalizarMoneda('SOLES')).toBe('PEN')
    expect(normalizarMoneda('USD')).toBe('USD')
  })

  it('convierte con el tipo de cambio venta sin redondear antes', () => {
    expect(centimosDeDecimales('1.3200', '3.450')).toBe(455)
    expect(centimosDeDecimales('1.0550', '3.450')).toBe(364)
  })

  it('acepta 5, 5.00 y 5,50 como céntimos de catálogo', () => {
    expect(centimosDesdeTextoDecimal('5')).toBe(500)
    expect(centimosDesdeTextoDecimal('5.00')).toBe(500)
    expect(centimosDesdeTextoDecimal('5,50')).toBe(550)
  })
})

describe('leerOrdenDeItems', () => {
  it('lee la moneda, la fecha de la orden y los precios de cuatro decimales', () => {
    const orden = leerOrdenDeItems([
      { str: 'FECHA: 07/10/2026', x: 465, y: 799 },
      { str: '30/09/2026', x: 439, y: 679 },
      { str: 'FECHA', x: 399, y: 678 },
      { str: 'MONEDA', x: 390, y: 665 },
      { str: 'DOLARES AMERICANOS', x: 439, y: 665 },
      { str: 'CODIGO', x: 39, y: 578 },
      { str: 'DESCRIPCIÓN', x: 136, y: 578 },
      { str: 'U.M.', x: 249, y: 578 },
      { str: 'PRECIO', x: 366, y: 578 },
      { str: 'JL-9000 R', x: 39, y: 563 },
      { str: 'YALONG- CODO DE 1/2" X 90°', x: 89, y: 563 },
      { str: 'UND', x: 249, y: 563 },
      { str: '1.3200', x: 396, y: 563 },
      { str: '0.00', x: 475, y: 563 },
      { str: 'JL-27000 R', x: 37, y: 542 },
      { str: 'YALONG- UNION DE 1/2" BRONCE', x: 89, y: 542 },
      { str: '1.0550', x: 396, y: 542 },
      { str: 'FECHA ENTREGA', x: 38, y: 202 },
      { str: '30/09/2026', x: 130, y: 202 },
    ])
    expect(orden).toEqual({
      moneda: 'USD',
      fecha: '2026-09-30',
      lineas: [
        {
          codigo: 'JL-9000',
          descripcion: 'YALONG- CODO DE 1/2" X 90°',
          precioUnitario: '1.3200',
        },
        {
          codigo: 'JL-27000',
          descripcion: 'YALONG- UNION DE 1/2" BRONCE',
          precioUnitario: '1.0550',
        },
      ],
    })
    const crudo = crudoDesdeOrdenes(orden === null ? [] : [orden])
    expect(crudo.coincidencias[1]?.precioUnitario).toBe('1.0550')
  })
})
