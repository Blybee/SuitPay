/**
 * Traduce el `detalle` de `asistencia_no_disponible` a una línea técnica corta.
 *
 * La banda le dice al vendedor qué no funciona; esta línea le dice al
 * administrador **por qué**, sin tener que abrir los logs de Cloud Run. Son
 * palabras estables del servidor (`motivo`), nunca texto crudo del proveedor.
 */

const EXPLICACION: Record<string, string> = {
  sin_claves: 'sin claves de asistencia en el servidor',
  cuota: 'cuota o límite de peticiones agotado',
  modelo_no_disponible: 'el modelo no existe o fue retirado',
  clave_rechazada: 'la clave fue rechazada por el servicio',
  http_error: 'el servicio respondió con error',
  timeout: 'el servicio no respondió a tiempo',
  red: 'no se pudo conectar con el servicio',
  respuesta_no_json: 'respuesta del servicio ilegible',
  sin_texto: 'el servicio no devolvió contenido',
  texto_no_json: 'el servicio devolvió un formato inesperado',
}

export function formatearMotivoAsistencia(
  detalle:
    Readonly<Record<string, string | number | boolean | null>> | undefined,
): string | undefined {
  if (detalle === undefined) return undefined
  const motivo = typeof detalle.motivo === 'string' ? detalle.motivo : undefined
  if (motivo === undefined) return undefined

  const partes: string[] = [EXPLICACION[motivo] ?? motivo]
  const extras: string[] = []
  if (typeof detalle.status === 'number') extras.push(`HTTP ${detalle.status}`)
  if (typeof detalle.estadoGemini === 'string' && detalle.estadoGemini !== '') {
    extras.push(detalle.estadoGemini)
  }
  if (typeof detalle.modelo === 'string' && detalle.modelo !== '') {
    extras.push(detalle.modelo)
  }
  if (typeof detalle.clave === 'string' && detalle.clave !== '') {
    extras.push(`clave ${detalle.clave}`)
  }
  if (extras.length > 0) partes.push(`(${extras.join(' · ')})`)
  return `Asistencia: ${partes.join(' ')}`
}

/** Para fallos del propio navegador (red, RPC): una línea, sin volcar el stack. */
export function formatearFalloDeCliente(error: unknown): string {
  if (error instanceof Error) {
    const texto = `${error.name}: ${error.message}`.replace(/\s+/g, ' ').trim()
    return `Cliente: ${texto.slice(0, 160)}`
  }
  return `Cliente: ${String(error).slice(0, 160)}`
}

/** Los errores del SDK de Storage llevan `code: 'storage/...'`. */
export function esFalloDeStorage(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('storage/')
  )
}
