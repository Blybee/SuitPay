import { describe, expect, it } from 'vitest'
import {
  limitesDelMesEnLima,
  mesEnLima,
  periodoEstaCerrado,
} from '../../../src/domain/comprobantes/periodo-lima.ts'
import {
  resumenSinIdentidadDeCliente,
  resumirPeriodo,
} from '../../../src/domain/comprobantes/resumen-periodo.ts'
import type { FilaDeVenta } from '../../../src/domain/comprobantes/resumen-periodo.ts'
import { esquemaDeResumenDeVentas } from '../../../src/mcp/herramientas/resumen-ventas.ts'

function fila(
  parcial: Partial<FilaDeVenta> & Pick<FilaDeVenta, 'total'>,
): FilaDeVenta {
  return {
    tipoDocumento: 'boleta',
    estado: 'aceptado',
    vendedorId: 'vend',
    cliente: null,
    anulacion: null,
    lineas: [],
    ...parcial,
  }
}

describe('resumen de un periodo', () => {
  it('redondea el ticket y no trunca', () => {
    const resumen = resumirPeriodo(
      [fila({ total: 100 }), fila({ total: 101 })],
      '2020-11',
    )
    expect(resumen.totalCentimos).toBe(201)
    expect(resumen.cantidad).toBe(2)
    expect(resumen.ticketPromedioCentimos).toBe(101)
  })

  it('suma nota de venta e indeterminado y deja fuera anulado, rechazado, interno, guía y anulación', () => {
    const resumen = resumirPeriodo(
      [
        fila({ tipoDocumento: 'nota_venta', total: 100 }),
        fila({ estado: 'indeterminado', total: 50 }),
        fila({ estado: 'anulado', total: 400 }),
        fila({ estado: 'rechazado', total: 1600 }),
        fila({ tipoDocumento: 'interno_contingencia', total: 800 }),
        fila({ tipoDocumento: 'guia', total: 3200 }),
        fila({
          estado: 'aceptado',
          total: 70,
          anulacion: { motivo: 'error' },
        }),
      ],
      '2020-11',
    )
    expect(resumen.totalCentimos).toBe(150)
    expect(resumen.cantidad).toBe(2)
    expect(resumen.porTipo).toEqual([
      { tipo: 'boleta', totalCentimos: 50, cantidad: 1 },
      { tipo: 'factura', totalCentimos: 0, cantidad: 0 },
      { tipo: 'nota_venta', totalCentimos: 100, cantidad: 1 },
    ])
  })

  it('quita documento y razón social antes de salir hacia un modelo', () => {
    const resumen = resumirPeriodo(
      [
        fila({
          total: 200,
          cliente: { numeroDocumento: '20100000001', denominacion: 'ACME' },
        }),
      ],
      '2020-11',
    )
    expect(resumen.topClientes[0]).toEqual({
      numeroDocumento: '20100000001',
      denominacion: 'ACME',
      totalCentimos: 200,
      cantidad: 1,
    })
    const publico = JSON.stringify(resumenSinIdentidadDeCliente(resumen))
    expect(publico).not.toContain('20100000001')
    expect(publico).not.toContain('ACME')
    expect(publico).toContain('200')
  })
})

describe('mes civil de Lima', () => {
  it('cierra el mes a las 05:00 UTC, no a la medianoche UTC', () => {
    const { desde, hastaExclusivo } = limitesDelMesEnLima('2020-11')
    expect(desde.toISOString()).toBe('2020-11-01T05:00:00.000Z')
    expect(hastaExclusivo.toISOString()).toBe('2020-12-01T05:00:00.000Z')
    expect(mesEnLima(new Date('2020-12-01T04:30:00.000Z'))).toBe('2020-11')
    expect(mesEnLima(new Date('2020-12-01T05:30:00.000Z'))).toBe('2020-12')
    expect(
      periodoEstaCerrado('2020-11', new Date('2026-11-18T15:00:00.000Z')),
    ).toBe(true)
    expect(
      periodoEstaCerrado('2026-11', new Date('2026-11-18T15:00:00.000Z')),
    ).toBe(false)
  })
})

describe('esquema de resumen_ventas', () => {
  it('rechaza un mes imposible y una clave de más', () => {
    expect(
      esquemaDeResumenDeVentas.safeParse({ periodo: '2020-11' }).success,
    ).toBe(true)
    expect(
      esquemaDeResumenDeVentas.safeParse({ periodo: '2020-13' }).success,
    ).toBe(false)
    expect(
      esquemaDeResumenDeVentas.safeParse({ periodo: '2020-11', extra: 1 })
        .success,
    ).toBe(false)
  })
})
