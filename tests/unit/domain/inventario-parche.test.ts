import { describe, expect, it } from 'vitest'
import { aplicarParcheDeInventario } from '../../../src/domain/inventario/parche.ts'
import { tieneControlDeCantidad } from '../../../src/domain/inventario/tipos.ts'
import type { Existencia } from '../../../src/domain/inventario/tipos.ts'

const momento = new Date('2026-09-19T12:00:00-05:00')

function base(cambios: Partial<Existencia> = {}): Existencia {
  return {
    codigo: 'TUB-1-2',
    cantidad: 10,
    maximo: 10,
    alerta: false,
    actualizadoPor: 'admin',
    actualizadoEn: momento,
    ...cambios,
  }
}

describe('aplicarParcheDeInventario', () => {
  it('fijar cantidad conserva el costo', () => {
    const siguiente = aplicarParcheDeInventario(
      base({ precioCompraCentimos: 1250, precioCompraEn: '2026-03-15' }),
      {
        codigo: 'TUB-1-2',
        cantidad: 4,
        autorId: 'admin',
        momento,
      },
    )
    expect(siguiente.cantidad).toBe(4)
    expect(siguiente.precioCompraCentimos).toBe(1250)
    expect(siguiente.precioCompraEn).toBe('2026-03-15')
  })

  it('fijar costo no inventa cantidad 0', () => {
    const siguiente = aplicarParcheDeInventario(null, {
      codigo: 'TUB-1-2',
      precioCompraCentimos: 800,
      precioCompraEn: '2026-01-02',
      autorId: 'admin',
      momento,
    })
    expect(siguiente.cantidad).toBeUndefined()
    expect(tieneControlDeCantidad(siguiente)).toBe(false)
    expect(siguiente.precioCompraCentimos).toBe(800)
    expect(siguiente.alerta).toBe(false)
  })

  it('null en precio borra costo y fecha', () => {
    const siguiente = aplicarParcheDeInventario(
      base({ precioCompraCentimos: 1250, precioCompraEn: '2026-03-15' }),
      {
        codigo: 'TUB-1-2',
        precioCompraCentimos: null,
        autorId: 'admin',
        momento,
      },
    )
    expect(siguiente.cantidad).toBe(10)
    expect(siguiente.precioCompraCentimos).toBeUndefined()
    expect(siguiente.precioCompraEn).toBeUndefined()
  })
})
