import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { anularComprobante } from '../../../src/server/emision/anular.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * T096 — ventana de anulación en horario de Lima (FR-037, FR-038).
 *
 * Un comprobante de ayer se rechaza; uno emitido a las 19:00 Lima sigue
 * anulable esa misma noche civil, aunque en UTC ya sea "mañana".
 */
describe('ventana de anulación', () => {
  it('rechaza un comprobante de ayer con fuera_de_ventana_anulacion', async () => {
    const emitidoEn = new Date('2026-07-27T15:00:00.000Z') // 10:00 Lima del 27
    const ahora = new Date('2026-07-28T15:00:00.000Z') // 10:00 Lima del 28
    const { proveedor, contexto } = montarEscenario({ momento: emitidoEn })

    const emitido = await emitirComprobante(contexto, peticion())
    expect(emitido.estado).toBe('aceptado')

    const contextoHoy = { ...contexto, ahora: () => ahora }

    await expect(
      anularComprobante(contextoHoy, {
        comprobanteId: emitido.comprobanteId,
        motivo: 'Error de tipografía en la razón social',
        autorId: 'vendedor-1',
      }),
    ).rejects.toMatchObject({ codigo: 'fuera_de_ventana_anulacion' })

    expect(proveedor.llamadasA('anular')).toBe(0)
  })

  it('permite anular a las 19:00 Lima el mismo día civil (caso UTC)', async () => {
    // 19:00 del 28 en Lima = 00:00 UTC del 29. Si se mirara UTC, parecería otro día.
    const emitidoEn = new Date('2026-07-29T00:00:00.000Z')
    const ahora = new Date('2026-07-29T03:00:00.000Z') // 22:00 Lima del 28
    const { proveedor, contexto } = montarEscenario({ momento: emitidoEn })

    const emitido = await emitirComprobante(contexto, peticion())
    const contextoNoche = { ...contexto, ahora: () => ahora }

    const anulacion = await anularComprobante(contextoNoche, {
      comprobanteId: emitido.comprobanteId,
      motivo: 'Cliente pidió boleta en lugar de factura',
      autorId: 'vendedor-1',
    })

    expect(anulacion.estado).toBe('anulado')
    expect(proveedor.llamadasA('anular')).toBe(1)
  })
})
