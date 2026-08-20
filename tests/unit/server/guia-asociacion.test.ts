import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { emitirGuia } from '../../../src/server/emision/emitir-guia.ts'
import {
  CLIENTE_IDENTIFICADO,
  montarEscenario,
  peticion,
} from './ayudas-emision.ts'
import { peticionGuia, trasladoPublico } from './guia-frontera.test.ts'

describe('asociación 1:1 boleta/factura ↔ guía', () => {
  it('escribe el par al emitir guía desde boleta y no altera el origen', async () => {
    const { almacen, contexto } = montarEscenario({
      series: ['boleta', 'guia'],
    })
    const boleta = await emitirComprobante(
      contexto,
      peticion({ cliente: CLIENTE_IDENTIFICADO }),
    )
    const origenAntes = await almacen.leerComprobante(boleta.comprobanteId)

    const guia = await emitirGuia(
      contexto,
      peticionGuia({ comprobanteOrigenId: boleta.comprobanteId }),
    )

    const origen = await almacen.leerComprobante(boleta.comprobanteId)
    const emitida = await almacen.leerComprobante(guia.comprobanteId)
    expect(origen?.guiaAsociadaId).toBe(guia.comprobanteId)
    expect(emitida?.comprobanteOrigenId).toBe(boleta.comprobanteId)
    expect(origen?.lineas).toEqual(origenAntes?.lineas)
    expect(origen?.total).toBe(origenAntes?.total)
    expect(origen?.estado).toBe(origenAntes?.estado)
  })

  it('rechaza una segunda guía vigente sobre el mismo origen', async () => {
    const { contexto } = montarEscenario({ series: ['boleta', 'guia'] })
    const boleta = await emitirComprobante(contexto, peticion())
    await emitirGuia(
      contexto,
      peticionGuia({ comprobanteOrigenId: boleta.comprobanteId }),
    )
    await expect(
      emitirGuia(
        contexto,
        peticionGuia({ comprobanteOrigenId: boleta.comprobanteId }),
      ),
    ).rejects.toMatchObject({ codigo: 'guia_asociada_existente' })
  })

  it('la nota de venta no escribe el par', async () => {
    const { almacen, contexto } = montarEscenario({ series: ['guia'] })
    const nv = await emitirComprobante(
      contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )
    const guia = await emitirGuia(
      contexto,
      peticionGuia({ comprobanteOrigenId: nv.comprobanteId }),
    )
    const origen = await almacen.leerComprobante(nv.comprobanteId)
    const emitida = await almacen.leerComprobante(guia.comprobanteId)
    expect(origen?.guiaAsociadaId ?? null).toBeNull()
    expect(emitida?.comprobanteOrigenId ?? null).toBeNull()
  })

  it('traslado entre almacenes se emite sin par', async () => {
    const { almacen, contexto } = montarEscenario({ series: ['guia'] })
    const guia = await emitirGuia(
      contexto,
      peticionGuia({
        destinatario: null,
        comprobanteOrigenId: null,
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
    const emitida = await almacen.leerComprobante(guia.comprobanteId)
    expect(emitida?.comprobanteOrigenId ?? null).toBeNull()
  })
})
