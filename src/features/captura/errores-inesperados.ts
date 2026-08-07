/**
 * Clasifica fallos del RPC de captura que no deben marcar asistencia caída.
 */
export function esErrorDeLoteDemasiadoGrande(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error)
  return mensaje.includes('too_big') || mensaje.includes('Too big')
}

export const MENSAJE_LOTE_DEMASIADO_GRANDE =
  'El lote de productos es demasiado grande para enviar. Recarga e intenta de nuevo.'
