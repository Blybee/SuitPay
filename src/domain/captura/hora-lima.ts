import { diaEnLima, esElMismoDiaEnLima, ZONA_HORARIA } from '../anulacion/ventana.ts'

const FORMATEADOR_HORA = new Intl.DateTimeFormat('es-PE', {
  timeZone: ZONA_HORARIA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function horaEnLima(instante: Date): string {
  return FORMATEADOR_HORA.format(instante)
}

export function esAudioDelDiaActual(
  grabadoEn: Date,
  ahora: Date = new Date(),
): boolean {
  return esElMismoDiaEnLima(grabadoEn, ahora)
}

export function claveDeDiaLima(instante: Date): string {
  return diaEnLima(instante)
}
