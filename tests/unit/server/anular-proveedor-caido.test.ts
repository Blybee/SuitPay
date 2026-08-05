import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { anularComprobante } from '../../../src/server/emision/anular.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * T097 — si el proveedor no confirma la baja, el comprobante NO queda anulado
 * localmente. Cubierta: indisponible, indeterminado y rechazo.
 */
describe('fallo del proveedor al anular', () => {
  it('no anula localmente si el proveedor está indisponible', async () => {
    const { almacen, proveedor, contexto } = montarEscenario()
    const emitido = await emitirComprobante(contexto, peticion())
    proveedor.configurarAnulacion({ tipo: 'indisponible' })

    await expect(
      anularComprobante(contexto, {
        comprobanteId: emitido.comprobanteId,
        motivo: 'Dato incorrecto en la línea 1',
        autorId: 'vendedor-1',
      }),
    ).rejects.toMatchObject({ codigo: 'proveedor_no_disponible' })

    const actual = await almacen.leerComprobante(emitido.comprobanteId)
    expect(actual?.estado).toBe('aceptado')
    expect(actual?.anulacion).toBeNull()
    expect(proveedor.llamadasA('anular')).toBe(1)
  })

  it('no anula localmente ante respuesta ausente (indeterminado)', async () => {
    const { almacen, proveedor, contexto } = montarEscenario()
    const emitido = await emitirComprobante(contexto, peticion())
    proveedor.configurarAnulacion({ tipo: 'acepta_pero_no_contesta' })

    await expect(
      anularComprobante(contexto, {
        comprobanteId: emitido.comprobanteId,
        motivo: 'Dato incorrecto en la línea 1',
        autorId: 'vendedor-1',
      }),
    ).rejects.toMatchObject({ codigo: 'emision_indeterminada' })

    const actual = await almacen.leerComprobante(emitido.comprobanteId)
    expect(actual?.estado).toBe('aceptado')
    expect(actual?.anulacion).toBeNull()
  })

  it('no anula localmente ante rechazo definitivo del proveedor', async () => {
    const { almacen, proveedor, contexto } = montarEscenario()
    const emitido = await emitirComprobante(contexto, peticion())
    proveedor.configurarAnulacion({ tipo: 'rechazo_definitivo' })

    await expect(
      anularComprobante(contexto, {
        comprobanteId: emitido.comprobanteId,
        motivo: 'Dato incorrecto en la línea 1',
        autorId: 'vendedor-1',
      }),
    ).rejects.toMatchObject({ codigo: 'emision_rechazada' })

    const actual = await almacen.leerComprobante(emitido.comprobanteId)
    expect(actual?.estado).toBe('aceptado')
    expect(actual?.anulacion).toBeNull()
  })
})
