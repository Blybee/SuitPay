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
})
