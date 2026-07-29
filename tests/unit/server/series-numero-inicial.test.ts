import { describe, expect, it } from 'vitest'
import { AlmacenEnMemoria } from '../../../src/server/emision/almacen-memoria.ts'
import { idDeSerie } from '../../../src/server/emision/almacen.ts'
import { reclamarCorrelativo } from '../../../src/server/emision/series.ts'
import type { TransaccionDeEmision } from '../../../src/server/emision/almacen.ts'

/**
 * FR-031a: el origen del contador lo fija `numeroInicial`, no un cero implícito.
 */

async function conTransaccion<T>(
  almacen: AlmacenEnMemoria,
  trabajo: (tx: TransaccionDeEmision) => Promise<T>,
): Promise<T> {
  return almacen.enTransaccion(trabajo)
}

describe('numeroInicial de serie', () => {
  it('con origen 0, el primer reclamado es 0', async () => {
    const almacen = new AlmacenEnMemoria()
    almacen.sembrarSerie({
      id: idDeSerie('v1', 'factura'),
      serie: 'F001',
      tipoDocumento: 'factura',
      vendedorId: 'v1',
      numeroInicial: 0,
      ultimoNumero: -1,
      ultimoNumeroConfirmado: -1,
      activa: true,
    })

    const reclamado = await conTransaccion(almacen, (tx) =>
      reclamarCorrelativo(tx, 'v1', 'factura'),
    )

    expect(reclamado.numero).toBe(0)
    expect((await almacen.leerSerie(idDeSerie('v1', 'factura')))?.ultimoNumero).toBe(
      0,
    )
  })

  it('con origen 100, el primer reclamado es 100', async () => {
    const almacen = new AlmacenEnMemoria()
    almacen.sembrarSerie({
      id: idDeSerie('v1', 'factura'),
      serie: 'F002',
      tipoDocumento: 'factura',
      vendedorId: 'v1',
      numeroInicial: 100,
      ultimoNumero: 99,
      ultimoNumeroConfirmado: 99,
      activa: true,
    })

    const reclamado = await conTransaccion(almacen, (tx) =>
      reclamarCorrelativo(tx, 'v1', 'factura'),
    )

    expect(reclamado.numero).toBe(100)
  })
})
