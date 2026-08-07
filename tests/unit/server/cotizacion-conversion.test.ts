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
})
