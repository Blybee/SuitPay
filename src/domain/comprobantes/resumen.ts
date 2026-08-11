/**
 * Resumen de ventas para cierre de caja (US4b / FR-057a).
 * Los anulados aparecen en la lista pero no suman al total.
 */

export function totalDeVentasParaCierre(
  items: readonly { readonly estado: string; readonly total: number }[],
): number {
  let suma = 0
  for (const cada of items) {
    if (cada.estado === 'anulado') continue
    suma += cada.total
  }
  return suma
}
