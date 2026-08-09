/**
 * Fase de operación del sistema: DEMO vs PRODUCCION.
 *
 * En DEMO se permiten atajos para pruebas manuales y presentación (p. ej.
 * altas de serie locales sin sync al proveedor). En PRODUCCION esos atajos
 * están prohibidos.
 *
 * Variable de entorno: `SUITPAY_FASE=DEMO|PRODUCCION`
 * Por omisión: DEMO (hasta el lanzamiento oficial).
 *
 * Ver `docs/FASE-OPERACION.md`.
 */

export type FaseOperacion = 'DEMO' | 'PRODUCCION'

export function faseOperacion(): FaseOperacion {
  const crudo = process.env['SUITPAY_FASE']?.trim().toUpperCase()
  if (crudo === 'PRODUCCION' || crudo === 'PRODUCTION') return 'PRODUCCION'
  return 'DEMO'
}

export function esFaseDemo(): boolean {
  return faseOperacion() === 'DEMO'
}

/** Prefijo de IDs sintéticos de serie/establecimiento solo válidos en DEMO. */
export const PREFIJO_ID_DEMO = 'demo-local-'
