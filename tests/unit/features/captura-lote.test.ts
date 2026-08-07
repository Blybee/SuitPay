import { describe, expect, it } from 'vitest'
import { crearIndice } from '../../../src/domain/busqueda/productos.ts'
import type { ProductoBuscable } from '../../../src/domain/busqueda/productos.ts'
import { construirLoteDeCandidatos } from '../../../src/features/captura/lote.ts'

const muchos: ProductoBuscable[] = Array.from({ length: 80 }, (_, i) => ({
  codigo: `P${i}`,
  descripcion: `PRODUCTO ${i} FG 1/2`,
  unidad: 'NIU',
  precio: 100 + i,
  activo: true,
}))

describe('lote de captura (T120)', () => {
  it('filtra con Fuse cuando hay término', () => {
    const indice = crearIndice(muchos)
    const lote = construirLoteDeCandidatos(indice, 'producto 5')
    expect(lote.length).toBeGreaterThan(0)
    expect(lote.length).toBeLessThan(muchos.length)
    expect(lote.every((c) => c.codigo && c.descripcion && c.unidad)).toBe(true)
  })

  it('envía el catálogo activo completo cuando el término está vacío', () => {
    const indice = crearIndice(muchos)
    const lote = construirLoteDeCandidatos(indice, '')
    expect(lote).toHaveLength(muchos.length)
  })
})
