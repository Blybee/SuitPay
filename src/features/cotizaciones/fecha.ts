import { ZONA_HORARIA } from '../../domain/anulacion/ventana.ts'

const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

const FORMATEADOR_PARTES = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

/**
 * Fecha corta del mostrador: iniciales del mes + día civil en Lima.
 * Ej. `Mar 15`.
 */
export function formatearFechaCortaCotizacion(fecha: Date): string {
  const partes = FORMATEADOR_PARTES.formatToParts(fecha)
  const mes = Number(partes.find((p) => p.type === 'month')?.value ?? '1')
  const dia = Number(partes.find((p) => p.type === 'day')?.value ?? '1')
  const etiqueta = MESES_CORTOS[mes - 1] ?? 'Ene'
  return `${etiqueta} ${dia}`
}
