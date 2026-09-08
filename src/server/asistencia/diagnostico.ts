import {
  clavesDeAsistencia,
  llamarConClave,
  modelosAIntentar,
} from './cliente-modelo.ts'
import type {
  DependenciasDelClienteModelo,
  EtiquetaDeClave,
  MotivoDeFalloAsistencia,
} from './cliente-modelo.ts'
import { asistenciaSimuladaActiva } from './simulado.ts'

/**
 * Diagnóstico de la asistencia, para el administrador.
 *
 * ## Por qué existe
 *
 * Cuando Gemini rechaza una llamada, el vendedor ve la banda «asistencia no
 * disponible» y nada más: el porqué (clave rechazada, cuota, modelo retirado,
 * red) queda en los logs de Cloud Run, que nadie del mostrador mira. Esto hace la
 * misma llamada que haría una foto, pero con un prompt fijo de una línea, y
 * devuelve el resultado por clave y modelo. **No sale ningún dato de clientes ni
 * del pedido**: el único contenido es la instrucción de responder `{"ok":true}`.
 *
 * Las claves nunca se devuelven; solo si están presentes y su longitud, que
 * basta para notar un secreto vacío o con salto de línea.
 */

const SCHEMA_SONDA = {
  type: 'OBJECT',
  properties: { ok: { type: 'BOOLEAN' } },
  required: ['ok'],
} as const

const PROMPT_SONDA =
  'Prueba de conectividad. Responde exactamente el JSON {"ok": true} y nada más.'

const TIMEOUT_SONDA_MS = 20_000

export interface SondaDeClave {
  readonly clave: EtiquetaDeClave
  readonly presente: boolean
  readonly longitud: number
  readonly modelo: string
  readonly resultado: 'ok' | 'ausente' | MotivoDeFalloAsistencia
  readonly status: number | null
  readonly estadoGemini: string | null
  readonly respondioOk: boolean | null
  readonly ms: number
}

export interface DiagnosticoDeAsistencia {
  readonly simuladoActivo: boolean
  readonly modelos: readonly string[]
  readonly sondas: readonly SondaDeClave[]
  readonly ejecutadoEn: string
}

export async function diagnosticarAsistencia(
  deps: DependenciasDelClienteModelo = {},
  ahora: () => Date = () => new Date(),
): Promise<DiagnosticoDeAsistencia> {
  const modelos = modelosAIntentar(deps)
  const { primaria, secundaria } = clavesDeAsistencia(deps)
  const claves: ReadonlyArray<{
    etiqueta: EtiquetaDeClave
    valor: string | undefined
  }> = [
    { etiqueta: 'primaria', valor: primaria },
    { etiqueta: 'secundaria', valor: secundaria },
  ]

  const sondas: SondaDeClave[] = []
  for (const { etiqueta, valor } of claves) {
    if (valor === undefined) {
      sondas.push({
        clave: etiqueta,
        presente: false,
        longitud: 0,
        modelo: modelos[0]!,
        resultado: 'ausente',
        status: null,
        estadoGemini: null,
        respondioOk: null,
        ms: 0,
      })
      continue
    }
    // Se sondea cada modelo de la cadena: así se ve si el respaldo también sirve.
    for (const modelo of modelos) {
      const inicio = Date.now()
      const resultado = await llamarConClave(
        valor,
        [{ text: PROMPT_SONDA }],
        deps,
        etiqueta,
        { schema: SCHEMA_SONDA, timeoutMs: TIMEOUT_SONDA_MS, modelo },
      )
      const ms = Date.now() - inicio
      if (resultado.ok) {
        const ok =
          resultado.json !== null &&
          typeof resultado.json === 'object' &&
          (resultado.json as { ok?: unknown }).ok === true
        sondas.push({
          clave: etiqueta,
          presente: true,
          longitud: valor.length,
          modelo,
          resultado: 'ok',
          status: 200,
          estadoGemini: null,
          respondioOk: ok,
          ms,
        })
      } else {
        sondas.push({
          clave: etiqueta,
          presente: true,
          longitud: valor.length,
          modelo,
          resultado: resultado.motivo,
          status: resultado.status ?? null,
          estadoGemini: resultado.estadoGemini ?? null,
          respondioOk: null,
          ms,
        })
      }
    }
  }

  return {
    simuladoActivo: asistenciaSimuladaActiva(),
    modelos,
    sondas,
    ejecutadoEn: ahora().toISOString(),
  }
}
