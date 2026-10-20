import { anonimizarTexto } from '../../domain/aprendizaje/compacto.ts'
import type { ParteGemini } from '../asistencia/cliente-modelo.ts'
import { payloadContieneDatosDeCliente } from '../asistencia/payload.ts'
import { cumpleEsquema, esquemaGeminiAJson } from './esquema.ts'

const URL_CHAT = 'https://openrouter.ai/api/v1/chat/completions'

export type MotivoDeRespaldo =
  | '429'
  | '402'
  | 'timeout'
  | 'json_invalido'
  | 'red'
  | 'payload'
  | 'sin_clave'
  | 'indice_clientes'
  | `${number}`

export type ResultadoOpenRouter =
  | { readonly ok: true; readonly json: unknown; readonly modelo: string }
  | {
      readonly ok: false
      readonly motivo: MotivoDeRespaldo
      readonly modelo: string
      readonly status?: number
    }

function motivoHttp(status: number): MotivoDeRespaldo {
  if (status === 429) return '429'
  if (status === 402) return '402'
  return String(status) as MotivoDeRespaldo
}

function textoAnonimo(
  partes: readonly ParteGemini[],
  nombres: readonly string[],
): string {
  return partes
    .map((parte) =>
      parte.text === undefined ? '' : anonimizarTexto(parte.text, nombres),
    )
    .filter((texto) => texto !== '')
    .join('\n\n')
}

function contenidoDe(
  partes: readonly ParteGemini[],
  nombres: readonly string[],
): string | readonly Record<string, unknown>[] {
  const hayImagen = partes.some((parte) =>
    parte.inlineData?.mimeType.startsWith('image/'),
  )
  if (!hayImagen) return textoAnonimo(partes, nombres)
  const bloques: Record<string, unknown>[] = []
  for (const parte of partes) {
    if (parte.text !== undefined && parte.text !== '') {
      bloques.push({
        type: 'text',
        text: anonimizarTexto(parte.text, nombres),
      })
    }
    if (parte.inlineData?.mimeType.startsWith('image/')) {
      bloques.push({
        type: 'image_url',
        image_url: {
          url: `data:${parte.inlineData.mimeType};base64,${parte.inlineData.data}`,
        },
      })
    }
  }
  return bloques
}

export function cuerpoDeOpenRouter(entrada: {
  readonly modelo: string
  readonly partes: readonly ParteGemini[]
  readonly schema: unknown
  readonly nombres: readonly string[]
}): Record<string, unknown> {
  return {
    model: entrada.modelo,
    messages: [
      {
        role: 'user',
        content: contenidoDe(entrada.partes, entrada.nombres),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'respuesta',
        strict: false,
        schema: esquemaGeminiAJson(entrada.schema),
      },
    },
  }
}

function jsonDelMensaje(data: unknown): unknown {
  if (data === null || typeof data !== 'object') return undefined
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return undefined
  const mensaje = (choices[0] as { message?: { content?: unknown } } | undefined)
    ?.message
  const content = mensaje?.content
  if (typeof content !== 'string' || content.trim() === '') return undefined
  return JSON.parse(content) as unknown
}

export async function llamarOpenRouter(entrada: {
  readonly modelo: string
  readonly partes: readonly ParteGemini[]
  readonly schema: unknown
  readonly nombres: readonly string[]
  readonly clave: string
  readonly fetchFn: typeof fetch
  readonly timeoutMs: number
}): Promise<ResultadoOpenRouter> {
  const cuerpo = cuerpoDeOpenRouter(entrada)
  if (payloadContieneDatosDeCliente(cuerpo)) {
    return { ok: false, motivo: 'payload', modelo: entrada.modelo }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), entrada.timeoutMs)
  try {
    const respuesta = await entrada.fetchFn(URL_CHAT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${entrada.clave}`,
      },
      body: JSON.stringify(cuerpo),
    })
    const texto = await respuesta.text()
    if (!respuesta.ok) {
      return {
        ok: false,
        motivo: motivoHttp(respuesta.status),
        modelo: entrada.modelo,
        status: respuesta.status,
      }
    }
    let data: unknown
    try {
      data = JSON.parse(texto)
    } catch {
      return { ok: false, motivo: 'json_invalido', modelo: entrada.modelo }
    }
    let json: unknown
    try {
      json = jsonDelMensaje(data)
    } catch {
      return { ok: false, motivo: 'json_invalido', modelo: entrada.modelo }
    }
    if (json === undefined || !cumpleEsquema(json, entrada.schema)) {
      return { ok: false, motivo: 'json_invalido', modelo: entrada.modelo }
    }
    return { ok: true, json, modelo: entrada.modelo }
  } catch (error) {
    const esTimeout =
      controller.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    return {
      ok: false,
      motivo: esTimeout ? 'timeout' : 'red',
      modelo: entrada.modelo,
    }
  } finally {
    clearTimeout(timer)
  }
}
