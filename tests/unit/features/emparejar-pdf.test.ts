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
})
