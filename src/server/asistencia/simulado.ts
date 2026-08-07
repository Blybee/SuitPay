import type {
  CandidatoDeAsistencia,
  RespuestaDelModelo,
  TipoDeCaptura,
} from './tipos.ts'

/**
 * Doble local del servicio de asistencia para unit/e2e sin Gemini real.
 * Activar con ASISTENCIA_SIMULADA=true.
 */

export type ModoSimulado =
  | 'exito'
  | 'ilegible'
  | 'con_pendientes'
  | 'caido'

let modoActual: ModoSimulado = 'exito'

export function fijarModoSimulado(modo: ModoSimulado): void {
  modoActual = modo
}

export function modoSimuladoActual(): ModoSimulado {
  return modoActual
}

export function asistenciaSimuladaActiva(): boolean {
  const flag = process.env.ASISTENCIA_SIMULADA
  if (flag === 'true' || flag === '1') return true
  if (flag === 'false' || flag === '0') return false
  // Emulador sin claves: caer a simulado para no romper e2e.
  const primaria = process.env.ASISTENCIA_CLAVE_PRIMARIA
  return !primaria || primaria.trim() === ''
}

export function interpretarSimulado(entrada: {
  readonly tipo: TipoDeCaptura
  readonly candidatos: readonly CandidatoDeAsistencia[]
}): RespuestaDelModelo {
  if (modoActual === 'caido') {
    throw new Error('asistencia_simulada_caida')
  }

  if (modoActual === 'ilegible') {
    return { ilegible: true, items: [] }
  }

  const lote = entrada.candidatos
  if (lote.length === 0) {
    return {
      ilegible: false,
      items: [
        {
          textoOriginal: 'producto desconocido',
          codigo: null,
          cantidad: 1,
          unidad: 'NIU',
          confidence: 'low',
        },
      ],
    }
  }

  if (modoActual === 'con_pendientes') {
    const primero = lote[0]!
    return {
      ilegible: false,
      items: [
        {
          textoOriginal: primero.descripcion,
          codigo: primero.codigo,
          cantidad: 2,
          unidad: primero.unidad,
          confidence: 'high',
        },
        {
          textoOriginal: '(renglón tachado ilegible)',
          codigo: null,
          cantidad: 1,
          unidad: 'NIU',
          confidence: 'low',
          ilegible: true,
        },
      ],
    }
  }

  // exito: hasta 3 productos del lote; el segundo queda ambiguo (sin codigo).
  const items = lote.slice(0, 3).map((c, i) => ({
    textoOriginal:
      entrada.tipo === 'imagen'
        ? `línea ${i + 1}: ${c.descripcion}`
        : `${i + 1} ${c.descripcion}`,
    codigo: i === 1 ? null : c.codigo,
    cantidad: i + 1,
    unidad: c.unidad,
    confidence: i === 1 ? ('low' as const) : ('high' as const),
  }))

  return { ilegible: false, items }
}
