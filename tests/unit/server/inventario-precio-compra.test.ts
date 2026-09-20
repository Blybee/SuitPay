import { describe, expect, it } from 'vitest'
import { AlmacenDeInventarioMemoria } from '../../../src/server/inventario/almacen-memoria.ts'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

describe('venta con documento solo de costo', () => {
  it('no inventa cantidad 0 ni descuenta', async () => {
    const escenario = montarEscenario({ series: ['nota_venta'] })
    escenario.inventario.sembrar({
      codigo: 'TUB-1-2',
      maximo: 0,
      alerta: false,
      precioCompraCentimos: 1250,
      actualizadoPor: 'admin',
      actualizadoEn: new Date(),
    })
    await emitirComprobante(
      escenario.contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )
    const leida = await escenario.inventario.leer('TUB-1-2')
    expect(leida?.cantidad).toBeUndefined()
    expect(leida?.precioCompraCentimos).toBe(1250)
  })
})

describe('fijar cantidad conserva costo', () => {
  it('merge', async () => {
    const inventario = new AlmacenDeInventarioMemoria()
    inventario.sembrar({
      codigo: 'TUB-1-2',
      precioCompraCentimos: 500,
      maximo: 0,
      alerta: false,
      actualizadoPor: 'admin',
      actualizadoEn: new Date(),
    })
    await inventario.fijar({
      codigo: 'TUB-1-2',
      cantidad: 8,
      autorId: 'admin',
      momento: new Date(),
    })
    const leida = await inventario.leer('TUB-1-2')
    expect(leida?.cantidad).toBe(8)
    expect(leida?.precioCompraCentimos).toBe(500)
  })
})
