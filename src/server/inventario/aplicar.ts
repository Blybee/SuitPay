import { ventaEstaCerrada } from '../emision/estados.ts'
import type { AlmacenDeEmision, Comprobante } from '../emision/almacen.ts'
import type { AlmacenDeInventario } from './almacen.ts'

export async function intentarTrasVenta(
  inventario: AlmacenDeInventario | undefined,
  emision: AlmacenDeEmision,
  comprobanteId: string,
): Promise<void> {
  if (inventario === undefined) return
  await trasVentaCerrada({ inventario, emision, comprobanteId })
}

export async function intentarTrasAnulacion(
  inventario: AlmacenDeInventario | undefined,
  emision: AlmacenDeEmision,
  comprobanteId: string,
): Promise<void> {
  if (inventario === undefined) return
  await trasAnulacion({ inventario, emision, comprobanteId })
}

/**
 * Aplica, hereda o reintegra inventario. El fallo se traga: la emisión ya
 * ocurrió (principio V).
 */
export async function trasVentaCerrada(entrada: {
  readonly inventario: AlmacenDeInventario
  readonly emision: AlmacenDeEmision
  readonly comprobanteId: string
}): Promise<void> {
  try {
    const comprobante = await entrada.emision.leerComprobante(
      entrada.comprobanteId,
    )
    if (comprobante === undefined) return
    if (!ventaEstaCerrada(comprobante.estado)) return
    await aplicarSegunTipo(entrada.inventario, entrada.emision, comprobante)
  } catch (error) {
    console.error('[SuitPay] inventario no aplicado tras venta', error)
  }
}

export async function trasAnulacion(entrada: {
  readonly inventario: AlmacenDeInventario
  readonly emision: AlmacenDeEmision
  readonly comprobanteId: string
}): Promise<void> {
  try {
    const comprobante = await entrada.emision.leerComprobante(
      entrada.comprobanteId,
    )
    if (comprobante === undefined) return
    const dueñoId = comprobante.inventarioAplicadoPor ?? comprobante.id
    const dueño =
      dueñoId === comprobante.id
        ? comprobante
        : ((await entrada.emision.leerComprobante(dueñoId)) ?? comprobante)
    await entrada.inventario.reintegrar(dueño)
  } catch (error) {
    console.error('[SuitPay] inventario no reintegrado tras anulación', error)
  }
}

async function aplicarSegunTipo(
  inventario: AlmacenDeInventario,
  emision: AlmacenDeEmision,
  comprobante: Comprobante,
): Promise<void> {
  if (comprobante.tipoDocumento === 'guia') {
    const origenId = comprobante.comprobanteOrigenId
    if (origenId === undefined || origenId === null) return
    const origen = await emision.leerComprobante(origenId)
    if (origen === undefined) return
    if (origen.inventarioAplicado === true) {
      await inventario.heredarTitularidad(origen, comprobante)
    }
    return
  }

  if (
    comprobante.tipoDocumento !== 'boleta' &&
    comprobante.tipoDocumento !== 'factura' &&
    comprobante.tipoDocumento !== 'nota_venta'
  ) {
    return
  }

  await inventario.aplicarVenta(comprobante)
}
