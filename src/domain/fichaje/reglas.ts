import { diaEnLima, ZONA_HORARIA } from '../anulacion/ventana.ts'

/**
 * Asistencia de entrada. Lima no tiene horario de verano: UTC−5 es estable.
 *
 * La hora que cuenta es la de la aprobación (o la que fija el jefe a mano),
 * nunca la del envío de la solicitud.
 */

export const HORA_DE_ENTRADA = 10 * 60
export const MINUTO_DE_TOLERANCIA = 10 * 60 + 15

export type EstadoDeMarca = 'presente' | 'tardanza' | 'falta' | 'justificado'
export type ClaseDeCelda = 'domingo' | 'proximo' | EstadoDeMarca

export interface CeldaDelMes {
  readonly dia: number
  readonly clase: ClaseDeCelda
}

export interface TotalesDeAsistencia {
  readonly presentes: number
  /** Las que quedan después de convertir cada 3 en una falta. */
  readonly tardanzas: number
  /** Faltas del calendario más un grupo por cada 3 tardanzas. */
  readonly faltas: number
  readonly justificados: number
  /** Tardanzas tal como quedaron marcadas, antes de la conversión. */
  readonly tardanzasEnBruto: number
  readonly porcentaje: number
}

const HORA = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const DIA_SEMANA = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,
  weekday: 'short',
})

const NOMBRE = /^[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*)*$/u

export function minutosDelDiaEnLima(instante: Date): number {
  const partes = HORA.formatToParts(instante)
  const hora = Number(partes.find((parte) => parte.type === 'hour')?.value)
  const minuto = Number(partes.find((parte) => parte.type === 'minute')?.value)
  const horaNormal = hora === 24 ? 0 : hora
  return horaNormal * 60 + minuto
}

/** Hasta las 10:15 inclusive es presente. Después, tardanza. */
export function estadoPorHoraDeEntrada(
  instante: Date,
): 'presente' | 'tardanza' {
  return minutosDelDiaEnLima(instante) <= MINUTO_DE_TOLERANCIA
    ? 'presente'
    : 'tardanza'
}

export function esDomingoEnLima(iso: string): boolean {
  return DIA_SEMANA.format(new Date(`${iso}T12:00:00-05:00`)) === 'Sun'
}

export function cantidadDeDias(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

export function isoDeDia(anio: number, mes: number, dia: number): string {
  const mesTexto = String(mes).padStart(2, '0')
  const diaTexto = String(dia).padStart(2, '0')
  return `${anio}-${mesTexto}-${diaTexto}`
}

export function claveDeNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-PE')
}

/** Nombre: una o más palabras, sin dígitos, entre 3 y 80 caracteres. */
export function nombreParaMostrar(crudo: string): string | null {
  const limpio = crudo.trim().replace(/\s+/g, ' ')
  if (limpio.length < 3 || limpio.length > 80) return null
  if (!NOMBRE.test(limpio)) return null
  return limpio
}

export function inicialesDe(nombre: string): string {
  const partes = nombre
    .trim()
    .split(/\s+/)
    .filter((parte) => parte.length > 0)
  const letras = partes.slice(0, 2).map((parte) => parte.charAt(0))
  const unidas = letras.join('').toLocaleUpperCase('es-PE')
  return unidas.length > 0 ? unidas : '·'
}

/**
 * Cada 3 tardanzas del mes pasan a ser 1 falta y dejan de contarse como
 * tardanza. La conversión es por trabajador: no se suman tardanzas entre
 * personas antes de agrupar.
 */
export function convertirTardanzas(
  tardanzas: number,
  faltas: number,
): { readonly tardanzas: number; readonly faltas: number } {
  const grupos = Math.floor(tardanzas / 3)
  return {
    tardanzas: tardanzas % 3,
    faltas: faltas + grupos,
  }
}

