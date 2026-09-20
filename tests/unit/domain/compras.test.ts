import { describe, expect, it } from 'vitest'
import { compactoParaCompras } from '../../../src/domain/compras/compacto.ts'
import { fusionarCoincidencias } from '../../../src/domain/compras/fusionar.ts'
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
})
