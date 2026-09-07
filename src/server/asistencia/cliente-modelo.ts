import { ErrorDeSuitPay } from '../errores.ts'
import { SCHEMA_RESPUESTA_ASISTENCIA, promptDeAsistencia } from './prompts.ts'
import type { MedioEnPayload } from './payload.ts'
import type {
  CandidatoDeAsistencia,
  ItemDelModelo,
  RespuestaDelModelo,
  TipoDeCaptura,
} from './tipos.ts'

const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models'
/** Mismo preview que la tienda virtual; sobreescribir con ASISTENCIA_MODELO. */
export const MODELO_POR_DEFECTO = 'gemini-3-flash-preview'
/**
 * Al que se pasa si el principal responde 404 (preview retirado o renombrado).
 * Estable con soporte largo; sobreescribir con ASISTENCIA_MODELO_RESPALDO
 * (vacío = sin respaldo).
 */
export const MODELO_DE_RESPALDO_POR_DEFECTO = 'gemini-3.5-flash'

export type FetchComo = typeof fetch

export interface DependenciasDelClienteModelo {
  readonly fetchFn?: FetchComo
  readonly clavePrimaria?: string
  readonly claveSecundaria?: string
  readonly modelo?: string
  /** `null` desactiva el respaldo (pruebas). */
  readonly modeloRespaldo?: string | null
  readonly timeoutMs?: number
}

export interface ParteGemini {
  text?: string
  inlineData?: { mimeType: string; data: string }
  fileData?: { mimeType: string; fileUri: string }
  mediaResolution?: { level: string }
}

/**
 * Por qué falló una llamada, en una palabra estable que viaja al cliente en
 * `detalle.motivo`. El texto crudo de Gemini se queda en el log del servidor.
 */
export type MotivoDeFalloAsistencia =
  | 'sin_claves'
  | 'cuota'
  | 'modelo_no_disponible'
  | 'clave_rechazada'
  | 'http_error'
  | 'timeout'
  | 'red'
  | 'respuesta_no_json'
  | 'sin_texto'
  | 'texto_no_json'

export type EtiquetaDeClave = 'primaria' | 'secundaria'

export interface FalloDeLlamada {
  readonly ok: false
  readonly motivo: MotivoDeFalloAsistencia
  readonly cuota: boolean
  readonly status?: number
  /** `error.status` de Gemini (p. ej. `PERMISSION_DENIED`), no su mensaje. */
  readonly estadoGemini?: string
  readonly modelo: string
  readonly clave: EtiquetaDeClave
}

export type ResultadoDeLlamada =
  | { readonly ok: true; readonly json: unknown; readonly modelo: string }
  | FalloDeLlamada

function saneada(valor: string | undefined): string | undefined {
  // Un secreto creado con `echo` arrastra un salto de línea: la cabecera
  // `x-goog-api-key` con "\n" hace que Gemini rechace la clave (400) o que
  // `fetch` lance antes de salir. Nunca debe depender de cómo se cargó.
  const limpio = valor?.trim()
  return limpio === undefined || limpio === '' ? undefined : limpio
}

function leerClaves(deps: DependenciasDelClienteModelo): {
  primaria: string | undefined
  secundaria: string | undefined
} {
  return {
    primaria: saneada(
      deps.clavePrimaria ?? process.env.ASISTENCIA_CLAVE_PRIMARIA,
    ),
    secundaria: saneada(
      deps.claveSecundaria ?? process.env.ASISTENCIA_CLAVE_SECUNDARIA,
    ),
  }
}

export function modelosAIntentar(deps: DependenciasDelClienteModelo): string[] {
  const principal =
    saneada(deps.modelo) ??
    saneada(process.env.ASISTENCIA_MODELO) ??
    MODELO_POR_DEFECTO
  const respaldo =
    deps.modeloRespaldo === null
      ? undefined
      : (saneada(deps.modeloRespaldo) ??
        (process.env.ASISTENCIA_MODELO_RESPALDO === undefined
          ? MODELO_DE_RESPALDO_POR_DEFECTO
          : saneada(process.env.ASISTENCIA_MODELO_RESPALDO)))
  return respaldo === undefined || respaldo === principal
    ? [principal]
    : [principal, respaldo]
}

/**
 * `error.status` (p. ej. `INVALID_ARGUMENT`) más el `reason` de ErrorInfo si
 * viene (p. ej. `API_KEY_INVALID`): son enumeraciones estables, no el mensaje.
 */
