import { describe, expect, it } from 'vitest'
import { detectarConflictos } from '../../../src/server/catalogo/conflictos.ts'
import { importarCatalogo } from '../../../src/server/catalogo/importar.ts'
import { AlmacenDeCatalogoEnMemoria } from '../../../src/server/catalogo/almacen-memoria.ts'
import type { ProductoDeCatalogo } from '../../../src/server/catalogo/tipos.ts'

/**
 * T075 / FR-010: códigos duplicados se informan y no se resuelven solos.
 */

function producto(
  parcial: Partial<ProductoDeCatalogo> & Pick<ProductoDeCatalogo, 'codigo'>,
): ProductoDeCatalogo {
  return {
    descripcion: parcial.descripcion ?? `Producto ${parcial.codigo}`,
    unidad: parcial.unidad ?? 'NIU',
    precio: parcial.precio ?? 100,
    activo: parcial.activo ?? true,
    marca: parcial.marca ?? '',
    codigo: parcial.codigo,
  }
}

describe('conflictos de importación — códigos duplicados', () => {
  it('señala el código repetido sin fusionar ni elegir un precio', () => {
    const conflictos = detectarConflictos([
      producto({ codigo: 'A', precio: 100 }),
      producto({ codigo: 'A', precio: 200 }),
      producto({ codigo: 'B', precio: 50 }),
    ])

    const duplicados = conflictos.filter((c) => c.tipo === 'codigo_duplicado')
    expect(duplicados).toHaveLength(1)
    expect(duplicados[0]?.codigo).toBe('A')
    expect(duplicados[0]?.detalle).toMatch(/2 veces/)
  })

  it('publicar con duplicados falla y no escribe el catálogo', async () => {
    const almacen = new AlmacenDeCatalogoEnMemoria()
    const contenido = JSON.stringify([
      {
        id: 'mismo',
        name: 'Uno',
        brand: 'Marca',
        stock: true,
        variants: [],
        unitConfig: { unitPrices: { wholesale: 1 } },
      },
      {
        id: 'mismo',
        name: 'Dos',
        brand: 'Marca',
        stock: true,
        variants: [],
        unitConfig: { unitPrices: { wholesale: 2 } },
      },
    ])

    await expect(
      importarCatalogo(almacen, {
        contenido,
        formato: 'json_tienda',
        modo: 'publicar',
        administradorId: 'admin-1',
      }),
    ).rejects.toMatchObject({ codigo: 'codigos_duplicados' })

    expect(almacen.actual).toBeNull()
  })

  it('publica precios 500 y 600, que son 5 y 6.00 en soles', async () => {
    const almacen = new AlmacenDeCatalogoEnMemoria()
    const resumen = await importarCatalogo(almacen, {
      contenido: JSON.stringify({
        productos: [
          {
            codigo: 'N1',
            descripcion: 'Nuevo uno',
            unidad: 'NIU',
            precio: 500,
            activo: true,
            marca: '',
          },
          {
            codigo: 'N2',
            descripcion: 'Nuevo dos',
            unidad: 'NIU',
            precio: 600,
            activo: true,
            marca: '',
          },
        ],
        categorias: [],
      }),
      formato: 'productos_revisados',
      modo: 'publicar',
      administradorId: 'admin-1',
    })
    expect(resumen.publicado).toBe(true)
    expect(resumen.propuestos.map((p) => p.precio)).toEqual([500, 600])
  })

  it('un precio no entero nombra el campo en el motivo', async () => {
    const almacen = new AlmacenDeCatalogoEnMemoria()
    await expect(
      importarCatalogo(almacen, {
        contenido: JSON.stringify({
          productos: [
            {
              codigo: 'N1',
              descripcion: 'Nuevo',
              unidad: 'NIU',
              precio: 5.5,
              activo: true,
              marca: '',
            },
          ],
          categorias: [],
        }),
        formato: 'productos_revisados',
        modo: 'publicar',
        administradorId: 'admin-1',
      }),
    ).rejects.toMatchObject({
      codigo: 'archivo_no_interpretable',
      detalle: { motivo: expect.stringContaining('precio') },
    })
  })
})
