import { describe, expect, it } from 'vitest'
import { esquemaDeProducto } from '../../../src/domain/esquemas/comunes.ts'
import { importarCatalogo } from '../../../src/server/catalogo/importar.ts'
import { AlmacenDeCatalogoEnMemoria } from '../../../src/server/catalogo/almacen-memoria.ts'
import type { ProductoDeCatalogo } from '../../../src/server/catalogo/tipos.ts'

/**
 * T195 / FR-009c / FR-009d: marca persistida, categorias[] en el documento,
 * categoriaId opcional; producto sin categoría publica; recarga conserva ids.
 */

const producto = (
  extras: Partial<ProductoDeCatalogo> & Pick<ProductoDeCatalogo, 'codigo'>,
): ProductoDeCatalogo => ({
  codigo: extras.codigo,
  descripcion: extras.descripcion ?? `Pieza ${extras.codigo}`,
  unidad: extras.unidad ?? 'NIU',
  precio: extras.precio ?? 100,
  activo: extras.activo ?? true,
  marca: extras.marca ?? '',
  categoriaId: extras.categoriaId,
})

describe('importación de marca y categorías', () => {
  it('el esquema admite marca vacía y categoriaId ausente', () => {
    const parseado = esquemaDeProducto.parse({
      codigo: 'X',
      descripcion: 'Pieza',
      unidad: 'NIU',
      precio: 10,
      activo: true,
    })
    expect(parseado.marca).toBe('')
    expect(parseado.categoriaId).toBeUndefined()
  })

  it('json_tienda persiste brand como marca', async () => {
    const almacen = new AlmacenDeCatalogoEnMemoria()
    await importarCatalogo(almacen, {
      contenido: JSON.stringify([
        {
          id: 'p1',
          name: 'Codo FG',
          brand: 'Valmax',
          stock: true,
          variants: [],
          unitConfig: { unitPrices: { wholesale: 8.5 } },
        },
      ]),
      formato: 'json_tienda',
      modo: 'publicar',
      administradorId: 'admin-1',
    })

    const publicado = await almacen.leerPublicado()
    expect(publicado?.productos[0]).toMatchObject({
      codigo: 'p1',
      marca: 'Valmax',
      descripcion: 'Valmax Codo FG',
    })
    expect(publicado?.productos[0]?.categoriaId).toBeUndefined()
    expect(publicado?.categorias).toEqual([])
  })

  it('publica categorias y producto sin categoría; recarga conserva ids', async () => {
    const almacen = new AlmacenDeCatalogoEnMemoria()
    const categorias = [
      { id: 'cat-valvulas', nombre: 'Válvulas' },
      { id: 'cat-codos', nombre: 'Codos' },
    ]
    const productos = [
      producto({
        codigo: 'A',
        marca: 'Acme',
        categoriaId: 'cat-valvulas',
      }),
      producto({ codigo: 'B', marca: 'Acme' }),
    ]

    const resumen = await importarCatalogo(almacen, {
      contenido: JSON.stringify({ productos, categorias }),
      formato: 'productos_revisados',
      modo: 'publicar',
      administradorId: 'admin-1',
    })

    expect(resumen.publicado).toBe(true)
    expect(resumen.propuestos).toHaveLength(2)

    const leido = await almacen.leerPublicado()
    expect(leido?.categorias).toEqual(categorias)
    expect(leido?.productos[0]?.marca).toBe('Acme')
    expect(leido?.productos[0]?.categoriaId).toBe('cat-valvulas')
    expect(leido?.productos[1]?.categoriaId).toBeUndefined()

    const otraVez = await almacen.leerPublicado()
    expect(otraVez?.categorias.map((c) => c.id)).toEqual([
      'cat-valvulas',
      'cat-codos',
    ])
  })
})
