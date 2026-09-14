import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LineaDePedido } from '../../../src/domain/totales/calculo.ts'
import { pintarListaDeVecino } from '../../../src/features/vecinos/captura.ts'

const CABECERA = 72
const FILA = 36
const PIE = 64
const ESCALA = 2

function altoEsperado(n: number): number {
  return (CABECERA + n * FILA + PIE) * ESCALA
}

function linea(indice: number): LineaDePedido {
  return {
    codigo: `P${indice}`,
    descripcion: `Producto ${indice}`,
    unidad: 'NIU',
    cantidad: 1,
    precio: 100,
  }
}

function contextoFalso(): CanvasRenderingContext2D {
  return {
    scale: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    font: '',
  } as unknown as CanvasRenderingContext2D
}

describe('pintarListaDeVecino', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('el alto del lienzo crece con cada línea, no con el viewport', async () => {
    const alturas: number[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => contextoFalso(),
    )
    HTMLCanvasElement.prototype.toBlob = function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      alturas.push(this.height)
      callback(new Blob(['png'], { type: 'image/png' }))
    }

    await pintarListaDeVecino({
      titulo: 'Pedido',
      lineas: [linea(1)],
      total: 100,
    })
    await pintarListaDeVecino({
      titulo: 'Pedido',
      lineas: [linea(1), linea(2), linea(3)],
      total: 300,
    })

    expect(alturas[0]).toBe(altoEsperado(1))
    expect(alturas[1]).toBe(altoEsperado(3))
    expect(alturas[1]).toBe((72 + 3 * 36 + 64) * 2)
  })
})
