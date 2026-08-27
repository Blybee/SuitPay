/**
 * Reconocimiento de `/crear vecino {alias} {DNI|RUC} {teléfono?}` (FR-034a).
 * El teléfono es opcional: un celular peruano (9 dígitos, con o sin 51).
 * Solo produce una propuesta; la escritura ocurre tras confirmación.
 */

export interface PropuestaCrearVecino {
  readonly alias: string
  readonly numeroDocumento: string
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly telefono?: string
}

const PATRON =
  /^\/crear\s+vecino\s+([^\s/]+)\s+(\d{8}|\d{11})(?:\s+(\+?(?:51)?9\d{8}))?\s*$/i

export function reconocerCrearVecino(
  texto: string,
): PropuestaCrearVecino | null {
  const coincidencia = PATRON.exec(texto.trim())
  if (coincidencia === null) return null
  const alias = coincidencia[1]?.trim() ?? ''
  const numeroDocumento = coincidencia[2] ?? ''
  const telefono = coincidencia[3]?.trim() ?? ''
  if (alias === '' || numeroDocumento === '') return null
  return {
    alias,
    numeroDocumento,
    tipoDocumento: numeroDocumento.length === 11 ? 'RUC' : 'DNI',
    ...(telefono !== '' ? { telefono } : {}),
  }
}

export function esComandoCrearVecino(texto: string): boolean {
  return /^\/crear\s+vecino\b/i.test(texto.trim())
}
