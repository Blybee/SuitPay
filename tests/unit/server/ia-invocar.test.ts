import { afterEach, describe, expect, it, vi } from 'vitest'
import { INTERRUPTORES_POR_DEFECTO } from '../../../src/domain/ia/proveedor.ts'
import { MODELO_OPENROUTER_TEXTO_POR_DEFECTO } from '../../../src/server/ia/modelos.ts'
import { invocarIa } from '../../../src/server/ia/invocar.ts'
import { payloadContieneDatosDeCliente } from '../../../src/server/asistencia/payload.ts'

const SCHEMA = {
  type: 'OBJECT',
  properties: { ok: { type: 'BOOLEAN' } },
  required: ['ok'],
} as const

const AMBOS_ABIERTOS = { texto: 'openrouter', imagen: 'openrouter' } as const

function respuestaGemini(json: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
    }),
    { status: 200 },
  )
}

function respuestaOpenRouter(json: unknown, status = 200): Response {
  if (status !== 200) return new Response('{}', { status })
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(json) } }],
    }),
    { status: 200 },
  )
}

describe('invocarIa', () => {
  const clavePrevia = process.env.OPENROUTER_API_KEY
  const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})

  afterEach(() => {
    avisos.mockClear()
    if (clavePrevia === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = clavePrevia
  })

  it('con los interruptores por defecto el texto sale a OpenRouter y la imagen a Gemini', async () => {
    process.env.OPENROUTER_API_KEY = 'clave-de-prueba'
    const urls: string[] = []
    const fetchFn = vi.fn(async (url: string) => {
      urls.push(String(url))
      if (String(url).includes('openrouter.ai')) {
        return respuestaOpenRouter({ ok: true })
      }
      return respuestaGemini({ ok: true })
    })
    const deps = {
      fetchFn: fetchFn as unknown as typeof fetch,
      clavePrimaria: 'k-gemini',
      modeloRespaldo: null,
      timeoutMs: 2_000,
    }
    const texto = await invocarIa({
      modalidad: 'texto',
      partes: [{ text: '12 codo PVC' }],
      schema: SCHEMA,
      deps,
      interruptores: INTERRUPTORES_POR_DEFECTO,
      nombresDeClientes: [],
    })
    const imagen = await invocarIa({
      modalidad: 'imagen',
      partes: [
        { text: 'foto' },
        { inlineData: { mimeType: 'image/jpeg', data: 'YQ==' } },
      ],
      schema: SCHEMA,
      deps,
      interruptores: INTERRUPTORES_POR_DEFECTO,
      nombresDeClientes: [],
    })
    expect(texto).toEqual({ ok: true })
    expect(imagen).toEqual({ ok: true })
    expect(urls[0]).toContain('openrouter.ai')
    expect(urls[1]).toContain('generativelanguage.googleapis.com')
  })

  it('audio, PDF y compras llaman a Gemini aunque los interruptores estén en OpenRouter', async () => {
    process.env.OPENROUTER_API_KEY = 'clave-de-prueba'
    const urls: string[] = []
    const fetchFn = vi.fn(async (url: string) => {
      urls.push(String(url))
      return respuestaGemini({ ok: true })
    })
    const deps = {
      fetchFn: fetchFn as unknown as typeof fetch,
      clavePrimaria: 'k-gemini',
      modeloRespaldo: null,
      timeoutMs: 2_000,
    }
    for (const modalidad of ['audio', 'pdf', 'compras'] as const) {
      await invocarIa({
        modalidad,
        partes: [{ text: '12 tubos' }],
        schema: SCHEMA,
        deps,
        interruptores: AMBOS_ABIERTOS,
        nombresDeClientes: [],
      })
    }
    expect(urls).toHaveLength(3)
    expect(urls.every((url) => url.includes('generativelanguage.googleapis.com'))).toBe(
      true,
    )
    expect(urls.some((url) => url.includes('openrouter.ai'))).toBe(false)
  })

  it.each([429, 402] as const)(
    'ante HTTP %s de OpenRouter llama a Gemini y lo registra sin el prompt',
    async (status) => {
      process.env.OPENROUTER_API_KEY = 'clave-de-prueba'
      const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
        void init
        if (String(url).includes('openrouter.ai')) {
          return respuestaOpenRouter({}, status)
        }
        return respuestaGemini({ ok: true, origen: 'gemini' })
      })
      const json = await invocarIa({
        modalidad: 'texto',
        partes: [{ text: 'pedido de Juan Pérez, 12 codo' }],
        schema: {
          type: 'OBJECT',
          properties: {
            ok: { type: 'BOOLEAN' },
            origen: { type: 'STRING' },
          },
          required: ['ok'],
        },
        deps: {
          fetchFn: fetchFn as unknown as typeof fetch,
          clavePrimaria: 'k-gemini',
          modeloRespaldo: null,
          timeoutMs: 2_000,
        },
        interruptores: INTERRUPTORES_POR_DEFECTO,
        nombresDeClientes: ['Juan Pérez'],
      })
      expect(json).toMatchObject({ ok: true, origen: 'gemini' })
      expect(fetchFn).toHaveBeenCalledTimes(2)
      const aviso = avisos.mock.calls.find(
        (llamada) => llamada[0] === '[SuitPay] ia: respaldo gemini',
      )
      expect(aviso?.[1]).toEqual({
        motivo: String(status),
        modelo: MODELO_OPENROUTER_TEXTO_POR_DEFECTO,
      })
      expect(JSON.stringify(aviso?.[1])).not.toContain('Juan')
      const init = fetchFn.mock.calls[0]?.[1]
      const cuerpo = JSON.parse(String(init?.body)) as unknown
      expect(JSON.stringify(cuerpo)).not.toContain('Juan')
      expect(JSON.stringify(cuerpo)).toContain('12 codo')
      expect(payloadContieneDatosDeCliente(cuerpo)).toBe(false)
      const respaldo = JSON.parse(
        String(fetchFn.mock.calls[1]?.[1]?.body),
      ) as unknown
      expect(JSON.stringify(respaldo)).not.toContain('Juan')
      expect(JSON.stringify(respaldo)).toContain('12 codo')
    },
  )

  it('un JSON que no cumple el schema también cae a Gemini', async () => {
    process.env.OPENROUTER_API_KEY = 'clave-de-prueba'
    const fetchFn = vi.fn(async (url: string) => {
      if (String(url).includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ ok: 'si' }) } }],
          }),
          { status: 200 },
        )
      }
      return respuestaGemini({ ok: true })
    })
    const json = await invocarIa({
      modalidad: 'texto',
      partes: [{ text: '3 tubos TUB-PVC-12' }],
      schema: SCHEMA,
      deps: {
        fetchFn: fetchFn as unknown as typeof fetch,
        clavePrimaria: 'k-gemini',
        modeloRespaldo: null,
        timeoutMs: 2_000,
      },
      interruptores: INTERRUPTORES_POR_DEFECTO,
      nombresDeClientes: [],
    })
    expect(json).toEqual({ ok: true })
    expect(fetchFn.mock.calls.map((c) => String(c[0]))[1]).toContain(
      'generativelanguage.googleapis.com',
    )
    expect(avisos).toHaveBeenCalledWith('[SuitPay] ia: respaldo gemini', {
      motivo: 'json_invalido',
      modelo: MODELO_OPENROUTER_TEXTO_POR_DEFECTO,
    })
  })
})
