import { afterEach, describe, expect, it } from 'vitest'
import { aplicarLineasAprobadasAlPedido } from '../../../src/features/captura/aprobar.ts'
import type { LineaCapturaAprobada } from '../../../src/features/captura/aprobar.ts'
import { aplicarProductosALista } from '../../../src/features/lista/lineas.ts'
import { usarPedido } from '../../../src/features/pedido/almacen.ts'
import { aplicarProductosALineas } from '../../../src/features/vecinos/lineas.ts'
import type { ProductoBuscable } from '../../../src/domain/busqueda/productos.ts'

/**
 * Orden de la foto (arriba → abajo). No es alfabético: MEDIDOR queda
 * después de REGISTRO, y los dos SUMIDERO no van juntos.
 */
const ORDEN_DE_LA_FOTO = [
  'CAJAS AZUL 1/16',
  'REGISTRO 2 GEMELLO',
  'SUMIDERO 2',
  'TAPON 2',
  'SUMIDERO 2 HELVEX',
  'CIENTO CONICO 1/2 NEOPRENE',
  'TRAMPA P GEMELLO',
  'UNION 1/2 BRONCE PESADO',
  'MEDIDOR AYON',
] as const

const LINEAS: readonly LineaCapturaAprobada[] = ORDEN_DE_LA_FOTO.map(
  (descripcion, indice) => ({
    codigo: `FOTO-${indice + 1}`,
    descripcion,
    unidad: 'NIU',
    cantidad: indice + 1,
    textoOriginal: `${indice + 1} ${descripcion}`,
  }),
)

function productoDe(linea: LineaCapturaAprobada): ProductoBuscable {
  return {
    codigo: linea.codigo,
    descripcion: linea.descripcion,
    unidad: linea.unidad,
    precio: 100,
    activo: true,
  }
}

describe('orden al agregar una captura', () => {
  afterEach(() => {
    usarPedido.setState({
      lineas: [],
      cliente: null,
      tipoDocumento: 'nota_venta',
      cotizacionId: null,
      capturaId: null,
      generacionPedido: null,
      claveIdempotencia: null,
      comprobanteOrigenId: null,
      comprobanteOrigenEtiqueta: null,
      modoCotizacion: false,
      restaurando: false,
      slotActivo: 1,
      segundoAbierto: false,
      fechasDeuda: null,
    })
  })

  it('deja el pedido en el orden de la propuesta, no al revés ni A→Z', () => {
    const aplicadas = aplicarLineasAprobadasAlPedido(LINEAS, 'captura-foto')
    expect(aplicadas).toEqual({ agregadas: 9, omitidas: 0 })
    expect(usarPedido.getState().lineas.map((linea) => linea.descripcion)).toEqual([
      ...ORDEN_DE_LA_FOTO,
    ])
  })

  it('antepone el bloque de la foto y conserva lo que ya estaba debajo', () => {
    usarPedido.getState().agregarLinea({
      codigo: 'PREVIA',
      descripcion: 'YA ESTABA',
      unidad: 'NIU',
      cantidad: 1,
      precio: 50,
    })
    aplicarLineasAprobadasAlPedido(LINEAS, null)
    expect(usarPedido.getState().lineas.map((linea) => linea.descripcion)).toEqual([
      ...ORDEN_DE_LA_FOTO,
      'YA ESTABA',
    ])
  })

  it('agrega a la lista en el orden de la propuesta', () => {
    const lineas = aplicarProductosALista(
      [],
      LINEAS.map((linea) => ({
        id: linea.codigo,
        codigo: linea.codigo,
        descripcion: linea.descripcion,
        cantidad: linea.cantidad,
      })),
    )
    expect(lineas.map((linea) => linea.descripcion)).toEqual([...ORDEN_DE_LA_FOTO])
  })

  it('agrega al vecino en el orden de la propuesta', () => {
    const lineas = aplicarProductosALineas(
      [],
      LINEAS.map((linea) => ({
        producto: productoDe(linea),
        cantidad: linea.cantidad,
      })),
    )
    expect(lineas.map((linea) => linea.descripcion)).toEqual([...ORDEN_DE_LA_FOTO])
  })
})
