import { describe, expect, it } from 'vitest'
import { serieEsValida, tieneValorTributario } from '#/domain/documentos/tipos.ts'
import { faltantesDelTraslado, trasladoEsEmitible } from '#/domain/guia/validar.ts'
import type { TrasladoDeGuia } from '#/domain/guia/tipos.ts'

function traslado(cambios: Partial<TrasladoDeGuia> = {}): TrasladoDeGuia {
  return {
    modoTransporte: 'publico',
    motivoTraslado: 'venta',
    pesoBruto: 12,
    unidadPeso: 'KGM',
    numeroBultos: 2,
    direccionPartida: { ubigeo: '150101', direccion: 'Av. Partida 1' },
    direccionLlegada: { ubigeo: '150203', direccion: 'Jr. Llegada 9' },
    transportista: {
      numeroDocumento: '20123456789',
      denominacion: 'TRANSPORTES DEMO S.A.C.',
    },
    items: [
      {
        codigo: 'TUB-1-2',
        cantidad: 2,
        descripcion: 'TUBO PVC',
        unidad: 'UND',
      },
    ],
    ...cambios,
  }
}

describe('guía de remisión — dominio', () => {
  it('la serie de guía lleva prefijo T', () => {
    expect(serieEsValida('guia', 'T001')).toBe(true)
    expect(serieEsValida('guia', 'B001')).toBe(false)
    expect(tieneValorTributario('guia')).toBe(true)
  })

  it('el transporte público exige transportista', () => {
    const sin = traslado({ transportista: undefined })
    expect(trasladoEsEmitible(sin)).toBe(false)
    expect(faltantesDelTraslado(sin).some((f) => f.campo === 'transportista')).toBe(
      true,
    )
  })

  it('el transporte privado exige conductor y placa', () => {
    const privado = traslado({
      modoTransporte: 'privado',
      transportista: undefined,
    })
    expect(trasladoEsEmitible(privado)).toBe(false)
    const completo = traslado({
      modoTransporte: 'privado',
      transportista: undefined,
      conductor: {
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        nombres: 'PEREZ JUAN',
        licencia: 'Q123',
        placa: 'ABC-123',
      },
    })
    expect(trasladoEsEmitible(completo)).toBe(true)
  })

  it('entre almacenes exige anexos', () => {
    const interno = traslado({ motivoTraslado: 'entre_almacenes' })
    expect(trasladoEsEmitible(interno)).toBe(false)
    const conAnexos = traslado({
      motivoTraslado: 'entre_almacenes',
      direccionPartida: {
        ubigeo: '150101',
        direccion: 'Almacén A',
        anexo: '0001',
      },
      direccionLlegada: {
        ubigeo: '150101',
        direccion: 'Almacén B',
        anexo: '0002',
      },
    })
    expect(trasladoEsEmitible(conAnexos)).toBe(true)
  })
})
