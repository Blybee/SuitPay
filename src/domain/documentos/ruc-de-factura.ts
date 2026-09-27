import type { TipoDeDocumento } from './tipos.ts'

export function motivoDeRucParaFactura(datos: {
  readonly tipo: TipoDeDocumento
  readonly cliente: { readonly numeroDocumento: string } | null
}): string | null {
  if (datos.tipo === 'factura' || datos.cliente === null) return null
  return null
}