function estadoGeminiDe(cuerpo: string): string | undefined {
  try {
    const parseado = JSON.parse(cuerpo) as {
      error?: { status?: unknown; details?: unknown }
    }
    const estado = parseado.error?.status
    const detalles = Array.isArray(parseado.error?.details)
      ? parseado.error.details
      : []
    const razon = detalles
      .map((d) =>
        d &&
        typeof d === 'object' &&
        typeof (d as { reason?: unknown }).reason === 'string'
          ? (d as { reason: string }).reason
          : undefined,
      )
      .find((r) => r !== undefined)
    if (typeof estado !== 'string') return razon
    return razon === undefined ? estado : `${estado}/${razon}`
  } catch {
    return undefined
  }
}

function esErrorDeCuota(status: number, cuerpo: string): boolean {
  if (status === 429) return true
  const bajo = cuerpo.toLowerCase()
  return (
    bajo.includes('quota') ||
    bajo.includes('resource_exhausted') ||
    bajo.includes('rate limit')
  )
}

function esModeloNoDisponible(status: number, cuerpo: string): boolean {
  if (status === 404) return true
  const bajo = cuerpo.toLowerCase()
  return (
    bajo.includes('is not found') ||
    bajo.includes('not supported for generatecontent')
  )
}

function esClaveRechazada(status: number, cuerpo: string): boolean {
  if (status === 401 || status === 403) return true
  const bajo = cuerpo.toLowerCase()
  return (
    status === 400 &&
    (bajo.includes('api key not valid') || bajo.includes('api_key_invalid'))
  )
}

function clasificarHttp(
  status: number,
  cuerpo: string,
): MotivoDeFalloAsistencia {
  if (esErrorDeCuota(status, cuerpo)) return 'cuota'
  if (esModeloNoDisponible(status, cuerpo)) return 'modelo_no_disponible'
  if (esClaveRechazada(status, cuerpo)) return 'clave_rechazada'
  return 'http_error'
}

/**
 * Primer texto útil de la respuesta. Los modelos con razonamiento pueden
 * anteponer partes `thought`; el JSON pedido va en la primera parte que no lo es.
 */
export function textoDeRespuestaGemini(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const candidatos = (data as { candidates?: unknown }).candidates
  if (!Array.isArray(candidatos)) return undefined
  const primero = candidatos[0] as { content?: { parts?: unknown } } | undefined
  const partes = primero?.content?.parts
  if (!Array.isArray(partes)) return undefined
  for (const parte of partes) {
    if (!parte || typeof parte !== 'object') continue
    const p = parte as { text?: unknown; thought?: unknown }
    if (p.thought === true) continue
    if (typeof p.text === 'string' && p.text.trim() !== '') return p.text
  }
  return undefined
}

function normalizarItem(raw: unknown): ItemDelModelo | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const textoOriginal =
    typeof r.textoOriginal === 'string' ? r.textoOriginal.trim() : ''
  if (textoOriginal === '' && r.ilegible !== true) return null
  const codigo =
    typeof r.codigo === 'string' && r.codigo.trim() !== ''
      ? r.codigo.trim()
      : null
  const cantidad =
    typeof r.cantidad === 'number' &&
    Number.isFinite(r.cantidad) &&
    r.cantidad > 0
      ? r.cantidad
      : 1
  const unidad =
    typeof r.unidad === 'string' && r.unidad.trim() !== ''
      ? r.unidad.trim()
      : 'NIU'
  const confidence = r.confidence === 'high' ? 'high' : 'low'
  return {
    textoOriginal: textoOriginal || '(renglón ilegible)',
    codigo,
    cantidad,
    unidad,
    confidence,
    ilegible: r.ilegible === true,
  }
}

export function normalizarRespuestaDelModelo(
  valor: unknown,
): RespuestaDelModelo {
  if (!valor || typeof valor !== 'object') {
    return { ilegible: false, items: [] }
  }
  const r = valor as Record<string, unknown>
  const itemsRaw = Array.isArray(r.items) ? r.items : []
  const items = itemsRaw
    .map(normalizarItem)
    .filter((i): i is ItemDelModelo => i !== null)
  return {
    ilegible: r.ilegible === true,
    items,
  }
}

