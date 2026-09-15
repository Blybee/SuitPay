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

  it('consume deudas seleccionadas sin vaciar el pedido vivo', async () => {
    const { almacen, contexto } = montarEscenario()
    almacen.sembrarCotizacion({
      id: 'cot-vecino',
      estado: 'pendiente',
      canal: 'vecino',
      generacionPedido: 4,
      totalDeudas: 5_000,
    })
    almacen.sembrarDeuda('cot-vecino', {
      fecha: '2026-09-12',
      total: 2_500,
      generacion: 0,
    })
    almacen.sembrarDeuda('cot-vecino', {
      fecha: '2026-09-13',
      total: 2_500,
      generacion: 0,
    })

    const primero = await emitirComprobante(
      contexto,
      peticion({
        claveIdempotencia: 'clave-deuda-a',
        cotizacionId: 'cot-vecino',
        generacionPedido: null,
        fechasDeuda: [{ fecha: '2026-09-12', generacion: 0 }],
      }),
    )
    expect(primero.comprobanteId).toBe('clave-deuda-a')
    expect(almacen.deudaPorDia('cot-vecino', '2026-09-12')).toBeUndefined()
    expect(almacen.deudaPorDia('cot-vecino', '2026-09-13')?.total).toBe(2_500)
    expect(almacen.cotizacionPorId('cot-vecino')).toMatchObject({
      generacionPedido: 4,
      totalDeudas: 2_500,
    })

    await expect(
      emitirComprobante(
        contexto,
        peticion({
          claveIdempotencia: 'clave-deuda-b',
          cotizacionId: 'cot-vecino',
          fechasDeuda: [{ fecha: '2026-09-12', generacion: 0 }],
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'cotizacion_ya_usada' })
  })

  it('reintento con la misma clave no vuelve a exigir la deuda', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    almacen.sembrarCotizacion({
      id: 'cot-vecino',
      estado: 'pendiente',
      canal: 'vecino',
      generacionPedido: 1,
      totalDeudas: 2_500,
    })
    almacen.sembrarDeuda('cot-vecino', {
      fecha: '2026-09-12',
      total: 2_500,
      generacion: 0,
    })
    const peticionDeVenta = peticion({
      claveIdempotencia: 'clave-deuda-red',
      cotizacionId: 'cot-vecino',
      fechasDeuda: [{ fecha: '2026-09-12', generacion: 0 }],
    })
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })
    await expect(
      emitirComprobante(contexto, peticionDeVenta),
    ).rejects.toMatchObject({ codigo: 'emision_indeterminada' })
    expect(almacen.deudaPorDia('cot-vecino', '2026-09-12')).toBeUndefined()

    proveedor.configurarEmision({ tipo: 'exito' })
    const segunda = await emitirComprobante(contexto, peticionDeVenta)
    expect(segunda.yaExistia).toBe(true)
    expect(almacen.totalDeComprobantes).toBe(1)
  })

  it('fallo del proveedor deja la deuda consumida y el reintento usa la misma clave', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    almacen.sembrarCotizacion({
      id: 'cot-vecino',
      estado: 'pendiente',
      canal: 'vecino',
      generacionPedido: 1,
      totalDeudas: 2_500,
    })
    almacen.sembrarDeuda('cot-vecino', {
      fecha: '2026-09-12',
      total: 2_500,
      generacion: 0,
    })
    const peticionDeVenta = peticion({
      claveIdempotencia: 'clave-deuda-caida',
      cotizacionId: 'cot-vecino',
      fechasDeuda: [{ fecha: '2026-09-12', generacion: 0 }],
    })
    proveedor.configurarEmision({ tipo: 'indisponible' })
    await expect(
      emitirComprobante(contexto, peticionDeVenta),
    ).rejects.toMatchObject({ codigo: 'proveedor_no_disponible' })
    expect(almacen.deudaPorDia('cot-vecino', '2026-09-12')).toBeUndefined()

    proveedor.configurarEmision({ tipo: 'exito' })
    const segunda = await emitirComprobante(contexto, peticionDeVenta)
    expect(segunda.estado).toMatch(/enviado|aceptado/)
    expect(almacen.deudaPorDia('cot-vecino', '2026-09-12')).toBeUndefined()
    expect(almacen.totalDeComprobantes).toBe(1)
  })
})