export function instanteDesdeFechaHoraLima(
  fecha: string,
  hora: string,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  if (!/^\d{2}:\d{2}$/.test(hora)) return null
  const [horas, minutos] = hora.split(':').map(Number)
  if (
    horas === undefined ||
    minutos === undefined ||
    horas > 23 ||
    minutos > 59
  ) {
    return null
  }
  const instante = new Date(`${fecha}T${hora}:00-05:00`)
  if (Number.isNaN(instante.getTime())) return null
  if (diaEnLima(instante) !== fecha) return null
  return instante
}

/**
 * Calendario de un trabajador en un mes.
 *
 * Domingo en gris, aunque sea futuro. Sábado es día laboral. Un día laboral
 * ya pasado sin marca es falta solo si esa persona ya tiene alguna marca en
 * el mes. Hoy sin marca no es falta: el día no ha cerrado. Una marca explícita
 * gana, también en domingo.
 */
export function armarMes(entrada: {
  readonly anio: number
  readonly mes: number
  readonly hoy: string
  readonly marcas: Readonly<Record<number, EstadoDeMarca>>
}): readonly CeldaDelMes[] {
  const total = cantidadDeDias(entrada.anio, entrada.mes)
  const inferirFalta = Object.keys(entrada.marcas).length > 0
  const celdas: CeldaDelMes[] = []

  for (let dia = 1; dia <= total; dia += 1) {
    const iso = isoDeDia(entrada.anio, entrada.mes, dia)
    const marca = entrada.marcas[dia]
    celdas.push({ dia, clase: claseDe(iso, entrada.hoy, marca, inferirFalta) })
  }

  return celdas
}

function claseDe(
  iso: string,
  hoy: string,
  marca: EstadoDeMarca | undefined,
  inferirFalta: boolean,
): ClaseDeCelda {
  if (marca === undefined && esDomingoEnLima(iso)) return 'domingo'
  if (marca !== undefined) return marca
  if (iso >= hoy) return 'proximo'
  if (inferirFalta) return 'falta'
  return 'proximo'
}

export function totalesDeCeldas(
  celdas: readonly CeldaDelMes[],
): TotalesDeAsistencia {
  let presentes = 0
  let tardanzasEnBruto = 0
  let faltas = 0
  let justificados = 0

  for (const celda of celdas) {
    if (celda.clase === 'presente') presentes += 1
    else if (celda.clase === 'tardanza') tardanzasEnBruto += 1
    else if (celda.clase === 'falta') faltas += 1
    else if (celda.clase === 'justificado') justificados += 1
  }

  const convertidas = convertirTardanzas(tardanzasEnBruto, faltas)
  const asistidos = presentes + justificados + convertidas.tardanzas
  const denominador = asistidos + convertidas.faltas

  return {
    presentes,
    tardanzas: convertidas.tardanzas,
    faltas: convertidas.faltas,
    justificados,
    tardanzasEnBruto,
    porcentaje:
      denominador === 0 ? 100 : Math.round((asistidos / denominador) * 100),
  }
}

export function sumarTotales(
  filas: readonly TotalesDeAsistencia[],
): TotalesDeAsistencia {
  const acumulado = filas.reduce(
    (suma, fila) => ({
      presentes: suma.presentes + fila.presentes,
      tardanzas: suma.tardanzas + fila.tardanzas,
      faltas: suma.faltas + fila.faltas,
      justificados: suma.justificados + fila.justificados,
      tardanzasEnBruto: suma.tardanzasEnBruto + fila.tardanzasEnBruto,
      porcentaje: 0,
    }),
    {
      presentes: 0,
      tardanzas: 0,
      faltas: 0,
      justificados: 0,
      tardanzasEnBruto: 0,
      porcentaje: 0,
    },
  )
  const asistidos =
    acumulado.presentes + acumulado.justificados + acumulado.tardanzas
  const denominador = asistidos + acumulado.faltas
  return {
    ...acumulado,
    porcentaje:
      denominador === 0 ? 100 : Math.round((asistidos / denominador) * 100),
  }
}
