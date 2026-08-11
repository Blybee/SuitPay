import { describe, expect, it } from 'vitest'
import {
  comienzoDelDiaEnLima,
  diaEnLima,
  finExclusivoDelDiaEnLima,
} from '../../../src/domain/anulacion/ventana.ts'
import { AlmacenEnMemoria } from '../../../src/server/emision/almacen-memoria.ts'
import type { Comprobante } from '../../../src/server/emision/almacen.ts'

function stub(
  parcial: Partial<Comprobante> & Pick<Comprobante, 'id'>,
): Comprobante {
  return {
    estado: 'aceptado',
    tipoDocumento: 'boleta',
    serie: 'B001',
    numero: 1,
    cliente: null,
    lineas: [],
    total: 100,
    condicionPago: {
      tipo: 'contado',
      fechaVencimiento: null,
      estadoCobro: 'no_aplica',
    },
    medioPago: null,
    vendedorId: 'vendedor-a',
    emitidoEn: new Date(),
    proveedor: null,
    anulacion: null,
    cotizacionId: null,
    capturaId: null,
    intentos: [],
    contacto: null,
    ...parcial,
  }
}

describe('listarComprobantes filtros (memoria)', () => {
  it('no filtra por emisor: documentos de A y B aparecen juntos', async () => {
    const almacen = new AlmacenEnMemoria()
    const hoy = diaEnLima(new Date())
    const emitidoEn = new Date(comienzoDelDiaEnLima(hoy).getTime() + 12 * 3600_000)

    almacen.sembrarComprobante(
      stub({
        id: 'c-a',
        vendedorId: 'vendedor-a',
        serie: 'B001',
        numero: 1,
        emitidoEn,
      }),
    )
    almacen.sembrarComprobante(
      stub({
        id: 'c-b',
        vendedorId: 'vendedor-b',
        serie: 'B001',
        numero: 2,
        emitidoEn: new Date(emitidoEn.getTime() + 1000),
      }),
    )

    const pagina = await almacen.listarComprobantes({
      emitidoDesde: comienzoDelDiaEnLima(hoy),
      emitidoHastaExclusivo: finExclusivoDelDiaEnLima(hoy),
      limite: 20,
    })

    expect(pagina.items.map((c) => c.id).sort()).toEqual(['c-a', 'c-b'])
  })

  it('filtra por cliente (AND con rango)', async () => {
    const almacen = new AlmacenEnMemoria()
    const hoy = diaEnLima(new Date())
    const emitidoEn = new Date(comienzoDelDiaEnLima(hoy).getTime() + 12 * 3600_000)

    almacen.sembrarComprobante(
      stub({
        id: 'c-1',
        emitidoEn,
        cliente: {
          tipoDocumento: '1',
          numeroDocumento: '12345678',
          denominacion: 'Cliente Uno',
          direccion: null,
          eventual: false,
        },
      }),
    )
    almacen.sembrarComprobante(
      stub({
        id: 'c-2',
        emitidoEn: new Date(emitidoEn.getTime() + 1000),
        serie: 'B001',
        numero: 9,
        cliente: {
          tipoDocumento: '6',
          numeroDocumento: '20123456789',
          denominacion: 'Otro',
          direccion: null,
          eventual: false,
        },
      }),
    )

    const pagina = await almacen.listarComprobantes({
      emitidoDesde: comienzoDelDiaEnLima(hoy),
      emitidoHastaExclusivo: finExclusivoDelDiaEnLima(hoy),
      clienteNumeroDocumento: '12345678',
      limite: 20,
    })

    expect(pagina.items).toHaveLength(1)
    expect(pagina.items[0]?.id).toBe('c-1')
  })

  it('busca por serie y número exactos', async () => {
    const almacen = new AlmacenEnMemoria()
    almacen.sembrarComprobante(stub({ id: 'x', serie: 'F100', numero: 61 }))

    const hallado = await almacen.buscarComprobantePorSerieNumero('F100', 61)
    expect(hallado?.id).toBe('x')
    expect(await almacen.buscarComprobantePorSerieNumero('F100', 99)).toBe(
      undefined,
    )
  })
})
