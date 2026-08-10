/**
 * Qué tipo de documento de identidad admite cada modo del mostrador.
 * Alineado con el campo ciclable de cabecera (FR-022).
 */

export type ModoDeClienteEnDocumento =
  | 'boleta'
  | 'factura'
  | 'nota_venta'
  | 'cotizacion'

export type TipoDocumentoCliente = 'DNI' | 'RUC'

export type ModoCampoCliente = 'ruc' | 'dni' | 'nombre'

/** Modos del campo inline en cabecera (chevrons). */
export function modosCampoClientePermitidos(
  modo: ModoDeClienteEnDocumento,
): readonly ModoCampoCliente[] {
  if (modo === 'factura') return ['ruc']
  if (modo === 'boleta') return ['dni', 'nombre']
  if (modo === 'cotizacion') return ['nombre', 'dni', 'ruc']
  return []
}

/** Tipos de identidad que se pueden fijar al pedido en ese modo. */
export function tiposDocumentoClientePermitidos(
  modo: ModoDeClienteEnDocumento,
): readonly TipoDocumentoCliente[] {
  if (modo === 'factura') return ['RUC']
  if (modo === 'boleta') return ['DNI']
  return ['DNI', 'RUC']
}

export function tipoDocumentoClienteDesdeNumero(
  numeroDocumento: string,
): TipoDocumentoCliente | null {
  const digitos = numeroDocumento.trim().replace(/\D/g, '')
  if (digitos.length === 11) return 'RUC'
  if (digitos.length === 8) return 'DNI'
  return null
}

export function clienteCompatibleConModo(
  numeroDocumento: string,
  modo: ModoDeClienteEnDocumento,
): boolean {
  const tipo = tipoDocumentoClienteDesdeNumero(numeroDocumento)
  if (tipo === null) return false
  return tiposDocumentoClientePermitidos(modo).includes(tipo)
}

export function mensajeIncompatibilidadCliente(
  numeroDocumento: string,
  modo: ModoDeClienteEnDocumento,
): string {
  const tipo = tipoDocumentoClienteDesdeNumero(numeroDocumento)
  if (modo === 'factura') {
    return tipo === 'DNI'
      ? 'Una factura solo admite cliente con RUC.'
      : 'Una factura solo admite cliente con RUC (11 dígitos).'
  }
  if (modo === 'boleta') {
    return tipo === 'RUC'
      ? 'Una boleta solo admite cliente con DNI (o nombre).'
      : 'Una boleta solo admite cliente con DNI (8 dígitos) o nombre.'
  }
  return 'Ese documento de identidad no aplica a este tipo de comprobante.'
}
