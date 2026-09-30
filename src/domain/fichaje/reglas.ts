import { diaEnLima, ZONA_HORARIA } from '../anulacion/ventana.ts'

/**
 * Asistencia de entrada. Lima no tiene horario de verano: UTC−5 es estable.
 *
 * La hora que cuenta es la de la aprobación (o la que fija el jefe a mano),
 * nunca la del envío de la solicitud.
 */

export const HORA_DE_ENTRADA = 10 * 60
export const HORA_DE_ENTRADA_TEXTO = '10:00'
/** Minutos de gracia después de la hora de entrada configurada. */
export const TOLERANCIA_DE_ENTRADA = 15
export const MINUTO_DE_TOLERANCIA = HORA_DE_ENTRADA + TOLERANCIA_DE_ENTRADA

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

const NOMBRE = /^[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*)+$/u

export function minutosDelDiaEnLima(instante: Date): number {
  const partes = HORA.formatToParts(instante)
  const hora = Number(partes.find((parte) => parte.type === 'hour')?.value)
  const minuto = Number(partes.find((parte) => parte.type === 'minute')?.value)
  const horaNormal = hora === 24 ? 0 : hora
  return horaNormal * 60 + minuto
}

/** `HH:MM` en 24 h, o null si no es una hora del día. */
export function minutosDeHora(hora: string): number | null {
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
  return horas * 60 + minutos
}

export function textoDeMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}

/** Lunes = 0 … sábado = 5. El domingo no tiene hora de entrada. */
export const DIAS_LABORALES = [
  { indice: 0, letra: 'L', nombre: 'lunes' },
  { indice: 1, letra: 'M', nombre: 'martes' },
  { indice: 2, letra: 'X', nombre: 'miércoles' },
  { indice: 3, letra: 'J', nombre: 'jueves' },
  { indice: 4, letra: 'V', nombre: 'viernes' },
  { indice: 5, letra: 'S', nombre: 'sábado' },
] as const

/** Claves `"0"`–`"5"`. Una hora `HH:MM` por día laboral. */
export type HorarioSemanal = Readonly<Record<string, string>>

const ORDEN_SEMANA: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

/** 0 = lunes … 6 = domingo, en Lima. */
export function indiceDeSemanaEnLima(instante: Date): number {
  return ORDEN_SEMANA[DIA_SEMANA.format(instante)] ?? 0
}

function semanaDesdeTexto(hora: string): HorarioSemanal | null {
  if (minutosDeHora(hora) === null) return null
  const semana: Record<string, string> = {}
  for (const dia of DIAS_LABORALES) semana[String(dia.indice)] = hora
  return semana
}

function semanaDesdeMapa(valor: object): HorarioSemanal | null {
  const crudo = valor as Record<string, unknown>
  const semana: Record<string, string> = {}
  for (const dia of DIAS_LABORALES) {
    const hora = crudo[String(dia.indice)]
    if (typeof hora !== 'string' || minutosDeHora(hora) === null) continue
    semana[String(dia.indice)] = hora
  }
  return Object.keys(semana).length > 0 ? semana : null
}

/**
 * Horarios por trabajador. Un string legado (`"10:00"`) aplica a lunes–sábado.
 * Un mapa usa la clave del día (`"0"` lunes … `"5"` sábado).
 */
export function horariosDesde(
  valor: unknown,
): Record<string, HorarioSemanal> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return {}
  }
  const salida: Record<string, HorarioSemanal> = {}
  for (const [clave, cada] of Object.entries(valor)) {
    const semana =
      typeof cada === 'string'
        ? semanaDesdeTexto(cada)
        : typeof cada === 'object' && cada !== null && !Array.isArray(cada)
          ? semanaDesdeMapa(cada)
          : null
    if (semana !== null) salida[clave] = semana
  }
  return salida
}

/** Los seis días laborales, o null si falta uno o la hora no es válida. */
export function semanaCompleta(
  dias: Readonly<Record<string, string>>,
): Record<string, string> | null {
  const semana: Record<string, string> = {}
  for (const dia of DIAS_LABORALES) {
    const hora = dias[String(dia.indice)]
    if (hora === undefined) return null
    const minutos = minutosDeHora(hora)
    if (minutos === null) return null
    semana[String(dia.indice)] = textoDeMinutos(minutos)
  }
  return semana
}

/**
 * Agrupa los días que comparten hora, en orden de semana.
 * Sin horario guardado, lunes a sábado quedan en 10:00.
 */
export function gruposDesdeHorario(
  semana: HorarioSemanal | undefined,
): { hora: string; dias: number[] }[] {
  const porHora = new Map<string, number[]>()
  const orden: string[] = []
  for (const dia of DIAS_LABORALES) {
    const hora = semana?.[String(dia.indice)] ?? HORA_DE_ENTRADA_TEXTO
    const lista = porHora.get(hora)
    if (lista === undefined) {
      porHora.set(hora, [dia.indice])
      orden.push(hora)
    } else {
      lista.push(dia.indice)
    }
  }
  return orden.map((hora) => ({ hora, dias: porHora.get(hora) ?? [] }))
}

/**
 * Hora de entrada de un trabajador en un día (0 = lunes … 5 = sábado).
 * Sin valor para ese día, vuelve a las 10:00.
 */
export function horaDeEntradaDe(
  horarios: Readonly<Record<string, HorarioSemanal>> | undefined,
  clave: string,
  indiceDia: number,
): number {
  const texto = horarios?.[clave]?.[String(indiceDia)]
  if (texto === undefined) return HORA_DE_ENTRADA
  return minutosDeHora(texto) ?? HORA_DE_ENTRADA
}

/**
 * Presente hasta la hora de entrada más 15 minutos, inclusive.
 * Sin segundo argumento, la hora es las 10:00 (presente hasta las 10:15).
 */
export function estadoPorHoraDeEntrada(
  instante: Date,
  horaEntrada = HORA_DE_ENTRADA,
): 'presente' | 'tardanza' {
  return minutosDelDiaEnLima(instante) <= horaEntrada + TOLERANCIA_DE_ENTRADA
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

/** Nombre completo: al menos dos palabras, sin dígitos, entre 3 y 80 caracteres. */
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
