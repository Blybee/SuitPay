/**
 * Reconocimiento de `/crear vecino {alias} {DNI|RUC}` (FR-034a).
 * Solo produce una propuesta; la escritura ocurre tras confirmación.
 */

export interface PropuestaCrearVecino {
  readonly alias: string
  readonly numeroDocumento: string
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly telefono?: string
}

const PATRON =
  /^\/crear\s+vecino\s+([^\s/]+)\s+(\d{8}|\d{11})\s*$/i

export function reconocerCrearVecino(
  texto: string,
): PropuestaCrearVecino | null {
  const coincidencia = PATRON.exec(texto.trim())
  if (coincidencia === null) return null
  const alias = coincidencia[1]?.trim() ?? ''
  const numeroDocumento = coincidencia[2] ?? ''
  if (alias === '' || numeroDocumento === '') return null
  return {
    alias,
    numeroDocumento,
    tipoDocumento: numeroDocumento.length === 11 ? 'RUC' : 'DNI',
  }
}

export function esComandoCrearVecino(texto: string): boolean {
  return /^\/crear\s+vecino\b/i.test(texto.trim())
}
