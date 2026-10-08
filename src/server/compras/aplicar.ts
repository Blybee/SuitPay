import type { CoincidenciaDeCompra } from '../../domain/compras/tipos.ts'
import {
  centimosDeDecimales,
  textoDeTipoCambio,
} from '../../domain/compras/moneda.ts'
import type { AlmacenDeInventario } from '../inventario/almacen.ts'
import type { Existencia } from '../../domain/inventario/tipos.ts'
import { ErrorDeSuitPay } from '../errores.ts'

export async function aplicarPreciosCompra(entrada: {
  readonly coincidencias: readonly CoincidenciaDeCompra[]
  readonly autorId: string
  readonly momento: Date
  readonly inventario: AlmacenDeInventario
}): Promise<readonly Existencia[]> {
  const escritas: Existencia[] = []
  for (const fila of entrada.coincidencias) {
    const costo = costoEnSoles(fila)
    const existencia = await entrada.inventario.parchear({
      codigo: fila.codigo,
      precioCompraCentimos: costo.centimos,
      precioCompraEn: fila.precioCompraEn ?? null,
      ...costo.meta,
      autorId: entrada.autorId,
      momento: entrada.momento,
    })
    escritas.push(existencia)
  }
  return escritas
}

function costoEnSoles(fila: CoincidenciaDeCompra): {
  readonly centimos: number
  readonly meta:
    | {
        readonly monedaCompra: 'USD'
        readonly precioCompraOriginal: string
        readonly tipoCambio: number
        readonly tipoCambioEn: string | null
      }
    | { readonly monedaCompra: null }
} {
  if (fila.moneda === 'USD') {
    const factor =
      fila.tipoCambio !== undefined
        ? textoDeTipoCambio(fila.tipoCambio)
        : undefined
    const centimos =
      fila.precioOriginal !== undefined && factor !== undefined
        ? centimosDeDecimales(fila.precioOriginal, factor)
        : undefined
    if (
      centimos === undefined ||
      fila.precioOriginal === undefined ||
      fila.tipoCambio === undefined
    ) {
      throw new ErrorDeSuitPay('peticion_invalida', {
        motivo: 'tipo_cambio_ausente',
      })
    }
    return {
      centimos,
      meta: {
        monedaCompra: 'USD',
        precioCompraOriginal: fila.precioOriginal,
        tipoCambio: fila.tipoCambio,
        tipoCambioEn: fila.tipoCambioEn ?? fila.precioCompraEn ?? null,
      },
    }
  }
  if (fila.precioCompraCentimos === undefined) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'precio_ausente' })
  }
  return { centimos: fila.precioCompraCentimos, meta: { monedaCompra: null } }
}
