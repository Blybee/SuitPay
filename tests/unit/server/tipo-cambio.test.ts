import { describe, expect, it } from 'vitest'
import {
  consultarTipoCambioSunat,
  resolverTiposDeCambio,
} from '../../../src/server/compras/tipo-cambio.ts'
import type {
  AlmacenDeTipoCambio,
  TipoCambioGuardado,
} from '../../../src/server/compras/tipo-cambio.ts'

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status })
}

describe('consultarTipoCambioSunat', () => {
  it('devuelve la venta de la fecha pedida', async () => {
    let pedido = ''
    const fetchMock: typeof fetch = async (input) => {
      pedido = String(input)
      return respuesta(200, {
        origen: 'SUNAT',
        compra: 3.441,
        venta: 3.45,
        moneda: 'USD',
        fecha: '2026-09-30',
      })
    }
    const consulta = await consultarTipoCambioSunat('2026-09-30', fetchMock)
    expect(consulta).toEqual({
      ok: true,
      venta: 3.45,
      fechaPublicada: '2026-09-30',
    })
    expect(pedido).toContain('fecha=2026-09-30')
  })

  it('una fecha futura o inválida para la API es 404', async () => {
    const fetchMock: typeof fetch = async () => respuesta(404, {})
    const consulta = await consultarTipoCambioSunat('2099-01-01', fetchMock)
    expect(consulta).toEqual({ ok: false, motivo: 'no_publicado' })
  })

  it('un 429 no se guarda en caché', async () => {
    const fetchMock: typeof fetch = async () => respuesta(429, {})
    const guardados: TipoCambioGuardado[] = []
    const almacen: AlmacenDeTipoCambio = {
      async leer() {
        return null
      },
      async guardar(valor) {
        guardados.push(valor)
      },
    }
    const resultado = await resolverTiposDeCambio(['2026-09-30'], {
      almacen,
      fetchImpl: fetchMock,
    })
    expect(resultado.fallos).toEqual([
      { fecha: '2026-09-30', motivo: 'limite' },
    ])
    expect(guardados).toEqual([])
  })

  it('si la fecha ya está cacheada no vuelve a llamar', async () => {
    let llamadas = 0
    const fetchMock: typeof fetch = async () => {
      llamadas += 1
      return respuesta(500, {})
    }
    const almacen: AlmacenDeTipoCambio = {
      async leer(fecha) {
        return { fecha, venta: 3.45, fechaPublicada: fecha }
      },
      async guardar() {
        throw new Error('no debía escribir')
      },
    }
    const resultado = await resolverTiposDeCambio(['2026-09-30'], {
      almacen,
      fetchImpl: fetchMock,
    })
    expect(llamadas).toBe(0)
    expect(resultado.tipos).toEqual([
      { fecha: '2026-09-30', venta: 3.45, fechaPublicada: '2026-09-30' },
    ])
  })

  it('un timeout corto termina en sin_respuesta', async () => {
    const fetchMock: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolver, rechazar) => {
        init?.signal?.addEventListener('abort', () => {
          rechazar(new DOMException('aborted', 'AbortError'))
        })
      })
    const consulta = await consultarTipoCambioSunat('2026-09-30', fetchMock, 15)
    expect(consulta).toEqual({ ok: false, motivo: 'sin_respuesta' })
  })
})
