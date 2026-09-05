import { describe, expect, it } from 'vitest'
import {
  deltasDeVenta,
  estaEnAlerta,
  maximoAlFijar,
  textoAvisoInventario,
  umbralEfectivo,
} from '../../../src/domain/inventario/reglas.ts'

describe('inventario orientativo', () => {
  it('umbral por omisión es 10% del máximo', () => {
    expect(umbralEfectivo(100, undefined)).toBe(10)
    expect(estaEnAlerta(9, 100)).toBe(true)
    expect(estaEnAlerta(10, 100)).toBe(false)
  })

  it('umbral explícito gana al 10%', () => {
    expect(estaEnAlerta(4, 100, 5)).toBe(true)
    expect(estaEnAlerta(5, 100, 5)).toBe(false)
  })

  it('maximo se fija en la primera escritura', () => {
    expect(maximoAlFijar(20, undefined)).toBe(20)
    expect(maximoAlFijar(3, 20)).toBe(20)
  })

  it('aviso de mostrador no habla de stock real y no bloquea', () => {
    expect(textoAvisoInventario(null)).toBeNull()
    expect(
      textoAvisoInventario({ cantidad: 10, alerta: false }),
    ).toBeNull()
    expect(textoAvisoInventario({ cantidad: 0, alerta: true })).toBe(
      'Cifra orientativa en 0. Se puede emitir.',
    )
    expect(textoAvisoInventario({ cantidad: 3, alerta: true })).toBe(
      'Cifra orientativa bajo umbral. Se puede emitir.',
    )
  })

  it('deltas de venta son negativos y agrupan códigos', () => {
    const deltas = deltasDeVenta([
      { codigo: 'A', cantidad: 2 },
      { codigo: 'A', cantidad: 1 },
      { codigo: 'B', cantidad: 4 },
    ])
    expect(deltas.get('A')).toBe(-3)
    expect(deltas.get('B')).toBe(-4)
  })
})
