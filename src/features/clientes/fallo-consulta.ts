import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'

export type RespuestaFallidaDeConsulta = {
  readonly ok: false
  readonly error: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

/**
 * Errores de configuración del proveedor (token/URL) no deben tumbar la
 * venta: en demo el token puede emitir y aun así rechazar el host de RUC/DNI.
 */
function esFalloDeConfiguracionDelProveedor(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /PROVEEDOR_(TOKEN|URL_BASE)|Falta PROVEEDOR_/i.test(error.message)
}

/**
 * Todo fallo de consulta → `{ ok: false }` serializable.
 * El client nunca debe recibir un throw opaco / HTTP 500 por padrón caído.
 */
export function respuestaDeFalloDeConsulta(
  error: unknown,
): RespuestaFallidaDeConsulta {
  if (esErrorDeSuitPay(error)) {
    return { ok: false, error: error.aRespuesta() }
  }
  if (esFalloDeConfiguracionDelProveedor(error)) {
    console.error('[SuitPay] consulta contribuyente: config del proveedor', error)
    return {
      ok: false,
      error: new ErrorDeSuitPay('servicio_no_disponible').aRespuesta(),
    }
  }
  console.error('[SuitPay] fallo al consultar contribuyente', error)
  return {
    ok: false,
    error: new ErrorDeSuitPay('servicio_no_disponible').aRespuesta(),
  }
}
