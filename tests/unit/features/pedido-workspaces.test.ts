import { afterEach, describe, expect, it } from 'vitest'
import { usarPedido } from '../../../src/features/pedido/almacen.ts'

const producto = {
  codigo: 'C1',
  descripcion: 'CODO 1/2',
  unidad: 'NIU',
  precio: 100,
  cantidad: 1,
}

describe('workspaces de pedido', () => {
  afterEach(() => {
    usarPedido.setState({
      lineas: [],
      cliente: null,
      tipoDocumento: 'nota_venta',
      cotizacionId: null,
      capturaId: null,
      claveIdempotencia: null,
      comprobanteOrigenId: null,
      comprobanteOrigenEtiqueta: null,
      modoCotizacion: false,
      restaurando: false,
      slotActivo: 1,
      segundoAbierto: false,
    })
  })

  it('no pisa las líneas al abrir y conmutar el segundo workspace', () => {
    usarPedido.getState().agregarLinea(producto)
    expect(usarPedido.getState().lineas).toHaveLength(1)
    usarPedido.getState().abrirSegundo()
    expect(usarPedido.getState().slotActivo).toBe(2)
    expect(usarPedido.getState().lineas).toHaveLength(0)
    usarPedido.getState().agregarLinea({
      ...producto,
      codigo: 'T1',
      descripcion: 'TEE 3/4',
    })
    usarPedido.getState().conmutarSlot()
    expect(usarPedido.getState().slotActivo).toBe(1)
    expect(usarPedido.getState().lineas[0]?.codigo).toBe('C1')
    usarPedido.getState().conmutarSlot()
    expect(usarPedido.getState().slotActivo).toBe(2)
    expect(usarPedido.getState().lineas[0]?.codigo).toBe('T1')
  })

  it('colapsa el workspace 2 al vaciarlo', () => {
    usarPedido.getState().abrirSegundo()
    usarPedido.getState().agregarLinea(producto)
    usarPedido.getState().vaciar()
    expect(usarPedido.getState().slotActivo).toBe(1)
    expect(usarPedido.getState().segundoAbierto).toBe(false)
    expect(usarPedido.getState().lineas).toHaveLength(0)
  })
})
