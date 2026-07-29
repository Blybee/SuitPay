import { describe, expect, it } from 'vitest'
import { compararContraPublicado } from '../../../src/server/catalogo/diferencias.ts'
import { importarCatalogo } from '../../../src/server/catalogo/importar.ts'
import { AlmacenDeCatalogoEnMemoria } from '../../../src/server/catalogo/almacen-memoria.ts'
import type { ProductoDeCatalogo } from '../../../src/server/catalogo/tipos.ts'

/**
 * T076 / FR-011: nuevos, cambios de precio y desapariciones.
 */

const base = (codigo: string, precio: number): ProductoDeCatalogo => ({
  codigo,
  descripcion: `Marca ${codigo}`,
  unidad: 'NIU',
  precio,
  activo: true,
})

describe('diferencias de importación', () => {
  it('distingue nuevos, cambios de precio y desapariciones', () => {
    const publicado = [base('A', 100), base('B', 200), base('C', 300)]
    const propuesto = [
      base('A', 100),
      base('B', 250),
      base('D', 400),
    ]

    const diff = compararContraPublicado(propuesto, publicado)
    expect(diff?.nuevos.map((p) => p.codigo)).toEqual(['D'])
    expect(diff?.cambiados).toHaveLength(1)
    expect(diff?.cambiados[0]?.anterior.precio).toBe(200)
    expect(diff?.cambiados[0]?.siguiente.precio).toBe(250)
    expect(diff?.desaparecidos.map((p) => p.codigo)).toEqual(['C'])
  })

  it('validar contra un catálogo ya publicado no escribe', async () => {
    const almacen = new AlmacenDeCatalogoEnMemoria({
      version: 1,
      publicadoEn: new Date('2026-01-01'),
      publicadoPor: 'admin',
      totalProductos: 1,
      productos: [base('viejo', 100)],
    })

    const resumen = await importarCatalogo(almacen, {
      contenido: JSON.stringify([
        {
          id: 'nuevo',
          name: 'Producto nuevo',
          brand: 'Acme',
          stock: true,
          variants: [],
          unitConfig: { unitPrices: { wholesale: 5 } },
        },
      ]),
      formato: 'json_tienda',
      modo: 'validar',
      administradorId: 'admin-1',
    })

    expect(resumen.publicado).toBe(false)
    expect(resumen.version).toBeNull()
    expect(resumen.diferencias?.nuevos).toHaveLength(1)
    expect(resumen.diferencias?.desaparecidos.map((p) => p.codigo)).toEqual([
      'viejo',
    ])
    expect(almacen.actual?.version).toBe(1)
  })
})
