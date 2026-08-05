import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { anularComprobante } from '../../../src/server/emision/anular.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * T098 — anular dos veces el mismo comprobante no duplica la baja ni altera
 * el registro original (motivo, autor, momento de la primera).
 */
describe('idempotencia de la anulación', () => {
  it('la segunda anulación no vuelve a llamar al proveedor', async () => {
    const { almacen, proveedor, contexto } = montarEscenario()
    const emitido = await emitirComprobante(contexto, peticion())

    const primera = await anularComprobante(contexto, {
      comprobanteId: emitido.comprobanteId,
      motivo: 'Primera baja por error de importe',
      autorId: 'vendedor-1',
    })

    const segunda = await anularComprobante(contexto, {
      comprobanteId: emitido.comprobanteId,
      motivo: 'Segundo intento con otro motivo',
      autorId: 'vendedor-2',
    })

    expect(primera.yaEstabaAnulado).toBe(false)
    expect(segunda.yaEstabaAnulado).toBe(true)
    expect(proveedor.llamadasA('anular')).toBe(1)

    const actual = await almacen.leerComprobante(emitido.comprobanteId)
    expect(actual?.estado).toBe('anulado')
    expect(actual?.anulacion?.motivo).toBe('Primera baja por error de importe')
    expect(actual?.anulacion?.autor).toBe('vendedor-1')
    expect(segunda.anulacion.motivo).toBe(primera.anulacion.motivo)
  })
})
