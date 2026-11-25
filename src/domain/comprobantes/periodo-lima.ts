import { comienzoDelDiaEnLima, diaEnLima } from '../anulacion/ventana.ts'

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/

/** Mes civil `AAAA-MM` de un instante en America/Lima. */
export function mesEnLima(instante: Date): string {
  return diaEnLima(instante).slice(0, 7)
}

export function periodoEsValido(periodo: string): boolean {
  return PERIODO.test(periodo)
}

/**
 * Inicio inclusive y fin exclusivo del mes civil en Lima.
 * El fin es el comienzo del mes siguiente, no la medianoche UTC.
 */
export function limitesDelMesEnLima(periodo: string): {
  desde: Date
  hastaExclusivo: Date
} {
  if (!periodoEsValido(periodo)) {
    throw new Error(`Periodo con forma inesperada: ${periodo}`)
  }
  const anio = Number(periodo.slice(0, 4))
  const mes = Number(periodo.slice(5, 7))
  const siguienteAnio = mes === 12 ? anio + 1 : anio
  const siguienteMes = mes === 12 ? 1 : mes + 1
  const siguiente = `${siguienteAnio}-${String(siguienteMes).padStart(2, '0')}`
  return {
    desde: comienzoDelDiaEnLima(`${periodo}-01`),
    hastaExclusivo: comienzoDelDiaEnLima(`${siguiente}-01`),
  }
}

/** Un mes cerrado es anterior al mes civil actual en Lima. El mes en curso y el futuro no lo son. */
export function periodoEstaCerrado(periodo: string, ahora: Date): boolean {
  if (!periodoEsValido(periodo)) {
    throw new Error(`Periodo con forma inesperada: ${periodo}`)
  }
  return periodo < mesEnLima(ahora)
}
