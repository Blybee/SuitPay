import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../src/server/emision/emitir.ts'
import { emitirGuia } from '../../src/server/emision/emitir-guia.ts'
import { anularComprobante } from '../../src/server/emision/anular.ts'
import { montarEscenario, peticion } from '../unit/server/ayudas-emision.ts'
import { peticionGuia, trasladoPublico } from '../unit/server/guia-frontera.test.ts'

describe('constitución — anulación en cascada bidireccional', () => {
  async function parAsociado() {
    const escenario = montarEscenario({ series: ['boleta', 'guia'] })
    const boleta = await emitirComprobante(escenario.contexto, peticion())
    const guia = await emitirGuia(
      escenario.contexto,
      peticionGuia({ comprobanteOrigenId: boleta.comprobanteId }),
    )
    return { ...escenario, boleta, guia }
  }

  it('anular la boleta anula la guía; el segundo intento es no-op', async () => {
    const { almacen, proveedor, contexto, boleta, guia } = await parAsociado()

    const primera = await anularComprobante(contexto, {
      comprobanteId: boleta.comprobanteId,
      motivo: 'Error de cliente en mostrador',
      autorId: 'vendedor-1',
    })
    expect(primera.parAnuladoId).toBe(guia.comprobanteId)
    expect(proveedor.llamadasA('anular')).toBe(2)

    const origen = await almacen.leerComprobante(boleta.comprobanteId)
    const asociada = await almacen.leerComprobante(guia.comprobanteId)
    expect(origen?.estado).toBe('anulado')
    expect(asociada?.estado).toBe('anulado')
    expect(asociada?.anulacion?.autor).toBe('vendedor-1')

    await anularComprobante(contexto, {
      comprobanteId: boleta.comprobanteId,
      motivo: 'Segundo intento',
      autorId: 'vendedor-1',
    })
    expect(proveedor.llamadasA('anular')).toBe(2)
  })

  it('anular la guía anula la boleta', async () => {
    const { almacen, proveedor, contexto, boleta, guia } = await parAsociado()
    await anularComprobante(contexto, {
      comprobanteId: guia.comprobanteId,
      motivo: 'Guía mal dirigida a provincia',
      autorId: 'vendedor-1',
    })
    expect(proveedor.llamadasA('anular')).toBe(2)
    expect((await almacen.leerComprobante(boleta.comprobanteId))?.estado).toBe(
      'anulado',
    )
    expect((await almacen.leerComprobante(guia.comprobanteId))?.estado).toBe(
      'anulado',
    )
  })

  it('respuesta ausente no presenta el par como anulado', async () => {
    const { almacen, proveedor, contexto, boleta, guia } = await parAsociado()
    proveedor.configurarAnulacion({ tipo: 'indeterminado' })
    await expect(
      anularComprobante(contexto, {
        comprobanteId: boleta.comprobanteId,
        motivo: 'Intento con proveedor mudo',
        autorId: 'vendedor-1',
      }),
    ).rejects.toMatchObject({ codigo: 'emision_indeterminada' })

    expect((await almacen.leerComprobante(boleta.comprobanteId))?.estado).not.toBe(
      'anulado',
    )
    expect((await almacen.leerComprobante(guia.comprobanteId))?.estado).not.toBe(
      'anulado',
    )
  })

  it('fallo del proveedor no anula el par', async () => {
    const { almacen, proveedor, contexto, boleta } = await parAsociado()
    proveedor.configurarAnulacion({ tipo: 'rechazo_definitivo' })
    await expect(
      anularComprobante(contexto, {
        comprobanteId: boleta.comprobanteId,
        motivo: 'Proveedor rechaza la baja',
        autorId: 'vendedor-1',
      }),
    ).rejects.toMatchObject({ codigo: 'emision_rechazada' })
    expect((await almacen.leerComprobante(boleta.comprobanteId))?.estado).not.toBe(
      'anulado',
    )
  })

  it('reintento tras indisponible acaba anulando ambos', async () => {
    const { almacen, proveedor, contexto, boleta, guia } = await parAsociado()
    proveedor.configurarAnulacion({ tipo: 'indisponible' })
    await expect(
      anularComprobante(contexto, {
        comprobanteId: boleta.comprobanteId,
        motivo: 'Red caída al anular',
        autorId: 'vendedor-1',
      }),
    ).rejects.toMatchObject({ codigo: 'proveedor_no_disponible' })

    proveedor.configurarAnulacion({ tipo: 'exito' })
    await anularComprobante(contexto, {
      comprobanteId: boleta.comprobanteId,
      motivo: 'Red caída al anular',
      autorId: 'vendedor-1',
    })
    expect((await almacen.leerComprobante(boleta.comprobanteId))?.estado).toBe(
      'anulado',
    )
    expect((await almacen.leerComprobante(guia.comprobanteId))?.estado).toBe(
      'anulado',
    )
  })

  it('guía de traslado sin par se anula sola', async () => {
    const { contexto, proveedor, almacen } = montarEscenario({
      series: ['guia'],
    })
    const guia = await emitirGuia(
      contexto,
      peticionGuia({
        destinatario: null,
        traslado: trasladoPublico({
          motivoTraslado: 'entre_almacenes',
          direccionPartida: {
            ubigeo: '150101',
            direccion: 'A',
            anexo: '0001',
          },
          direccionLlegada: {
            ubigeo: '150101',
            direccion: 'B',
            anexo: '0002',
          },
        }),
      }),
    )
    await anularComprobante(contexto, {
      comprobanteId: guia.comprobanteId,
      motivo: 'Traslado cancelado en almacén',
      autorId: 'vendedor-1',
    })
    expect(proveedor.llamadasA('anular')).toBe(1)
    expect((await almacen.leerComprobante(guia.comprobanteId))?.estado).toBe(
      'anulado',
    )
  })
})
