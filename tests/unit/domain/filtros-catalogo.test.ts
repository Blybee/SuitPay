import { describe, expect, it } from 'vitest'
import {
  filtrarPorFacetas,
  filtrarPorTexto,
  marcasDe,
} from '../../../src/domain/catalogo/filtros.ts'

/**
 * T196 / FR-009d: filtros facetados sobre el espejo en memoria.
 * Producto sin categoría no entra al filtro de categoría.
 */

const catalogo = [
  {
    codigo: 'A',
    marca: 'Valmax',
    categoriaId: 'cat-valvulas',
  },
  {
    codigo: 'B',
    marca: 'Valmax',
    categoriaId: 'cat-codos',
  },
  {
    codigo: 'C',
    marca: 'Fipalsa',
    categoriaId: 'cat-valvulas',
  },
  {
    codigo: 'D',
    marca: 'Valmax',
  },
  {
    codigo: 'E',
    marca: '',
  },
] as const

describe('filtros facetados de catálogo', () => {
  it('categoría global incluye solo productos con ese categoriaId', () => {
    const filtrados = filtrarPorFacetas(catalogo, {
      categoriaId: 'cat-valvulas',
    })
    expect(filtrados.map((p) => p.codigo)).toEqual(['A', 'C'])
  })

  it('producto sin categoría no entra al filtro de categoría', () => {
    const filtrados = filtrarPorFacetas(catalogo, {
      categoriaId: 'cat-codos',
    })
    expect(filtrados.map((p) => p.codigo)).toEqual(['B'])
    expect(filtrados.some((p) => p.codigo === 'D')).toBe(false)
  })

  it('categoría ∩ marca cruza ambos ejes', () => {
    const filtrados = filtrarPorFacetas(catalogo, {
      marca: 'Valmax',
      categoriaId: 'cat-valvulas',
    })
    expect(filtrados.map((p) => p.codigo)).toEqual(['A'])
  })

  it('marca sola deja fuera otras marcas y la marca vacía', () => {
    const filtrados = filtrarPorFacetas(catalogo, { marca: 'Valmax' })
    expect(filtrados.map((p) => p.codigo)).toEqual(['A', 'B', 'D'])
  })

  it('sin facetas devuelve el catálogo entero', () => {
    expect(filtrarPorFacetas(catalogo, {}).map((p) => p.codigo)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ])
  })

  it('marcasDe lista valores no vacíos, únicos y ordenados', () => {
    expect(marcasDe(catalogo)).toEqual(['Fipalsa', 'Valmax'])
  })
})

const conTexto = [
  {
    codigo: 'CFG12',
    descripcion: 'CODO FG 1/2',
    marca: 'Valmax',
  },
  {
    codigo: 'CFG34',
    descripcion: 'CODO FG 3/4',
    marca: 'Valmax',
  },
  {
    codigo: 'LLPASO12',
    descripcion: 'LLAVE DE PASO BRONCE 1/2',
    marca: 'Fipalsa',
  },
  {
    codigo: 'AQ-25009',
    descripcion: 'Válvula de desagüe',
    marca: '',
  },
] as const

describe('filtro de texto de catálogo', () => {
  it('consulta vacía deja el catálogo entero', () => {
    expect(filtrarPorTexto(conTexto, '  ').map((p) => p.codigo)).toEqual([
      'CFG12',
      'CFG34',
      'LLPASO12',
      'AQ-25009',
    ])
  })

  it('encuentra por código', () => {
    expect(filtrarPorTexto(conTexto, 'llpaso12').map((p) => p.codigo)).toEqual([
      'LLPASO12',
    ])
  })

  it('encuentra por descripción sin importar el orden de los términos', () => {
    expect(filtrarPorTexto(conTexto, '1/2 fg codo').map((p) => p.codigo)).toEqual(
      ['CFG12'],
    )
  })

  it('encuentra por marca', () => {
    expect(filtrarPorTexto(conTexto, 'fipalsa').map((p) => p.codigo)).toEqual([
      'LLPASO12',
    ])
  })

  it('ignora tildes', () => {
    expect(filtrarPorTexto(conTexto, 'valvula').map((p) => p.codigo)).toEqual([
      'AQ-25009',
    ])
  })

  it('sin coincidencias devuelve vacío', () => {
    expect(filtrarPorTexto(conTexto, 'inexistente')).toEqual([])
  })
})
