import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * Proveedor caído (FR-050 enmendado, decisión 10).
 */
describe('emisión con el proveedor caído', () => {
  it('deja la venta pendiente, no indeterminada', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'caido-1' })
    proveedor.configurarEmision({ tipo: 'indisponible' })

    await expect(emitirComprobante(contexto, p)).rejects.toMatchObject({
      codigo: 'proveedor_no_disponible',
    })

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.estado).toBe('pendiente')
    expect(proveedor.documentosEmitidos).toBe(0)
  })

  it('conserva el pedido completo para poder emitirlo después', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'caido-2' })
    proveedor.configurarEmision({ tipo: 'indisponible' })

    await expect(emitirComprobante(contexto, p)).rejects.toThrow()

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.lineas).toHaveLength(1)
    expect(comprobante?.total).toBe(2_500)
    expect(comprobante?.serie).toBe('B001')
    expect(comprobante?.numero).toBe(1)
  })

  it('el mensaje pide reintentar, no datos de contacto ni documento interno', async () => {
    const { contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'caido-3' })
    proveedor.configurarEmision({ tipo: 'indisponible' })

    try {
      await emitirComprobante(contexto, p)
      expect.unreachable()
    } catch (error) {
      const mensaje = (error as { mensajeParaVendedor: string })
        .mensajeParaVendedor
      expect(mensaje).toMatch(/inténtalo de nuevo/i)
      expect(mensaje).not.toMatch(/contacto/i)
      expect(mensaje).not.toMatch(/documento interno/i)
    }
  })

  it('no propaga el mensaje crudo del proveedor', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'caido-4' })
    proveedor.configurarEmision({ tipo: 'indisponible' })

    let mensajeMostrado = ''
    try {
      await emitirComprobante(contexto, p)
    } catch (error) {
      mensajeMostrado = (error as { mensajeParaVendedor: string })
        .mensajeParaVendedor
    }

    expect(mensajeMostrado).not.toContain('fetch failed')

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.intentos[0]?.rastro?.mensajeOriginal).toBe(
      'fetch failed',
    )
  })

  it('el reintento manual con la misma clave vuelve a invocar al proveedor', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    const p = peticion({ claveIdempotencia: 'caido-reintento' })
    proveedor.configurarEmision({ tipo: 'indisponible' })

    await expect(emitirComprobante(contexto, p)).rejects.toThrow()
    expect(proveedor.documentosEmitidos).toBe(0)

    proveedor.configurarEmision({ tipo: 'exito' })
    const segunda = await emitirComprobante(contexto, p)

    expect(segunda.estado).toMatch(/enviado|aceptado/)
    expect(proveedor.documentosEmitidos).toBe(1)
    expect(almacen.todosLosComprobantes()[0]?.estado).toMatch(/enviado|aceptado/)
  })
})
