import type { TipoDeDocumento } from './tipos.ts'

export const MENSAJE_FACTURA_REQUIERE_RUC =
  'La factura requiere un cliente con RUC'

/** RUC peruano: 11 dígitos, prefijo 10 o 20. */
export function rucEsValido(numero: string): boolean {
  return /^(10|20)\d{9}$/.test(numero.trim())
}

export function motivoDeRucParaFactura(datos: {
  readonly tipo: TipoDeDocumento
  readonly cliente: { readonly numeroDocumento: string } | null
}): string | null {
  if (datos.tipo !== 'factura') return null
  if (datos.cliente !== null && rucEsValido(datos.cliente.numeroDocumento)) {
    return null
  }
  return MENSAJE_FACTURA_REQUIERE_RUC
}
