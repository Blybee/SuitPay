/**
 * La ventana de anulación.
 *
 * ## Por qué existe este archivo en lugar de una comparación de fechas
 *
 * FR-037 permite anular un comprobante **el mismo día** de su emisión. Ese día
 * es el de Lima, y Lima va cinco horas por detrás de UTC.
 *
 * La consecuencia de ignorarlo es concreta y grave: una venta de las 19:00 del
 * martes en Lima ocurre a las 00:00 del miércoles en UTC. Si el sistema
 * comparase días en UTC, esa venta quedaría inanulable **a los pocos minutos**
 * de emitirse, justo en la franja de más movimiento del mostrador. El vendedor
 * vería que corresponde una nota de crédito por un error de impresión que acaba
 * de cometer, y no habría nada que hacer.
 *
 * Y al revés: una venta de las 20:00 del martes seguiría pareciendo "del mismo
 * día" a las 18:00 del miércoles en Lima, permitiendo anular fuera de plazo algo
 * que la autoridad ya considera cerrado.
 *
 * De modo que la zona horaria está fijada aquí, no tomada del entorno. Un
 * servidor de Cloud Run corre en UTC y el navegador de un vendedor corre en la
 * zona que tenga configurado el sistema operativo, que puede estar mal. Ninguno
 * de los dos es una fuente de verdad aceptable para esto.
 */

export const ZONA_HORARIA = 'America/Lima'

const FORMATEADOR_DE_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * El día civil en Lima de un instante dado, como `AAAA-MM-DD`. Se usa el locale
 * `en-CA` porque produce exactamente ese orden de forma estable, en lugar de
 * armar la cadena a mano desde las partes.
 */
export function diaEnLima(instante: Date): string {
  return FORMATEADOR_DE_DIA.format(instante)
}

/**
 * Si dos instantes caen en el mismo día civil de Lima. Esta es la pregunta que
 * decide si un comprobante puede anularse, y por eso está expresada como
 * comparación de días y no como diferencia de horas: "el mismo día" no son
 * veinticuatro horas, son las que queden hasta la medianoche de Lima.
 */
export function esElMismoDiaEnLima(uno: Date, otro: Date): boolean {
  return diaEnLima(uno) === diaEnLima(otro)
}

export interface ResultadoDeVentana {
  readonly dentroDeVentana: boolean
  /** El día de la emisión en Lima, para poder decírselo al vendedor. */
  readonly diaDeEmision: string
  readonly diaActual: string
}

/**
 * Si un comprobante emitido en `emitidoEn` puede anularse en el momento
 * `ahora`. El segundo argumento es explícito y no `new Date()` por dentro: una
 * función que lee el reloj del sistema no se puede probar, y esta es
 * precisamente una de las que hay que probar.
 */
export function estaDentroDeLaVentanaDeAnulacion(
  emitidoEn: Date,
  ahora: Date,
): ResultadoDeVentana {
  const diaDeEmision = diaEnLima(emitidoEn)
  const diaActual = diaEnLima(ahora)
  return {
    dentroDeVentana: diaDeEmision === diaActual,
    diaDeEmision,
    diaActual,
  }
}

/**
 * Cuánto queda de ventana, en milisegundos, contado hasta la medianoche de Lima
 * del día de la emisión. Sirve para avisar al vendedor de que le queda poco, no
 * para decidir: la decisión es la comparación de días de arriba.
 *
 * Devuelve 0 si la ventana ya se cerró.
 */
export function milisegundosRestantesDeVentana(
  emitidoEn: Date,
  ahora: Date,
): number {
  if (!esElMismoDiaEnLima(emitidoEn, ahora)) return 0
  const finDeVentana = comienzoDelDiaSiguienteEnLima(emitidoEn)
  return Math.max(0, finDeVentana.getTime() - ahora.getTime())
}

/**
 * El instante en que empieza el día siguiente en Lima. Se obtiene averiguando
 * el desplazamiento real de la zona en ese momento en lugar de restar cinco
 * horas fijas: Perú no aplica horario de verano hoy, pero grabar el
 * desplazamiento como constante es la clase de suposición que sobrevive al
 * cambio de norma y falla en silencio.
 */
function comienzoDelDiaSiguienteEnLima(instante: Date): Date {
  return finExclusivoDelDiaEnLima(diaEnLima(instante))
}

/**
 * Inicio inclusive del día civil `AAAA-MM-DD` en America/Lima (como instante UTC).
 * Sirve para consultas de listado US4b (Hoy / rango).
 */
export function comienzoDelDiaEnLima(dia: string): Date {
  const partes = dia.split('-').map(Number)
  const anio = partes[0]
  const mes = partes[1]
  const numeroDeDia = partes[2]
  if (anio === undefined || mes === undefined || numeroDeDia === undefined) {
    throw new Error(`Día de Lima con forma inesperada: ${dia}`)
  }

  const medianocheComoSiFueraUtc = Date.UTC(anio, mes - 1, numeroDeDia)
  const desplazamiento = desplazamientoDeLima(new Date(medianocheComoSiFueraUtc))
  return new Date(medianocheComoSiFueraUtc + desplazamiento)
}

/** Fin exclusivo del día civil `AAAA-MM-DD` en America/Lima (= inicio del día siguiente). */
export function finExclusivoDelDiaEnLima(dia: string): Date {
  const partes = dia.split('-').map(Number)
  const anio = partes[0]
  const mes = partes[1]
  const numeroDeDia = partes[2]
  if (anio === undefined || mes === undefined || numeroDeDia === undefined) {
    throw new Error(`Día de Lima con forma inesperada: ${dia}`)
  }

  const medianocheComoSiFueraUtc = Date.UTC(anio, mes - 1, numeroDeDia + 1)
  const desplazamiento = desplazamientoDeLima(new Date(medianocheComoSiFueraUtc))
  return new Date(medianocheComoSiFueraUtc + desplazamiento)
}

/** Milisegundos que hay que sumar a una hora local de Lima para obtener UTC. */
function desplazamientoDeLima(instante: Date): number {
  const enLima = new Date(instante.toLocaleString('en-US', { timeZone: ZONA_HORARIA }))
  const enUtc = new Date(instante.toLocaleString('en-US', { timeZone: 'UTC' }))
  return enUtc.getTime() - enLima.getTime()
}
