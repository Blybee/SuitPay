import { ErrorDeSuitPay } from '../errores.ts'
import { SCHEMA_RESPUESTA_ASISTENCIA, promptDeAsistencia } from './prompts.ts'
import type { MedioEnPayload } from './payload.ts'
import type {
  CandidatoDeAsistencia,
  ItemDelModelo,
  RespuestaDelModelo,
  TipoDeCaptura,
} from './tipos.ts'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
/** Mismo preview que la tienda virtual; sobreescribir con ASISTENCIA_MODELO. */
const MODELO_POR_DEFECTO = 'gemini-3-flash-preview'

export type FetchComo = typeof fetch

export interface DependenciasDelClienteModelo {
  readonly fetchFn?: FetchComo
  readonly clavePrimaria?: string
  readonly claveSecundaria?: string
  readonly modelo?: string
  readonly timeoutMs?: number
}

interface ParteGemini {
  text?: string
  inlineData?: { mimeType: string; data: string }
  mediaResolution?: { level: string }
}

function leerClaves(deps: DependenciasDelClienteModelo): {
  primaria: string | undefined
  secundaria: string | undefined
} {
  return {
    primaria:
      deps.clavePrimaria ?? process.env.ASISTENCIA_CLAVE_PRIMARIA ?? undefined,
    secundaria:
      deps.claveSecundaria ??
      process.env.ASISTENCIA_CLAVE_SECUNDARIA ??
      undefined,
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
    typeof r.cantidad === 'number' && Number.isFinite(r.cantidad) && r.cantidad > 0
      ? r.cantidad
      : 1
  const unidad = typeof r.unidad === 'string' && r.unidad.trim() !== ''
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

export function normalizarRespuestaDelModelo(valor: unknown): RespuestaDelModelo {
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

async function llamarConClave(
  clave: string,
  partes: ParteGemini[],
  deps: DependenciasDelClienteModelo,
  etiquetaClave: 'primaria' | 'secundaria',
): Promise<{ ok: true; json: unknown } | { ok: false; cuota: boolean }> {
  const fetchFn = deps.fetchFn ?? fetch
  const modelo =
    deps.modelo ?? process.env.ASISTENCIA_MODELO ?? MODELO_POR_DEFECTO
  const timeoutMs = deps.timeoutMs ?? 45_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const url = `${GEMINI_API_BASE}/${modelo}:generateContent`

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
          responseSchema: SCHEMA_RESPUESTA_ASISTENCIA,
        },
      }),
    })

    const cuerpoTexto = await response.text()
    if (!response.ok) {
      const resumen = cuerpoTexto.slice(0, 280).replace(/\s+/g, ' ')
      console.error(
        `[SuitPay] asistencia Gemini (${etiquetaClave}) HTTP ${response.status} modelo=${modelo}: ${resumen}`,
      )
      return { ok: false, cuota: esErrorDeCuota(response.status, cuerpoTexto) }
    }

    let data: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }
    try {
      data = JSON.parse(cuerpoTexto) as typeof data
    } catch {
      console.error(
        `[SuitPay] asistencia Gemini (${etiquetaClave}): respuesta no JSON`,
      )
      return { ok: false, cuota: false }
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error(
        `[SuitPay] asistencia Gemini (${etiquetaClave}): sin texto en candidates`,
      )
      return { ok: false, cuota: false }
    }

    try {
      return { ok: true, json: JSON.parse(text) as unknown }
    } catch {
      console.error(
        `[SuitPay] asistencia Gemini (${etiquetaClave}): texto no parseable como JSON`,
      )
      return { ok: false, cuota: false }
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    console.error(
      `[SuitPay] asistencia Gemini (${etiquetaClave}) red/timeout: ${mensaje}`,
    )
    return { ok: false, cuota: false }
  } finally {
    clearTimeout(timer)
  }
}

export async function invocarModelo(entrada: {
  readonly tipo: TipoDeCaptura
  readonly medio: MedioEnPayload
  readonly candidatos: readonly CandidatoDeAsistencia[]
  readonly deps?: DependenciasDelClienteModelo
}): Promise<RespuestaDelModelo> {
  const deps = entrada.deps ?? {}
  const { primaria, secundaria } = leerClaves(deps)

  if (!primaria && !secundaria) {
    console.error(
      '[SuitPay] asistencia: faltan ASISTENCIA_CLAVE_PRIMARIA / _SECUNDARIA en el proceso del servidor',
    )
    throw new ErrorDeSuitPay('asistencia_no_disponible')
  }

  const modelo =
    deps.modelo ?? process.env.ASISTENCIA_MODELO ?? MODELO_POR_DEFECTO
  console.info(
    `[SuitPay] asistencia: modelo=${modelo} claves=${primaria ? 'P' : '-'}${secundaria ? 'S' : '-'} candidatos=${entrada.candidatos.length} medio=${entrada.medio.mimeType} (~${Math.round((entrada.medio.dataBase64.length * 0.75) / 1024)} KB)`,
  )

  const prompt = promptDeAsistencia(entrada.tipo, entrada.candidatos)
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

  const intentos: Array<{
    clave: string
    etiqueta: 'primaria' | 'secundaria'
  }> = []
  if (primaria) intentos.push({ clave: primaria, etiqueta: 'primaria' })
  if (secundaria) intentos.push({ clave: secundaria, etiqueta: 'secundaria' })

  for (const intento of intentos) {
    const resultado = await llamarConClave(
      intento.clave,
      partes,
      deps,
      intento.etiqueta,
    )
    if (resultado.ok) {
      return normalizarRespuestaDelModelo(resultado.json)
    }
  }

  throw new ErrorDeSuitPay('asistencia_no_disponible')
}
