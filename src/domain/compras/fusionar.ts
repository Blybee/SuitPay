import type { CoincidenciaDeCompra } from './tipos.ts'

function claveDeFecha(valor: string | undefined): string {
  return valor ?? ''
}

/**
 * Un SKU en dos facturas del lote: gana la fecha más reciente.
 * Sin fecha pierde frente a una fechada.
 */
export function fusionarCoincidencias(
  filas: readonly CoincidenciaDeCompra[],
): CoincidenciaDeCompra[] {
  const porCodigo = new Map<string, CoincidenciaDeCompra>()
  for (const fila of filas) {
    const previa = porCodigo.get(fila.codigo)
    if (previa === undefined) {
      porCodigo.set(fila.codigo, fila)
      continue
    }
    if (claveDeFecha(fila.precioCompraEn) >= claveDeFecha(previa.precioCompraEn)) {
      porCodigo.set(fila.codigo, fila)
    }
  }
  return [...porCodigo.values()]
}
