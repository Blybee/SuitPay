import type { UrgenciaDeRequerimiento } from './tipos.ts'

const PATRON_URGENTE =
  /\b(urgente|urgencia|ya\s+mismo|lo\s+antes\s+posible|prioritario)\b/i

/**
 * La urgencia se resuelve en el cliente a partir de lo oído, no en el modelo.
 * Por omisión siempre es Normal.
 */
export function urgenciaDesdeTexto(
  texto: string,
): UrgenciaDeRequerimiento {
  return PATRON_URGENTE.test(texto) ? 'urgente' : 'normal'
}

export function alternarUrgencia(
  actual: UrgenciaDeRequerimiento,
): UrgenciaDeRequerimiento {
  return actual === 'urgente' ? 'normal' : 'urgente'
}

export function etiquetaDeUrgencia(urgencia: UrgenciaDeRequerimiento): string {
  return urgencia === 'urgente' ? 'Urgente' : 'Normal'
}
