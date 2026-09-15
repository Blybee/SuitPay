import { describe, expect, it } from 'vitest'
import {
  diaCivilDeLineasVivas,
  fusionarLineasPorCodigo,
  hayQueArchivarPedidoVivo,
  totalDeGrupos,
} from '../../../src/domain/vecinos/deudas.ts'
import type { LineaDePedido } from '../../../src/domain/totales/calculo.ts'

function linea(
  codigo: string,
  cantidad: number,
  precio: number,
  descripcion = codigo,
): LineaDePedido {
  return {
    codigo,
    descripcion,
    unidad: 'UND',
    cantidad,
    precio,
  }
}

describe('fusión de líneas por código', () => {
  it('suma cantidades y toma precio del día más reciente', () => {
    const fusionadas = fusionarLineasPorCodigo([
      {
        fecha: '2026-09-12',
        lineas: [linea('TUB', 2, 1000), linea('COD', 1, 500)],
      },
      {
        fecha: '2026-09-13',
        lineas: [linea('TUB', 3, 1200, 'Tubo nuevo')],
      },
    ])
    expect(fusionadas).toEqual([
      {
        codigo: 'TUB',
        descripcion: 'Tubo nuevo',
        unidad: 'UND',
        cantidad: 5,
        precio: 1200,
      },
      linea('COD', 1, 500),
    ])
  })

  it('conserva el orden de primera aparición', () => {
    const fusionadas = fusionarLineasPorCodigo([
      { fecha: '2026-09-10', lineas: [linea('B', 1, 1), linea('A', 1, 1)] },
      { fecha: '2026-09-11', lineas: [linea('C', 1, 1)] },
    ])
    expect(fusionadas.map((cada) => cada.codigo)).toEqual(['B', 'A', 'C'])
  })
})

describe('corte de día civil', () => {
  it('archiva cuando hay líneas de un día anterior', () => {
    expect(hayQueArchivarPedidoVivo('2026-09-13', '2026-09-14', 2)).toBe(true)
    expect(hayQueArchivarPedidoVivo('2026-09-14', '2026-09-14', 2)).toBe(false)
    expect(hayQueArchivarPedidoVivo('2026-09-13', '2026-09-14', 0)).toBe(false)
  })

  it('infiere el día de actualizadoEn si falta diaCivilLineas', () => {
    expect(
      diaCivilDeLineasVivas(
        null,
        new Date('2026-09-13T08:00:00-05:00'),
        new Date('2026-09-14T10:00:00-05:00'),
      ),
    ).toBe('2026-09-13')
    expect(
      diaCivilDeLineasVivas(
        '2026-09-12',
        new Date('2026-09-13T08:00:00-05:00'),
        new Date('2026-09-14T10:00:00-05:00'),
      ),
    ).toBe('2026-09-12')
  })

  it('suma totales de grupos', () => {
    expect(
      totalDeGrupos([
        { fecha: '2026-09-12', lineas: [linea('A', 2, 100)] },
        { fecha: '2026-09-13', lineas: [linea('B', 1, 50)] },
      ]),
    ).toBe(250)
  })
})
