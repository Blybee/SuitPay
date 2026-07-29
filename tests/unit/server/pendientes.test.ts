import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { procesarPendientes } from '../../../src/server/emision/pendientes.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * La tarea que completa las ventas que esperaron.
 *
 * Reintentar aquí es seguro, y conviene tener claro por qué: `pendiente` significa
 * que **consta que no se emitió nada**. No es el caso indeterminado.
 *
 * La afirmación que más cuenta es la del rechazo tardío: acaba en
 * `requiere_intervencion` y no en `rechazado`, porque el cliente ya se fue con la
 * mercadería y no hay nadie a quien preguntar (FR-050b).
 */
describe('procesar ventas en espera', () => {
  async function ventaEnEspera() {
    const escenario = montarEscenario()
    escenario.proveedor.configurarEmision({ tipo: 'indisponible' })
    await expect(
      emitirComprobante(escenario.contexto, peticion()),
    ).rejects.toThrow()
    expect(escenario.almacen.todosLosComprobantes()[0]?.estado).toBe('pendiente')
    return escenario
  }

  it('completa la emisión cuando el proveedor vuelve', async () => {
    const { almacen, proveedor } = await ventaEnEspera()
    proveedor.configurarEmision({ tipo: 'exito' })

    const resumen = await procesarPendientes({
      almacen,
      proveedor,
      formatoImpresion: 'a4',
      ahora: () => new Date('2026-07-28T16:00:00Z'),
    })

    expect(resumen.emitidos).toBe(1)
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe('aceptado')
  })

  it('reutiliza el número reservado en la venta', async () => {
    // Pedir otro número dejaría el primero huérfano y abriría un hueco que no
    // hace falta: el que había quedó reservado precisamente para esto.
    const { almacen, proveedor } = await ventaEnEspera()
    const numeroReservado = almacen.todosLosComprobantes()[0]?.numero
    proveedor.configurarEmision({ tipo: 'exito' })

    await procesarPendientes({
      almacen,
      proveedor,
      formatoImpresion: 'a4',
      ahora: () => new Date('2026-07-28T16:00:00Z'),
    })

    expect(almacen.todosLosComprobantes()[0]?.numero).toBe(numeroReservado)
  })

  it('conserva la fecha original de la venta, no la de la emisión', async () => {
    // El documento tiene que llevar la fecha en que se cobró, que es la que el
    // cliente tiene escrita en su documento interno.
    const { almacen, proveedor } = await ventaEnEspera()
    proveedor.configurarEmision({ tipo: 'exito' })

    await procesarPendientes({
      almacen,
      proveedor,
      formatoImpresion: 'a4',
      ahora: () => new Date('2026-07-28T16:00:00Z'),
    })

    const comprobante = almacen.todosLosComprobantes()[0]
    expect(comprobante?.emitidoEn.toISOString()).toBe('2026-07-28T15:00:00.000Z')
  })

  it('un rechazo tardío va a intervención, no a rechazado', async () => {
    // La diferencia de fondo: un rechazo con el cliente delante lo resuelve el
    // vendedor corrigiendo; tres horas después, sin nadie a quien preguntar,
    // necesita una persona. Dejarlo como un rechazo más lo enterraría en una
    // lista que nadie mira.
    const { almacen, proveedor } = await ventaEnEspera()
    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })

    const resumen = await procesarPendientes({
      almacen,
      proveedor,
      formatoImpresion: 'a4',
      ahora: () => new Date('2026-07-28T18:00:00Z'),
    })

    expect(resumen.requierenIntervencion).toBe(1)
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe(
      'requiere_intervencion',
    )
    expect(almacen.todosLosComprobantes()[0]?.intentos.at(-1)?.razon).toBe(
      'rechazado_con_mercaderia_entregada',
    )
  })

  it('sigue en espera si el proveedor continúa caído', async () => {
    const { almacen, proveedor } = await ventaEnEspera()

    const resumen = await procesarPendientes({
      almacen,
      proveedor,
      formatoImpresion: 'a4',
      ahora: () => new Date('2026-07-28T16:00:00Z'),
    })

    expect(resumen.siguenPendientes).toBe(1)
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe('pendiente')
  })

  it('un indeterminado en el reintento sale del camino de emisión', async () => {
    // Si al completar la venta la respuesta se pierde, vuelve a aplicar la
    // prohibición: pasa a `indeterminado` y solo la reconciliación lo saca.
    const { almacen, proveedor } = await ventaEnEspera()
    proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })

    const resumen = await procesarPendientes({
      almacen,
      proveedor,
      formatoImpresion: 'a4',
      ahora: () => new Date('2026-07-28T16:00:00Z'),
    })

    expect(resumen.indeterminados).toBe(1)
    expect(almacen.todosLosComprobantes()[0]?.estado).toBe('indeterminado')
  })

  it('no vuelve a emitir una venta ya completada', async () => {
    const { almacen, proveedor } = await ventaEnEspera()
    proveedor.configurarEmision({ tipo: 'exito' })

    await procesarPendientes({
      almacen,
      proveedor,
      formatoImpresion: 'a4',
      ahora: () => new Date('2026-07-28T16:00:00Z'),
    })
    const llamadas = proveedor.llamadasA('emitir')

    // Segundo barrido: ya no hay nada pendiente.
    const segundo = await procesarPendientes({
      almacen,
      proveedor,
      formatoImpresion: 'a4',
      ahora: () => new Date('2026-07-28T16:05:00Z'),
    })

    expect(segundo.revisados).toBe(0)
    expect(proveedor.llamadasA('emitir')).toBe(llamadas)
    expect(proveedor.documentosEmitidos).toBe(1)
  })
})
