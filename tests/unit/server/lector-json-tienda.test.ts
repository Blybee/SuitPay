import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  aCentimos,
  interpretarJsonDeTienda,
} from '../../../src/server/catalogo/lector-json.ts'

const muestra = readFileSync(
  resolve('tests/fixtures/productos-tienda-muestra.json'),
  'utf8',
)

describe('interpretarJsonDeTienda', () => {
  it('expande variantes como productos distintos con su wholesale', () => {
    const productos = interpretarJsonDeTienda(muestra)
    const valvulas = productos.filter((p) =>
      p.descripcion.includes('VALVULA ESFER. BRC. P/ ROJA'),
    )

    expect(valvulas.length).toBe(3)
    expect(valvulas.map((p) => p.precio).sort((a, b) => a - b)).toEqual([
      850, 1200, 1800,
    ])
    expect(valvulas.every((p) => p.descripcion.startsWith('Valmax '))).toBe(
      true,
    )
    expect(valvulas.every((p) => p.codigo.includes('__'))).toBe(true)
  })

  it('un producto sin variantes usa unitConfig.wholesale y el id como código', () => {
    const productos = interpretarJsonDeTienda(muestra)
    const manubrio = productos.find((p) =>
      p.descripcion.includes('MANUBRIO CROMADO'),
    )

    expect(manubrio).toMatchObject({
      codigo: 'dgx2LBlzoDHnW3ib9E6e',
      descripcion: 'Fipalsa MANUBRIO CROMADO CON VARA DE BRONCE',
      unidad: 'NIU',
      precio: 650,
      activo: true,
      marca: 'Fipalsa',
    })
  })

  it('si hay variantes ignora el unitConfig del padre', () => {
    const productos = interpretarJsonDeTienda(muestra)
    // Uc3K9mpXCVvPKfgcikTP tiene unitConfig en 0 y una variante con wholesale 3
    const adaptador = productos.filter((p) =>
      p.codigo.startsWith('Uc3K9mpXCVvPKfgcikTP'),
    )

    expect(adaptador).toHaveLength(1)
    expect(adaptador[0]?.precio).toBe(300)
    expect(adaptador[0]?.descripcion).toContain('1/2"')
  })

  it('no embebe el precio en la descripción', () => {
    const productos = interpretarJsonDeTienda(muestra)
    for (const producto of productos) {
      expect(producto.descripcion).not.toMatch(/\b\d+\.\d+\b/)
      // Tampoco el wholesale en céntimos como cola suelta típica
      expect(producto.descripcion.endsWith(String(producto.precio))).toBe(false)
    }
  })

  it('convierte soles a céntimos; ausente → 0', () => {
    expect(aCentimos(6.5)).toBe(650)
    expect(aCentimos(8.5)).toBe(850)
    expect(aCentimos(undefined)).toBe(0)
    expect(aCentimos(Number.NaN)).toBe(0)
  })
})