export async function llamarConClave(
  clave: string,
  partes: ParteGemini[],
  deps: DependenciasDelClienteModelo,
  etiquetaClave: EtiquetaDeClave,
  opciones?: {
    readonly schema?: unknown
    readonly timeoutMs?: number
    readonly modelo?: string
  },
): Promise<ResultadoDeLlamada> {
  const fetchFn = deps.fetchFn ?? fetch
  const modelo = opciones?.modelo ?? modelosAIntentar(deps)[0]!
  const timeoutMs = opciones?.timeoutMs ?? deps.timeoutMs ?? 45_000
  const schema = opciones?.schema ?? SCHEMA_RESPUESTA_ASISTENCIA
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const url = `${GEMINI_API_BASE}/${modelo}:generateContent`
  const fallo = (
    motivo: MotivoDeFalloAsistencia,
    extra?: { status?: number; estadoGemini?: string },
  ): FalloDeLlamada => ({
    ok: false,
    motivo,
    cuota: motivo === 'cuota',
    modelo,
    clave: etiquetaClave,
    ...(extra?.status !== undefined ? { status: extra.status } : {}),
    ...(extra?.estadoGemini !== undefined
      ? { estadoGemini: extra.estadoGemini }
      : {}),
  })

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': clave,
      },
      body: JSON.stringify({
        contents: [{ parts: partes }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    })

    const cuerpoTexto = await response.text()
    if (!response.ok) {
      const resumen = cuerpoTexto.slice(0, 280).replace(/\s+/g, ' ')
      const motivo = clasificarHttp(response.status, cuerpoTexto)
      console.error(
        `[SuitPay] asistencia Gemini (${etiquetaClave}) HTTP ${response.status} modelo=${modelo} motivo=${motivo}: ${resumen}`,
      )
      return fallo(motivo, {
        status: response.status,
        estadoGemini: estadoGeminiDe(cuerpoTexto),
      })
    }

    let data: unknown
    try {
      data = JSON.parse(cuerpoTexto)
    } catch {
      console.error(
        `[SuitPay] asistencia Gemini (${etiquetaClave}) modelo=${modelo}: respuesta no JSON`,
      )
      return fallo('respuesta_no_json', { status: response.status })
    }

    const text = textoDeRespuestaGemini(data)
    if (text === undefined) {
      const finishReason = (
        data as { candidates?: Array<{ finishReason?: unknown }> }
      ).candidates?.[0]?.finishReason
      console.error(
        `[SuitPay] asistencia Gemini (${etiquetaClave}) modelo=${modelo}: sin texto en candidates (finishReason=${String(finishReason)}) ${cuerpoTexto.slice(0, 280).replace(/\s+/g, ' ')}`,
      )
      return fallo('sin_texto', {
        status: response.status,
        estadoGemini:
          typeof finishReason === 'string' ? finishReason : undefined,
      })
    }

    try {
      return { ok: true, json: JSON.parse(text) as unknown, modelo }
    } catch {
      console.error(
        `[SuitPay] asistencia Gemini (${etiquetaClave}) modelo=${modelo}: texto no parseable como JSON`,
      )
      return fallo('texto_no_json', { status: response.status })
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    const esTimeout =
      controller.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    console.error(
      `[SuitPay] asistencia Gemini (${etiquetaClave}) modelo=${modelo} ${esTimeout ? `timeout ${timeoutMs}ms` : 'red'}: ${mensaje}`,
    )
    return fallo(esTimeout ? 'timeout' : 'red')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Recorre modelos × claves. La clave secundaria es la contingencia ante cuota o
 * clave rechazada; el modelo de respaldo, la contingencia ante un modelo
 * retirado (404). Un timeout corta: repetirlo con otra clave solo multiplica la
 * espera del vendedor.
 */
async function intentarLlamadas(entrada: {
  readonly partes: readonly ParteGemini[]
  readonly deps: DependenciasDelClienteModelo
  readonly schema?: unknown
  readonly timeoutMs?: number
}): Promise<{ json: unknown; modelo: string }> {
  const { primaria, secundaria } = leerClaves(entrada.deps)
  if (!primaria && !secundaria) {
    console.error(
      '[SuitPay] asistencia: faltan ASISTENCIA_CLAVE_PRIMARIA / _SECUNDARIA en el proceso del servidor',
    )
    throw new ErrorDeSuitPay('asistencia_no_disponible', {
      motivo: 'sin_claves',
    })
  }
  const claves: Array<{ clave: string; etiqueta: EtiquetaDeClave }> = []
  if (primaria) claves.push({ clave: primaria, etiqueta: 'primaria' })
  if (secundaria) claves.push({ clave: secundaria, etiqueta: 'secundaria' })

  const fallos: FalloDeLlamada[] = []
  modelos: for (const modelo of modelosAIntentar(entrada.deps)) {
    for (const { clave, etiqueta } of claves) {
      const resultado = await llamarConClave(
        clave,
        [...entrada.partes],
        entrada.deps,
        etiqueta,
        { schema: entrada.schema, timeoutMs: entrada.timeoutMs, modelo },
      )
      if (resultado.ok)
        return { json: resultado.json, modelo: resultado.modelo }
      fallos.push(resultado)
      if (resultado.motivo === 'timeout') break modelos
      if (resultado.motivo === 'modelo_no_disponible') continue modelos
    }
    const ultimo = fallos[fallos.length - 1]
    // Si el modelo respondió (cuota, clave, 5xx…), cambiar de modelo no ayuda.
    if (ultimo && ultimo.motivo !== 'modelo_no_disponible') break
  }

  throw new ErrorDeSuitPay('asistencia_no_disponible', detalleDeFallos(fallos))
}

/** Lo que viaja al cliente: motivo del último intento, sin texto del proveedor. */
export function detalleDeFallos(fallos: readonly FalloDeLlamada[]): {
  readonly motivo: MotivoDeFalloAsistencia
  readonly intentos: number
  readonly modelo: string
  readonly clave: EtiquetaDeClave
  readonly status: number | null
  readonly estadoGemini: string | null
} {
  const ultimo = fallos[fallos.length - 1]
  if (ultimo === undefined) {
    return {
      motivo: 'sin_claves',
      intentos: 0,
      modelo: '',
      clave: 'primaria',
      status: null,
      estadoGemini: null,
    }
  }
  return {
    motivo: ultimo.motivo,
    intentos: fallos.length,
    modelo: ultimo.modelo,
    clave: ultimo.clave,
    status: ultimo.status ?? null,
    estadoGemini: ultimo.estadoGemini ?? null,
  }
}

export async function invocarModelo(entrada: {
  readonly tipo: TipoDeCaptura
  readonly medio: MedioEnPayload
  readonly candidatos: readonly CandidatoDeAsistencia[]
  readonly instrucciones?: readonly string[]
  readonly deps?: DependenciasDelClienteModelo
}): Promise<RespuestaDelModelo> {
  const deps = entrada.deps ?? {}
  const { primaria, secundaria } = leerClaves(deps)
  console.info(
    `[SuitPay] asistencia: modelos=${modelosAIntentar(deps).join('>')} claves=${primaria ? 'P' : '-'}${secundaria ? 'S' : '-'} candidatos=${entrada.candidatos.length} medio=${entrada.medio.mimeType} (~${Math.round((entrada.medio.dataBase64.length * 0.75) / 1024)} KB)`,
  )

  const prompt = promptDeAsistencia(
    entrada.tipo,
    entrada.candidatos,
    entrada.instrucciones ?? [],
  )
  const partes: ParteGemini[] = [
    { text: prompt },
    {
      inlineData: {
        mimeType: entrada.medio.mimeType,
        data: entrada.medio.dataBase64,
      },
      ...(entrada.tipo === 'imagen'
        ? { mediaResolution: { level: 'MEDIA_RESOLUTION_HIGH' } }
        : {}),
    },
  ]

  const { json } = await intentarLlamadas({ partes, deps })
  return normalizarRespuestaDelModelo(json)
}

/**
 * generateContent con partes y schema propios (PDF FR-061).
 * Reutiliza claves y conmutación de cuota; no usa el prompt de audio/foto.
 */
export async function invocarModeloConPartes(entrada: {
  readonly partes: readonly ParteGemini[]
  readonly schema: unknown
  readonly deps?: DependenciasDelClienteModelo
  readonly timeoutMs?: number
}): Promise<unknown> {
  const { json } = await intentarLlamadas({
    partes: entrada.partes,
    deps: entrada.deps ?? {},
    schema: entrada.schema,
    timeoutMs: entrada.timeoutMs,
  })
  return json
}

export function clavesDeAsistencia(deps: DependenciasDelClienteModelo = {}): {
  primaria: string | undefined
  secundaria: string | undefined
} {
  return leerClaves(deps)
}
