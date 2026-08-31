import { describe, expect, it } from 'vitest'
import { crearIndice } from '../../../src/domain/busqueda/productos.ts'
import { emparejarItemsPdf } from '../../../src/features/cotizaciones/emparejar-pdf.ts'

const indice = crearIndice([
  {
    codigo: 'C1',
    descripcion: 'CODO FG 1/2',
    unidad: 'NIU',
    precio: 100,
    activo: true,
  },
  {
    codigo: 'T1',
    descripcion: 'TEE PVC 3/4',
    unidad: 'NIU',
    precio: 200,
    activo: true,
  },
])

describe('emparejarItemsPdf', () => {
  it('resuelve una coincidencia fuerte y deja pendiente lo desconocido', () => {
    const lineas = emparejarItemsPdf(indice, [
      { textoOriginal: 'codo fg 1/2', cantidad: 10, unidad: 'NIU' },
      { textoOriginal: 'producto inventado xyz', cantidad: 1, unidad: 'NIU' },
    ])
    expect(lineas[0]?.estadoLinea).toBe('resuelta')
    expect(lineas[0]?.seleccion).toBe('C1')
    expect(lineas[0]?.cantidad).toBe(10)
    expect(lineas[1]?.estadoLinea).toBe('pendiente')
  })

  it('prefiere el código del modelo si existe en catálogo', () => {
    const lineas = emparejarItemsPdf(
      indice,
      [
        {
          textoOriginal: 'codo media',
          cantidad: 2,
          unidad: 'NIU',
          codigo: 'C1',
          confidence: 'high',
        },
      ],
      (codigo) =>
        codigo === 'C1'
          ? { codigo: 'C1', descripcion: 'CODO FG 1/2', unidad: 'NIU' }
          : undefined,
    )
    expect(lineas[0]?.seleccion).toBe('C1')
    expect(lineas[0]?.estadoLinea).toBe('resuelta')
  })

  it('deja ambigua un código inventado', () => {
    const lineas = emparejarItemsPdf(
      indice,
      [
        {
          textoOriginal: 'inventado',
          cantidad: 1,
          unidad: 'NIU',
          codigo: 'NO-EXISTE',
          confidence: 'high',
        },
      ],
      () => undefined,
    )
    expect(lineas[0]?.estadoLinea).toBe('pendiente')
  })
})
