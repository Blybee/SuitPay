import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../src/server/emision/emitir.ts'
import { anularComprobante } from '../../src/server/emision/anular.ts'
import {
  montarEscenario,
  peticion,
  VENDEDOR,
} from '../unit/server/ayudas-emision.ts'

/**
 * T155 / SC-011: toda emisión, anulación e intento fallido queda atribuido
 * a un vendedor y a un momento.
 */

describe('trazabilidad de emisión y anulación', () => {
  it('la emisión guarda vendedor y momento', async () => {
    const { contexto, almacen } = montarEscenario()
    const ahora = contexto.ahora?.() ?? new Date()
    const respuesta = await emitirComprobante(
      contexto,
      peticion({ claveIdempotencia: 'clave-traza-ok' }),
    )
    const doc = await almacen.leerComprobante(respuesta.comprobanteId)
    expect(doc?.vendedorId).toBe(VENDEDOR)
    expect(doc?.emitidoEn.getTime()).toBe(ahora.getTime())
  })

  it('un intento fallido queda en el rastro con momento', async () => {
    const { contexto, almacen, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })
    await expect(
      emitirComprobante(
        contexto,
        peticion({ claveIdempotencia: 'clave-traza-fallo' }),
      ),
    ).rejects.toMatchObject({ codigo: 'emision_rechazada' })
    const doc = await almacen.leerComprobante('clave-traza-fallo')
    expect(doc?.vendedorId).toBe(VENDEDOR)
    expect(doc?.intentos.length).toBeGreaterThan(0)
    expect(doc?.intentos[0]?.momento).toBeInstanceOf(Date)
    expect(doc?.intentos[0]?.resultado).not.toBe('exito')
  })

  it('la anulación registra autor y momento', async () => {
    const { contexto, almacen } = montarEscenario()
    const emitido = await emitirComprobante(
      contexto,
      peticion({ claveIdempotencia: 'clave-traza-anular' }),
    )
    await anularComprobante(contexto, {
      comprobanteId: emitido.comprobanteId,
      motivo: 'Error de captura en mostrador',
      autorId: VENDEDOR,
    })
    const doc = await almacen.leerComprobante(emitido.comprobanteId)
    expect(doc?.anulacion?.autor).toBe(VENDEDOR)
    expect(doc?.anulacion?.momento).toBeInstanceOf(Date)
    expect(doc?.anulacion?.motivo.length).toBeGreaterThan(3)
  })
})
