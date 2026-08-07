import { usarCaptura } from './estado.ts'

/**
 * Impide emitir mientras quede un renglón sin resolver (T124 / FR-044).
 * No descarta nada en silencio.
 */
export function capturaBloqueaEmision(): boolean {
  const captura = usarCaptura.getState()
  if (captura.fase !== 'revision' && captura.fase !== 'revision_texto') {
    return false
  }
  return captura.hayPendientesOAmbiguas() || captura.lineas.length > 0
}

/**
 * Motivo para el pie del mostrador cuando la captura aún no se aprobó.
 */
export function motivoBloqueoPorCaptura(): string | null {
  const captura = usarCaptura.getState()
  if (captura.fase === 'revision_texto') {
    return 'Confirma el texto extraído de la fotografía antes de continuar.'
  }
  if (captura.fase === 'revision') {
    if (captura.hayPendientesOAmbiguas()) {
      return 'Hay líneas de captura sin resolver. Elígelas o descarta la propuesta.'
    }
    return 'Aprueba o descarta la propuesta de captura antes de emitir.'
  }
  if (captura.fase === 'ilegible') {
    return 'La captura fue ilegible. Reintenta o escribe el pedido.'
  }
  if (
    captura.fase === 'grabando' ||
    captura.fase === 'subiendo' ||
    captura.fase === 'procesando'
  ) {
    return 'Espera a que termine la captura o cancélala para emitir.'
  }
  return null
}
