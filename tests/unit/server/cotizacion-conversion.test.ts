import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { esErrorDeSuitPay } from '../../../src/server/errores.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

describe('conversión de cotización en emisión', () => {
  it('borra la cotización y rechaza una segunda clave distinta', async () => {
    const { almacen, contexto } = montarEscenario()
    almacen.sembrarCotizacion({
      id: 'cot-1',
      estado: 'pendiente',
    })

    const primero = await emitirComprobante(
      contexto,
      peticion({
        claveIdempotencia: 'clave-a',
        cotizacionId: 'cot-1',
      }),
    )
    expect(primero.comprobanteId).toBe('clave-a')
    expect(almacen.cotizacionPorId('cot-1')).toBeUndefined()

    await expect(
      emitirComprobante(
        contexto,
        peticion({
          claveIdempotencia: 'clave-b',
          cotizacionId: 'cot-1',
        }),
      ),
    ).rejects.toMatchObject({
      codigo: 'cotizacion_ya_usada',
    })
  })

  it('rechaza cotización inexistente o no pendiente sin crear comprobante', async () => {
    const { almacen, contexto } = montarEscenario()

    await expect(
      emitirComprobante(
        contexto,
        peticion({
          claveIdempotencia: 'clave-fantasma',
          cotizacionId: 'no-existe',
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'cotizacion_ya_usada' })

    expect(almacen.totalDeComprobantes).toBe(0)

    almacen.sembrarCotizacion({
      id: 'cot-descartada',
      estado: 'descartada',
    })

    try {
      await emitirComprobante(
        contexto,
        peticion({
          claveIdempotencia: 'clave-descartada',
          cotizacionId: 'cot-descartada',
        }),
      )
      expect.unreachable()
    } catch (error) {
      expect(esErrorDeSuitPay(error)).toBe(true)
      if (esErrorDeSuitPay(error)) {
        expect(error.codigo).toBe('cotizacion_ya_usada')
      }
    }

    expect(almacen.totalDeComprobantes).toBe(0)
  })

  it('conserva al vecino, incrementa generación y rechaza la misma generación', async () => {
    const { almacen, contexto } = montarEscenario()
    almacen.sembrarCotizacion({
      id: 'cot-vecino',
      estado: 'pendiente',
      canal: 'vecino',
      generacionPedido: 0,
    })

    const primero = await emitirComprobante(
      contexto,
      peticion({
        claveIdempotencia: 'clave-vecino-a',
        cotizacionId: 'cot-vecino',
        generacionPedido: 0,
      }),
    )
    expect(primero.comprobanteId).toBe('clave-vecino-a')
    expect(almacen.cotizacionPorId('cot-vecino')).toMatchObject({
      estado: 'pendiente',
      canal: 'vecino',
      generacionPedido: 1,
    })

    await expect(
      emitirComprobante(
        contexto,
        peticion({
          claveIdempotencia: 'clave-vecino-b',
          cotizacionId: 'cot-vecino',
          generacionPedido: 0,
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'cotizacion_ya_usada' })

    const suelto = await emitirComprobante(
      contexto,
      peticion({
        claveIdempotencia: 'clave-vecino-nuevo',
        cotizacionId: null,
        generacionPedido: null,
      }),
    )
    expect(suelto.comprobanteId).toBe('clave-vecino-nuevo')
    expect(almacen.cotizacionPorId('cot-vecino')?.generacionPedido).toBe(1)
  })
})
