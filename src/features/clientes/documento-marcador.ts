/**
 * Documento placeholder cuando la boleta/cotización lleva solo nombre
 * (cliente eventual con denominación). Cumple min(8) del esquema de emisión
 * sin inventar un DNI real.
 */
export const DOCUMENTO_CLIENTE_POR_NOMBRE = '00000000'

export function esClientePorNombre(numeroDocumento: string): boolean {
  return numeroDocumento.trim() === DOCUMENTO_CLIENTE_POR_NOMBRE
}
