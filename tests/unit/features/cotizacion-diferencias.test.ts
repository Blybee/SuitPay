import { describe, expect, it } from 'vitest'
import { diferenciasContraCatalogo } from '../../../src/features/cotizaciones/diferencias.ts'
import type { ProductoBuscable } from '../../../src/domain/busqueda/productos.ts'

function producto(
  parcial: Partial<ProductoBuscable> & Pick<ProductoBuscable, 'codigo'>,
): ProductoBuscable {
  return {
    descripcion: parcial.descripcion ?? parcial.codigo,
    unidad: parcial.unidad ?? 'UND',
    precio: parcial.precio ?? 1_000,
    activo: parcial.activo ?? true,
    codigo: parcial.codigo,
  }
}

describe('diferenciasContraCatalogo', () => {
  const catalogo = new Map<string, ProductoBuscable>([
    ['A', producto({ codigo: 'A', precio: 1_500 })],
    ['B', producto({ codigo: 'B', precio: 2_000, activo: false })],
  ])

  function porCodigo(codigo: string): ProductoBuscable | undefined {
    return catalogo.get(codigo)
  }

  it('señala precios cambiados y productos desaparecidos', () => {
    const diferencias = diferenciasContraCatalogo(
      [
        {
          codigo: 'A',
          descripcion: 'Producto A',
          unidad: 'UND',
          cantidad: 1,
          precio: 1_000,
        },
        {
          codigo: 'B',
          descripcion: 'Producto B',
          unidad: 'UND',
          cantidad: 1,
          precio: 2_000,
        },
        {
          codigo: 'C',
          descripcion: 'Producto C',
          unidad: 'UND',
          cantidad: 1,
          precio: 500,
        },
      ],
      porCodigo,
    )

    expect(diferencias).toEqual([
      expect.objectContaining({
        codigo: 'A',
        clase: 'precio_cambiado',
        precioGuardado: 1_000,
        precioActual: 1_500,
      }),
      expect.objectContaining({
        codigo: 'B',
        clase: 'producto_desaparecido',
      }),
      expect.objectContaining({
        codigo: 'C',
        clase: 'producto_desaparecido',
      }),
    ])
  })

  it('no advierte cuando todo coincide', () => {
    expect(
      diferenciasContraCatalogo(
        [
          {
            codigo: 'A',
            descripcion: 'Producto A',
            unidad: 'UND',
            cantidad: 2,
            precio: 1_500,
          },
        ],
        porCodigo,
      ),
    ).toEqual([])
  })
})
