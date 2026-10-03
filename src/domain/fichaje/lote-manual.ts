import { semanaLaboralEnLima } from '../lista/semana.ts'
import { DIAS_LABORALES } from './reglas.ts'

/**
 * Qué días de la semana laboral actual se pueden fichar a mano.
 *
 * El domingo y cualquier fecha de otra semana invalidan el pedido entero.
 * Un día omitido significa solo que ya tenía entrada.
 */

export interface PlanDeLoteManual {
  readonly tipo: 'escribir'
  readonly fechas: readonly string[]
  readonly omitidas: readonly string[]
  readonly mensaje: string
}

export interface RechazoDeLoteManual {
  readonly tipo: 'rechazar'
  readonly codigo: 'peticion_invalida' | 'entrada_ya_registrada'
  readonly mensaje: string
}

export type DecisionDeLoteManual = PlanDeLoteManual | RechazoDeLoteManual

function lista(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  const ultimo = nombres[nombres.length - 1] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${ultimo}`
}

export function planificarLoteManual(entrada: {
  readonly ahora: Date
  readonly fechas: readonly string[]
  readonly ocupadas: ReadonlySet<string>
}): DecisionDeLoteManual {
  if (entrada.fechas.length === 0) {
    return {
      tipo: 'rechazar',
      codigo: 'peticion_invalida',
      mensaje: 'Elige al menos un día.',
    }
  }

  const semana = semanaLaboralEnLima(entrada.ahora)
  const nombreDe = new Map(
    semana.map((dia, indice) => [
      dia.fecha,
      DIAS_LABORALES[indice]?.nombre ?? dia.etiqueta,
    ]),
  )
  const pedidas = new Set(entrada.fechas)
  for (const fecha of pedidas) {
    if (!nombreDe.has(fecha)) {
      return {
        tipo: 'rechazar',
        codigo: 'peticion_invalida',
        mensaje: 'Esos días no pertenecen a esta semana laboral.',
      }
    }
  }

  const orden = semana.filter((dia) => pedidas.has(dia.fecha))
  const omitidas = orden.filter((dia) => entrada.ocupadas.has(dia.fecha))
  const libres = orden.filter((dia) => !entrada.ocupadas.has(dia.fecha))
  const nombresOmitidos = omitidas.map(
    (dia) => nombreDe.get(dia.fecha) ?? dia.etiqueta,
  )

  if (libres.length === 0) {
    const verbo = nombresOmitidos.length === 1 ? 'tenía' : 'tenían'
    return {
      tipo: 'rechazar',
      codigo: 'entrada_ya_registrada',
      mensaje: `Ya ${verbo} entrada: ${lista(nombresOmitidos)}.`,
    }
  }

  const nombresLibres = libres.map(
    (dia) => nombreDe.get(dia.fecha) ?? dia.etiqueta,
  )
  const registrado = `Registrado: ${lista(nombresLibres)}.`
  const mensaje =
    nombresOmitidos.length === 0
      ? registrado
      : `${registrado} Ya ${nombresOmitidos.length === 1 ? 'tenía' : 'tenían'} entrada: ${lista(nombresOmitidos)}.`

  return {
    tipo: 'escribir',
    fechas: libres.map((dia) => dia.fecha),
    omitidas: omitidas.map((dia) => dia.fecha),
    mensaje,
  }
}
