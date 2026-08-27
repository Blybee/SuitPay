import { diaEnLima } from '../anulacion/ventana.ts'

/**
 * Semana laboral (lunes a sábado) del día civil actual en America/Lima.
 * El domingo el local no abre: ese día se muestra la semana que termina.
 */

export interface DiaDeSemanaLaboral {
  /** Día civil `AAAA-MM-DD`; id del documento en Firestore. */
  readonly fecha: string
  /** Abreviatura del día (escritorio): Lun … Sáb. */
  readonly etiqueta: string
  /** Fecha corta `dd/mm` (teléfono). */
  readonly corta: string
}

const ETIQUETAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const
const DIA_MS = 24 * 60 * 60 * 1000

function fechaCivil(utcMs: number): string {
  const fecha = new Date(utcMs)
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getUTCDate()).padStart(2, '0')
  return `${fecha.getUTCFullYear()}-${mes}-${dia}`
}

export function semanaLaboralEnLima(
  ahora: Date = new Date(),
): readonly DiaDeSemanaLaboral[] {
  const [anio, mes, dia] = diaEnLima(ahora).split('-').map(Number)
  if (anio === undefined || mes === undefined || dia === undefined) {
    throw new Error('Día de Lima con forma inesperada.')
  }
  const hoyUtc = Date.UTC(anio, mes - 1, dia)
  // getUTCDay(): 0 = domingo. Lunes de esta semana civil.
  const desdeLunes = (new Date(hoyUtc).getUTCDay() + 6) % 7
  const lunesUtc = hoyUtc - desdeLunes * DIA_MS

  return ETIQUETAS.map((etiqueta, indice) => {
    const fechaMs = lunesUtc + indice * DIA_MS
    const fecha = fechaCivil(fechaMs)
    const [, mesCorto, diaCorto] = fecha.split('-')
    return {
      fecha,
      etiqueta,
      corta: `${diaCorto}/${mesCorto}`,
    }
  })
}

/**
 * El día que abre seleccionado: hoy si cae de lunes a sábado; si es domingo,
 * el sábado de la semana mostrada.
 */
export function diaPorDefecto(
  semana: readonly DiaDeSemanaLaboral[],
  ahora: Date = new Date(),
): string {
  const hoy = diaEnLima(ahora)
  const encontrado = semana.find((cada) => cada.fecha === hoy)
  return encontrado?.fecha ?? semana[semana.length - 1]?.fecha ?? hoy
}
