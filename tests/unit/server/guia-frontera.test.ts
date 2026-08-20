import { describe, expect, it } from 'vitest'
import { emitirGuia } from '../../../src/server/emision/emitir-guia.ts'
import type { PeticionDeEmitirGuia } from '../../../src/server/emision/emitir-guia.ts'
import { montarEscenario } from './ayudas-emision.ts'
import type { TrasladoDeGuia } from '../../../src/domain/guia/tipos.ts'

export function trasladoPublico(
  cambios: Partial<TrasladoDeGuia> = {},
): TrasladoDeGuia {
  return {
    modoTransporte: 'publico',
    motivoTraslado: 'venta',
    pesoBruto: 10,
    unidadPeso: 'KGM',
    numeroBultos: 1,
    direccionPartida: { ubigeo: '150101', direccion: 'Av. Partida 1' },
    direccionLlegada: { ubigeo: '150203', direccion: 'Jr. Llegada 9' },
    transportista: {
      numeroDocumento: '20123456789',
      denominacion: 'TRANSPORTES DEMO S.A.C.',
    },
    items: [
      { codigo: 'TUB-1-2', cantidad: 2, descripcion: 'TUBO PVC', unidad: 'UND' },
    ],
    ...cambios,
  }
}

let n = 0
export function peticionGuia(
  cambios: Partial<PeticionDeEmitirGuia> = {},
): PeticionDeEmitirGuia {
  n += 1
  return {
    claveIdempotencia: `guia-${n}-${Date.now()}`,
    destinatario: {
      tipoDocumento: 'RUC',
      numeroDocumento: '20512345678',
      denominacion: 'FERRETERIA DESTINO S.A.C.',
    },
    traslado: trasladoPublico(),
    comprobanteOrigenId: null,
    ...cambios,
  }
}

describe('frontera emitirGuiaRemision (simulado)', () => {
  it('emite las tres modalidades', async () => {
    const { contexto, proveedor } = montarEscenario({
      series: ['guia'],
    })

    await emitirGuia(contexto, peticionGuia())
    await emitirGuia(
      contexto,
      peticionGuia({
        traslado: trasladoPublico({
          modoTransporte: 'privado',
          transportista: undefined,
          conductor: {
            tipoDocumento: 'DNI',
            numeroDocumento: '12345678',
            nombres: 'PEREZ',
            licencia: 'Q1',
            placa: 'ABC-123',
          },
        }),
      }),
    )
    await emitirGuia(
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

    expect(proveedor.llamadasA('emitir_guia')).toBe(3)
    expect(proveedor.documentosEmitidos).toBe(3)
  })

  it('clasifica rechazo, indisponible e indeterminado', async () => {
    const { contexto, proveedor } = montarEscenario({ series: ['guia'] })

    proveedor.configurarEmision({ tipo: 'rechazo_definitivo' })
    await expect(emitirGuia(contexto, peticionGuia())).rejects.toMatchObject({
      codigo: 'emision_rechazada',
    })

    proveedor.configurarEmision({ tipo: 'indisponible' })
    await expect(emitirGuia(contexto, peticionGuia())).rejects.toMatchObject({
      codigo: 'proveedor_no_disponible',
    })

    proveedor.configurarEmision({ tipo: 'indeterminado' })
    await expect(emitirGuia(contexto, peticionGuia())).rejects.toMatchObject({
      codigo: 'emision_indeterminada',
    })
  })
})
